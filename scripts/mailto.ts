#!/usr/bin/env node
/**
 * mailto — print a mailto: handoff for an application email draft.
 *
 * Usage:
 *   npx tsx scripts/mailto.ts --file <feed>/<lead>-email.md
 *
 * Reads the draft written by the `application-email` skill. It does not send
 * anything and does not open a mail client; it prints the URL for the user.
 */
import { promises as fs } from "node:fs"
import { parseEmailDraft, buildMailto } from "../lib/email.ts"
import { fail, flagValue } from "./args.ts"

const SCRIPT = "mailto"

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const file = flagValue(SCRIPT, args, "--file")
  if (file === undefined) {
    return fail(SCRIPT, "usage: --file <email.md>")
  }
  let raw: string
  try {
    raw = await fs.readFile(file, "utf8")
  } catch (error) {
    return fail(SCRIPT, `cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const draft = parseEmailDraft(raw)
  if (draft === null) {
    return fail(SCRIPT, "email draft needs To, Subject, and a ## Body section")
  }
  console.log(buildMailto(draft))
}

await main()
