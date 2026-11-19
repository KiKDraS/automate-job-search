/**
 * Retry policy for scheduled runs.
 *
 * A model/provider connection reset can kill a run after minutes of work. One
 * retry is safe when the failed attempt did not submit an application and
 * enough of the runtime budget remains.
 */
import { promises as fs } from "node:fs"
import path from "node:path"

const TRANSPORT_MARKERS = [
  "econnreset",
  "socket connection was closed unexpectedly",
  "etimedout",
  "econnrefused",
  "eai_again",
  "enotfound",
  "fetch failed",
  "network error",
]

/** True when the failure looks like a dropped model/provider connection. */
export function isTransportFailure(stderr: string, error?: Error): boolean {
  const text = `${stderr}\n${error?.message ?? ""}`.toLowerCase()
  return TRANSPORT_MARKERS.some((marker) => text.includes(marker))
}

export interface RetryDecision {
  status: number | null
  elapsedMs: number
  maxRuntimeMinutes: number
  applicationsWritten: boolean
}

/** A retry needs a failed attempt, no submission, and half the budget left. */
export function canRetryRun(decision: RetryDecision): boolean {
  if (decision.status === 0) return false
  if (decision.applicationsWritten) return false
  const budgetMs = decision.maxRuntimeMinutes * 60_000
  return decision.elapsedMs < budgetMs / 2
}

/**
 * True when `applications.md` or any `jobs/<folder>/applied.md` was written
 * after `since`. A retry must never follow a confirmed submission.
 */
export async function applicationsWrittenSince(
  dataDir: string,
  since: number,
): Promise<boolean> {
  const files = [path.join(dataDir, "applications.md")]
  const jobsDir = path.join(dataDir, "jobs")
  const entries = await fs.readdir(jobsDir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.isDirectory()) files.push(path.join(jobsDir, entry.name, "applied.md"))
  }
  for (const file of files) {
    const stat = await fs.stat(file).catch(() => null)
    if (stat !== null && stat.mtimeMs >= since) return true
  }
  return false
}
