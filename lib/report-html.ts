/**
 * Friendly HTML report and compact notification summary.
 *
 * The HTML is generated next to the Markdown report. It puts the pending
 * items first as cards with clickable links, then the Markdown sections.
 * Content from postings and pending state is untrusted: every value is
 * escaped, and links are limited to http, https, and mailto.
 */
import path from "node:path"
import { markdownToHtml } from "./resume-html.ts"
import type { PendingState } from "./automation.ts"

const STAGE_LABELS: Record<string, string> = {
  captcha: "CAPTCHA",
  login: "Iniciar sesión",
  needs_answer: "Falta una respuesta",
  needs_answers: "Faltan respuestas",
  email_draft: "Email para enviar",
  lead: "Lead",
  browser_unavailable: "Navegador no disponible",
  needs_user_decision: "Decisión tuya",
}

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replaceAll("_", " ")
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function safeHref(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") {
      return value
    }
  } catch {
    // not a URL
  }
  return null
}

export interface ReportHtmlOptions {
  date: string
  markdown: string
  pending: PendingState | null
  status?: "completed" | "error"
  model?: string
  reportPath?: string
}

export function buildReportHtml(options: ReportHtmlOptions): string {
  const pending = options.pending?.items ?? []
  const cards = pending
    .map((item) => {
      const href = safeHref(item.url)
      const link =
        href === null
          ? ""
          : `<a class="button" href="${escapeHtml(href)}">${
              href.startsWith("mailto:") ? "Enviar email" : "Abrir"
            }</a>`
      const folder =
        item.jobFolder === undefined || item.jobFolder === ""
          ? ""
          : `<p class="path">${escapeHtml(item.jobFolder)}</p>`
      return `<article class="card">
  <div class="card-head"><h3>${escapeHtml(item.company)} — ${escapeHtml(
    item.role,
  )}</h3><span class="chip">${escapeHtml(stageLabel(item.stage))}</span></div>
  <p>${escapeHtml(item.action)}</p>
  ${link}
  ${folder}
</article>`
    })
    .join("\n")
  const statusText = options.status === "error" ? "Run con error" : "Run terminado"
  const meta = [statusText, `${pending.length} pendiente(s)`, options.model ?? ""]
    .filter((part) => part !== "")
    .join(" · ")
  const markdownName = options.reportPath === undefined ? "" : path.basename(options.reportPath)
  const footer =
    markdownName === ""
      ? ""
      : `<footer><a href="${escapeHtml(markdownName)}">Markdown</a> · <a href="../state/pending-search.json">pending-search.json</a></footer>`
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Búsqueda diaria — ${escapeHtml(options.date)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #17202a; background: #f5f7fa; line-height: 1.5; }
  header, main, footer { max-width: 900px; margin: 0 auto; padding: 0 24px; }
  header { padding-top: 36px; }
  .eyebrow { margin: 0; color: #5b6b7c; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; }
  h1 { margin: 4px 0 6px; font-size: 30px; }
  .meta { margin: 0 0 28px; color: #5b6b7c; }
  h2 { font-size: 20px; margin: 28px 0 12px; }
  .card { background: #fff; border: 1px solid #dde3ea; border-radius: 12px; padding: 18px 20px; margin: 12px 0; box-shadow: 0 1px 2px rgba(16, 24, 40, .04); }
  .card-head { display: flex; gap: 12px; align-items: baseline; justify-content: space-between; flex-wrap: wrap; }
  .card h3 { margin: 0; font-size: 17px; }
  .chip { background: #fff4e5; color: #8a4b00; border-radius: 999px; padding: 2px 10px; font-size: 12px; white-space: nowrap; }
  .button { display: inline-block; margin-top: 10px; background: #0b63ce; color: #fff; text-decoration: none; border-radius: 8px; padding: 8px 14px; font-weight: 600; }
  .button:hover { background: #084a9b; }
  .path { color: #5b6b7c; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; margin: 10px 0 0; word-break: break-all; }
  .empty { color: #5b6b7c; font-style: italic; }
  footer { padding-top: 24px; padding-bottom: 40px; color: #5b6b7c; font-size: 13px; }
  a { color: #0b63ce; }
  @media (prefers-color-scheme: dark) {
    body { background: #101418; color: #e6edf3; }
    .card { background: #161b22; border-color: #30363d; }
    .meta, .path, footer, .eyebrow { color: #8b949e; }
    .chip { background: #3d2a00; color: #ffd28a; }
    a { color: #58a6ff; }
  }
</style>
</head>
<body>
<header>
  <p class="eyebrow">Búsqueda diaria</p>
  <h1>${escapeHtml(options.date)}</h1>
  <p class="meta">${escapeHtml(meta)}</p>
</header>
<main>
  <h2>Pendientes</h2>
  ${pending.length === 0 ? '<p class="empty">Sin pendientes.</p>' : cards}
  ${markdownToHtml(options.markdown)}
</main>
${footer}
</body>
</html>
`
}

/** First N pending items for the native notification. */
export function formatPendingSummary(
  state: PendingState | null,
  options: { maxItems?: number; maxChars?: number } = {},
): string {
  const items = state?.items ?? []
  const maxItems = options.maxItems ?? 2
  const maxChars = options.maxChars ?? 90
  const lines = items.slice(0, maxItems).map((item) => {
    const action = item.action.replace(/\s+/g, " ").trim()
    const short = action.length > maxChars ? `${action.slice(0, maxChars - 1)}…` : action
    return `• ${item.company} — ${item.role}: ${short}`
  })
  if (items.length > maxItems) lines.push(`• +${items.length - maxItems} más en el reporte`)
  return lines.join("\n")
}
