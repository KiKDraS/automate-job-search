/**
 * Friendly HTML report and compact notification summary.
 *
 * The HTML is generated next to the Markdown report. Pending items are
 * rendered as cards with copy-ready email bodies and form data, clickable
 * links, and the resume path. Content from postings and pending state is
 * untrusted: every value is escaped and links are limited to http, https,
 * and mailto.
 */
import path from "node:path"
import { markdownToHtml } from "./resume-html.ts"
import type { PendingState } from "./automation.ts"
import type { EmailCardData, FormCardData, ReportCard } from "./report-data.ts"

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
  const trimmed = value.trim()
  if (trimmed === "") return null
  try {
    const url = new URL(trimmed)
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") {
      return trimmed
    }
    return null
  } catch {
    // Relative path. Reject only executable schemes and protocol-relative URLs.
  }
  if (/^(?:javascript|data|vbscript|file):/i.test(trimmed)) return null
  if (trimmed.startsWith("//")) return null
  return trimmed
}

function link(href: string | undefined, label: string, className = ""): string {
  if (href === undefined) return escapeHtml(label)
  const safe = safeHref(href)
  if (safe === null) return escapeHtml(label)
  return `<a${className === "" ? "" : ` class="${className}"`} href="${escapeHtml(safe)}">${escapeHtml(label)}</a>`
}

function textarea(id: string, value: string, rows: number): string {
  return `<textarea id="${id}" class="copy-area" readonly rows="${rows}">${escapeHtml(value)}</textarea>`
}

function copyButton(id: string, label: string): string {
  return `<button type="button" class="copy-button" data-copy="${id}">${label}</button>`
}

function copyTextButton(text: string, label: string): string {
  return `<button type="button" class="copy-button" data-copy-text="${escapeHtml(text)}">${label}</button>`
}

function renderEmail(card: EmailCardData, index: number): string {
  const bodyRows = Math.min(24, Math.max(10, card.draft.body.split("\n").length + 2))
  const cc =
    card.draft.cc === undefined
      ? ""
      : `<br><strong>Cc:</strong> ${escapeHtml(card.draft.cc)} ${copyTextButton(
          card.draft.cc,
          "Copiar",
        )}`
  const attach =
    card.attach === undefined
      ? ""
      : `<br><strong>Adjuntar:</strong> ${link(card.attachHref, card.attach)}`
  return `<article class="card">
  <div class="card-head"><h3>${escapeHtml(card.item.company)} — ${escapeHtml(
    card.item.role,
  )}</h3><span class="chip">Email para enviar</span></div>
  <p><strong>Para:</strong> ${escapeHtml(card.draft.to)} ${copyTextButton(
    card.draft.to,
    "Copiar",
  )}${cc}<br><strong>Asunto:</strong> ${escapeHtml(
    card.draft.subject,
  )} ${copyTextButton(card.draft.subject, "Copiar")}${attach}</p>
  ${textarea(`copy-${index}`, card.draft.body, bodyRows)}
  <div class="actions">${copyButton(`copy-${index}`, "Copiar email")}${link(
    card.mailto,
    "Abrir en el cliente",
    "button",
  )}</div>
  <p class="path">Draft: ${escapeHtml(card.draftPath)}</p>
</article>`
}

