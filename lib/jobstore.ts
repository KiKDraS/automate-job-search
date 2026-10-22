/**
 * Job history and per-job folders in the data directory.
 *
 * History format (append-only — see `.opencode/docs/data-directory.md`):
 *
 *   ## [YYYY-MM-DD] - Search: "terms"
 *
 *   | Job Title | Company | Location | Salary | Fit | Notes |
 *   | --- | --- | --- | --- | --- | --- |
 *   | ... |
 *
 * Duplicate detection uses the same company + title + location rule as
 * `.opencode/docs/fit-scoring.md`.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { dataPath } from "./data-dir.ts"

export type FitVerdict = "High" | "Medium" | "Low"

export interface HistoryRecord {
  title: string
  company: string
  location: string
  salary: string
  fit: FitVerdict
  notes: string
}

export interface HistorySection {
  date: string
  terms: string
  records: HistoryRecord[]
}

/** Local (not UTC) date as YYYY-MM-DD. */
export function todayIso(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Filesystem-safe slug; never empty. Truncates on a word boundary. */
export function slugify(value: string, maxLength = 40): string {
  const normalized = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  let slug = normalized.slice(0, maxLength)
  // If the cut lands inside a word, drop the partial word instead of
  // ending with a fragment like "...-flutt".
  if (normalized.length > maxLength && /[a-z0-9]/.test(normalized.charAt(maxLength))) {
    slug = slug.replace(/-[a-z0-9]+$/, "")
  }
  slug = slug.replace(/-+$/g, "")
  return slug || "untitled"
}

/** Case- and punctuation-insensitive identity for duplicate detection. */
export function duplicateKey(
  record: Pick<HistoryRecord, "title" | "company" | "location">,
): string {
  return [record.company, record.title, record.location]
    .map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
    .join("|")
}

export function jobFolderName(company: string, role: string, date: string): string {
  return `${slugify(company)}-${slugify(role)}-${date}`
}

export function jobFolderPath(company: string, role: string, date: string): string {
  return dataPath("jobs", jobFolderName(company, role, date))
}

/** Create (if needed) and return the folder for one job. */
export async function ensureJobFolder(
  company: string,
  role: string,
  date: string,
): Promise<string> {
  const dir = jobFolderPath(company, role, date)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

function sanitizeCell(value: string): string {
  return value
    .replace(/[|\r\n]+/g, " / ")
    .replace(/\s+/g, " ")
    .trim()
}

export function formatHistorySection(
  date: string,
  terms: string,
  records: HistoryRecord[],
): string {
  const safeTerms = sanitizeCell(terms).replaceAll('"', "'")
  const lines = [
    `## [${date}] - Search: "${safeTerms}"`,
    "",
    "| Job Title | Company | Location | Salary | Fit | Notes |",
    "| --- | --- | --- | --- | --- | --- |",
  ]
  for (const record of records) {
    lines.push(
      `| ${sanitizeCell(record.title)} | ${sanitizeCell(record.company)} | ${sanitizeCell(
        record.location,
      )} | ${sanitizeCell(record.salary)} | ${record.fit} | ${sanitizeCell(record.notes)} |`,
    )
  }
  return `${lines.join("\n")}\n`
}

const SECTION_PATTERN = /^## \[(\d{4}-\d{2}-\d{2})\] - Search: "(.*)"$/
const ROW_PATTERN =
  /^\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$/

/** Parse job-history.md. Missing file means empty history. */
export async function readHistory(): Promise<HistorySection[]> {
  let source: string
  try {
    source = await fs.readFile(dataPath("job-history.md"), "utf8")
  } catch {
    return []
  }
  const sections: HistorySection[] = []
  let current: HistorySection | null = null
  for (const line of source.split(/\r?\n/)) {
    const sectionMatch = line.match(SECTION_PATTERN)
    if (sectionMatch) {
      current = { date: sectionMatch[1] ?? "", terms: sectionMatch[2] ?? "", records: [] }
      sections.push(current)
      continue
    }
    const rowMatch = line.match(ROW_PATTERN)
    if (rowMatch && current) {
      const [, title = "", company = "", location = "", salary = "", fit = "", notes = ""] =
        rowMatch
      if (title === "Job Title" || title.startsWith("---")) continue
      if (title === "" && company === "") continue
      const verdict: FitVerdict = fit === "High" || fit === "Medium" ? fit : "Low"
      current.records.push({ title, company, location, salary, fit: verdict, notes })
    }
  }
  return sections
}

/** All duplicate keys already present in history. */
export async function seenJobKeys(): Promise<Set<string>> {
  const keys = new Set<string>()
  for (const section of await readHistory()) {
    for (const record of section.records) keys.add(duplicateKey(record))
  }
  return keys
}

/**
 * Remove candidates already seen — present in history or repeated earlier in
 * the same batch. Order is preserved.
 */
export function filterNew<T extends Pick<HistoryRecord, "title" | "company" | "location">>(
  candidates: readonly T[],
  seen: ReadonlySet<string>,
): T[] {
  const batch = new Set<string>()
  const out: T[] = []
  for (const candidate of candidates) {
    const key = duplicateKey(candidate)
    if (seen.has(key) || batch.has(key)) continue
    batch.add(key)
    out.push(candidate)
  }
  return out
}

export interface AppendHistoryResult {
  appended: number
  skipped: number
}

/**
 * Append one search section, dropping duplicates already in history or
 * repeated within the section. Returns how many rows were written and
 * skipped.
 */
export async function appendHistory(
  date: string,
  terms: string,
  records: HistoryRecord[],
): Promise<AppendHistoryResult> {
  if (records.length === 0) return { appended: 0, skipped: 0 }
  const fresh = filterNew(records, await seenJobKeys())
  const skipped = records.length - fresh.length
  if (fresh.length === 0) return { appended: 0, skipped }
  const file = dataPath("job-history.md")
  await fs.mkdir(path.dirname(file), { recursive: true })
  let existing = ""
  try {
    existing = await fs.readFile(file, "utf8")
  } catch {
    // first entry
  }
  const separator =
    existing.length === 0 ? "" : existing.endsWith("\n\n") ? "" : existing.endsWith("\n") ? "\n" : "\n\n"
  await fs.appendFile(file, `${separator}${formatHistorySection(date, terms, fresh)}`)
  return { appended: fresh.length, skipped }
}
