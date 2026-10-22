/**
 * applied.md — the per-job record of a submitted application.
 *
 * Written only after LinkedIn confirms the submission. Records the exact
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
    "- Method: LinkedIn Easy Apply",
    "- Status: submitted",
    `- Confirmation: "${oneLine(entry.confirmation)}"`,
    `- Resume: ${oneLine(entry.resume)}`,
    `- Cover letter: ${oneLine(entry.coverLetter ?? "not requested")}`,
  ]
  const fields = entry.fields ?? []
  if (fields.length > 0) {
    lines.push("", "## Answers sent", "")
    for (const field of fields) {
      lines.push(`- ${oneLine(field.label)}: ${oneLine(field.value) || "—"}`)
    }
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
    resume: record["resume"] as string,
    confirmation: record["confirmation"] as string,
    coverLetter: typeof record["coverLetter"] === "string" ? record["coverLetter"] : undefined,
    fields,
  }
}
