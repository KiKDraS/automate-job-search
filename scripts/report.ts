#!/usr/bin/env node
/**
 * report — show the latest daily report and pending items.
 *
 * Usage:
 *   npx tsx scripts/report.ts
 *   npx tsx scripts/report.ts --open
 *   npx tsx scripts/report.ts --date 2026-11-23
 *
 * Regenerates the friendly HTML report from the Markdown and
 * `state/pending-search.json`, prints the pending items with their paths, and
 * optionally opens the HTML with the OS default browser.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { resolveDataDir } from "../lib/data-dir.ts"
import { parseAutomationConfig, parsePendingState, type PendingState } from "../lib/automation.ts"
import { openFile } from "../lib/open.ts"
import { buildReportHtml, stageLabel } from "../lib/report-html.ts"
import { fail } from "./args.ts"

const SCRIPT = "report"

function optionalValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index === -1) return undefined
  const value = args[index + 1]
  if (value === undefined || value.startsWith("--")) {
    return fail(SCRIPT, `missing value for ${flag}`)
  }
  return value
}

async function latestReport(dataDir: string): Promise<string | null> {
  const reportsDir = path.join(dataDir, "reports")
  const entries = await fs.readdir(reportsDir).catch(() => [] as string[])
  const reports = entries
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .sort()
    .reverse()
  return reports[0] === undefined ? null : path.join(reportsDir, reports[0])
}

function mailAddress(url: string): string | null {
  if (!url.startsWith("mailto:")) return null
  const raw = url.slice("mailto:".length).split("?")[0] ?? ""
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function shortAction(action: string): string {
  const text = action.replace(/\s+/g, " ").trim()
  return text.length > 220 ? `${text.slice(0, 219)}…` : text
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const dataDir = resolveDataDir()
  const reportsDir = path.join(dataDir, "reports")
  const date = optionalValue(args, "--date")
  const requested = date === undefined ? await latestReport(dataDir) : path.join(reportsDir, `${date}.md`)
  if (requested === null) {
    return fail(SCRIPT, `no daily reports in ${reportsDir}`)
  }
  const markdown = await fs.readFile(requested, "utf8").catch(() => null)
  if (markdown === null) {
    return fail(SCRIPT, `report not found: ${requested}`)
  }
  const reportDate = path.basename(requested, ".md")
  const htmlPath = path.join(reportsDir, `${reportDate}.html`)
  const pendingPath = path.join(dataDir, "state", "pending-search.json")
  let pending: PendingState | null = null
  try {
    pending = parsePendingState(await fs.readFile(pendingPath, "utf8"))
  } catch {
    // no pending state
  }
  let model = "OpenCode default"
  try {
    model =
      parseAutomationConfig(await fs.readFile(path.join(dataDir, "automation.md"), "utf8"))
        .model || "OpenCode default"
  } catch {
    // no automation config
  }

  await fs.writeFile(
    htmlPath,
    buildReportHtml({
      date: reportDate,
      markdown,
      pending,
      status: "completed",
      model,
      reportPath: requested,
    }),
  )

  const items = pending?.items ?? []
  console.log(`Run ${reportDate} — ${items.length} pendiente(s)`)
  for (const [index, item] of items.entries()) {
    console.log(`${index + 1}. ${item.company} — ${item.role} — ${stageLabel(item.stage)}`)
    console.log(`   ${shortAction(item.action)}`)
    const address = mailAddress(item.url)
    if (address !== null) console.log(`   Email: ${address}`)
    else if (item.url !== "") console.log(`   Abrir: ${item.url}`)
    if (item.jobFolder !== undefined && item.jobFolder !== "") {
      const folderPath = path.join(dataDir, item.jobFolder)
      const stat = await fs.stat(folderPath).catch(() => null)
      if (stat?.isDirectory()) {
        console.log(`   Carpeta: ${folderPath}`)
        const draft = path.join(folderPath, "application-email.md")
        if (await fs.stat(draft).then((value) => value.isFile(), () => false)) {
          console.log(`   Draft: ${draft}`)
        }
      } else {
        console.log(`   Archivo: ${folderPath}`)
      }
    }
  }
  console.log(`Reporte: ${htmlPath}`)
  console.log(`Markdown: ${requested}`)
  console.log(`Pendientes: ${pendingPath}`)

  if (args.includes("--open")) {
    console.log(openFile(htmlPath) ? "Abriendo el reporte…" : `No se pudo abrir: ${htmlPath}`)
  }
}

await main()
