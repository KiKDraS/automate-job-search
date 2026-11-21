#!/usr/bin/env node
/**
 * cleanup — delete old application folders and feed leads.
 *
 * Usage:
 *   npx tsx scripts/cleanup.ts              # dry run, 30 days
 *   npx tsx scripts/cleanup.ts --apply      # delete
 *   npx tsx scripts/cleanup.ts --days 45    # custom window
 *
 * Jobs are eligible only when `applied.md` says `submitted` and the date is at
 * least `days` old. Feed leads use the date in the file (or filename). Pending
 * items in `state/pending-search.json` are skipped. `applications.md` and
 * `job-history.md` are never touched.
 */
import { resolveDataDir } from "../lib/data-dir.ts"
import { cleanupExpiredData } from "../lib/cleanup.ts"
import { fail } from "./args.ts"

const SCRIPT = "cleanup"
const args = process.argv.slice(2)
const daysIndex = args.indexOf("--days")
const days = daysIndex === -1 ? 30 : Number(args[daysIndex + 1])
if (!Number.isInteger(days) || days < 1) {
  fail(SCRIPT, "--days must be a positive integer")
}
const apply = args.includes("--apply")

const result = await cleanupExpiredData(resolveDataDir(), { days, apply })
console.log(
  `${apply ? "Cleanup" : "Dry run"}: ${result.candidates.length} item(s) with ${days}+ days.`,
)
for (const item of result.candidates) {
  const siblings = item.siblings?.length ?? 0
  console.log(
    `- ${item.path} — ${item.date}, ${item.ageDays} days${item.status ? `, ${item.status}` : ""}${
      siblings > 0 ? ` (+${siblings} email)` : ""
    }`,
  )
}
for (const skip of result.skipped) {
  console.log(`  skip ${skip.path}: ${skip.reason}`)
}
for (const failure of result.failed) {
  console.log(`  failed ${failure.path}: ${failure.reason}`)
}
if (apply) {
  if (result.backfilled.length > 0) {
    console.log(`Backfilled applications.md: ${result.backfilled.length}`)
  }
  console.log(`Deleted: ${result.deleted.length}`)
} else if (result.candidates.length > 0) {
  console.log("Re-run with --apply to delete.")
}
