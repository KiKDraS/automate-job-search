#!/usr/bin/env node
/**
 * stack-check — flag mismatch-prone technologies in a saved posting.
 *
 * Usage:
 *   npx tsx scripts/stack-check.ts --posting <posting.md>
 *     --profile <profile.md> [--resume <base.md|base.txt>]
 *
 * Prints compact JSON: found, matched, missing. The fit scorer decides; the
 * check is a heuristic, not a verdict.
 */
import { promises as fs } from "node:fs"
import { checkStack } from "../lib/stack-check.ts"
import { fail, flagValue } from "./args.ts"

const SCRIPT = "stack-check"

async function read(path: string, label: string): Promise<string> {
  try {
    return await fs.readFile(path, "utf8")
  } catch (error) {
    return fail(SCRIPT, `cannot read ${label} ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const posting = flagValue(SCRIPT, args, "--posting")
  const profile = flagValue(SCRIPT, args, "--profile")
  const resume = flagValue(SCRIPT, args, "--resume")
  if (posting === undefined || profile === undefined) {
    return fail(SCRIPT, "usage: --posting <posting.md> --profile <profile.md> [--resume <base.md|base.txt>]")
  }

  const postingText = await read(posting, "posting")
  const profileText = await read(profile, "profile")
  const resumeText = resume === undefined ? "" : await read(resume, "resume")
  console.log(JSON.stringify(checkStack(postingText, `${profileText}\n${resumeText}`)))
}

await main()
