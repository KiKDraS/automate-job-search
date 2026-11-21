/**
 * Retention cleanup — delete old application folders and feed leads.
 *
 * Jobs: a `jobs/<folder>/` with an `applied.md` whose status starts with
 * `submitted` is removed once the application date is `days` old or older.
 * Feed leads: a dated `feed/<date>-…​.md` is removed once its date is `days`
 * old; its `-email.md` sibling goes with it. `applications.md` and
 * `job-history.md` are never touched. Folders and files listed in
 * `state/pending-search.json` are skipped.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import {
  APPLICATIONS_INDEX_HEADER,
  formatApplicationIndexRow,
  parseAppliedMarkdown,
  upsertApplicationIndexRow,
  type AppliedMarkdown,
} from "./apply.ts"
import { PENDING_FILE, parsePendingState } from "./automation.ts"
import { todayIso } from "./jobstore.ts"

const DAY_MS = 86_400_000
const FEED_DATE = /^(\d{4}-\d{2}-\d{2})-/

export interface CleanupOptions {
  /** Retention window in days. Default 30. */
  days?: number
  now?: Date
  /** Delete candidates. Default false (dry run). */
  apply?: boolean
}

export type CleanupKind = "job" | "feed"

export interface CleanupCandidate {
  kind: CleanupKind
  /** Path relative to the data directory. */
  path: string
  /** Application date (jobs) or lead date (feed). */
  date: string
  ageDays: number
  status?: string
  /** Extra feed files deleted with the lead (its email draft). */
  siblings?: string[]
}

export interface CleanupSkip {
  path: string
  reason: string
}

export interface CleanupResult {
  candidates: CleanupCandidate[]
  deleted: CleanupCandidate[]
  backfilled: string[]
  skipped: CleanupSkip[]
  failed: CleanupSkip[]
}

function ageInDays(date: string, now: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const parsed = Date.parse(`${date}T00:00:00`)
  const today = Date.parse(`${todayIso(now)}T00:00:00`)
  if (!Number.isFinite(parsed) || !Number.isFinite(today)) return null
  return Math.floor((today - parsed) / DAY_MS)
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child)
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
}

async function readPendingPaths(dataDir: string): Promise<Set<string>> {
  try {
    const state = parsePendingState(
      await fs.readFile(path.join(dataDir, PENDING_FILE), "utf8"),
    )
    return new Set(
      (state?.items ?? [])
        .map((item) => item.jobFolder?.replaceAll("\\", "/"))
        .filter((item): item is string => typeof item === "string" && item !== ""),
    )
  } catch {
    return new Set()
  }
}

async function findExpiredJobs(
  dataDir: string,
  days: number,
  now: Date,
  pending: Set<string>,
): Promise<{ candidates: CleanupCandidate[]; skipped: CleanupSkip[] }> {
  const jobsDir = path.join(dataDir, "jobs")
  const candidates: CleanupCandidate[] = []
  const skipped: CleanupSkip[] = []
  const entries = await fs.readdir(jobsDir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const relative = `jobs/${entry.name}`
    if (entry.isSymbolicLink()) {
      skipped.push({ path: relative, reason: "symlink" })
      continue
    }
    if (!entry.isDirectory()) continue
    const source = await fs
      .readFile(path.join(jobsDir, entry.name, "applied.md"), "utf8")
      .catch(() => null)
    if (source === null) continue
    const record = parseAppliedMarkdown(source)
    if (record === null) {
      skipped.push({ path: relative, reason: "applied.md without date or status" })
      continue
    }
    if (!record.status.toLowerCase().startsWith("submitted")) {
      skipped.push({ path: relative, reason: `status ${record.status}` })
      continue
    }
    const age = ageInDays(record.date, now)
    if (age === null) {
      skipped.push({ path: relative, reason: "invalid date" })
      continue
    }
    if (age < days) continue
    if (pending.has(relative)) {
      skipped.push({ path: relative, reason: "pending" })
      continue
    }
    candidates.push({
      kind: "job",
      path: relative,
      date: record.date,
      ageDays: age,
      status: record.status,
    })
  }
  return { candidates, skipped }
}

