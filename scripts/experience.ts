#!/usr/bin/env node
/**
 * experience — compute total experience from the role dates in profile.md.
 *
 * Usage:
 *   npx tsx scripts/experience.ts [--profile <profile.md>] [--as-of YYYY-MM] [--json]
 *
 * No total is stored: the figure is derived from the roles the user confirmed
 * during setup. Unique calendar time counts overlapping roles once; the sum of
 * role durations is included as a reference. Career breaks are excluded.
 */
import { promises as fs } from "node:fs"
import { dataPath } from "../lib/data-dir.ts"
import { computeExperience } from "../lib/experience.ts"
import { fail, flagValue } from "./args.ts"

const SCRIPT = "experience"

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const profile = flagValue(SCRIPT, args, "--profile") ?? dataPath("profile.md")
  const asOf = flagValue(SCRIPT, args, "--as-of")
  const json = args.includes("--json")

  let text: string
  try {
    text = await fs.readFile(profile, "utf8")
  } catch (error) {
    return fail(
      SCRIPT,
      `cannot read profile ${profile}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  let result
  try {
    result = computeExperience(text, asOf)
  } catch (error) {
    return fail(SCRIPT, error instanceof Error ? error.message : String(error))
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  console.log(`Profile: ${profile}`)
  console.log(`Unique calendar time: ${result.uniqueLabel} (${result.uniqueMonths} months)`)
  console.log(`Sum of role durations: ${result.sumLabel} (${result.sumMonths} months)`)
  console.log(`Rounded: ${result.rounded}`)
  console.log(`Roles: ${result.activeRoles} active, ${result.breaks} break(s)`)
  for (const warning of result.warnings) console.log(`Warning: ${warning}`)
}

await main()
