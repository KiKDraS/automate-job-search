/**
 * Job decisions — persisted "do not apply" markers written by report actions.
 *
 * The backlog and the apply flow skip folders listed here. The user can undo
 * a decision with `scripts/job-decisions.ts unskip`.
 */
import { promises as fs } from "node:fs"
import path from "node:path"

export const SKIPPED_JOBS_FILE = path.join("state", "skipped-jobs.json")

export interface SkippedJob {
  reason: string
  updatedAt: string
}

export interface JobDecisions {
  schema: 1
  jobs: Record<string, SkippedJob>
}

export function emptyJobDecisions(): JobDecisions {
  return { schema: 1, jobs: {} }
}

export function parseJobDecisions(source: string): JobDecisions | null {
  try {
    const parsed = JSON.parse(source) as { schema?: unknown; jobs?: unknown }
    if (parsed.schema !== 1 || typeof parsed.jobs !== "object" || parsed.jobs === null) {
      return null
    }
    const jobs: Record<string, SkippedJob> = {}
    for (const [folder, value] of Object.entries(parsed.jobs)) {
      if (typeof value !== "object" || value === null) continue
      const entry = value as Record<string, unknown>
      if (typeof entry["reason"] !== "string" || typeof entry["updatedAt"] !== "string") {
        continue
      }
      const normalized = normalizeFolder(folder)
      if (normalized === "") continue
      jobs[normalized] = { reason: entry["reason"], updatedAt: entry["updatedAt"] }
    }
    return { schema: 1, jobs }
  } catch {
    return null
  }
}

export function formatJobDecisions(decisions: JobDecisions): string {
  return `${JSON.stringify(decisions, null, 2)}\n`
}

export function normalizeFolder(folder: string): string {
  return folder.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\/+$/, "").trim()
}

export async function readJobDecisions(dataDir: string): Promise<JobDecisions> {
  const source = await fs
    .readFile(path.join(dataDir, SKIPPED_JOBS_FILE), "utf8")
    .catch(() => null)
  if (source === null) return emptyJobDecisions()
  return parseJobDecisions(source) ?? emptyJobDecisions()
}

async function writeJobDecisions(
  dataDir: string,
  decisions: JobDecisions,
): Promise<void> {
  const target = path.join(dataDir, SKIPPED_JOBS_FILE)
  await fs.mkdir(path.dirname(target), { recursive: true })
  const temporary = `${target}.${process.pid}.tmp`
  await fs.writeFile(temporary, formatJobDecisions(decisions))
  await fs.rename(temporary, target)
}

export async function skipJob(
  dataDir: string,
  folder: string,
  reason: string,
  now: string = new Date().toISOString(),
): Promise<JobDecisions> {
  const key = normalizeFolder(folder)
  if (key === "") throw new Error("folder is required")
  const decisions = await readJobDecisions(dataDir)
  decisions.jobs[key] = { reason: reason.trim() || "skipped", updatedAt: now }
  await writeJobDecisions(dataDir, decisions)
  return decisions
}

export async function unskipJob(
  dataDir: string,
  folder: string,
): Promise<JobDecisions> {
  const key = normalizeFolder(folder)
  const decisions = await readJobDecisions(dataDir)
  delete decisions.jobs[key]
  await writeJobDecisions(dataDir, decisions)
  return decisions
}

export function isJobSkipped(decisions: JobDecisions, folder: string): boolean {
  return decisions.jobs[normalizeFolder(folder)] !== undefined
}
