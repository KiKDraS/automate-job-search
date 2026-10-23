#!/usr/bin/env node
/**
 * tech-catalog — manage the user's local technology overlay.
 *
 * Usage:
 *   npx tsx scripts/tech-catalog.ts add --name "Stake Engine" \
 *     [--aliases "stake engine,stakeengine"] [--file <path>]
 *   npx tsx scripts/tech-catalog.ts validate [--file <path>]
 *   npx tsx scripts/tech-catalog.ts list [--file <path>]
 *
 * The overlay defaults to `<data dir>/tech-catalog.json`. It is personal data:
 * never commit it. The stack check merges it with the shipped catalog.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { dataPath } from "../lib/data-dir.ts"
import {
  mergeCatalog,
  parseCatalog,
  TECH_CATALOG,
  validateCatalog,
  type TechTerm,
} from "../lib/tech-catalog.ts"
import { fail, flagValue } from "./args.ts"

const SCRIPT = "tech-catalog"

function defaultFile(): string {
  return dataPath("tech-catalog.json")
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.stat(file)
    return true
  } catch {
    return false
  }
}

async function readOverlay(file: string): Promise<TechTerm[]> {
  if (!(await exists(file))) return []
  try {
    return parseCatalog(await fs.readFile(file, "utf8"))
  } catch (error) {
    return fail(SCRIPT, `cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function writeOverlay(file: string, terms: TechTerm[]): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, `${JSON.stringify({ terms }, null, 2)}\n`)
}

function validateMerged(overlay: TechTerm[]): string[] {
  return validateCatalog(mergeCatalog(TECH_CATALOG, overlay))
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  const file = flagValue(SCRIPT, args, "--file") ?? defaultFile()

  if (command === "add") {
    const name = flagValue(SCRIPT, args, "--name")?.trim()
    if (name === undefined || name === "") {
      return fail(SCRIPT, "usage: add --name <name> [--aliases \"a,b\"] [--file <path>]")
    }
    const rawAliases = flagValue(SCRIPT, args, "--aliases")
    const aliases = (rawAliases ?? name.toLowerCase())
      .split(",")
      .map((alias) => alias.trim())
      .filter((alias) => alias !== "")

    const overlay = await readOverlay(file)
    const existing = overlay.find((term) => term.name.toLowerCase() === name.toLowerCase())
    if (existing === undefined) {
      overlay.push({ name, aliases })
    } else {
      for (const alias of aliases) {
        if (!existing.aliases.some((current) => current.toLowerCase() === alias.toLowerCase())) {
          existing.aliases.push(alias)
        }
      }
    }

    const errors = validateMerged(overlay)
    if (errors.length > 0) {
      return fail(SCRIPT, `catalog conflict: ${errors.join("; ")}`)
    }

    await writeOverlay(file, overlay)
    console.log(`${file} — added ${name}`)
    return
  }

  if (command === "validate") {
    const overlay = await readOverlay(file)
    const errors = validateMerged(overlay)
    if (errors.length > 0) {
      return fail(SCRIPT, `catalog conflict: ${errors.join("; ")}`)
    }
    const total = mergeCatalog(TECH_CATALOG, overlay).length
    console.log(`ok — ${total} terms (${overlay.length} local)`)
    return
  }

  if (command === "list") {
    const overlay = await readOverlay(file)
    if (overlay.length === 0) {
      console.log(`no local catalog at ${file}`)
      return
    }
    for (const term of overlay) {
      console.log(`${term.name}: ${term.aliases.join(", ")}`)
    }
    return
  }

  return fail(SCRIPT, "usage: add|validate|list [--file <path>]")
}

await main()
