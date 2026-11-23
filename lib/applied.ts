/**
 * Applied index — the canonical "do not apply again" list.
 *
 * Reads `applications.md` (written by the apply flow and manual logs) and
 * exposes URL and company+role lookups. The job search, backlog, and apply
 * skills use it so a manual submission without `applied.md` cannot be retried.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { normalizeJobUrl, normalizeUrl } from "./linkedin-url.ts"
import { slugify } from "./jobstore.ts"

export const APPLICATIONS_FILE = "applications.md"

export interface AppliedRow {
  date: string
  company: string
  role: string
  status: string
  url: string
  folder: string
}

export interface AppliedIndex {
  rows: AppliedRow[]
  urls: Map<string, AppliedRow>
  companyRoles: Map<string, AppliedRow>
}

export interface AppliedCandidate {
  url?: string
  company?: string
  role?: string
  /** Relative or absolute job folder (`jobs/<folder>`). */
  folder?: string
}

/** Lowercase, strip accents and punctuation, collapse spaces. */
export function normalizeKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function companyRoleKey(company: string, role: string): string {
  return `${normalizeKey(company)}::${normalizeKey(role)}`
}

export interface PostingMeta {
  company?: string
  role?: string
}

/** Read the role and company from a saved `posting.md`. */
export function parsePostingMeta(source: string): PostingMeta {
  const field = (label: string): string | undefined =>
    source.match(new RegExp(`^- ${label}:\\s*(.+?)\\s*$`, "m"))?.[1]?.trim()
  const heading = source.match(/^# Posting — (.+) at (.+?)\s*$/m)
  return {
    company: field("Company") ?? heading?.[2]?.trim(),
    role: field("Role") ?? heading?.[1]?.trim(),
  }
}

export function normalizeAppliedUrl(url: string): string | null {
  const trimmed = url.trim()
  if (trimmed === "" || trimmed === "not available") return null
  return normalizeJobUrl(trimmed) ?? normalizeUrl(trimmed)
}

/** Split a Markdown table row on unescaped pipes. */
function splitRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "")
  const cells: string[] = []
  let current = ""
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index] ?? ""
    if (char === "\\" && inner[index + 1] === "|") {
      current += "|"
      index += 1
      continue
    }
    if (char === "|") {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
}

export async function readAppliedIndex(dataDir: string): Promise<AppliedIndex> {
  const source = await fs
    .readFile(path.join(dataDir, APPLICATIONS_FILE), "utf8")
    .catch(() => "")
  const rows: AppliedRow[] = []
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue
    const cells = splitRow(line)
    if (cells.length < 9) continue
    if (cells[0] === "Date" || cells[0]?.includes("---")) continue
    const [date = "", company = "", role = "", , , status = "", , url = "", folder = ""] =
      cells
    if (date === "" || company === "" || role === "") continue
    rows.push({ date, company, role, status, url, folder })
  }
  const urls = new Map<string, AppliedRow>()
  const companyRoles = new Map<string, AppliedRow>()
  for (const row of rows) {
    const normalized = normalizeAppliedUrl(row.url)
    if (normalized !== null) urls.set(normalized, row)
    companyRoles.set(companyRoleKey(row.company, row.role), row)
  }
  return { rows, urls, companyRoles }
}

function matchesFolder(row: AppliedRow, folder: string): boolean {
  const wanted = folder.replaceAll("\\", "/").replace(/^\/+/, "")
  const stored = row.folder.replaceAll("\\", "/").replace(/^\/+/, "")
  return (
    stored === wanted ||
    stored.endsWith(`/${wanted}`) ||
    wanted.endsWith(`/${stored}`)
  )
}

/** The matching applied row, or null when the job is new. */
export function isApplied(
  index: AppliedIndex,
  candidate: AppliedCandidate,
): AppliedRow | null {
  if (candidate.folder !== undefined && candidate.folder !== "") {
    const row = index.rows.find((item) => matchesFolder(item, candidate.folder as string))
    if (row !== undefined) return row
  }
  if (candidate.url !== undefined && candidate.url !== "") {
    const normalized = normalizeAppliedUrl(candidate.url)
    if (normalized !== null) {
      const row = index.urls.get(normalized)
      if (row !== undefined) return row
    }
  }
  if (
    candidate.company !== undefined &&
    candidate.company !== "" &&
    candidate.role !== undefined &&
    candidate.role !== ""
  ) {
    const row = index.companyRoles.get(companyRoleKey(candidate.company, candidate.role))
    if (row !== undefined) return row
  }
  return null
}

/** Companies the user asked to exclude, from `preferences.md`. */
export async function readExcludedCompanies(dataDir: string): Promise<string[]> {
  const source = await fs
    .readFile(path.join(dataDir, "preferences.md"), "utf8")
    .catch(() => "")
  return source
    .split(/\r?\n/)
    .filter((line) => /^-\s*Excluded companies:/i.test(line))
    .flatMap((line) =>
      line.replace(/^-\s*Excluded companies:\s*/i, "").split(/[,;]/),
    )
    .map((value) => value.trim())
    .filter((value) => value !== "")
}

/** Job folders without `applied.md` and without an `applications.md` row. */
export async function listBacklogFolders(dataDir: string): Promise<string[]> {
  const index = await readAppliedIndex(dataDir)
  const excluded = new Set(
    (await readExcludedCompanies(dataDir))
      .map((company) => slugify(company))
      .filter((company) => company !== "untitled"),
  )
  const jobsDir = path.join(dataDir, "jobs")
  const entries = await fs.readdir(jobsDir, { withFileTypes: true }).catch(() => [])
  const folders: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (
      [...excluded].some(
        (company) => entry.name === company || entry.name.startsWith(`${company}-`),
      )
    ) {
      continue
    }
    const folder = path.join(jobsDir, entry.name)
    const postingSource = await fs
      .readFile(path.join(folder, "posting.md"), "utf8")
      .catch(() => null)
    if (postingSource === null) continue
    const hasApplied = await fs
      .stat(path.join(folder, "applied.md"))
      .then((stat) => stat.isFile(), () => false)
    if (hasApplied) continue
    const relative = `jobs/${entry.name}`
    if (isApplied(index, { folder: relative }) !== null) continue
    const meta = parsePostingMeta(postingSource)
    if (
      meta.company !== undefined &&
      meta.role !== undefined &&
      isApplied(index, { company: meta.company, role: meta.role }) !== null
    ) {
      continue
    }
    folders.push(folder)
  }
  return folders.sort()
}
