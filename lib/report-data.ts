/**
 * Report cards — turn pending items into copy/paste-ready presentation data.
 *
 * Email cards read `<job folder>/application-email.md` (To, Cc, Subject,
 * Attach, body). Form cards read `<job folder>/apply-review.md` (filled
 * fields, still-blank fields, CAPTCHA, blocker) and locate `resume.pdf`.
 * The HTML report and `/job/report` both consume this data.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import {
  buildMailto,
  parseEmailDraft,
  type EmailDraft,
} from "./email.ts"
import type { PendingItem, PendingState } from "./automation.ts"

export interface FormField {
  label: string
  value: string
}

export interface EmailCardData {
  kind: "email"
  item: PendingItem
  draft: EmailDraft
  mailto: string
  attach?: string
  attachHref?: string
  draftPath: string
}

export interface FormCardData {
  kind: "form"
  item: PendingItem
  url: string
  ats?: string
  fit?: string
  status?: string
  fields: FormField[]
  premarked: string[]
  missing: string[]
  captcha: string
  blocker: string
  resumePath: string
  resumeHref?: string
  resumeExists: boolean
  resumeFallback: boolean
  reviewPath?: string
}

export interface OtherCardData {
  kind: "other"
  item: PendingItem
}

export type ReportCard = EmailCardData | FormCardData | OtherCardData

const FORM_STAGES = new Set([
  "captcha",
  "captcha_required",
  "needs_answer",
  "needs_answers",
  "login",
  "account_required",
  "needs_user_decision",
  "blocked",
  "form_blocked",
])

function field(source: string, label: string): string | undefined {
  return source
    .match(new RegExp(`^- ${label}:\\s*(.+?)\\s*$`, "m"))?.[1]
    ?.trim()
}

function splitRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "")
  const cells: string[] = []
  let current = ""
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index] ?? ""
    if (char === "\\" && inner[index + 1] === "|") {
      current += "|"
      index += 1
      continue
    }
    if (char === "|") {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
}

function sectionMap(source: string): Map<string, string> {
  const map = new Map<string, string>()
  let current = ""
  let lines: string[] = []
  const flush = (): void => {
    if (current !== "") map.set(current.toLowerCase(), lines.join("\n").trim())
  }
  for (const line of source.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/)
    if (heading) {
      flush()
      current = heading[1] ?? ""
      lines = []
      continue
    }
    lines.push(line)
  }
  flush()
  return map
}

function section(map: Map<string, string>, prefix: string): string {
  for (const [key, value] of map) {
    if (key.startsWith(prefix)) return value
  }
  return ""
}

function sectionsMatching(map: Map<string, string>, prefixes: readonly string[]): string {
  const parts: string[] = []
  for (const [key, value] of map) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) parts.push(value)
  }
  return parts.join("\n")
}

function tableFields(text: string): FormField[] {
  const fields: FormField[] = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue
    const cells = splitRow(line)
    if (cells.length < 2) continue
    const label = cells[0] ?? ""
    if (label === "Field" || /^:?-{3,}:?$/.test(label)) continue
    if (label === "") continue
    fields.push({ label, value: cells[cells.length - 1] ?? "" })
  }
  return fields
}

function bulletPairs(text: string): FormField[] {
  const fields: FormField[] = []
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*-\s*(.+?):\s*(.+)\s*$/)
    if (match) fields.push({ label: match[1] ?? "", value: match[2] ?? "" })
  }
  return fields
}

function uniqueFields(fields: FormField[]): FormField[] {
  const seen = new Set<string>()
  const unique: FormField[] = []
  for (const field of fields) {
    const key = field.label.trim().toLowerCase()
    if (key === "" || seen.has(key)) continue
    seen.add(key)
    unique.push(field)
  }
  return unique
}

function bullets(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line !== "")
}

function firstField(source: string, labels: readonly string[]): string | undefined {
  for (const label of labels) {
    const value = field(source, label)
    if (value !== undefined) return value
  }
  return undefined
}

function captchaLines(source: string): string {
  const negatives = /\b(no|not|none|without|invisible)\b[^.]{0,20}\bcaptcha\b|\bcaptcha\b[^.]{0,20}\b(absent|not present|not shown|not required)\b/i
  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*>#\s]+/, "").trim())
    .filter((line) => /\bcaptcha\b/i.test(line) && !negatives.test(line))
    .filter((line) => !/^captcha$/i.test(line))
    .join("\n")
}

interface Review {
  url?: string
  ats?: string
  fit?: string
  status?: string
  fields: FormField[]
  premarked: string[]
  missing: string[]
  captcha: string
  blocker: string
}

/** Parse `apply-review.md` into the fields the report shows. */
export function parseApplyReview(source: string): Review {
  const map = sectionMap(source)
  const filled = sectionsMatching(map, [
    "filled state",
    "form fields",
    "review sheet",
    "contact info",
    "additional questions",
    "answers",
  ])
  const fields = uniqueFields([...tableFields(filled), ...bulletPairs(filled)])
  const blankValues = fields
    .filter((item) => /^(left blank|not answered|blank|—|-)$/i.test(item.value.trim()))
    .map((item) => item.label)
  const missing = [
    ...new Set([
      ...bullets(
        sectionsMatching(map, ["still blank", "missing", "needs answer", "unanswered", "not filled"]),
      ),
      ...blankValues,
    ]),
  ]
  const blocker =
    section(map, "blocker") ||
    section(map, "blocked") ||
    section(map, "stop reason") ||
    section(map, "reason")
  const sectionCaptcha = section(map, "captcha").trim()
  const captcha =
    sectionCaptcha === "" || /^(none|no|n\/a|not required)\.?$/i.test(sectionCaptcha)
      ? sectionCaptcha === ""
        ? captchaLines(source)
        : ""
      : sectionCaptcha
  return {
    url: firstField(source, ["URL", "Job URL", "Apply URL", "Link"]),
    ats: firstField(source, ["ATS", "Method"]),
    fit: firstField(source, ["Fit"]),
    status: firstField(source, ["Status", "Result"]),
    fields,
    premarked: bullets(
      sectionsMatching(map, ["pre-marked", "prefilled", "pre-filled", "checkboxes"]),
    ),
    missing,
    captcha,
    blocker,
  }
}