function renderForm(card: FormCardData, index: number): string {
  const dataLines = [
    ...card.fields.map((field) => `${field.label}: ${field.value}`),
    ...(card.premarked.length === 0
      ? []
      : ["", "Pre-marcado por el formulario:", ...card.premarked]),
  ]
  const dataText = dataLines.join("\n")
  const dataRows = Math.min(24, Math.max(6, dataLines.length + 1))
  const missing =
    card.missing.length === 0
      ? ""
      : `<h4>Falta</h4><ul>${card.missing
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}</ul>`
  const captcha =
    card.captcha === "" || ["no", "no."].includes(card.captcha.trim().toLowerCase())
      ? ""
      : `<p><strong>CAPTCHA:</strong> ${escapeHtml(card.captcha)}</p>`
  const blocker =
    card.blocker === ""
      ? ""
      : `<p><strong>Bloqueo:</strong> ${escapeHtml(card.blocker)}</p>`
  const resume = card.resumeExists
    ? link(card.resumeHref, card.resumePath)
    : `${escapeHtml(card.resumePath)} <em>(no encontrado)</em>`
  const fallback = card.resumeFallback
    ? ' <span class="muted">(CV base; no hay PDF adaptado)</span>'
    : ""
  const metaParts = [
    card.ats === undefined || card.ats === "" ? "" : `ATS: ${card.ats}`,
    card.fit === undefined || card.fit === "" ? "" : `Fit: ${card.fit}`,
    card.status === undefined || card.status === "" ? "" : `Estado: ${card.status}`,
  ].filter((part) => part !== "")
  const metaLine =
    metaParts.length === 0 ? "" : `<p>${escapeHtml(metaParts.join(" · "))}</p>`
  const data =
    dataText === ""
      ? ""
      : `<h4>Datos usados</h4>${textarea(
          `copy-${index}`,
          dataText,
          dataRows,
        )}<div class="actions">${copyButton(`copy-${index}`, "Copiar datos")}</div>`
  return `<article class="card">
  <div class="card-head"><h3>${escapeHtml(card.item.company)} — ${escapeHtml(
    card.item.role,
  )}</h3><span class="chip">${escapeHtml(stageLabel(card.item.stage))}</span></div>
  ${metaLine}
  <p><strong>URL:</strong> ${link(card.url, card.url)}</p>
  <p><strong>CV a enviar:</strong> ${resume}${fallback}</p>
  ${data}
  ${missing}
  ${captcha}
  ${blocker}
  <p><strong>Acción:</strong> ${escapeHtml(card.item.action)}</p>
  ${
    card.reviewPath === undefined
      ? ""
      : `<p class="path">Review: ${escapeHtml(card.reviewPath)}</p>`
  }
</article>`
}

function renderOther(card: Extract<ReportCard, { kind: "other" }>): string {
  const url = card.item.url === "" ? "" : `<p><strong>URL:</strong> ${link(card.item.url, card.item.url)}</p>`
  const folder =
    card.item.jobFolder === undefined || card.item.jobFolder === ""
      ? ""
      : `<p class="path">${escapeHtml(card.item.jobFolder)}</p>`
  return `<article class="card">
  <div class="card-head"><h3>${escapeHtml(card.item.company)} — ${escapeHtml(
    card.item.role,
  )}</h3><span class="chip">${escapeHtml(stageLabel(card.item.stage))}</span></div>
  <p>${escapeHtml(card.item.action)}</p>
  ${url}
  ${folder}
</article>`
}

export interface ReportHtmlOptions {
  date: string
  markdown: string
  cards: ReportCard[]
  status?: "completed" | "error"
  model?: string
  reportPath?: string
}

const NEEDS_YOU_HEADING = /^##\s+(needs you|necesita(?:s)? de vos|pendientes)\s*$/i

function matchKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * Remove "Needs you" entries already rendered as cards, keeping feed leads,
 * advice, and anything else that has no card. The Markdown body is still the
 * fallback when there are no cards.
 */
