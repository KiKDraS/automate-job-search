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
import { TECH_CATALOG, type TechTerm } from "./tech-catalog.ts"

export interface DeclaredStack {
  primary: string[]
  working: string[]
}

export interface PostingSections {
  required: string
  optional: string
  sectionsFound: boolean
}

export interface StackCandidate {
  term: string
  section: "required" | "optional"
  context: string
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
  candidates: StackCandidate[]
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

function canonicalize(term: string, catalog: readonly TechTerm[]): string {
  const normalized = term.trim().toLowerCase()
  const catalogTerm = catalog.find(
    (candidate) =>
      candidate.name.toLowerCase() === normalized ||
      candidate.aliases.some((alias) => alias.toLowerCase() === normalized),
  )
  return catalogTerm?.name ?? term.trim()
}

function isCatalogTerm(term: string, catalog: readonly TechTerm[]): boolean {
  return catalog.some((candidate) => candidate.name === term)
}

/** Technology names found in `text`; the catalog plus the user's extra terms. */
export function extractTerms(
  text: string,
  extraTerms: readonly string[] = [],
  catalog: readonly TechTerm[] = TECH_CATALOG,
): string[] {
  const found = new Set<string>()
  for (const term of catalog) {
    if (term.aliases.some((alias) => aliasPattern(alias).test(text))) {
      found.add(term.name)
    }
  }
  for (const raw of extraTerms) {
    const term = canonicalize(raw, catalog)
    if (term === "" || found.has(term) || isCatalogTerm(term, catalog)) continue
    if (aliasPattern(raw).test(text)) found.add(term)
  }
  return [...found].sort()
}

const CANDIDATE_TRIGGER =
  /(?:experience|proficiency|proficient|knowledge|familiarity|expertise|understanding|hands-on)\s+(?:with|in|of)\s+([^.;\n]+)/gi
const MUST_HAVE_TRIGGER = /must[- ]have\s+([^.;\n]+)/gi
const CANDIDATE_SPLIT = /\s*(?:,|;|\s+and\s+|\s+or\s+)\s*/i
const CANDIDATE_LEADING =
  /^(?:strong|solid|proven|hands-on|professional|demonstrated|working|practical|advanced|modern)\s+/i
const CANDIDATE_ROLE =
  /^(?:experience|proficiency|knowledge|familiarity|expertise|understanding)\s+(?:with|in|of)\s+/i
const CANDIDATE_TRAILING =
  /\s+(?:experience|skills?|knowledge|tools?|technologies|frameworks?|pipelines?|apis?|applications?|services?|platforms?|development|practices?|animations?|concepts?)$/i
const CANDIDATE_IGNORE = new Set([
  "and",
  "or",
  "with",
  "including",
  "such",
  "for",
  "in",
  "of",
  "at",
  "the",
  "a",
  "an",
  "e.g.",
  "etc",
  "years",
  "year",
  "least",
  "modern",
  "strong",
  "solid",
  "proven",
  "experience",
  "knowledge",
  "familiarity",
  "expertise",
  "understanding",
  "ui",
  "ux",
  "api",
  "apis",
  "spa",
  "js",
  "ts",
  "ci",
  "cd",
  "qa",
  "ml",
  "ai",
])

function isCandidateShape(term: string): boolean {
  if (term.includes("/")) return false
  const words = term.split(/\s+/).filter((word) => word !== "")
  if (words.length === 0 || words.length > 3) return false
  for (const word of words) {
    const cleaned = word
      .replace(/^[("'\[]+/, "")
      .replace(/[)\]"'\\,.;:]+$/, "")
    if (cleaned === "") return false
    if (!/^[A-Z0-9]/.test(cleaned)) return false
    if (CANDIDATE_IGNORE.has(cleaned.toLowerCase())) return false
  }
  return true
}

function cleanCandidate(raw: string): string {
  let value = raw.replace(/\s+/g, " ").trim()
  value = value.replace(CANDIDATE_LEADING, "")
  value = value.replace(CANDIDATE_ROLE, "")
  value = value.replace(/^must[- ]have\s+/i, "")
  value = value.replace(CANDIDATE_TRAILING, "")
  return value.replace(/^[\s:;,.-]+|[\s:;,.-]+$/g, "").trim()
}

function candidateContext(text: string, index: number): string {
  const lineStart = text.lastIndexOf("\n", index) + 1
  const lineEnd = text.indexOf("\n", index)
  return text
    .slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
}

function extractCandidates(
  text: string,
  section: "required" | "optional",
  known: ReadonlySet<string>,
): StackCandidate[] {
  const candidates: StackCandidate[] = []
  const seen = new Set<string>()
  for (const pattern of [CANDIDATE_TRIGGER, MUST_HAVE_TRIGGER]) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const phrase = match[1] ?? ""
      for (const raw of phrase.split(CANDIDATE_SPLIT)) {
        const term = cleanCandidate(raw)
        if (term.length < 2 || term.length > 60) continue
        if (!isCandidateShape(term)) continue
        const key = term.toLowerCase()
        if (known.has(key) || seen.has(key)) continue
        seen.add(key)
        candidates.push({ term, section, context: candidateContext(text, match.index) })
        if (candidates.length >= 10) return candidates
      }
    }
  }
  return candidates
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
  catalog: readonly TechTerm[] = TECH_CATALOG,
): StackCheckResult | null {
  const stack = parseDeclaredStack(profileText)
  if (stack === null) return null

  const extraTerms = [...stack.primary, ...stack.working].map((term) => canonicalize(term, catalog))
  const stackTerms = new Set(extraTerms.map((term) => term.toLowerCase()))
  const sections = splitPostingSections(postingText)
  const mentioned = extractTerms(postingText, extraTerms, catalog)
  const required = extractTerms(sections.required, extraTerms, catalog)
  const optional = extractTerms(sections.optional, extraTerms, catalog)

  const known = new Set(
    [
      ...catalog.flatMap((term) => [term.name, ...term.aliases]),
      ...extraTerms,
      ...mentioned,
      ...required,
      ...optional,
    ].map((term) => term.toLowerCase()),
  )
  const candidates = [
    ...extractCandidates(sections.required, "required", known),
    ...extractCandidates(sections.optional, "optional", known),
  ]
  const seenCandidates = new Set<string>()
  const uniqueCandidates = candidates
    .filter((candidate) => {
      const key = candidate.term.toLowerCase()
      if (seenCandidates.has(key)) return false
      seenCandidates.add(key)
      return true
    })
    .slice(0, 10)

  return {
    targetRoles: parseTargetRoles(preferencesText),
    sectionsFound: sections.sectionsFound,
    required,
    optional,
    matched: mentioned.filter((term) => stackTerms.has(term.toLowerCase())),
    requiredNotInStack: required.filter((term) => !stackTerms.has(term.toLowerCase())),
    optionalNotInStack: optional.filter((term) => !stackTerms.has(term.toLowerCase())),
    mentioned,
    candidates: uniqueCandidates,
  }
}
