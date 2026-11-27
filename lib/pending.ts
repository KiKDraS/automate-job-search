/**
 * Pending queue helpers — remove a pending item after the user dismisses it.
 *
 * The report server and the agent both use this. Removal is atomic; the job
 * folder, resume, drafts, and history stay untouched.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { normalizeKey } from "./applied.ts"
import {
  PENDING_FILE,
  formatPendingState,
  parsePendingState,
} from "./automation.ts"

export interface PendingMatch {
  jobFolder?: string
  company?: string
  role?: string
  url?: string
}

function sameFolder(left: string | undefined, right: string | undefined): boolean {
  if (left === undefined || right === undefined) return false
  return (
    left.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\/+$/, "").trim() ===
    right.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\/+$/, "").trim()
  )
}

/** Remove matching pending items. Returns how many were removed. */
export async function removePendingItem(
  dataDir: string,
  match: PendingMatch,
): Promise<number> {
  const file = path.join(dataDir, PENDING_FILE)
  const source = await fs.readFile(file, "utf8").catch(() => null)
  if (source === null) return 0
  const state = parsePendingState(source)
  if (state === null) return 0
  const company = match.company === undefined ? "" : normalizeKey(match.company)
  const role = match.role === undefined ? "" : normalizeKey(match.role)
  const before = state.items.length
  state.items = state.items.filter((item) => {
    if (sameFolder(item.jobFolder, match.jobFolder)) return false
    if (
      company !== "" &&
      role !== "" &&
      normalizeKey(item.company) === company &&
      normalizeKey(item.role) === role
    ) {
      return false
    }
    if (match.url !== undefined && match.url !== "" && item.url === match.url) {
      return false
    }
    return true
  })
  if (state.items.length === before) return 0
  state.generatedAt = new Date().toISOString()
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  await fs.writeFile(temporary, formatPendingState(state))
  await fs.rename(temporary, file)
  return before - state.items.length
}
