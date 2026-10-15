/**
 * LinkedIn URL construction and normalization.
 *
 * Used by job-scout when building searches and saving postings. Parameter
 * values mirror `.opencode/docs/linkedin-ui-patterns.md`; if LinkedIn changes
 * a filter, update that document and this module together.
 */

export type PostedWithin = "24h" | "week" | "month"
export type WorkMode = "on-site" | "remote" | "hybrid"
export type ExperienceLevel =
  | "internship"
  | "entry"
  | "associate"
  | "mid-senior"
  | "director"
  | "executive"

export interface JobSearchParams {
  keywords: string
  location?: string
  postedWithin?: PostedWithin
  workMode?: WorkMode
  experience?: ExperienceLevel
  easyApplyOnly?: boolean
  sortRecent?: boolean
}

const POSTED_WITHIN: Record<PostedWithin, string> = {
  "24h": "r86400",
  week: "r604800",
  month: "r2592000",
}

const WORK_MODE: Record<WorkMode, string> = {
  "on-site": "1",
  remote: "2",
  hybrid: "3",
}

const EXPERIENCE: Record<ExperienceLevel, string> = {
  internship: "1",
  entry: "2",
  associate: "3",
  "mid-senior": "4",
  director: "5",
  executive: "6",
}

/** Build a LinkedIn Jobs search URL from structured parameters. */
export function buildJobSearchUrl(params: JobSearchParams): string {
  const url = new URL("https://www.linkedin.com/jobs/search/")
  url.searchParams.set("keywords", params.keywords)
  if (params.location) url.searchParams.set("location", params.location)
  if (params.postedWithin) url.searchParams.set("f_TPR", POSTED_WITHIN[params.postedWithin])
  if (params.workMode) url.searchParams.set("f_WT", WORK_MODE[params.workMode])
  if (params.experience) url.searchParams.set("f_E", EXPERIENCE[params.experience])
  if (params.easyApplyOnly) url.searchParams.set("f_AL", "true")
  if (params.sortRecent) url.searchParams.set("sortBy", "DD")
  return url.toString()
}

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "refId",
  "trackingId",
  "trk",
  "trkInfo",
  "originalSubdomain",
  "lipi",
]

function isLinkedInHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === "linkedin.com" || host.endsWith(".linkedin.com")
}

/** Extract the numeric job ID from any LinkedIn job URL form. */
export function jobIdFromUrl(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (!isLinkedInHost(url.hostname)) return null
  const fromPath = url.pathname.match(/\/jobs\/view\/(\d+)/)
  if (fromPath) return fromPath[1] ?? null
  const fromQuery = url.searchParams.get("currentJobId")
  if (fromQuery && /^\d+$/.test(fromQuery)) return fromQuery
  return null
}

/** Canonical form of a LinkedIn job URL, or null when it is not one. */
export function normalizeJobUrl(input: string): string | null {
  const id = jobIdFromUrl(input)
  return id === null ? null : `https://www.linkedin.com/jobs/view/${id}/`
}

/**
 * Normalize a general URL: https only, tracking parameters and fragments
 * removed, remaining query parameters sorted, no trailing slash.
 * Returns null for non-http(s) input.
 */
export function normalizeUrl(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  url.protocol = "https:"
  url.hash = ""
  for (const param of TRACKING_PARAMS) url.searchParams.delete(param)
  url.searchParams.sort()
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1)
  }
  return url.toString()
}
