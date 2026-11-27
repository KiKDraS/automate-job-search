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
import type { PendingState } from "./automation.ts"
import type {
  CompanyPreferences,
} from "./company-preferences.ts"
import { isCompanyExcluded } from "./company-preferences.ts"
import type { ReportAction } from "./report-actions.ts"
import type {
  EmailCardData,
  FormCardData,
  LeadCardData,
  ReportCard,
} from "./report-data.ts"

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
  const external = /^https?:/i.test(safe)
  const target = external ? ' target="_blank" rel="noopener noreferrer"' : ""
  const classAttr = className === "" ? "" : ` class="${className}"`
  return `<a${classAttr} href="${escapeHtml(safe)}"${target}>${escapeHtml(label)}</a>`
}

function mappedHref(
  href: string | undefined,
  options: ReportHtmlOptions,
): string | undefined {
  if (href === undefined) return undefined
  return options.fileUrl === undefined ? href : options.fileUrl(href)
}

function anchor(href: string, label: string): string {
  return link(href, label)
}

function isHref(value: string): boolean {
  return /^(?:https?:\/\/|mailto:)/i.test(value)
}

function inlineReport(raw: string): string {
  const pattern =
    /(`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)\s]+\)|(?:https?:\/\/|mailto:)[^\s<>()]+|\*\*[^*]+\*\*)/g
  const parts: string[] = []
  let last = 0
  for (const match of raw.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) parts.push(escapeHtml(raw.slice(last, index)))
    const token = match[0]
    if (token.startsWith("`")) {
      const code = token.slice(1, -1)
      parts.push(isHref(code) ? anchor(code, code) : `<code>${escapeHtml(code)}</code>`)
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(
        /^\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)$/,
      )
      parts.push(
        linkMatch === null
          ? escapeHtml(token)
          : anchor(linkMatch[2] ?? "", linkMatch[1] ?? ""),
      )
    } else if (token.startsWith("**")) {
      parts.push(`<strong>${escapeHtml(token.slice(2, -2))}</strong>`)
    } else {
      let url = token
      let suffix = ""
      const trailing = url.match(/[.,;:!?]+$/)
      if (trailing !== null) {
        suffix = trailing[0]
        url = url.slice(0, -suffix.length)
      }
      parts.push(anchor(url, url) + escapeHtml(suffix))
    }
    last = index + token.length
  }
  parts.push(escapeHtml(raw.slice(last)))
  return parts.join("")
}

/** Report Markdown with links, code spans, and bold. */
export function reportMarkdownToHtml(markdown: string): string {
  const out: string[] = []
  let inList = false
  const closeList = (): void => {
    if (inList) {
      out.push("</ul>")
      inList = false
    }
  }
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === "") {
      closeList()
      continue
    }
    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      closeList()
      const level = heading[1]?.length ?? 1
      out.push(`<h${level}>${inlineReport(heading[2] ?? "")}</h${level}>`)
      continue
    }
    const bullet = trimmed.match(/^[-*]\s+(.*)$/)
    if (bullet) {
      if (!inList) {
        out.push("<ul>")
        inList = true
      }
      out.push(`<li>${inlineReport(bullet[1] ?? "")}</li>`)
      continue
    }
    closeList()
    out.push(`<p>${inlineReport(trimmed)}</p>`)
  }
  closeList()
  return out.join("\n")
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

const ACTION_LABELS: Record<string, string> = {
  apply: "Aplicar",
  dismiss: "Desestimar",
  skip: "No aplicar",
  retry: "Reintentar",
  mark_sent: "Ya lo envié",
  draft_cv: "Armar CV",
  draft_mp: "Armar MP",
  note: "Guardar nota",
}

function cardAttributes(card: ReportCard): string {
  const folder = card.item.jobFolder ?? ""
  return ` data-company="${escapeHtml(card.item.company)}" data-role="${escapeHtml(
    card.item.role,
  )}"${folder === "" ? "" : ` data-folder="${escapeHtml(folder)}"`}`
}

