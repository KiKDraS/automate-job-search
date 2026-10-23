/**
 * Deterministic stack check for saved postings.
 *
 * Extracts a curated set of mismatch-prone technologies and compares them
 * with the profile/base resume. It is a heuristic, not a verdict: the fit
 * scorer still reads the requirements.
 */

export interface StackTerm {
  name: string
  pattern: RegExp
}

/** Technologies that commonly sink a front-end application when absent. */
export const STACK_TERMS: readonly StackTerm[] = [
  { name: "Angular", pattern: /\bangular(?:js)?\b/i },
  { name: ".NET", pattern: /\.net\b/i },
  { name: "C#", pattern: /\bc#/i },
  { name: "Java", pattern: /\bjava\b/i },
  { name: "PHP", pattern: /\bphp\b/i },
  { name: "Laravel", pattern: /\blaravel\b/i },
  { name: "Django", pattern: /\bdjango\b/i },
  { name: "Spring", pattern: /\bspring(?:\s+boot|\s+framework)\b/i },
  { name: "Vue", pattern: /\bvue(?:\.js)?\b/i },
  { name: "Svelte", pattern: /\bsvelte(?:kit)?\b/i },
  { name: "Unity", pattern: /\bunity\b/i },
  { name: "PixiJS", pattern: /\bpixi(?:\.js|js)?\b/i },
  { name: "Flutter", pattern: /\bflutter\b/i },
  { name: "React Native", pattern: /\breact\s+native\b/i },
  { name: "Node.js", pattern: /\bnode(?:\.js)?\b/i },
  { name: "Express", pattern: /\bexpress(?:\.js)?\b/i },
  { name: "PostgreSQL", pattern: /\bpostgres(?:ql)?\b/i },
  { name: "Entity Framework", pattern: /\bentity\s+framework\b/i },
  { name: "AWS", pattern: /\baws\b/i },
  { name: "Azure", pattern: /\bazure\b/i },
  { name: "Docker", pattern: /\bdocker\b/i },
  { name: "Kubernetes", pattern: /\bkubernetes\b/i },
  { name: "Ruby", pattern: /\bruby\b/i },
  { name: "Rust", pattern: /\brust\b/i },
  { name: "Kotlin", pattern: /\bkotlin\b/i },
  { name: "Swift", pattern: /\bswift\b/i },
]

/** Terms from the curated list that appear in `text`, sorted by name. */
export function extractStackTerms(text: string): string[] {
  return STACK_TERMS.filter((term) => term.pattern.test(text))
    .map((term) => term.name)
    .sort()
}

export interface StackCheckResult {
  found: string[]
  matched: string[]
  missing: string[]
}

/** Compare the posting's stack terms with the profile/base resume text. */
export function checkStack(postingText: string, evidenceText: string): StackCheckResult {
  const found = extractStackTerms(postingText)
  const matched = found.filter((name) => {
    const term = STACK_TERMS.find((candidate) => candidate.name === name)
    return term !== undefined && term.pattern.test(evidenceText)
  })
  const missing = found.filter((name) => !matched.includes(name))
  return { found, matched, missing }
}
