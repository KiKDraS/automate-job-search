/**
 * Application email drafts — parse the markdown written by the
 * `application-email` skill and build a `mailto:` handoff.
 *
 * The handoff opens the user's mail client with To, Subject, and Body
 * prefilled. It never sends.
 */

export interface EmailDraft {
  to: string
  cc?: string
  subject: string
  body: string
}

function field(source: string, label: string): string | null {
  const match = source.match(new RegExp(`^- ${label}:\\s*(.+)$`, "m"))
  return match?.[1]?.trim() ?? null
}

export function parseEmailDraft(source: string): EmailDraft | null {
  const to = field(source, "To")
  const subject = field(source, "Subject")
  if (to === null || subject === null) return null
  const cc = field(source, "Cc") ?? undefined
  const afterBody = source.split(/^## Body\s*$/m)[1]
  const body = afterBody?.split(/^## /m)[0]?.trim() ?? ""
  if (body === "") return null
  return { to, cc, subject, body }
}

export function buildMailto(draft: EmailDraft): string {
  const params = new URLSearchParams({ subject: draft.subject, body: draft.body })
  if (draft.cc !== undefined && draft.cc.trim() !== "") params.set("cc", draft.cc)
  return `mailto:${encodeURIComponent(draft.to)}?${params.toString()}`
}
