#!/usr/bin/env node
/**
 * save-feed — move a browser-extracted feed hiring post into the feed folder.
 *
 * Usage:
 *   npx tsx scripts/save-feed.ts --file <.playwright-mcp/feed.txt>
 *     --company "<company>" --role "<role>"
 *     --author "<name>" --fit "High|Medium" --why "<one line>"
 *     [--url "<post url>"] [--date YYYY-MM-DD]
 *
 * Reads the file (an artifact of browser_evaluate's `filename` option),
 * unwraps JSON-string encoding when present, and writes
 * <data dir>/feed/<date>-<company>-<role>.md with an untrusted-content header.
 * Prints the written path.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { dataPath } from "../lib/data-dir.ts"
import { slugify, todayIso } from "../lib/jobstore.ts"
import { buildFeedMarkdown } from "../lib/feed.ts"
import { unwrapEvalResult } from "../lib/posting.ts"
import { fail, flagValue } from "./args.ts"

const SCRIPT = "save-feed"

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const file = flagValue(SCRIPT, args, "--file")
  const company = flagValue(SCRIPT, args, "--company")
  const role = flagValue(SCRIPT, args, "--role")
  const url = flagValue(SCRIPT, args, "--url") ?? "not available"
  const author = flagValue(SCRIPT, args, "--author")
  const fit = flagValue(SCRIPT, args, "--fit")
  const why = flagValue(SCRIPT, args, "--why")
  if (
    file === undefined ||
    company === undefined ||
    role === undefined ||
    author === undefined ||
    fit === undefined ||
    why === undefined
  ) {
    return fail(
      SCRIPT,
      "usage: --file <path> --company <c> --role <r> --author <a> --fit <High|Medium> --why <text> [--url <u>] [--date YYYY-MM-DD]",
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
    return fail(SCRIPT, `extracted feed post is empty (${file})`)
  }

  const dir = dataPath("feed")
  await fs.mkdir(dir, { recursive: true })
  const target = path.join(dir, `${date}-${slugify(company)}-${slugify(role)}.md`)
  await fs.writeFile(
    target,
    buildFeedMarkdown({ company, role, url, author, fit, why, date }, content),
  )
  console.log(target)
}

await main()
