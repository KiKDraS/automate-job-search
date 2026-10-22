#!/usr/bin/env node
/**
 * apply-log — write <job folder>/applied.md after a confirmed submission.
 *
 * Usage:
 *   npx tsx scripts/apply-log.ts --folder <job folder> --file <entry.json>
 *
 * The JSON entry: role, company, url, resume, confirmation, optional
 * coverLetter and fields [{ label, value }]. Prints the written path.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { formatAppliedMarkdown, parseAppliedEntry } from "../lib/apply.ts"
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

  const target = path.join(folder, "applied.md")
  await fs.writeFile(target, formatAppliedMarkdown(entry))
  console.log(target)
}

await main()
