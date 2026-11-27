#!/usr/bin/env node
/**
 * job-decisions — persisted "do not apply" markers.
 *
 * Usage:
 *   npx tsx scripts/job-decisions.ts list
 *   npx tsx scripts/job-decisions.ts check --folder <path>
 *   npx tsx scripts/job-decisions.ts skip --folder <path> [--reason "<text>"]
 *   npx tsx scripts/job-decisions.ts unskip --folder <path>
 */
import {
  isJobSkipped,
  readJobDecisions,
  skipJob,
  unskipJob,
} from "../lib/job-decisions.ts"
import { resolveDataDir } from "../lib/data-dir.ts"
import { fail, flagValue } from "./args.ts"

const SCRIPT = "job-decisions"

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  const dataDir = resolveDataDir()

  if (command === "list") {
    const decisions = await readJobDecisions(dataDir)
    const entries = Object.entries(decisions.jobs)
    if (entries.length === 0) {
      console.log("no skipped jobs")
      return
    }
    for (const [folder, entry] of entries) {
      console.log(`${folder}\t${entry.reason}\t${entry.updatedAt}`)
    }
    return
  }

  if (command === "check") {
    const folder = flagValue(SCRIPT, args, "--folder")
    if (folder === undefined) return fail(SCRIPT, "usage: check --folder <path>")
    const decisions = await readJobDecisions(dataDir)
    console.log(isJobSkipped(decisions, folder) ? "skipped" : "not skipped")
    return
  }

  if (command === "skip") {
    const folder = flagValue(SCRIPT, args, "--folder")
    if (folder === undefined) return fail(SCRIPT, "usage: skip --folder <path> [--reason <text>]")
    const decisions = await skipJob(
      dataDir,
      folder,
      flagValue(SCRIPT, args, "--reason") ?? "skipped from the report",
    )
    console.log(`skipped ${folder}`)
    console.log(`${Object.keys(decisions.jobs).length} decision(s)`)
    return
  }

  if (command === "unskip") {
    const folder = flagValue(SCRIPT, args, "--folder")
    if (folder === undefined) return fail(SCRIPT, "usage: unskip --folder <path>")
    await unskipJob(dataDir, folder)
    console.log(`unskipped ${folder}`)
    return
  }

  return fail(SCRIPT, "usage: list | check --folder <path> | skip --folder <path> | unskip --folder <path>")
}

await main()