function actionTypes(card: ReportCard): string[] {
  if (card.kind === "email") return ["mark_sent", "dismiss", "note"]
  if (card.kind === "form") return ["retry", "dismiss", "note"]
  if (card.kind === "lead") {
    const types = ["apply", "dismiss"]
    if (card.cv === undefined) types.push("draft_cv")
    if (card.message === undefined) types.push("draft_mp")
    types.push("note")
    return types
  }
  return ["apply", "dismiss", "retry", "note"]
}

function actionLabel(card: ReportCard, type: string): string {
  if (type === "dismiss") {
    if (card.kind === "email") return "Desestimar email"
    if (card.kind === "form") return "Desestimar postulación"
    if (card.kind === "lead") return "Desestimar lead"
    return "Desestimar"
  }
  return ACTION_LABELS[type] ?? type
}

function renderActions(card: ReportCard, options: ReportHtmlOptions): string {
  const buttons = actionTypes(card)
    .map(
      (type) =>
        `<button type="button" class="action-button" data-action="${type}">${actionLabel(card, type)}</button>`,
    )
    .join("")
  const company = card.item.company
  const excluded =
    options.companyPreferences === undefined
      ? false
      : isCompanyExcluded(options.companyPreferences, company)
  const companyLine =
    company === ""
      ? ""
      : excluded
        ? `<p class="company-pref"><span class="chip excluded">No recibir más</span> <button type="button" class="action-button" data-company-pref="yes">Volver a recibir ofertas</button></p>`
        : `<p class="company-pref"><button type="button" class="action-button" data-company-pref="no">No recibir más ofertas de esta compañía</button></p>`
  return `<div class="card-actions">
  <div class="actions">${buttons}</div>
  <textarea class="note-area" data-note rows="2" placeholder="Nota para el agente (opcional)"></textarea>
  ${companyLine}
  <p class="muted action-status" data-action-status></p>
</div>`
}

function renderEmail(
  card: EmailCardData,
  index: number,
  options: ReportHtmlOptions,
): string {
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
      : `<br><strong>Adjuntar:</strong> ${link(
          mappedHref(card.attachHref, options),
          card.attach,
        )}`
  const actions = renderActions(card, options)
  return `<article class="card"${cardAttributes(card)}>
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
  ${actions}
</article>`
}

function renderForm(
  card: FormCardData,
  index: number,
  options: ReportHtmlOptions,
): string {
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
    ? link(mappedHref(card.resumeHref, options), card.resumePath)
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
  return `<article class="card"${cardAttributes(card)}>
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
  ${renderActions(card, options)}
</article>`
}

