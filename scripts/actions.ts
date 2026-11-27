#!/usr/bin/env node
/**
 * actions — read and manage the report action queue.
 *
 * Usage:
 *   npx tsx scripts/actions.ts list
 *   npx tsx scripts/actions.ts pending
 *   npx tsx scripts/actions.ts add --type apply --company "<c>" --role "<r>" [--folder <jobs/...>] [--note "<text>"]
 *   npx tsx scripts/actions.ts done --id <id> [--result "<what happened>"]
 */
import {
  appendAction,
  markActionProcessed,
  pendingActions,
  readActions,
  type ReportActionType,
} from "../lib/report-actions.ts"
import { resolveDataDir } from "../lib/data-dir.ts"
import { fail, flagValue } from "./args.ts"

const SCRIPT = "actions"
const TYPES: readonly ReportActionType[] = [
  "apply",
  "skip",
  "retry",
  "mark_sent",
  "draft_cv",
  "draft_mp",
  "note",
]

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

  return fail(SCRIPT, "usage: list | pending | add ... | done --id <id> [--result <text>]")
}

await main()