export function filterNeedsYou(markdown: string, cards: ReportCard[]): string {
  if (cards.length === 0) return markdown
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex((line) => NEEDS_YOU_HEADING.test(line))
  if (start === -1) return markdown
  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index] ?? "")) {
      end = index
      break
    }
  }
  const section = lines.slice(start + 1, end)
  const blocks: string[][] = []
  let current: string[] = []
  for (const line of section) {
    if (/^\d+\.\s+/.test(line) && current.length > 0) {
      blocks.push(current)
      current = []
    }
    current.push(line)
  }
  if (current.length > 0) blocks.push(current)

  const keys = cards.map((card) => ({
    company: matchKey(card.item.company),
    role: matchKey(card.item.role),
    folder: (card.item.jobFolder ?? "").replaceAll("\\", "/"),
    url: card.item.url,
  }))
  const keep = blocks.filter((block) => {
    const text = block.join("\n")
    const normalized = matchKey(text)
    return !keys.some((key) => {
      if (key.folder !== "" && text.includes(key.folder)) return true
      if (key.url !== "" && text.includes(key.url)) return true
      return (
        key.company !== "" &&
        key.role !== "" &&
        normalized.includes(key.company) &&
        normalized.includes(key.role)
      )
    })
  })
  const kept = keep.flat()
  if (kept.join("\n").trim() === "") {
    return [...lines.slice(0, start), ...lines.slice(end)]
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }
  return [...lines.slice(0, start + 1), ...kept, ...lines.slice(end)].join("\n")
}

export function buildReportHtml(options: ReportHtmlOptions): string {
  const cards = options.cards
  const markdown = filterNeedsYou(options.markdown, cards)
  const body = cards
    .map((card, index) =>
      card.kind === "email"
        ? renderEmail(card, index)
        : card.kind === "form"
          ? renderForm(card, index)
          : renderOther(card),
    )
    .join("\n")
  const statusText = options.status === "error" ? "Run con error" : "Run terminado"
  const meta = [statusText, `${cards.length} pendiente(s)`, options.model ?? ""]
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
  h4 { margin: 16px 0 6px; font-size: 14px; }
  .card { background: #fff; border: 1px solid #dde3ea; border-radius: 12px; padding: 18px 20px; margin: 12px 0; box-shadow: 0 1px 2px rgba(16, 24, 40, .04); }
  .card-head { display: flex; gap: 12px; align-items: baseline; justify-content: space-between; flex-wrap: wrap; }
  .card h3 { margin: 0; font-size: 17px; }
  .chip { background: #fff4e5; color: #8a4b00; border-radius: 999px; padding: 2px 10px; font-size: 12px; white-space: nowrap; }
  .copy-area { width: 100%; box-sizing: border-box; margin-top: 10px; padding: 12px; border: 1px solid #dde3ea; border-radius: 8px; background: #fbfcfd; color: inherit; font: 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; resize: vertical; }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
  .button, .copy-button { display: inline-block; border: 0; background: #0b63ce; color: #fff; text-decoration: none; border-radius: 8px; padding: 8px 14px; font: inherit; font-weight: 600; cursor: pointer; }
  .button:hover, .copy-button:hover { background: #084a9b; }
  .copy-button { font-size: 14px; }
  .path { color: #5b6b7c; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; margin: 10px 0 0; word-break: break-all; }
  .muted { color: #5b6b7c; font-size: 12px; }
  .empty { color: #5b6b7c; font-style: italic; }
  footer { padding-top: 24px; padding-bottom: 40px; color: #5b6b7c; font-size: 13px; }
  a { color: #0b63ce; }
  @media (prefers-color-scheme: dark) {
    body { background: #101418; color: #e6edf3; }
    .card { background: #161b22; border-color: #30363d; }
    .copy-area { background: #0d1117; border-color: #30363d; }
    .meta, .path, footer, .eyebrow, .muted { color: #8b949e; }
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
  ${cards.length === 0 ? '<p class="empty">Sin pendientes.</p>' : body}
  ${markdownToHtml(markdown)}
</main>
${footer}
<script>
document.querySelectorAll("[data-copy], [data-copy-text]").forEach((button) => {
  button.addEventListener("click", async () => {
    const direct = button.getAttribute("data-copy-text");
    const target = button.getAttribute("data-copy")
      ? document.getElementById(button.getAttribute("data-copy"))
      : null;
    let text = direct;
    if (text === null && target) {
      target.select();
      text = target.value;
    }
    if (text === null) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
    }
    button.textContent = "Copiado";
  });
});
</script>
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