function renderLead(
  card: LeadCardData,
  index: number,
  options: ReportHtmlOptions,
): string {
  const meta = [
    card.author === undefined || card.author === "" ? "" : `Autor: ${card.author}`,
    card.fit === undefined || card.fit === "" ? "" : `Fit: ${card.fit}`,
    card.mpRequested ? "MP pedido" : "",
  ]
    .filter((part) => part !== "")
    .join(" · ")
  const why =
    card.why === undefined || card.why === ""
      ? ""
      : `<p><strong>Por qué:</strong> ${escapeHtml(card.why)}</p>`
  const note =
    card.applyNote === undefined || card.applyNote === ""
      ? ""
      : `<p class="muted">${escapeHtml(card.applyNote)}</p>`
  const cv =
    card.cv === undefined
      ? "no creado"
      : link(mappedHref(card.cv.href, options), "CV adaptado")
  const mp =
    card.message === undefined
      ? card.mpRequested
        ? "pedido; falta armarlo"
        : "no pedido"
      : `${link(
          mappedHref(card.message.href, options),
          "borrador listo",
        )} <span class="muted">(no enviado)</span>`
  const email =
    card.emailAddress !== undefined
      ? `${escapeHtml(card.emailAddress)} ${copyTextButton(card.emailAddress, "Copiar")}`
      : card.emailDraft === undefined
        ? "no disponible"
        : link(mappedHref(card.emailDraft.href, options), "borrador listo")
  const message =
    card.message?.text === undefined
      ? ""
      : `<h4>MP</h4>${textarea(
          `lead-copy-${index}`,
          card.message.text,
          Math.min(12, Math.max(6, card.message.text.split("\n").length + 2)),
        )}<div class="actions">${copyButton(`lead-copy-${index}`, "Copiar MP")}${link(
          mappedHref(card.message.href, options),
          "Abrir borrador",
          "button",
        )}</div>`
  const post =
    card.postUrl === undefined || card.postUrl === card.applyUrl
      ? ""
      : link(card.postUrl, "Ver post", "button")
  return `<article class="card"${cardAttributes(card)}>
  <div class="card-head"><h3>${escapeHtml(card.item.company)} — ${escapeHtml(
    card.item.role,
  )}</h3><span class="chip">Lead</span></div>
  ${meta === "" ? "" : `<p>${escapeHtml(meta)}</p>`}
  ${why}
  <p><strong>Qué tenés que hacer:</strong> ${escapeHtml(card.item.action)}</p>
  <div class="actions">${link(card.applyUrl, "Abrir postulación", "button")}${post}</div>
  ${note}
  <p><strong>Artefactos:</strong> CV: ${cv} · MP: ${mp} · Email: ${email}</p>
  ${message}
  <p class="path">Lead: ${escapeHtml(card.leadPath)}</p>
  ${renderActions(card, options)}
</article>`
}

function renderOther(
  card: Extract<ReportCard, { kind: "other" }>,
  options: ReportHtmlOptions,
): string {
  const url = card.item.url === "" ? "" : `<p><strong>URL:</strong> ${link(card.item.url, card.item.url)}</p>`
  const folder =
    card.item.jobFolder === undefined || card.item.jobFolder === ""
      ? ""
      : `<p class="path">${escapeHtml(card.item.jobFolder)}</p>`
  return `<article class="card"${cardAttributes(card)}>
  <div class="card-head"><h3>${escapeHtml(card.item.company)} — ${escapeHtml(
    card.item.role,
  )}</h3><span class="chip">${escapeHtml(stageLabel(card.item.stage))}</span></div>
  <p>${escapeHtml(card.item.action)}</p>
  ${url}
  ${folder}
  ${renderActions(card, options)}
</article>`
}

export interface ReportApi {
  actionsUrl: string
  companyUrl: string
}

