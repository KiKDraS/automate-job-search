#!/usr/bin/env node
/**
 * history — job history, dedupe and folder helpers (wraps lib/jobstore.ts).
 *
 * Usage:
 *   npx tsx scripts/history.ts filter --file <candidates.json>
 *   npx tsx scripts/history.ts applied [--url <url>] [--company <c>] [--role <r>] [--folder <folder>]
 *   npx tsx scripts/history.ts backlog
 *   npx tsx scripts/history.ts append --file <section.json>
 *   npx tsx scripts/history.ts folder --company "<c>" --role "<r>" [--date YYYY-MM-DD]
 *
 * filter reads a JSON array of candidates (title, company, location + extra
 * fields) and prints the subset not present in job-history.md or already in
 * applications.md. applied reports whether a job is already in the applied
 * index. backlog lists saved job folders that are neither applied nor in the
 * index. append reads { terms, date?, records } and appends a history section.
 * folder creates the job folder and prints its path.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { parseAppliedMarkdown } from "../lib/apply.ts"
import { isApplied, listBacklogFolders, readAppliedIndex } from "../lib/applied.ts"
import { isJobSkipped, readJobDecisions } from "../lib/job-decisions.ts"
import { resolveDataDir } from "../lib/data-dir.ts"
import {
  appendHistory,
  ensureJobFolder,
  filterNew,
  seenJobKeys,
  todayIso,
  type FitVerdict,
  type HistoryRecord,
} from "../lib/jobstore.ts"
import { fail, flagValue } from "./args.ts"

const SCRIPT = "history"

function optionalValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index === -1) return undefined
  const value = args[index + 1]
  if (value === undefined || value.startsWith("--")) {
    return fail(SCRIPT, `missing value for ${flag}`)
  }
  return value
}

interface Candidate {
  title: string
  company: string
  location: string
  [key: string]: unknown
}

async function readJson(file: string): Promise<unknown> {
  let raw: string
  try {
    raw = await fs.readFile(file, "utf8")
  } catch (error) {
    return fail(SCRIPT, `cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`)
  }
  try {
    return JSON.parse(raw)
  } catch (error) {
    return fail(SCRIPT, `invalid JSON in ${file}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function asCandidateList(input: unknown): Candidate[] {
  if (!Array.isArray(input)) return fail(SCRIPT, "candidates file must contain a JSON array")
  return input.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      return fail(SCRIPT, `candidate ${index} is not an object`)
    }
    const record = item as Record<string, unknown>
    const title = record["title"]
    const company = record["company"]
    const location = record["location"]
    if (typeof title !== "string" || typeof company !== "string" || typeof location !== "string") {
      return fail(SCRIPT, `candidate ${index} needs string fields: title, company, location`)
    }
    return { ...record, title, company, location }
  })
}

function asRecords(input: unknown): HistoryRecord[] {
  if (typeof input !== "object" || input === null) return fail(SCRIPT, "section file must be a JSON object")
  const records = (input as Record<string, unknown>)["records"]
  if (!Array.isArray(records)) return fail(SCRIPT, "section file needs a records array")
  return records.map((item, index) => {
    if (typeof item !== "object" || item === null) return fail(SCRIPT, `record ${index} is not an object`)
    const raw = item as Record<string, unknown>
    const text = (key: string): string => (typeof raw[key] === "string" ? (raw[key] as string) : "")
    const fit: FitVerdict = raw["fit"] === "High" || raw["fit"] === "Medium" ? raw["fit"] : "Low"
    return {
      title: text("title"),
      company: text("company"),
      location: text("location"),
      salary: text("salary"),
      fit,
      notes: text("notes"),
    }
  })
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)

  if (command === "filter") {
    const file = flagValue(SCRIPT, args, "--file")
    if (file === undefined) return fail(SCRIPT, "usage: filter --file <candidates.json>")
    const candidates = asCandidateList(await readJson(file))
    const seen = await seenJobKeys()
    const index = await readAppliedIndex(resolveDataDir())
    const fresh = filterNew(candidates, seen).filter((candidate) => {
      const url =
        typeof candidate["url"] === "string"
          ? candidate["url"]
          : typeof candidate["jobUrl"] === "string"
            ? candidate["jobUrl"]
            : undefined
      return (
        isApplied(index, {
          url,
          company: candidate.company,
          role: candidate.title,
        }) === null
      )
    })
    console.log(JSON.stringify(fresh))
    return
  }

  if (command === "applied") {
    const url = optionalValue(args, "--url")
    const company = optionalValue(args, "--company")
    const role = optionalValue(args, "--role")
    const folder = optionalValue(args, "--folder")
    if (url === undefined && folder === undefined && (company === undefined || role === undefined)) {
      return fail(
        SCRIPT,
        "usage: applied --url <url> | --folder <folder> | --company <c> --role <r>",
      )
    }
    const dataDir = resolveDataDir()
    if (folder !== undefined) {
      const folderPath = path.isAbsolute(folder) ? folder : path.join(dataDir, folder)
      const source = await fs.readFile(path.join(folderPath, "applied.md"), "utf8").catch(() => null)
      if (source !== null) {
        const record = parseAppliedMarkdown(source)
        console.log(`already applied: ${record?.date ?? "unknown"} — applied.md`)
        return
      }
    }
    const index = await readAppliedIndex(dataDir)
    const match = isApplied(index, { url, company, role, folder })
    if (match !== null) {
      console.log(`already applied: ${match.date} — ${match.company} — ${match.role}`)
      return
    }
    console.log("new")
    return
  }

  if (command === "backlog") {
    const dataDir = resolveDataDir()
    const folders = await listBacklogFolders(dataDir)
    const decisions = await readJobDecisions(dataDir)
    const open = folders.filter((folder) => !isJobSkipped(decisions, folder))
    if (open.length === 0) {
      console.log("no backlog")
      return
    }
    for (const folder of open) console.log(folder)
    return
  }

  if (command === "append") {
    const file = flagValue(SCRIPT, args, "--file")
    if (file === undefined) return fail(SCRIPT, "usage: append --file <section.json>")
    const input = await readJson(file)
    const records = asRecords(input)
    const terms = typeof (input as Record<string, unknown>)["terms"] === "string"
      ? ((input as Record<string, unknown>)["terms"] as string)
      : ""
    const date = typeof (input as Record<string, unknown>)["date"] === "string"
      ? ((input as Record<string, unknown>)["date"] as string)
      : todayIso()
    const result = await appendHistory(date, terms, records)
    const skipped = result.skipped > 0 ? `, skipped ${result.skipped} duplicate(s)` : ""
    console.log(`appended ${result.appended} record(s) to job-history.md${skipped}`)
    return
  }

  if (command === "folder") {
    const company = flagValue(SCRIPT, args, "--company")
    const role = flagValue(SCRIPT, args, "--role")
    if (company === undefined || role === undefined) {
      return fail(SCRIPT, "usage: folder --company <c> --role <r> [--date YYYY-MM-DD]")
    }
    const date = flagValue(SCRIPT, args, "--date") ?? todayIso()
    const dir = await ensureJobFolder(company, role, date)
    console.log(dir)
    return
  }

  return fail(SCRIPT, "usage: filter | applied | backlog | append | folder")
}

await main()
