#!/usr/bin/env node
/**
 * linkedin — deterministic LinkedIn URL helpers (wraps lib/linkedin-url.ts).
 *
 * Usage:
 *   npx tsx scripts/linkedin.ts search-url --keywords "<terms>" [--location "<place>"]
 *     [--posted 24h|48h|week|month] [--mode on-site|remote|hybrid]
 *     [--level internship|entry|associate|mid-senior|director|executive]
 *     [--easy-apply] [--recent]
 *   npx tsx scripts/linkedin.ts job-id <url>
 *   npx tsx scripts/linkedin.ts normalize-job <url>
 */
import {
  buildJobSearchUrl,
  jobIdFromUrl,
  normalizeJobUrl,
  type ExperienceLevel,
  type JobSearchParams,
  type PostedWithin,
  type WorkMode,
} from "../lib/linkedin-url.ts"
import { fail, valueAfter } from "./args.ts"

const SCRIPT = "linkedin"

const POSTED: readonly string[] = ["24h", "48h", "week", "month"]
const MODES: readonly string[] = ["on-site", "remote", "hybrid"]
const LEVELS: readonly string[] = [
  "internship",
  "entry",
  "associate",
  "mid-senior",
  "director",
  "executive",
]

function searchUrl(args: string[]): void {
  const params: JobSearchParams = { keywords: "" }
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]
    if (flag === undefined) break
    switch (flag) {
      case "--keywords":
        params.keywords = valueAfter(SCRIPT, args, i, flag)
        i++
        break
      case "--location":
        params.location = valueAfter(SCRIPT, args, i, flag)
        i++
        break
      case "--posted": {
        const value = valueAfter(SCRIPT, args, i, flag)
        if (!POSTED.includes(value)) return fail(SCRIPT, `invalid --posted: ${value} (${POSTED.join("|")})`)
        params.postedWithin = value as PostedWithin
        i++
        break
      }
      case "--mode": {
        const value = valueAfter(SCRIPT, args, i, flag)
        if (!MODES.includes(value)) return fail(SCRIPT, `invalid --mode: ${value} (${MODES.join("|")})`)
        params.workMode = value as WorkMode
        i++
        break
      }
      case "--level": {
        const value = valueAfter(SCRIPT, args, i, flag)
        if (!LEVELS.includes(value)) return fail(SCRIPT, `invalid --level: ${value} (${LEVELS.join("|")})`)
        params.experience = value as ExperienceLevel
        i++
        break
      }
      case "--easy-apply":
        params.easyApplyOnly = true
        break
      case "--recent":
        params.sortRecent = true
        break
      default:
        return fail(SCRIPT, `unknown flag: ${flag}`)
    }
  }
  if (params.keywords.trim() === "") {
    return fail(SCRIPT, "--keywords is required")
  }
  console.log(buildJobSearchUrl(params))
}

function main(): void {
  const [command, ...args] = process.argv.slice(2)
  if (command === "search-url") {
    searchUrl(args)
    return
  }
  if (command === "job-id" || command === "normalize-job") {
    const url = args[0]
    if (url === undefined) return fail(SCRIPT, `usage: ${command} <url>`)
    if (command === "job-id") {
      const id = jobIdFromUrl(url)
      if (id === null) return fail(SCRIPT, "not a LinkedIn job URL")
      console.log(id)
      return
    }
    const normalized = normalizeJobUrl(url)
    if (normalized === null) return fail(SCRIPT, "not a LinkedIn job URL")
    console.log(normalized)
    return
  }
  return fail(SCRIPT, "usage: search-url | job-id <url> | normalize-job <url>")
}

main()
