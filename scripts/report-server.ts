#!/usr/bin/env node
/**
 * report-server — localhost server for the interactive report.
 *
 * Serves the latest report and accepts action/company POSTs. Writes only the
 * action queue and company preferences under the data directory. Binds to
 * 127.0.0.1 with a per-process token.
 *
 * Usage:
 *   npx tsx scripts/report-server.ts [--date YYYY-MM-DD] [--port 0]
 *     [--no-open] [--timeout 240]
 */
import { randomBytes } from "node:crypto"
import { promises as fs } from "node:fs"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import path from "node:path"
import { parseAutomationConfig, parsePendingState, type PendingState } from "../lib/automation.ts"
import { readCompanyPreferences, setCompanyPreference } from "../lib/company-preferences.ts"
import { resolveDataDir } from "../lib/data-dir.ts"
import { openFile } from "../lib/open.ts"
import { appendAction, readActions } from "../lib/report-actions.ts"
import { collectReportCards } from "../lib/report-data.ts"
import { buildReportHtml } from "../lib/report-html.ts"
import { REPORT_SERVER_FILE, REPORT_SERVER_VERSION, type ReportServerInfo } from "../lib/report-server.ts"
import { fail, flagValue } from "./args.ts"

const SCRIPT = "report-server"
const MAX_BODY = 64 * 1024

function latestReport(reportsDir: string): Promise<string | null> {
  return fs
    .readdir(reportsDir)
    .catch(() => [] as string[])
    .then((entries) => {
      const reports = entries
        .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
        .sort()
        .reverse()
      return reports[0] === undefined ? null : path.join(reportsDir, reports[0])
    })
}

function tokenFrom(req: IncomingMessage, url: URL, token: string): boolean {
  return (
    url.searchParams.get("token") === token ||
    req.headers["x-report-token"] === token
  )
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  })
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY) throw new Error("body too large")
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString("utf8")
  if (text.trim() === "") return null
  return JSON.parse(text) as unknown
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const dataDir = resolveDataDir()
  const reportsDir = path.join(dataDir, "reports")
  const requestedDate = flagValue(SCRIPT, args, "--date")
  const reportFile =
    requestedDate === undefined
      ? await latestReport(reportsDir)
      : path.join(reportsDir, `${requestedDate}.md`)
  if (reportFile === null) return fail(SCRIPT, `no reports in ${reportsDir}`)
  const markdown = await fs.readFile(reportFile, "utf8").catch(() => null)
  if (markdown === null) return fail(SCRIPT, `report not found: ${reportFile}`)

  const date = path.basename(reportFile, ".md")
  const portValue = flagValue(SCRIPT, args, "--port")
  const port = portValue === undefined ? 0 : Number(portValue)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    return fail(SCRIPT, `invalid --port: ${portValue ?? ""}`)
  }
  const timeoutValue = flagValue(SCRIPT, args, "--timeout")
  const timeoutMinutes = timeoutValue === undefined ? 240 : Number(timeoutValue)
  if (!Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0) {
    return fail(SCRIPT, `invalid --timeout: ${timeoutValue ?? ""}`)
  }
  const token = randomBytes(16).toString("hex")
  const open = !args.includes("--no-open")

  let timer: NodeJS.Timeout | undefined
  let info: ReportServerInfo | undefined

  const server = createServer(async (req, res) => {
    if (timer !== undefined) timer.refresh()
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1")
      if (!tokenFrom(req, url, token)) {
        sendJson(res, 403, { error: "forbidden" })
        return
      }

      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/report")) {
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
        const companyPreferences = await readCompanyPreferences(dataDir)
        const actions = await readActions(dataDir)
        const html = buildReportHtml({
          date,
          markdown,
          cards,
          companyPreferences,
          actions: actions.actions,
          interactive: {
            actionsUrl: `/api/actions?token=${encodeURIComponent(token)}`,
            companyUrl: `/api/company?token=${encodeURIComponent(token)}`,
          },
          status: "completed",
          model,
          reportPath: reportFile,
        })
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        })
        res.end(html)
        return
      }

      if (req.method === "GET" && url.pathname === "/api/health") {
        sendJson(res, 200, { ok: true })
        return
      }

      if (req.method === "POST" && url.pathname === "/api/actions") {
        const body = await readBody(req)
        if (typeof body !== "object" || body === null) {
          sendJson(res, 400, { error: "invalid body" })
          return
        }
        const raw = body as Record<string, unknown>
        try {
          const action = await appendAction(dataDir, {
            type: raw["type"] as never,
            company: typeof raw["company"] === "string" ? raw["company"] : "",
            role: typeof raw["role"] === "string" ? raw["role"] : "",
            jobFolder: typeof raw["jobFolder"] === "string" ? raw["jobFolder"] : undefined,
            note: typeof raw["note"] === "string" ? raw["note"] : undefined,
          })
          sendJson(res, 200, { ok: true, id: action.id })
        } catch (error) {
          sendJson(res, 400, {
            error: error instanceof Error ? error.message : String(error),
          })
        }
        return
      }

      if (req.method === "POST" && url.pathname === "/api/company") {
        const body = await readBody(req)
        if (typeof body !== "object" || body === null) {
          sendJson(res, 400, { error: "invalid body" })
          return
        }
        const raw = body as Record<string, unknown>
        if (
          typeof raw["company"] !== "string" ||
          typeof raw["receiveOffers"] !== "boolean"
        ) {
          sendJson(res, 400, { error: "company and receiveOffers are required" })
          return
        }
        try {
          const preferences = await setCompanyPreference(
            dataDir,
            raw["company"],
            raw["receiveOffers"],
          )
          sendJson(res, 200, { ok: true, excluded: preferences })
        } catch (error) {
          sendJson(res, 400, {
            error: error instanceof Error ? error.message : String(error),
          })
        }
        return
      }

      sendJson(res, 404, { error: "not found" })
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })

  const shutdown = async (): Promise<void> => {
    if (timer !== undefined) clearTimeout(timer)
    await new Promise<void>((resolve) => server.close(() => resolve()))
    try {
      const current = JSON.parse(
        await fs.readFile(path.join(dataDir, REPORT_SERVER_FILE), "utf8"),
      ) as ReportServerInfo
      if (current.pid === info?.pid && current.token === info?.token) {
        await fs.unlink(path.join(dataDir, REPORT_SERVER_FILE))
      }
    } catch {
      // state file already gone
    }
    process.exit(0)
  }
  process.on("SIGINT", () => void shutdown())
  process.on("SIGTERM", () => void shutdown())

  server.listen(port, "127.0.0.1", async () => {
    const address = server.address()
    if (address === null || typeof address === "string") {
      console.error(`${SCRIPT}: cannot resolve listening port`)
      process.exit(1)
    }
    info = {
      pid: process.pid,
      port: address.port,
      token,
      url: `http://127.0.0.1:${address.port}/report?token=${token}`,
      date,
      startedAt: new Date().toISOString(),
      serverVersion: REPORT_SERVER_VERSION,
    }
    const target = path.join(dataDir, REPORT_SERVER_FILE)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, `${JSON.stringify(info, null, 2)}\n`)
    console.log(`Report server: ${info.url}`)
    if (open) openFile(info.url, { background: true })
    const milliseconds = Math.round(timeoutMinutes * 60_000)
    timer = setTimeout(() => void shutdown(), milliseconds)
  })
}

await main()
