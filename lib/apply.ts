/**
 * applied.md — the per-job record of a submitted application.
 *
 * Written only after the ATS confirms the submission. Records the exact
 * values sent, so the user can see what an employer received.
 */
import { todayIso } from "./jobstore.ts"

export interface AppliedField {
  label: string
  value: string
}

export interface AppliedEntry {
  role: string
  company: string
  url: string
  method?: string
  fit?: string
  source?: string
  status?: string
  note?: string
  date?: string
  resume: string
  coverLetter?: string
  confirmation: string
  fields?: AppliedField[]
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

export function formatAppliedMarkdown(entry: AppliedEntry, date = todayIso()): string {
  const lines = [
    `# Application — ${oneLine(entry.role)} at ${oneLine(entry.company)}`,
    "",
    `- Date: ${date}`,
    `- Job URL: ${oneLine(entry.url)}`,
    `- Method: ${oneLine(entry.method ?? "LinkedIn Easy Apply")}`,
    `- Fit: ${oneLine(entry.fit ?? "not recorded")}`,
    `- Source: ${oneLine(entry.source ?? "agent")}`,
    `- Status: ${oneLine(entry.status ?? "submitted")}`,
    `- Confirmation: "${oneLine(entry.confirmation)}"`,
    `- Resume: ${oneLine(entry.resume)}`,
    `- Cover letter: ${oneLine(entry.coverLetter ?? "not requested")}`,
  ]
  if (entry.note !== undefined && entry.note.trim() !== "") {
    lines.push(`- Note: ${oneLine(entry.note)}`)
  }
  const fields = entry.fields ?? []
  if (fields.length > 0) {
    lines.push("", "## Answers sent", "")
    for (const field of fields) {
      lines.push(`- ${oneLine(field.label)}: ${oneLine(field.value) || "—"}`)
    }
  }
  return `${lines.join("\n")}\n`
}

export const APPLICATIONS_INDEX_HEADER = `# Applications

| Date | Company | Role | Fit | Method | Status | Confirmation | Job URL | Folder |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
`

/** One row for <data dir>/applications.md, the consolidated review log. */
export function formatApplicationIndexRow(
  entry: AppliedEntry,
  folder: string,
  date = todayIso(),
): string {
  const cell = (value: string): string => oneLine(value).replace(/\|/g, "\\|")
  return `| ${date} | ${cell(entry.company)} | ${cell(entry.role)} | ${cell(entry.fit ?? "not recorded")} | ${cell(entry.method ?? "LinkedIn Easy Apply")} | ${cell(entry.status ?? "submitted")} | ${cell(entry.confirmation)} | ${cell(entry.url)} | ${cell(folder)} |\n`
}

/** Append a new row, or replace the existing row for the same job folder. */
export function upsertApplicationIndexRow(
  existing: string,
  row: string,
  folder: string,
): string {
  const lines = existing.replace(/\n$/, "").split("\n")
  const needle = `| ${folder} |`
  const index = lines.findIndex((line) => line.endsWith(needle))
  if (index >= 0) {
    lines[index] = row.trimEnd()
  } else {
    lines.push(row.trimEnd())
  }
  return `${lines.join("\n")}\n`
}

/** Parse the JSON handoff written by the apply skill; null when invalid. */
export function parseAppliedEntry(source: string): AppliedEntry | null {
  let data: unknown
  try {
    data = JSON.parse(source)
  } catch {
    return null
  }
  if (typeof data !== "object" || data === null) return null
  const record = data as Record<string, unknown>
  for (const key of ["role", "company", "url", "resume", "confirmation"]) {
    const value = record[key]
    if (typeof value !== "string" || value.trim() === "") return null
  }
  const fields: AppliedField[] = Array.isArray(record["fields"])
    ? (record["fields"] as unknown[])
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .filter((item) => typeof item["label"] === "string" && typeof item["value"] === "string")
        .map((item) => ({ label: item["label"] as string, value: item["value"] as string }))
    : []
  return {
    role: record["role"] as string,
    company: record["company"] as string,
    url: record["url"] as string,
    method: typeof record["method"] === "string" ? record["method"] : undefined,
    fit: typeof record["fit"] === "string" ? record["fit"] : undefined,
    source: typeof record["source"] === "string" ? record["source"] : undefined,
    status: typeof record["status"] === "string" ? record["status"] : undefined,
    note: typeof record["note"] === "string" ? record["note"] : undefined,
    date: typeof record["date"] === "string" ? record["date"] : undefined,
    resume: record["resume"] as string,
    confirmation: record["confirmation"] as string,
    coverLetter: typeof record["coverLetter"] === "string" ? record["coverLetter"] : undefined,
    fields,
  }
}
