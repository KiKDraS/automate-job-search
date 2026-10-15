#!/usr/bin/env node
/**
 * resume-text — extract text from a resume PDF into a plain .txt file.
 *
 * Usage:
 *   npx tsx scripts/resume-text.ts --file <resume.pdf> [--out <resume.txt>]
 *
 * Writes `<file>.txt` next to the PDF by default. Scanned or image-only
 * PDFs produce (almost) no text; the script reports that clearly instead of
 * writing an empty file, so the skills can ask the user to paste the text.
 */
import { promises as fs } from "node:fs"
import { extractPdfText } from "../lib/resume-text.ts"
import { fail, flagValue } from "./args.ts"

const SCRIPT = "resume-text"

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const file = flagValue(SCRIPT, args, "--file")
  if (file === undefined) {
    return fail(SCRIPT, "usage: --file <resume.pdf> [--out <resume.txt>]")
  }
  const out = flagValue(SCRIPT, args, "--out") ?? `${file.replace(/\.pdf$/i, "")}.txt`

  let extracted
  try {
    extracted = await extractPdfText(file)
  } catch (error) {
    return fail(SCRIPT, `cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (extracted.looksEmpty) {
    return fail(
      SCRIPT,
      `no text layer found in ${file} (${extracted.pages} page(s)) — scanned or image-only PDF. Ask the user to paste the resume text or share a text-based export.`,
    )
  }

  await fs.writeFile(out, `${extracted.text}\n`)
  console.log(`${out} (${extracted.pages} page(s), ${extracted.text.length} chars)`)
}

await main()
