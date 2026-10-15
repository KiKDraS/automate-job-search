#!/usr/bin/env node
/**
 * render-resume — render a resume markdown file to PDF.
 *
 * Usage:
 *   npx tsx scripts/render-resume.ts --file <resume.md> [--out <resume.pdf>]
 *
 * Uses playwright-core with the installed system Chrome (no browser
 * downloads). The output defaults to the input path with a .pdf extension.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import type { Browser } from "playwright-core"
import { buildResumeHtml } from "../lib/resume-html.ts"
import { fail, flagValue } from "./args.ts"

const SCRIPT = "render-resume"

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const file = flagValue(SCRIPT, args, "--file")
  if (file === undefined) {
    return fail(SCRIPT, "usage: --file <resume.md> [--out <resume.pdf>]")
  }
  const out = flagValue(SCRIPT, args, "--out") ?? `${file.replace(/\.md$/i, "")}.pdf`

  let markdown: string
  try {
    markdown = await fs.readFile(file, "utf8")
  } catch (error) {
    return fail(SCRIPT, `cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`)
  }

  const { chromium } = await import("playwright-core")
  const html = buildResumeHtml(markdown, path.basename(file))

  let browser: Browser
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true })
  } catch (error) {
    return fail(
      SCRIPT,
      `cannot launch Chrome — is Google Chrome installed? (${error instanceof Error ? error.message : String(error)})`,
    )
  }

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "load" })
    await page.pdf({ path: out, format: "A4", printBackground: false })
  } finally {
    await browser.close()
  }

  const stats = await fs.stat(out)
  console.log(`${out} (${Math.round(stats.size / 1024)} KB)`)
}

await main()
