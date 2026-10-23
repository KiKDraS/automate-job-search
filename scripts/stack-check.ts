#!/usr/bin/env node
/**
 * stack-check — compare a posting with the stack the user confirmed.
 *
 * Usage:
 *   npx tsx scripts/stack-check.ts --posting <posting.md>
 *     --profile <profile.md> [--preferences <preferences.md>]
 *     [--catalog <tech-catalog.json>]
 *
 * The optional catalog is the local overlay (`<data dir>/tech-catalog.json`
 * by default). It is merged with the shipped catalog. Prints compact JSON.
 * Fails when profile.md has no ## Stack section; the caller must ask Coach to
 * confirm the stack, never assume one.
 */
import { promises as fs } from "node:fs"
import { dataPath } from "../lib/data-dir.ts"
import { checkStack } from "../lib/stack-check.ts"
import {
  mergeCatalog,
  parseCatalog,
  TECH_CATALOG,
  validateCatalog,
} from "../lib/tech-catalog.ts"
import { fail, flagValue } from "./args.ts"

const SCRIPT = "stack-check"

async function read(path: string, label: string): Promise<string> {
  try {
    return await fs.readFile(path, "utf8")
  } catch (error) {
    return fail(SCRIPT, `cannot read ${label} ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.stat(path)
    return true
  } catch {
    return false
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const posting = flagValue(SCRIPT, args, "--posting")
  const profile = flagValue(SCRIPT, args, "--profile")
  const preferences = flagValue(SCRIPT, args, "--preferences")
  const explicitCatalog = flagValue(SCRIPT, args, "--catalog")
  if (posting === undefined || profile === undefined) {
    return fail(
      SCRIPT,
      "usage: --posting <posting.md> --profile <profile.md> [--preferences <preferences.md>] [--catalog <tech-catalog.json>]",
    )
  }

  const catalogPath = explicitCatalog ?? dataPath("tech-catalog.json")
  let catalog = [...TECH_CATALOG]
  if (await exists(catalogPath)) {
    let overlay
    try {
      overlay = parseCatalog(await fs.readFile(catalogPath, "utf8"))
    } catch (error) {
      return fail(
        SCRIPT,
        `cannot read catalog ${catalogPath}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    catalog = mergeCatalog(TECH_CATALOG, overlay)
    const errors = validateCatalog(catalog)
    if (errors.length > 0) {
      return fail(SCRIPT, `invalid catalog ${catalogPath}: ${errors.join("; ")}`)
    }
  } else if (explicitCatalog !== undefined) {
    return fail(SCRIPT, `catalog not found: ${catalogPath}`)
  }

  const postingText = await read(posting, "posting")
  const profileText = await read(profile, "profile")
  const preferencesText = preferences === undefined ? "" : await read(preferences, "preferences")
  const result = checkStack(postingText, profileText, preferencesText, catalog)
  if (result === null) {
    return fail(
      SCRIPT,
      `no ## Stack section in ${profile} — confirm the user's stack with job-setup before checking`,
    )
  }
  console.log(JSON.stringify(result))
}

await main()
