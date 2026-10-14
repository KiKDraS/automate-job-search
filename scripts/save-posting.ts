#!/usr/bin/env node
/**
 * save-posting — move a browser-extracted posting into its job folder.
 *
 * Usage:
 *   npx tsx scripts/save-posting.ts --file <.playwright-mcp/posting.txt>
 *     --company "<company>" --role "<role>" --url "<url>" [--date YYYY-MM-DD]
 *
 * Reads the file (an artifact of browser_evaluate's `filename` option),
 * unwraps JSON-string encoding when present, and writes
 * <data dir>/jobs/<company>-<role>-<date>/posting.md with an
 * untrusted-content header. Prints the folder path.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { ensureJobFolder, todayIso } from "../lib/jobstore.ts"
import { buildPostingMarkdown, unwrapEvalResult } from "../lib/posting.ts"
import { fail, flagValue } from "./args.ts"

const SCRIPT = "save-posting"

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const file = flagValue(SCRIPT, args, "--file")
  const company = flagValue(SCRIPT, args, "--company")
  const role = flagValue(SCRIPT, args, "--role")
  const url = flagValue(SCRIPT, args, "--url")
  if (file === undefined || company === undefined || role === undefined || url === undefined) {
    return fail(
      SCRIPT,
      "usage: --file <path> --company <company> --role <role> --url <url> [--date YYYY-MM-DD]",
    )
  }
  const date = flagValue(SCRIPT, args, "--date") ?? todayIso()

  let raw: string
  try {
    raw = await fs.readFile(file, "utf8")
  } catch (error) {
    return fail(SCRIPT, `cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`)
  }

  const content = unwrapEvalResult(raw).trim()
  if (content === "") {
    return fail(SCRIPT, `extracted posting is empty (${file})`)
  }

  const dir = await ensureJobFolder(company, role, date)
  await fs.writeFile(path.join(dir, "posting.md"), buildPostingMarkdown({ company, role, url, date }, content))
  console.log(dir)
}

await main()
