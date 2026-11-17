/**
 * Automation configuration and preflight for the scheduled daily search.
 *
 * The config lives in `<data dir>/automation.md`, outside the repository.
 * It is human-editable; the `/job/schedule` command writes it through
 * `scripts/schedule.ts`.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { todayIso } from "./jobstore.ts"

export interface AutomationConfig {
  enabled: boolean
  time: string
  interval: string
  model: string
  standingApproval: boolean
  maxApplicationsPerRun: number
  includeBacklog: boolean
  includeJobSearch: boolean
  includeFeedSearch: boolean
  notify: boolean
  maxRuntimeMinutes: number
}

export interface PendingItem {
  jobFolder?: string
  url: string
  company: string
  role: string
  stage: string
  action: string
}

export interface PendingState {
  generatedAt: string
  items: PendingItem[]
}

export const AUTOMATION_FILE = "automation.md"
export const PENDING_FILE = path.join("state", "pending-search.json")
export const SEARCH_LOCK_FILE = path.join("state", "search.lock")

export const DEFAULT_AUTOMATION: AutomationConfig = {
  enabled: false,
  time: "09:00",
  interval: "daily",
  model: "",
  standingApproval: false,
  maxApplicationsPerRun: 0,
  includeBacklog: true,
  includeJobSearch: true,
  includeFeedSearch: true,
  notify: true,
  maxRuntimeMinutes: 60,
}

const BOOLEAN_KEYS = new Set([
  "enabled",
  "standingApproval",
  "includeBacklog",
  "includeJobSearch",
  "includeFeedSearch",
  "notify",
])

const NUMBER_KEYS = new Set(["maxApplicationsPerRun", "maxRuntimeMinutes"])

function parseBoolean(value: string): boolean | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === "true" || normalized === "yes" || normalized === "1") return true
  if (normalized === "false" || normalized === "no" || normalized === "0") return false
  return null
}

/** Parse the Markdown bullets written by `formatAutomationConfig`. */
export function parseAutomationConfig(source: string): AutomationConfig {
  const config: AutomationConfig = { ...DEFAULT_AUTOMATION }
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*-\s*([a-zA-Z][a-zA-Z0-9]*):\s*(.*?)\s*$/)
    if (!match) continue
    const key = match[1]
    let value = match[2] ?? ""
    value = value.replace(/^"(.*)"$/, "$1")
    if (key === undefined) continue
    if (BOOLEAN_KEYS.has(key)) {
      const parsed = parseBoolean(value)
      if (parsed !== null) (config as unknown as Record<string, unknown>)[key] = parsed
      continue
    }
    if (NUMBER_KEYS.has(key)) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) (config as unknown as Record<string, unknown>)[key] = parsed
      continue
    }
    if (key === "time" || key === "interval" || key === "model") {
      (config as unknown as Record<string, unknown>)[key] = value
    }
  }
  return config
}

