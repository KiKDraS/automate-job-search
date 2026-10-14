#!/usr/bin/env node
/**
 * check-skills — validate SKILL.md files under .opencode/skills.
 *
 * Phase 1 scope:
 *   - directory names are lowercase kebab-case (skill IDs)
 *   - each skill directory contains a SKILL.md with a frontmatter block
 *   - frontmatter declares `name` and `description`
 */
import { promises as fs } from "node:fs"
import path from "node:path"

const SKILLS_DIR = path.resolve(process.cwd(), ".opencode", "skills")
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

interface Problem {
  skill: string
  message: string
}

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

function hasField(frontmatter: string, field: string): boolean {
  return new RegExp(`^${field}:\\s*\\S`, "m").test(frontmatter)
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

async function main(): Promise<void> {
  const ids = await listSkillIds()
  if (ids.length === 0) {
    console.log(`No skills to check yet (${SKILLS_DIR} is empty or missing).`)
    return
  }

  const problems: Problem[] = []
  for (const id of ids) {
    if (!ID_PATTERN.test(id)) {
      problems.push({ skill: id, message: "directory name is not lowercase kebab-case" })
    }
    const skillFile = path.join(SKILLS_DIR, id, "SKILL.md")
    let source: string
    try {
      source = await fs.readFile(skillFile, "utf8")
    } catch {
      problems.push({ skill: id, message: "missing SKILL.md" })
      continue
    }
    const frontmatter = extractFrontmatter(source)
    if (frontmatter === null) {
      problems.push({ skill: id, message: "SKILL.md has no frontmatter block" })
      continue
    }
    if (!hasField(frontmatter, "name")) {
      problems.push({ skill: id, message: "frontmatter missing `name`" })
    }
    if (!hasField(frontmatter, "description")) {
      problems.push({ skill: id, message: "frontmatter missing `description`" })
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) {
      console.log(`✗ ${problem.skill}: ${problem.message}`)
    }
    console.log(`\n${problems.length} problem(s) across ${ids.length} skill(s).`)
    process.exitCode = 1
    return
  }

  console.log(`✓ ${ids.length} skill(s) valid.`)
}

await main()