function relativeHref(fromDir: string, target: string): string {
  return encodeURI(path.relative(fromDir, target).replaceAll(path.sep, "/"))
}

async function isFile(file: string): Promise<boolean> {
  return fs.stat(file).then((stat) => stat.isFile(), () => false)
}

function cleanCc(cc: string | undefined): string | undefined {
  if (cc === undefined) return undefined
  const value = cc.trim()
  if (value === "" || ["—", "-", "none", "no"].includes(value.toLowerCase())) {
    return undefined
  }
  return value
}

async function findEmailSource(
  target: string,
): Promise<{ source: string; file: string } | null> {
  const stat = await fs.stat(target).catch(() => null)
  if (stat?.isDirectory()) {
    const direct = path.join(target, "application-email.md")
    if (await isFile(direct)) {
      return { source: await fs.readFile(direct, "utf8"), file: direct }
    }
    const entries = await fs.readdir(target).catch(() => [] as string[])
    const drafts = entries.filter((name) => name.endsWith("-email.md")).sort()
    const first = drafts[0]
    if (first === undefined) return null
    const file = path.join(target, first)
    return { source: await fs.readFile(file, "utf8"), file }
  }
  if (stat?.isFile() && target.endsWith(".md")) {
    if (target.endsWith("-email.md")) {
      return { source: await fs.readFile(target, "utf8"), file: target }
    }
    const sibling = path.join(
      path.dirname(target),
      `${path.basename(target, ".md")}-email.md`,
    )
    if (await isFile(sibling)) {
      return { source: await fs.readFile(sibling, "utf8"), file: sibling }
    }
  }
  return null
}

/** Build the presentation cards for the pending items. */
export async function collectReportCards(
  dataDir: string,
  pending: PendingState | null,
  reportsDir: string,
): Promise<ReportCard[]> {
  const cards: ReportCard[] = []
  for (const item of pending?.items ?? []) {
    const relative = (item.jobFolder ?? "").replaceAll("\\", "/")
    const targetPath = relative === "" ? null : path.join(dataDir, relative)
    if (
      targetPath === null ||
      (!relative.startsWith("jobs/") && !relative.startsWith("feed/"))
    ) {
      cards.push({ kind: "other", item })
      continue
    }
    const targetStat = await fs.stat(targetPath).catch(() => null)
    if (targetStat === null || (!targetStat.isDirectory() && !targetStat.isFile())) {
      cards.push({ kind: "other", item })
      continue
    }
    const folderPath = targetStat.isDirectory() ? targetPath : path.dirname(targetPath)

    const found = await findEmailSource(targetPath)
    if (found !== null) {
      const emailPath = found.file
      const emailSource = found.source
      const draft = parseEmailDraft(emailSource)
      if (draft !== null) {
        const cc = cleanCc(draft.cc)
        const cleaned: EmailDraft = { ...draft, cc }
        const attachRaw = field(emailSource, "Attach")
        const attach =
          attachRaw !== undefined && attachRaw !== "—"
            ? attachRaw.split(" (")[0]?.trim()
            : undefined
        const attachPath =
          attach === undefined
            ? undefined
            : path.isAbsolute(attach)
              ? attach
              : path.join(dataDir, attach)
        const attachExists = attachPath !== undefined && (await isFile(attachPath))
        cards.push({
          kind: "email",
          item,
          draft: cleaned,
          mailto: buildMailto(cleaned),
          attach: attach === undefined || attach === "" ? undefined : attach,
          attachHref:
            attachPath !== undefined && attachExists
              ? relativeHref(reportsDir, attachPath)
              : undefined,
          draftPath: emailPath,
        })
        continue
      }
    }

    const reviewPath = path.join(folderPath, "apply-review.md")
    const reviewSource = await fs.readFile(reviewPath, "utf8").catch(() => null)
    if (reviewSource !== null || FORM_STAGES.has(item.stage)) {
      const review =
        reviewSource === null
          ? {
              fields: [],
              premarked: [],
              missing: [],
              captcha: "",
              blocker: "",
            }
          : parseApplyReview(reviewSource)
      const tailored = path.join(folderPath, "resume.pdf")
      const base = path.join(dataDir, "resume", "base.pdf")
      let resumePath = tailored
      let resumeFallback = false
      if (!(await isFile(tailored)) && (await isFile(base))) {
        resumePath = base
        resumeFallback = true
      }
      const resumeExists = await isFile(resumePath)
      cards.push({
        kind: "form",
        item,
        url: review.url || item.url,
        ats: review.ats,
        fit: review.fit,
        status: review.status,
        fields: review.fields,
        premarked: review.premarked,
        missing: review.missing,
        captcha: review.captcha,
        blocker: review.blocker,
        resumePath,
        resumeHref: resumeExists ? relativeHref(reportsDir, resumePath) : undefined,
        resumeExists,
        resumeFallback,
        reviewPath: reviewSource === null ? undefined : reviewPath,
      })
      continue
    }

    cards.push({ kind: "other", item })
  }
  return cards
}
