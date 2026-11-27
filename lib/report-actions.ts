/**
 * Report actions — a small queue written by the interactive report and read
 * by the agent at the start of a session or scheduled run.
 *
 * The queue is deliberately simple: JSON on disk, atomic writes, one action
 * per click. The agent marks actions processed after acting on them.
 */
import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"

export const REPORT_ACTIONS_FILE = path.join("state", "user-actions.json")

export const ACTION_TYPES = [
  "apply",
  "dismiss",
  "skip",
  "retry",
  "mark_sent",
  "draft_cv",
  "draft_mp",
  "note",
] as const

export type ReportActionType = (typeof ACTION_TYPES)[number]

export interface ReportAction {
  id: string
  createdAt: string
  type: ReportActionType
  company: string
  role: string
  jobFolder?: string
  note?: string
  status: "pending" | "processed"
  result?: string
  processedAt?: string
}

export interface ReportActionsState {
  schema: 1
  actions: ReportAction[]
}

export interface ReportActionInput {
  type: ReportActionType
  company: string
  role: string
  jobFolder?: string
  note?: string
}

export function emptyActions(): ReportActionsState {
  return { schema: 1, actions: [] }
}

function isActionType(value: unknown): value is ReportActionType {
  return typeof value === "string" && (ACTION_TYPES as readonly string[]).includes(value)
}

function safeFolder(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const normalized = value.replaceAll("\\", "/").replace(/^\.\/+/, "").trim()
  if (normalized === "") return undefined
  if (normalized.startsWith("/") || normalized.includes("../")) return undefined
  if (!normalized.startsWith("jobs/") && !normalized.startsWith("feed/")) return undefined
  if (normalized.split("/").includes("..")) return undefined
  return normalized
}

export function validateReportAction(
  input: unknown,
  now: string = new Date().toISOString(),
): { ok: true; action: ReportAction } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "action must be an object" }
  }
  const raw = input as Record<string, unknown>
  if (!isActionType(raw["type"])) return { ok: false, error: "invalid action type" }
  const company = typeof raw["company"] === "string" ? raw["company"].trim() : ""
  const role = typeof raw["role"] === "string" ? raw["role"].trim() : ""
  if (company === "" || company.length > 120) return { ok: false, error: "invalid company" }
  if (role === "" || role.length > 200) return { ok: false, error: "invalid role" }
  const folder = typeof raw["jobFolder"] === "string" ? safeFolder(raw["jobFolder"]) : undefined
  if (raw["jobFolder"] !== undefined && folder === undefined) {
    return { ok: false, error: "jobFolder must be under jobs/ or feed/" }
  }
  const note = typeof raw["note"] === "string" ? raw["note"].trim() : ""
  if (note.length > 2000) return { ok: false, error: "note is too long" }
  return {
    ok: true,
    action: {
      id: randomUUID(),
      createdAt: now,
      type: raw["type"],
      company,
      role,
      jobFolder: folder,
      note: note === "" ? undefined : note,
      status: "pending",
    },
  }
}

export function parseActions(source: string): ReportActionsState | null {
  try {
    const parsed = JSON.parse(source) as { schema?: unknown; actions?: unknown }
    if (parsed.schema !== 1 || !Array.isArray(parsed.actions)) return null
    const actions: ReportAction[] = []
    for (const value of parsed.actions) {
      if (typeof value !== "object" || value === null) continue
      const raw = value as Record<string, unknown>
      if (
        typeof raw["id"] !== "string" ||
        typeof raw["createdAt"] !== "string" ||
        !isActionType(raw["type"]) ||
        typeof raw["company"] !== "string" ||
        typeof raw["role"] !== "string" ||
        (raw["status"] !== "pending" && raw["status"] !== "processed")
      ) {
        continue
      }
      actions.push({
        id: raw["id"],
        createdAt: raw["createdAt"],
        type: raw["type"],
        company: raw["company"],
        role: raw["role"],
        jobFolder: safeFolder(typeof raw["jobFolder"] === "string" ? raw["jobFolder"] : undefined),
        note: typeof raw["note"] === "string" ? raw["note"] : undefined,
        status: raw["status"],
        result: typeof raw["result"] === "string" ? raw["result"] : undefined,
        processedAt: typeof raw["processedAt"] === "string" ? raw["processedAt"] : undefined,
      })
    }
    return { schema: 1, actions }
  } catch {
    return null
  }
}

export function formatActions(state: ReportActionsState): string {
  return `${JSON.stringify(state, null, 2)}\n`
}

export async function readActions(dataDir: string): Promise<ReportActionsState> {
  const source = await fs
    .readFile(path.join(dataDir, REPORT_ACTIONS_FILE), "utf8")
    .catch(() => null)
  if (source === null) return emptyActions()
  return parseActions(source) ?? emptyActions()
}

async function writeActions(dataDir: string, state: ReportActionsState): Promise<void> {
  const target = path.join(dataDir, REPORT_ACTIONS_FILE)
  await fs.mkdir(path.dirname(target), { recursive: true })
  const temporary = `${target}.${process.pid}.tmp`
  await fs.writeFile(temporary, formatActions(state))
  await fs.rename(temporary, target)
}

/** Append an action, reusing an identical pending one. */
export async function appendAction(
  dataDir: string,
  input: ReportActionInput,
  now: string = new Date().toISOString(),
): Promise<ReportAction> {
  const validated = validateReportAction(input, now)
  if (!validated.ok) throw new Error(validated.error)
  const state = await readActions(dataDir)
  const duplicate = state.actions.find(
    (action) =>
      action.status === "pending" &&
      action.type === validated.action.type &&
      action.company === validated.action.company &&
      action.role === validated.action.role &&
      action.jobFolder === validated.action.jobFolder,
  )
  if (duplicate !== undefined) {
    if (validated.action.note !== undefined && duplicate.note !== validated.action.note) {
      duplicate.note = validated.action.note
      await writeActions(dataDir, state)
    }
    return duplicate
  }
  state.actions.push(validated.action)
  await writeActions(dataDir, state)
  return validated.action
}

export async function markActionProcessed(
  dataDir: string,
  id: string,
  result: string,
  now: string = new Date().toISOString(),
): Promise<boolean> {
  const state = await readActions(dataDir)
  const action = state.actions.find((item) => item.id === id)
  if (action === undefined) return false
  action.status = "processed"
  action.result = result.trim() === "" ? "processed" : result.trim()
  action.processedAt = now
  await writeActions(dataDir, state)
  return true
}

export function pendingActions(state: ReportActionsState): ReportAction[] {
  return state.actions.filter((action) => action.status === "pending")
}
