#!/usr/bin/env node
/**
 * company — manage the machine-readable company offer preferences.
 *
 * Usage:
 *   npx tsx scripts/company.ts list
 *   npx tsx scripts/company.ts excluded
 *   npx tsx scripts/company.ts check --company "<name>"
 *   npx tsx scripts/company.ts set --company "<name>" --receive yes|no
 */
import {
  excludedCompanies,
  isCompanyExcluded,
  readCompanyPreferences,
  setCompanyPreference,
} from "../lib/company-preferences.ts"
import { resolveDataDir } from "../lib/data-dir.ts"
import { fail, flagValue } from "./args.ts"

const SCRIPT = "company"

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  const dataDir = resolveDataDir()

  if (command === "list") {
    const preferences = await readCompanyPreferences(dataDir)
    const entries = Object.values(preferences.companies)
    if (entries.length === 0) {
      console.log("no company preferences")
      return
    }
    for (const entry of entries.sort((a, b) => a.company.localeCompare(b.company))) {
      console.log(`${entry.company}\t${entry.receiveOffers ? "receiving" : "excluded"}\t${entry.updatedAt}`)
    }
    return
  }

  if (command === "excluded") {
    const names = excludedCompanies(await readCompanyPreferences(dataDir))
    for (const name of names) console.log(name)
    return
  }

  if (command === "check") {
    const company = flagValue(SCRIPT, args, "--company")
    if (company === undefined) return fail(SCRIPT, "usage: check --company <name>")
    const preferences = await readCompanyPreferences(dataDir)
    console.log(isCompanyExcluded(preferences, company) ? "excluded" : "allowed")
    return
  }

  if (command === "set") {
    const company = flagValue(SCRIPT, args, "--company")
    const receive = flagValue(SCRIPT, args, "--receive")
    if (company === undefined || receive === undefined) {
      return fail(SCRIPT, "usage: set --company <name> --receive yes|no")
    }
    if (receive !== "yes" && receive !== "no") {
      return fail(SCRIPT, "--receive must be yes or no")
    }
    const preferences = await setCompanyPreference(dataDir, company, receive === "yes")
    console.log(`${company}: ${receive === "yes" ? "receiving" : "excluded"}`)
    console.log(`${Object.keys(preferences.companies).length} preference(s)`)
    return
  }

  return fail(SCRIPT, "usage: list | excluded | check --company <name> | set --company <name> --receive yes|no")
}

await main()