async function findExpiredFeed(
  dataDir: string,
  days: number,
  now: Date,
  pending: Set<string>,
): Promise<{ candidates: CleanupCandidate[]; skipped: CleanupSkip[] }> {
  const feedDir = path.join(dataDir, "feed")
  const candidates: CleanupCandidate[] = []
  const skipped: CleanupSkip[] = []
  const entries = await fs.readdir(feedDir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      skipped.push({ path: `feed/${entry.name}`, reason: "symlink" })
      continue
    }
    if (!entry.isFile()) continue
    if (entry.name.endsWith("-email.md")) continue
    const match = entry.name.match(FEED_DATE)
    if (match === null) {
      skipped.push({ path: `feed/${entry.name}`, reason: "no date in filename" })
      continue
    }
    const relative = `feed/${entry.name}`
    const source = await fs
      .readFile(path.join(feedDir, entry.name), "utf8")
      .catch(() => "")
    const date = source.match(/^- Date:\s*(\d{4}-\d{2}-\d{2})\s*$/m)?.[1] ?? match[1] ?? ""
    const age = ageInDays(date, now)
    if (age === null) {
      skipped.push({ path: relative, reason: "invalid date" })
      continue
    }
    if (age < days) continue
    const emailName = entry.name.replace(/\.md$/, "-email.md")
    const emailExists = await fs
      .stat(path.join(feedDir, emailName))
      .then((stat) => stat.isFile(), () => false)
    const siblings = emailExists ? [`feed/${emailName}`] : []
    if (pending.has(relative) || siblings.some((sibling) => pending.has(sibling))) {
      skipped.push({ path: relative, reason: "pending" })
      continue
    }
    candidates.push({
      kind: "feed",
      path: relative,
      date,
      ageDays: age,
      siblings,
    })
  }
  return { candidates, skipped }
}

async function ensureApplicationIndexed(
  dataDir: string,
  relativeFolder: string,
  record: AppliedMarkdown,
): Promise<"existing" | "created" | "missing"> {
  const index = path.join(dataDir, "applications.md")
  let existing = ""
  try {
    existing = await fs.readFile(index, "utf8")
  } catch {
    existing = ""
  }
  if (existing.split(/\r?\n/).some((line) => line.endsWith(`| ${relativeFolder} |`))) {
    return "existing"
  }
  if (
    record.role === undefined ||
    record.company === undefined ||
    record.url === undefined ||
    record.confirmation === undefined
  ) {
    return "missing"
  }
  const entry = {
    role: record.role,
    company: record.company,
    url: record.url,
    method: record.method,
    fit: record.fit,
    status: record.status,
    confirmation: record.confirmation,
    resume: record.resume ?? "resume.pdf",
  }
  const row = formatApplicationIndexRow(entry, relativeFolder, record.date)
  if (existing === "") {
    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(index, APPLICATIONS_INDEX_HEADER)
    existing = APPLICATIONS_INDEX_HEADER
  }
  await fs.writeFile(index, upsertApplicationIndexRow(existing, row, relativeFolder))
  return "created"
}

/** Find, and optionally delete, expired application folders and feed leads. */
export async function cleanupExpiredData(
  dataDir: string,
  options: CleanupOptions = {},
): Promise<CleanupResult> {
  const days = options.days ?? 30
  const now = options.now ?? new Date()
  if (!Number.isInteger(days) || days < 1) {
    throw new Error("days must be a positive integer")
  }
  const pending = await readPendingPaths(dataDir)
  const jobs = await findExpiredJobs(dataDir, days, now, pending)
  const feed = await findExpiredFeed(dataDir, days, now, pending)
  const candidates = [...jobs.candidates, ...feed.candidates].sort(
    (a, b) => b.ageDays - a.ageDays,
  )
  const skipped = [...jobs.skipped, ...feed.skipped]
  const deleted: CleanupCandidate[] = []
  const backfilled: string[] = []
  const failed: CleanupSkip[] = []

  if (options.apply === true) {
    for (const candidate of candidates) {
      try {
        const parent = path.resolve(
          dataDir,
          candidate.kind === "job" ? "jobs" : "feed",
        )
        const target = path.resolve(dataDir, candidate.path)
        if (!isInside(target, parent)) {
          throw new Error("outside its data folder")
        }
        if (candidate.kind === "job") {
          const source = await fs.readFile(path.join(target, "applied.md"), "utf8")
          const record = parseAppliedMarkdown(source)
          if (record === null) throw new Error("cannot read applied.md")
          const indexed = await ensureApplicationIndexed(
            dataDir,
            candidate.path,
            record,
          )
          if (indexed === "missing") {
            throw new Error("applications.md row missing and applied.md lacks fields")
          }
          if (indexed === "created") backfilled.push(candidate.path)
          const stat = await fs.lstat(target)
          if (stat.isSymbolicLink()) throw new Error("symlink")
          await fs.rm(target, { recursive: true, force: true })
        } else {
          await fs.rm(target, { force: true })
          for (const sibling of candidate.siblings ?? []) {
            const siblingTarget = path.resolve(dataDir, sibling)
            if (!isInside(siblingTarget, parent)) {
              throw new Error("sibling outside its data folder")
            }
            await fs.rm(siblingTarget, { force: true })
          }
        }
        deleted.push(candidate)
      } catch (error) {
        failed.push({
          path: candidate.path,
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  return { candidates, deleted, backfilled, skipped, failed }
}
