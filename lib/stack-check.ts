/**
 * Adaptive stack check for saved postings.
 *
 * The user's stack is declared in `profile.md` (`## Stack`) and confirmed
 * during setup. This module compares the posting's required and optional
 * technologies with that declared stack. It never assumes a stack: without
 * `## Stack` it returns null and the caller asks Coach to collect it.
 *
 * The catalog is a neutral recognition dictionary, not a list of "bad"
 * stacks. Results are advisory: the fit scorer and the user decide.
 */
import { TECH_CATALOG } from "./tech-catalog.ts"

export interface DeclaredStack {
  primary: string[]
  working: string[]
}

export interface PostingSections {
  required: string
  optional: string
  sectionsFound: boolean
}

export interface StackCheckResult {
  targetRoles: string[]
  sectionsFound: boolean
  required: string[]
  optional: string[]
  matched: string[]
  requiredNotInStack: string[]
  optionalNotInStack: string[]
  mentioned: string[]
}

const STACK_HEADING = /^#{1,6}\s+.*\bstack\b/i
const PRIMARY_LABEL =
  /^[-*]\s*(?:\*\*)?(?:primary|primario|principales)(?:\*\*)?\s*:\s*(.*)$/i
const WORKING_LABEL =
  /^[-*]\s*(?:\*\*)?(?:working(?:\s+knowledge)?|secondary|secundario|conocimiento)(?:\*\*)?\s*:\s*(.*)$/i
const TARGET_ROLES_LABEL = /^[-*]\s*target roles\s*:\s*(.*)$/im
const REQUIRED_START =
  /^(?:requirements?|required\b|must[- ]have\b|qualifications?\b|what we(?:'| a)re looking for\b|requisitos\b|imprescindible\b|excluyente\b)/i
const OPTIONAL_START =
  /^(?:nice[- ]to[- ]have\b|preferred\b|desired\b|desirable\b|pluses?\b|plus\b|deseable\b|valoramos\b|deseado\b)/i
const OTHER_HEADING =
  /^(?:about|introduction|organization profile|position challenges|typical duties|responsibilities|key responsibilities|what you(?:'ll| will) do|benefits|what we offer|perks|compensation|salary|location|personal qualities|how to apply|why join|the role|role overview|job description|descripción|responsabilidades|beneficios|sobre|el rol|lo que harás|ofrecemos)\b/i
const MARKDOWN_HEADING = /^#{1,6}\s+/

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Whole-token match that does not split Java/JavaScript or SQL/PostgreSQL. */
function aliasPattern(alias: string): RegExp {
  return new RegExp(`(?<![a-z0-9])${escapeRegex(alias)}(?![a-z0-9])`, "i")
}

function sectionAfterHeading(text: string, heading: RegExp): string | null {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((line) => heading.test(line))
  if (start === -1) return null
  const out: string[] = []
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index] ?? ""
    if (MARKDOWN_HEADING.test(line)) break
    out.push(line)
  }
  return out.join("\n").trim()
}

function parseStackLine(section: string, label: RegExp): string[] {
  for (const line of section.split(/\r?\n/)) {
    const match = line.match(label)
    if (match?.[1] !== undefined) {
      return match[1]
        .split(/[,;]/)
        .map((term) => term.trim())
        .filter((term) => term !== "")
    }
  }
  return []
}

/** The stack the user confirmed in `profile.md`; null when it is missing. */
export function parseDeclaredStack(profileText: string): DeclaredStack | null {
  const section = sectionAfterHeading(profileText, STACK_HEADING)
  if (section === null) return null
  const primary = parseStackLine(section, PRIMARY_LABEL)
  const working = parseStackLine(section, WORKING_LABEL)
  if (primary.length === 0 && working.length === 0) return null
  return { primary, working }
}

/** Target roles from `preferences.md`; [] when the line is missing. */
export function parseTargetRoles(preferencesText: string): string[] {
  const match = preferencesText.match(TARGET_ROLES_LABEL)
  if (match?.[1] === undefined) return []
  return match[1]
    .split(";")
    .map((role) => role.trim())
    .filter((role) => role !== "")
}

/** Split a posting into required and optional sections, when headings exist. */
export function splitPostingSections(text: string): PostingSections {
  const lines = text.split(/\r?\n/)
  let current: "required" | "optional" | null = null
  const parts: { required: string[]; optional: string[] } = { required: [], optional: [] }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === "") {
      if (current !== null) parts[current].push("")
      continue
    }
    const isBullet = /^[-*•]/.test(trimmed)
    const clean = trimmed.replace(MARKDOWN_HEADING, "").trim()
    if (!isBullet) {
      if (REQUIRED_START.test(clean)) {
        current = "required"
        parts.required.push(clean)
        continue
      }
      if (OPTIONAL_START.test(clean)) {
        current = "optional"
        parts.optional.push(clean)
        continue
      }
      if (OTHER_HEADING.test(clean) || MARKDOWN_HEADING.test(trimmed)) {
        current = null
        continue
      }
    }
    if (current !== null) parts[current].push(line)
  }

  const required = parts.required.join("\n").trim()
  const optional = parts.optional.join("\n").trim()
  return { required, optional, sectionsFound: required !== "" || optional !== "" }
}

function canonicalize(term: string): string {
  const normalized = term.trim().toLowerCase()
  const catalogTerm = TECH_CATALOG.find(
    (candidate) =>
      candidate.name.toLowerCase() === normalized ||
      candidate.aliases.some((alias) => alias.toLowerCase() === normalized),
  )
  return catalogTerm?.name ?? term.trim()
}

function isCatalogTerm(term: string): boolean {
  return TECH_CATALOG.some((candidate) => candidate.name === term)
}

/** Technology names found in `text`; the catalog plus the user's extra terms. */
export function extractTerms(text: string, extraTerms: readonly string[] = []): string[] {
  const found = new Set<string>()
  for (const term of TECH_CATALOG) {
    if (term.aliases.some((alias) => aliasPattern(alias).test(text))) {
      found.add(term.name)
    }
  }
  for (const raw of extraTerms) {
    const term = canonicalize(raw)
    if (term === "" || found.has(term) || isCatalogTerm(term)) continue
    if (aliasPattern(raw).test(text)) found.add(term)
  }
  return [...found].sort()
}

/**
 * Compare the posting against the user's declared stack.
 *
 * Returns null when `profile.md` has no `## Stack` section; the caller must
 * ask Coach to confirm the stack instead of assuming one.
 */
export function checkStack(
  postingText: string,
  profileText: string,
  preferencesText = "",
): StackCheckResult | null {
  const stack = parseDeclaredStack(profileText)
  if (stack === null) return null

  const extraTerms = [...stack.primary, ...stack.working].map(canonicalize)
  const stackTerms = new Set(extraTerms)
  const sections = splitPostingSections(postingText)
  const mentioned = extractTerms(postingText, extraTerms)
  const required = extractTerms(sections.required, extraTerms)
  const optional = extractTerms(sections.optional, extraTerms)

  return {
    targetRoles: parseTargetRoles(preferencesText),
    sectionsFound: sections.sectionsFound,
    required,
    optional,
    matched: mentioned.filter((term) => stackTerms.has(term)),
    requiredNotInStack: required.filter((term) => !stackTerms.has(term)),
    optionalNotInStack: optional.filter((term) => !stackTerms.has(term)),
    mentioned,
  }
}
