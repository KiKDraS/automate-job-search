/**
 * Interactive report server lifecycle.
 *
 * The scheduler and `/job/report --open` prefer a localhost server so report
 * buttons can write the action queue. If the server cannot start, callers fall
 * back to opening the static HTML (copy-to-chat actions).
 */
import { spawn } from "node:child_process"
import { promises as fs } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { openFile } from "./open.ts"

export const REPORT_SERVER_FILE = path.join("state", "report-server.json")
export const REPORT_SERVER_VERSION = 4

export interface ReportServerInfo {
  pid: number
  port: number
  token: string
  url: string
  date: string
  startedAt: string
  serverVersion: number
}

export function readReportServerInfo(source: string): ReportServerInfo | null {
  try {
    const parsed = JSON.parse(source) as Record<string, unknown>
    if (
      typeof parsed["pid"] !== "number" ||
      typeof parsed["port"] !== "number" ||
      typeof parsed["token"] !== "string" ||
      typeof parsed["url"] !== "string" ||
      typeof parsed["date"] !== "string" ||
      typeof parsed["startedAt"] !== "string" ||
      typeof parsed["serverVersion"] !== "number"
    ) {
      return null
    }
    return {
      pid: parsed["pid"],
      port: parsed["port"],
      token: parsed["token"],
      url: parsed["url"],
      date: parsed["date"],
      startedAt: parsed["startedAt"],
      serverVersion: parsed["serverVersion"],
    }
  } catch {
    return null
  }
}

export async function readReportServer(
  dataDir: string,
): Promise<ReportServerInfo | null> {
  const source = await fs
    .readFile(path.join(dataDir, REPORT_SERVER_FILE), "utf8")
    .catch(() => null)
  return source === null ? null : readReportServerInfo(source)
}

export async function isReportServerAlive(info: ReportServerInfo): Promise<boolean> {
  try {
    const response = await fetch(
      `http://127.0.0.1:${info.port}/api/health?token=${encodeURIComponent(info.token)}`,
      { signal: AbortSignal.timeout(800) },
    )
    return response.ok
  } catch {
    return false
  }
}

function serverScriptPath(): string {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "scripts",
    "report-server.ts",
  )
}

function tsxCliPath(): string {
  return createRequire(import.meta.url).resolve("tsx/cli")
}

async function waitForServer(
  dataDir: string,
  date: string,
  timeoutMs: number,
): Promise<ReportServerInfo | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const info = await readReportServer(dataDir)
    if (info !== null && info.date === date && (await isReportServerAlive(info))) {
      return info
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  return null
}

/** Reuse a live server for the same date, or start a detached one. */
export async function startReportServer(
  dataDir: string,
  date: string,
): Promise<ReportServerInfo | null> {
  const existing = await readReportServer(dataDir)
  if (
    existing !== null &&
    existing.date === date &&
    existing.serverVersion === REPORT_SERVER_VERSION &&
    (await isReportServerAlive(existing))
  ) {
    return existing
  }
  const child = spawn(
    process.execPath,
    [tsxCliPath(), serverScriptPath(), "--date", date, "--no-open"],
    {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, JOBSEARCH_HOME: dataDir },
    },
  )
  child.unref()
  return waitForServer(dataDir, date, 6000)
}

/**
 * Open the interactive report when possible, otherwise the static HTML.
 * Returns "server", "file", or false when both fail.
 */
export async function openReportInteractive(
  dataDir: string,
  date: string,
  htmlPath: string,
): Promise<"server" | "file" | false> {
  const info = await startReportServer(dataDir, date)
  if (info !== null && openFile(info.url, { background: true })) return "server"
  return openFile(htmlPath, { background: true }) ? "file" : false
}
