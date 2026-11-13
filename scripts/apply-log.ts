#!/usr/bin/env node
/**
 * apply-log — write <job folder>/applied.md and append <data dir>/applications.md.
 *
 * Usage:
 *   npx tsx scripts/apply-log.ts --folder <job folder> --file <entry.json>
 *
 * The JSON entry: role, company, url, resume, confirmation, optional method,
 * fit, source, status, note, date, coverLetter and fields. Manual submissions
 * use source "user" and status "submitted (manual)". Prints both written paths.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { todayIso } from "../lib/jobstore.ts"
import { resolveDataDir } from "../lib/data-dir.ts"
import {
  APPLICATIONS_INDEX_HEADER,
  formatApplicationIndexRow,
  formatAppliedMarkdown,
  parseAppliedEntry,
  upsertApplicationIndexRow,
} from "../lib/apply.ts"
import { fail, flagValue } from "./args.ts"

const SCRIPT = "apply-log"

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const folder = flagValue(SCRIPT, args, "--folder")
  const file = flagValue(SCRIPT, args, "--file")
  if (folder === undefined || file === undefined) {
    return fail(SCRIPT, "usage: --folder <job folder> --file <entry.json>")
  }

  let raw: string
  try {
    raw = await fs.readFile(file, "utf8")
  } catch (error) {
    return fail(
      SCRIPT,
      `cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const entry = parseAppliedEntry(raw)
  if (entry === null) {
    return fail(SCRIPT, "entry needs role, company, url, resume, and confirmation (non-empty strings)")
  }

  try {
    await fs.access(path.join(folder, "posting.md"))
  } catch {
    return fail(SCRIPT, `${folder} has no posting.md — wrong job folder?`)
  }

  const date = entry.date ?? todayIso()
  const target = path.join(folder, "applied.md")
  await fs.writeFile(target, formatAppliedMarkdown(entry, date))

  const dataDir = resolveDataDir()
  const index = path.join(dataDir, "applications.md")
  const relativeFolder = path.relative(dataDir, folder) || folder
  let existing = ""
  try {
    existing = await fs.readFile(index, "utf8")
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(index, APPLICATIONS_INDEX_HEADER)
    existing = APPLICATIONS_INDEX_HEADER
  }

  const row = formatApplicationIndexRow(entry, relativeFolder, date)
  await fs.writeFile(index, upsertApplicationIndexRow(existing, row, relativeFolder))

  console.log(target)
  console.log(index)
}

await main()
