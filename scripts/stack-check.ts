#!/usr/bin/env node
/**
 * stack-check — compare a posting with the stack the user confirmed.
 *
 * Usage:
 *   npx tsx scripts/stack-check.ts --posting <posting.md>
 *     --profile <profile.md> [--preferences <preferences.md>]
 *
 * Prints compact JSON. Fails when profile.md has no ## Stack section; the
 * caller must ask Coach to confirm the stack, never assume one.
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
  const preferences = flagValue(SCRIPT, args, "--preferences")
  if (posting === undefined || profile === undefined) {
    return fail(
      SCRIPT,
      "usage: --posting <posting.md> --profile <profile.md> [--preferences <preferences.md>]",
    )
  }

  const postingText = await read(posting, "posting")
  const profileText = await read(profile, "profile")
  const preferencesText = preferences === undefined ? "" : await read(preferences, "preferences")
  const result = checkStack(postingText, profileText, preferencesText)
  if (result === null) {
    return fail(
      SCRIPT,
      `no ## Stack section in ${profile} — confirm the user's stack with job-setup before checking`,
    )
  }
  console.log(JSON.stringify(result))
}

await main()
