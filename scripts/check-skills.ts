#!/usr/bin/env node
/**
 * check-skills — validate skills and cross-references.
 *
 * Failures (exit 1):
 *   - skill directory not lowercase kebab-case
 *   - missing SKILL.md, frontmatter, name, or description
 *   - missing `.opencode/docs/*.md` file referenced from AGENTS.md or .opencode
 *   - missing skill-local `assets/` or `references/` file
 *
 * Warnings (exit 0):
 *   - description over the token-economy budget (~40 words)
 */
import { promises as fs } from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const SKILLS_DIR = path.resolve(ROOT, ".opencode", "skills")
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DESCRIPTION_WORD_BUDGET = 40
const DOCS_REF_PATTERN = /\.opencode\/docs\/[a-z0-9-]+\.md/g
const LOCAL_REF_PATTERN = /`((?:assets|references)\/[^`]+)`/g

function extractFrontmatter(source: string): string | null {
  if (!source.startsWith("---\n") && !source.startsWith("---\r\n")) {
    return null
  }
  const end = source.indexOf("\n---", 3)
  if (end === -1) {
    return null
  }
  return source.slice(4, end)
}

function fieldValue(frontmatter: string, field: string): string | null {
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, "m"))
  if (!match) return null
  return (match[1] ?? "").trim().replace(/^"|"$/g, "")
}

async function listSkillIds(): Promise<string[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(SKILLS_DIR)
  } catch {
    return []
  }
  const flags = await Promise.all(
    entries.map(async (entry) => {
      const stat = await fs.stat(path.join(SKILLS_DIR, entry)).catch(() => null)
      return stat?.isDirectory() ? entry : null
    }),
  )
  return flags.filter((id): id is string => id !== null)
}

async function walkMarkdown(dir: string, out: string[] = []): Promise<string[]> {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walkMarkdown(full, out)
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full)
    }
  }
  return out
}

async function main(): Promise<void> {
  const problems: string[] = []
  const warnings: string[] = []

  // ---- skills ----
  const ids = await listSkillIds()
  for (const id of ids) {
    if (!ID_PATTERN.test(id)) {
      problems.push(`${id}: directory name is not lowercase kebab-case`)
    }
    const skillFile = path.join(SKILLS_DIR, id, "SKILL.md")
    let source: string
    try {
      source = await fs.readFile(skillFile, "utf8")
    } catch {
      problems.push(`${id}: missing SKILL.md`)
      continue
    }
    const frontmatter = extractFrontmatter(source)
    if (frontmatter === null) {
      problems.push(`${id}: SKILL.md has no frontmatter block`)
      continue
    }
    if (fieldValue(frontmatter, "name") === null) {
      problems.push(`${id}: frontmatter missing \`name\``)
    }
    const description = fieldValue(frontmatter, "description")
    if (description === null) {
      problems.push(`${id}: frontmatter missing \`description\``)
    } else {
      const words = description.split(/\s+/).filter(Boolean).length
      if (words > DESCRIPTION_WORD_BUDGET) {
        warnings.push(
          `${id}: description is ${words} words (budget ~${DESCRIPTION_WORD_BUDGET}) — it is listed on every model step`,
        )
      }
    }
    const body = source.slice(source.indexOf("\n---", 3) + 4)
    for (const match of body.matchAll(LOCAL_REF_PATTERN)) {
      const ref = match[1] ?? ""
      try {
        await fs.access(path.join(SKILLS_DIR, id, ref))
      } catch {
        problems.push(`${id}: \`${ref}\` referenced but missing`)
      }
    }
  }

  // ---- docs references ----
  const files = [
    path.resolve(ROOT, "AGENTS.md"),
    path.resolve(ROOT, "SPEC.md"),
    ...(await walkMarkdown(path.resolve(ROOT, ".opencode"))),
  ]
  const seenRefs = new Set<string>()
  for (const file of files) {
    let source: string
    try {
      source = await fs.readFile(file, "utf8")
    } catch {
      continue
    }
    for (const match of source.matchAll(DOCS_REF_PATTERN)) {
      const ref = match[0]
      if (seenRefs.has(ref)) continue
      seenRefs.add(ref)
      try {
        await fs.access(path.resolve(ROOT, ref))
      } catch {
        problems.push(`${path.relative(ROOT, file)}: references \`${ref}\` but it is missing`)
      }
    }
  }

  // ---- report ----
  if (ids.length === 0 && seenRefs.size === 0) {
    console.log(`No skills to check yet (${SKILLS_DIR} is empty or missing).`)
    return
  }
  for (const warning of warnings) console.log(`! ${warning}`)
  for (const problem of problems) console.log(`✗ ${problem}`)
  console.log(
    `${ids.length} skill(s), ${seenRefs.size} docs reference(s): ${warnings.length} warning(s), ${problems.length} problem(s).`,
  )
  if (problems.length > 0) {
    process.exitCode = 1
  }
}

await main()
