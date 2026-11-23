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
 * optionally opens the HTML with the OS default browser. Email drafts are
 * printed in full, and form cards print every field used plus the resume path,
 * so the user can copy and paste without reopening the tab.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { resolveDataDir } from "../lib/data-dir.ts"
import { parseAutomationConfig, parsePendingState, type PendingState } from "../lib/automation.ts"
import { openFile } from "../lib/open.ts"
import { buildReportHtml, stageLabel } from "../lib/report-html.ts"
import { collectReportCards, type ReportCard } from "../lib/report-data.ts"
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

function printCard(item: ReportCard, index: number, dataDir: string): void {
  const pending = item.item
  console.log(
    `${index + 1}. ${pending.company} — ${pending.role} — ${stageLabel(pending.stage)}`,
  )
  if (item.kind === "email") {
    console.log(`   Para: ${item.draft.to}`)
    if (item.draft.cc !== undefined) console.log(`   Cc: ${item.draft.cc}`)
    console.log(`   Asunto: ${item.draft.subject}`)
    if (item.attach !== undefined) {
      console.log(
        `   Adjuntar: ${item.attach}${item.attachHref === undefined ? " (no encontrado)" : ""}`,
      )
    }
    console.log("   --- inicio del email ---")
    for (const line of item.draft.body.split(/\r?\n/)) console.log(`   ${line}`)
    console.log("   --- fin del email ---")
    console.log(`   Abrir en el cliente: ${item.mailto}`)
    console.log(`   Draft: ${item.draftPath}`)
    return
  }
  if (item.kind === "form") {
    const meta = [
      item.ats === undefined || item.ats === "" ? "" : `ATS: ${item.ats}`,
      item.fit === undefined || item.fit === "" ? "" : `Fit: ${item.fit}`,
      item.status === undefined || item.status === "" ? "" : `Estado: ${item.status}`,
    ].filter((part) => part !== "")
    if (meta.length > 0) console.log(`   ${meta.join(" · ")}`)
    console.log(`   URL: ${item.url}`)
    console.log(
      `   CV a enviar: ${item.resumePath}${item.resumeExists ? "" : " (no encontrado)"}${
        item.resumeFallback ? " (CV base; no hay PDF adaptado)" : ""
      }`,
    )
    if (item.fields.length > 0) {
      console.log("   Datos usados:")
      for (const field of item.fields) console.log(`     ${field.label}: ${field.value}`)
    }
    if (item.premarked.length > 0) {
      console.log("   Pre-marcado por el formulario:")
      for (const line of item.premarked) console.log(`     ${line}`)
    }
    if (item.missing.length > 0) {
      console.log("   Falta:")
      for (const line of item.missing) console.log(`     ${line}`)
    }
    if (item.captcha !== "" && !["no", "no."].includes(item.captcha.trim().toLowerCase())) {
      console.log(`   CAPTCHA: ${item.captcha}`)
    }
    if (item.blocker !== "") console.log(`   Bloqueo: ${item.blocker}`)
    if (item.reviewPath !== undefined) console.log(`   Review: ${item.reviewPath}`)
    console.log(`   Acción: ${pending.action}`)
    return
  }
  if (item.kind === "lead") {
    const meta = [
      item.author === undefined || item.author === "" ? "" : `Autor: ${item.author}`,
      item.fit === undefined || item.fit === "" ? "" : `Fit: ${item.fit}`,
      item.mpRequested ? "MP pedido" : "",
    ].filter((part) => part !== "")
    if (meta.length > 0) console.log(`   ${meta.join(" · ")}`)
    if (item.why !== undefined && item.why !== "") console.log(`   Por qué: ${item.why}`)
    console.log(`   Abrir postulación: ${item.applyUrl}`)
    if (item.postUrl !== undefined && item.postUrl !== item.applyUrl) {
      console.log(`   Post: ${item.postUrl}`)
    }
    console.log(`   Qué tenés que hacer: ${pending.action}`)
    console.log(`   CV: ${item.cv === undefined ? "no creado" : item.cv.path}`)
    console.log(
      `   MP: ${
        item.message === undefined
          ? item.mpRequested
            ? "pedido; falta armarlo"
            : "no pedido"
          : `${item.message.path} (borrador, no enviado)`
      }`,
    )
    if (item.message?.text !== undefined) {
      console.log("   --- inicio del MP ---")
      for (const line of item.message.text.split(/\r?\n/)) console.log(`   ${line}`)
      console.log("   --- fin del MP ---")
    }
    console.log(
      `   Email: ${
        item.emailAddress ??
        (item.emailDraft === undefined ? "no disponible" : item.emailDraft.path)
      }`,
    )
    console.log(`   Lead: ${item.leadPath}`)
    return
  }
  console.log(`   ${pending.action}`)
  if (pending.url !== "") console.log(`   Abrir: ${pending.url}`)
  if (pending.jobFolder !== undefined && pending.jobFolder !== "") {
    const folderPath = path.join(dataDir, pending.jobFolder)
    console.log(`   Carpeta: ${folderPath}`)
  }
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

  const cards = await collectReportCards(dataDir, pending, reportsDir)
  await fs.writeFile(
    htmlPath,
    buildReportHtml({
      date: reportDate,
      markdown,
      cards,
      status: "completed",
      model,
      reportPath: requested,
    }),
  )

  console.log(`Run ${reportDate} — ${cards.length} pendiente(s)`)
  for (const [index, card] of cards.entries()) printCard(card, index, dataDir)
  console.log(`Reporte: ${htmlPath}`)
  console.log(`Markdown: ${requested}`)
  console.log(`Pendientes: ${pendingPath}`)

  if (args.includes("--open")) {
    console.log(openFile(htmlPath) ? "Abriendo el reporte…" : `No se pudo abrir: ${htmlPath}`)
  }
}

await main()
