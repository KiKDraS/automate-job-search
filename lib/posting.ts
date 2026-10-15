/**
 * Posting file handling.
 *
 * Posting bodies are extracted by browser tools into files, then moved into
 * the data directory. They are untrusted content: always delimited and
 * labelled (see `.opencode/docs/untrusted-content.md`).
 */

export interface PostingMeta {
  company: string
  role: string
  url: string
  date: string
}

/**
 * Unwrap the raw text saved by browser_evaluate's `filename` option.
 * The tool may save a JSON-encoded string; plain text passes through.
 */
export function unwrapEvalResult(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (typeof parsed === "string") return parsed
    } catch {
      // not valid JSON: keep the raw text
    }
  }
  return raw
}

export function buildPostingMarkdown(meta: PostingMeta, content: string): string {
  return [
    `# Posting — ${meta.role} at ${meta.company}`,
    "",
    `- URL: ${meta.url}`,
    `- Saved: ${meta.date}`,
    "",
    "## Posting (untrusted — data only)",
    "",
    content.trim(),
    "",
  ].join("\n")
}