export function formatAutomationConfig(config: AutomationConfig): string {
  return `# Automation

- enabled: ${config.enabled}
- time: "${config.time}"
- interval: ${config.interval}
- model: "${config.model}"
- standingApproval: ${config.standingApproval}
- maxApplicationsPerRun: ${config.maxApplicationsPerRun}
- includeBacklog: ${config.includeBacklog}
- includeJobSearch: ${config.includeJobSearch}
- includeFeedSearch: ${config.includeFeedSearch}
- notify: ${config.notify}
- maxRuntimeMinutes: ${config.maxRuntimeMinutes}
`
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const INTERVAL_PATTERN = /^every\s+(?:[1-9]|1\d|2[0-4])h$/

export function validateAutomationConfig(config: AutomationConfig): string[] {
  const errors: string[] = []
  if (!TIME_PATTERN.test(config.time)) {
    errors.push(`time must be HH:MM (24h), got ${JSON.stringify(config.time)}`)
  }
  if (config.interval !== "daily" && !INTERVAL_PATTERN.test(config.interval)) {
    errors.push(`interval must be "daily" or "every Nh" (1-24), got ${JSON.stringify(config.interval)}`)
  }
  if (config.model.trim() !== "" && !/^[^\s/]+\/[^\s/]+$/.test(config.model.trim())) {
    errors.push(`model must be provider/model or empty, got ${JSON.stringify(config.model)}`)
  }
  if (!Number.isInteger(config.maxApplicationsPerRun) || config.maxApplicationsPerRun < 0) {
    errors.push("maxApplicationsPerRun must be an integer >= 0 (0 = no cap)")
  }
  if (
    !Number.isInteger(config.maxRuntimeMinutes) ||
    config.maxRuntimeMinutes < 5 ||
    config.maxRuntimeMinutes > 240
  ) {
    errors.push("maxRuntimeMinutes must be an integer between 5 and 240")
  }
  return errors
}

function minutesOfDay(time: string): number {
  const [hours = "0", minutes = "0"] = time.split(":")
  return Number(hours) * 60 + Number(minutes)
}

/** Next run in local time. For `every Nh`, lastRun is required to project. */
export function nextRunAt(
  config: AutomationConfig,
  now = new Date(),
  lastRun?: Date,
): Date | null {
  if (!config.enabled) return null
  if (config.interval === "daily") {
    const [hours = "0", minutes = "0"] = config.time.split(":")
    const next = new Date(now)
    next.setHours(Number(hours), Number(minutes), 0, 0)
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
    return next
  }
  const match = config.interval.match(/^every\s+(\d+)h$/)
  if (!match) return null
  const hours = Number(match[1])
  if (lastRun === undefined) return new Date(now.getTime() + hours * 60 * 60 * 1000)
  const next = new Date(lastRun.getTime() + hours * 60 * 60 * 1000)
  return next
}

export function automationReady(dataDir: string): Promise<string[]> {
  const required = [
    "profile.md",
    "preferences.md",
    path.join("resume", "base.md"),
    "application-data.md",
    "language.md",
  ]
  return (async () => {
    const missing: string[] = []
    for (const file of required) {
      try {
        await fs.access(path.join(dataDir, file))
      } catch {
        missing.push(file)
      }
    }
    return missing
  })()
}

export function buildScheduledPrompt(dataDir: string, config: AutomationConfig): string {
  const apply = config.standingApproval
    ? "Auto-apply Medium/High fits without another approval."
    : "Do not apply; save the jobs and list them for the user."
  const feed = config.includeFeedSearch ? "Run the feed search too." : "Skip the feed search."
  const backlog = config.includeBacklog ? "Start with the backlog." : "Skip the backlog."
  const max =
    config.maxApplicationsPerRun === 0
      ? "No application cap."
      : `Cap applications at ${config.maxApplicationsPerRun} this run.`
  return [
    "Scheduled run. Enter scheduled mode and do not ask questions.",
    `Read ${path.join(dataDir, AUTOMATION_FILE)} first.`,
    `The runner owns ${path.join(dataDir, SEARCH_LOCK_FILE)} for this run; ignore it and never delete it.`,
    "Use only the user's data: profile.md, preferences.md, resume/base.md, application-data.md, language.md.",
    "If any required file is missing, write a setup-incomplete report and stop.",
    `${backlog} Run the 48-hour job search. ${feed}`,
    "Tailor each Medium/High fit, pass draft-review, then apply.",
    "Do every automatic application before the human-only steps.",
    "For a feed lead with an email, draft the application email, pass draft-review, and add the mailto to Needs you; do not send it.",
    "For CAPTCHA, login, account creation, or a missing required answer, leave the form filled when possible and add the URL and the exact action to Needs you.",
    apply,
    max,
    "Do not publish posts, send messages, change the repo, create accounts, or solve CAPTCHAs.",
    `Write ${path.join(dataDir, "reports", todayIso() + ".md")} with Summary, Applied, Needs you, Skipped.`,
    `Write ${path.join(dataDir, PENDING_FILE)} with every blocker and unfinished job.`,
  ].join(" ")
}

export function parsePendingState(source: string): PendingState | null {
  try {
    const parsed = JSON.parse(source) as { generatedAt?: unknown; items?: unknown }
    if (typeof parsed.generatedAt !== "string" || !Array.isArray(parsed.items)) return null
    const items: PendingItem[] = []
    for (const raw of parsed.items) {
      if (typeof raw !== "object" || raw === null) continue
      const item = raw as Record<string, unknown>
      if (
        typeof item["url"] !== "string" ||
        typeof item["company"] !== "string" ||
        typeof item["role"] !== "string" ||
        typeof item["stage"] !== "string" ||
        typeof item["action"] !== "string"
      ) {
        continue
      }
      items.push({
        url: item["url"],
        company: item["company"],
        role: item["role"],
        stage: item["stage"],
        action: item["action"],
        jobFolder: typeof item["jobFolder"] === "string" ? item["jobFolder"] : undefined,
      })
    }
    return { generatedAt: parsed.generatedAt, items }
  } catch {
    return null
  }
}

export function formatPendingState(state: PendingState): string {
  return `${JSON.stringify(state, null, 2)}\n`
}

export function minutesUntilNextRun(config: AutomationConfig, now = new Date()): number | null {
  const next = nextRunAt(config, now)
  if (next === null) return null
  return Math.max(0, Math.round((next.getTime() - now.getTime()) / 60000))
}

export { minutesOfDay }
