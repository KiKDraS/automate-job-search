#!/usr/bin/env node
/**
 * actions — read and manage the report action queue.
 *
 * Usage:
 *   npx tsx scripts/actions.ts list
 *   npx tsx scripts/actions.ts pending
 *   npx tsx scripts/actions.ts add --type apply --company "<c>" --role "<r>" [--folder <jobs/...>] [--note "<text>"]
 *   npx tsx scripts/actions.ts done --id <id> [--result "<what happened>"]
 *   npx tsx scripts/actions.ts sent --id <id>
 *   npx tsx scripts/actions.ts dismiss --id <id>
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import {
  appendAction,
  markActionProcessed,
  pendingActions,
  readActions,
  type ReportAction,
  type ReportActionType,
} from "../lib/report-actions.ts"
import { removePendingItem } from "../lib/pending.ts"
import { skipJob } from "../lib/job-decisions.ts"
import { isApplied, readAppliedIndex } from "../lib/applied.ts"
import { resolveDataDir } from "../lib/data-dir.ts"
import { fail, flagValue } from "./args.ts"

const SCRIPT = "actions"
const TYPES: readonly ReportActionType[] = [
  "apply",
  "dismiss",
  "skip",
  "retry",
  "mark_sent",
  "draft_cv",
  "draft_mp",
  "note",
]

async function hasSentRecord(dataDir: string, action: ReportAction): Promise<boolean> {
  if (action.jobFolder !== undefined && action.jobFolder.startsWith("jobs/")) {
    const applied = path.join(dataDir, action.jobFolder, "applied.md")
    if (await fs.stat(applied).then((stat) => stat.isFile(), () => false)) return true
  }
  const index = await readAppliedIndex(dataDir)
  return (
    isApplied(index, {
      folder: action.jobFolder,
      company: action.company,
      role: action.role,
    }) !== null
  )
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  const dataDir = resolveDataDir()

  if (command === "list" || command === "pending") {
    const state = await readActions(dataDir)
    const actions = command === "pending" ? pendingActions(state) : state.actions
    if (actions.length === 0) {
      console.log("no actions")
      return
    }
    console.log(JSON.stringify(actions, null, 2))
    return
  }

  if (command === "add") {
    const type = flagValue(SCRIPT, args, "--type")
    const company = flagValue(SCRIPT, args, "--company")
    const role = flagValue(SCRIPT, args, "--role")
    if (type === undefined || company === undefined || role === undefined) {
      return fail(SCRIPT, "usage: add --type <type> --company <c> --role <r> [--folder <path>] [--note <text>]")
    }
    if (!TYPES.includes(type as ReportActionType)) {
      return fail(SCRIPT, `invalid --type: ${type} (${TYPES.join("|")})`)
    }
    const action = await appendAction(dataDir, {
      type: type as ReportActionType,
      company,
      role,
      jobFolder: flagValue(SCRIPT, args, "--folder"),
      note: flagValue(SCRIPT, args, "--note"),
    })
    console.log(action.id)
    console.log(JSON.stringify(action, null, 2))
    return
  }

  if (command === "done") {
    const id = flagValue(SCRIPT, args, "--id")
    if (id === undefined) return fail(SCRIPT, "usage: done --id <id> [--result <text>]")
    const result = flagValue(SCRIPT, args, "--result") ?? "processed"
    const ok = await markActionProcessed(dataDir, id, result)
    if (!ok) return fail(SCRIPT, `action not found: ${id}`)
    console.log(`processed ${id}`)
    return
  }

  if (command === "sent") {
    const id = flagValue(SCRIPT, args, "--id")
    if (id === undefined) return fail(SCRIPT, "usage: sent --id <id>")
    const state = await readActions(dataDir)
    const action = state.actions.find((item) => item.id === id)
    if (action === undefined) return fail(SCRIPT, `action not found: ${id}`)
    if (action.type !== "mark_sent") return fail(SCRIPT, `action is not mark_sent: ${action.type}`)
    if (!(await hasSentRecord(dataDir, action))) {
      return fail(
        SCRIPT,
        "no application record found; log the send first (applied.md or applications.md)",
      )
    }
    const removed = await removePendingItem(dataDir, {
      jobFolder: action.jobFolder,
      company: action.company,
      role: action.role,
    })
    await markActionProcessed(
      dataDir,
      action.id,
      `manual send recorded (${removed} pending item(s) removed)`,
    )
    console.log(`recorded ${action.company} — ${action.role}`)
    console.log(`${removed} pending item(s) removed; the application record exists`)
    return
  }

  if (command === "dismiss") {
    const id = flagValue(SCRIPT, args, "--id")
    if (id === undefined) return fail(SCRIPT, "usage: dismiss --id <id>")
    const state = await readActions(dataDir)
    const action = state.actions.find((item) => item.id === id)
    if (action === undefined) return fail(SCRIPT, `action not found: ${id}`)
    if (action.type !== "dismiss") return fail(SCRIPT, `action is not dismiss: ${action.type}`)
    const removed = await removePendingItem(dataDir, {
      jobFolder: action.jobFolder,
      company: action.company,
      role: action.role,
    })
    if (action.jobFolder !== undefined) {
      await skipJob(dataDir, action.jobFolder, "dismissed from report")
    }
    await markActionProcessed(
      dataDir,
      action.id,
      `dismissed (${removed} pending item(s) removed)`,
    )
    console.log(`dismissed ${action.company} — ${action.role}`)
    console.log(`${removed} pending item(s) removed; files kept`)
    return
  }

  return fail(
    SCRIPT,
    "usage: list | pending | add ... | done --id <id> | sent --id <id> | dismiss --id <id>",
  )
}

await main()