export interface ReportHtmlOptions {
  date: string
  markdown: string
  cards: ReportCard[]
  status?: "completed" | "error"
  model?: string
  reportPath?: string
  companyPreferences?: CompanyPreferences
  actions?: ReportAction[]
  interactive?: ReportApi
  /** Map data-relative file hrefs to the interactive server's file endpoint. */
  fileUrl?: (href: string) => string
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
    author: card.kind === "lead" ? matchKey(card.author ?? "") : "",
  }))
  const keep = blocks.filter((block) => {
    const text = block.join("\n")
    const normalized = matchKey(text)
    return !keys.some((key) => {
      if (key.folder !== "" && text.includes(key.folder)) return true
      if (key.url !== "" && text.includes(key.url)) return true
      if (
        key.author !== "" &&
        key.role !== "" &&
        normalized.includes(key.author) &&
        normalized.includes(key.role)
      ) {
        return true
      }
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
  let counter = 0
  const renumbered = keep.map((block) => {
    const firstIndex = block.findIndex((line) => line.trim() !== "")
    if (firstIndex === -1) return block
    const first = block[firstIndex] ?? ""
    if (!/^\d+\.\s+/.test(first)) return block
    counter += 1
    const updated = [...block]
    updated[firstIndex] = first.replace(/^\d+\./, `${counter}.`)
    return updated
  })
  return [
    ...lines.slice(0, start + 1),
    ...renumbered.flat(),
    ...lines.slice(end),
  ].join("\n")
}

export function buildReportHtml(options: ReportHtmlOptions): string {
  const cards = options.cards
  const markdown = filterNeedsYou(options.markdown, cards)
  const body = cards
    .map((card, index) =>
      card.kind === "email"
        ? renderEmail(card, index, options)
        : card.kind === "form"
          ? renderForm(card, index, options)
          : card.kind === "lead"
            ? renderLead(card, index, options)
            : renderOther(card, options),
    )
    .join("\n")
  const pending = (options.actions ?? []).filter((action) => action.status === "pending")
  const actionsHtml =
    pending.length === 0
      ? ""
      : `<h2>Tus acciones</h2><ul>${pending
          .map(
            (action) =>
              `<li>${escapeHtml(action.company)} — ${escapeHtml(
                action.role,
              )}: <strong>${escapeHtml(action.type)}</strong>${
                action.note === undefined ? "" : ` — ${escapeHtml(action.note)}`
              }</li>`,
          )
          .join("")}</ul>`
  const apiConfig = options.interactive === undefined ? "null" : JSON.stringify(options.interactive)
  const modeHint =
    options.interactive === undefined
      ? "Modo archivo: las acciones se copian para pegarlas en el chat del agente."
      : "Modo interactivo: las acciones se guardan para que el agente las procese al inicio del próximo turno."
  const statusText = options.status === "error" ? "Run con error" : "Run terminado"
  const meta = [statusText, `${cards.length} pendiente(s)`, options.model ?? ""]
    .filter((part) => part !== "")
    .join(" · ")
  const markdownName = options.reportPath === undefined ? "" : path.basename(options.reportPath)
  const markdownHref =
    options.fileUrl === undefined ? markdownName : options.fileUrl(`reports/${markdownName}`)
  const pendingHref =
    options.fileUrl === undefined
      ? "../state/pending-search.json"
      : options.fileUrl("state/pending-search.json")
  const footer =
    markdownName === ""
      ? ""
      : `<footer><a href="${escapeHtml(markdownHref)}">Markdown</a> · <a href="${escapeHtml(pendingHref)}">pending-search.json</a></footer>`
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
  .card-actions { border-top: 1px solid #dde3ea; margin-top: 16px; padding-top: 12px; }
  .action-button { display: inline-block; border: 1px solid #c9d8ea; background: #eef3f9; color: #0b4f9c; border-radius: 8px; padding: 6px 11px; font: inherit; font-weight: 600; cursor: pointer; }
  .action-button:hover { background: #dbe7f6; }
  .action-button:disabled { opacity: .6; cursor: wait; }
  .note-area { width: 100%; box-sizing: border-box; margin-top: 10px; padding: 8px 10px; border: 1px solid #dde3ea; border-radius: 8px; background: #fbfcfd; color: inherit; font: 13px inherit; resize: vertical; }
  .company-pref { margin: 8px 0 0; }
  .chip.excluded { background: #fdecea; color: #a61b1b; }
  .action-status { min-height: 1.2em; }
  .button, .copy-button { display: inline-block; border: 0; background: #0b63ce; color: #fff; text-decoration: none; border-radius: 8px; padding: 8px 14px; font: inherit; font-weight: 600; cursor: pointer; }
  .button:hover, .copy-button:hover { background: #084a9b; }
  .copy-button { font-size: 14px; }
  .path { color: #5b6b7c; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; margin: 10px 0 0; word-break: break-all; }
  .muted { color: #5b6b7c; font-size: 12px; }
  .empty { color: #5b6b7c; font-style: italic; }
  footer { padding-top: 24px; padding-bottom: 40px; color: #5b6b7c; font-size: 13px; }
  a { color: #0b63ce; }
  a:focus-visible, button:focus-visible { outline: 2px solid #0b63ce; outline-offset: 2px; }
  @media (prefers-color-scheme: dark) {
    body { background: #101418; color: #e6edf3; }
    .card { background: #161b22; border-color: #30363d; }
    .copy-area { background: #0d1117; border-color: #30363d; }
    .note-area { background: #0d1117; border-color: #30363d; }
    .card-actions { border-color: #30363d; }
    .action-button { background: #17263a; border-color: #2d4a6d; color: #8fc2ff; }
    .action-button:hover { background: #1e3350; }
    .meta, .path, footer, .eyebrow, .muted { color: #8b949e; }
    .chip { background: #3d2a00; color: #ffd28a; }
    .chip.excluded { background: #4a1f1f; color: #ffb3b3; }
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
  <p class="muted">${escapeHtml(modeHint)}</p>
  ${actionsHtml}
  <h2>Pendientes</h2>
  ${cards.length === 0 ? '<p class="empty">Sin pendientes.</p>' : body}
  ${reportMarkdownToHtml(markdown)}
</main>
${footer}
<script>
window.__REPORT_API__ = ${apiConfig};
async function reportCopy(text) {
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
}
async function reportPost(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
function reportCard(button) {
  const card = button.closest("article.card");
  if (!card) return null;
  return {
    card,
    company: card.getAttribute("data-company") || "",
    role: card.getAttribute("data-role") || "",
    jobFolder: card.getAttribute("data-folder") || undefined,
    note: (card.querySelector("[data-note]")?.value || "").trim() || undefined,
  };
}
document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    const info = reportCard(button);
    if (!info) return;
    const type = button.getAttribute("data-action");
    const status = info.card.querySelector("[data-action-status]");
    const payload = {
      type,
      company: info.company,
      role: info.role,
      jobFolder: info.jobFolder,
      note: info.note,
    };
    if (window.__REPORT_API__) {
      button.disabled = true;
      try {
        await reportPost(window.__REPORT_API__.actionsUrl, payload);
        if (type === "dismiss") {
          if (status) status.textContent = "Desestimada. Actualizando el reporte…";
          button.textContent = "Desestimada";
          location.reload();
          return;
        }
        if (status) status.textContent = "Guardado. El agente lo procesa al inicio del próximo turno.";
        button.textContent = "Guardado";
      } catch (error) {
        if (status) status.textContent = "No se pudo guardar: " + error;
        button.disabled = false;
      }
      return;
    }
    const lines = ["ACCIÓN PARA EL AGENTE", "action: " + type, "company: " + info.company, "role: " + info.role];
    if (info.jobFolder) lines.push("jobFolder: " + info.jobFolder);
    if (info.note) lines.push("note: " + JSON.stringify(info.note));
    await reportCopy(lines.join("\\n") + "\\n");
    if (status) status.textContent = "Copiado. Pegalo en el chat del agente.";
  });
});
document.querySelectorAll("[data-company-pref]").forEach((button) => {
  button.addEventListener("click", async () => {
    const info = reportCard(button);
    if (!info) return;
    const receiveOffers = button.getAttribute("data-company-pref") === "yes";
    const status = info.card.querySelector("[data-action-status]");
    if (window.__REPORT_API__) {
      button.disabled = true;
      try {
        await reportPost(window.__REPORT_API__.companyUrl, {
          company: info.company,
          receiveOffers,
        });
        if (status) status.textContent = receiveOffers ? "Volvés a recibir ofertas." : "No vas a recibir más ofertas.";
        button.disabled = false;
        location.reload();
      } catch (error) {
        if (status) status.textContent = "No se pudo guardar: " + error;
        button.disabled = false;
      }
      return;
    }
    await reportCopy(
      "ACCIÓN PARA EL AGENTE\\ncompany: " + info.company + "\\nreceiveOffers: " + receiveOffers + "\\n",
    );
    if (status) status.textContent = "Copiado. Pegalo en el chat del agente.";
  });
});
</script>
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
