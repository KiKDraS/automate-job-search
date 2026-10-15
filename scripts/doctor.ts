#!/usr/bin/env node
/**
 * doctor — environment self-check.
 *
 * Reports what works right now and what needs attention. Failing checks exit
 * non-zero; warnings do not block the repository, they limit which workflows
 * work until resolved.
 */
import { execFile } from "node:child_process"
import { constants, promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { DATA_DIR_ENV, ensureDataDir, resolveDataDir } from "../lib/data-dir.ts"

const execFileAsync = promisify(execFile)

const MIN_NODE_MAJOR = 20

type Level = "ok" | "warn" | "fail"

interface CheckResult {
  name: string
  level: Level
  detail: string
}

const SYMBOL: Record<Level, string> = { ok: "✓", warn: "!", fail: "✗" }

function check(name: string, level: Level, detail: string): CheckResult {
  return { name, level, detail }
}

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.split("\n")[0]?.trim() ?? ""
}

function checkNode(): CheckResult {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10)
  return major >= MIN_NODE_MAJOR
    ? check("Node.js", "ok", `v${process.versions.node}`)
    : check("Node.js", "fail", `v${process.versions.node} — Node ${MIN_NODE_MAJOR}+ required`)
}

async function checkGh(): Promise<CheckResult> {
  try {
    await execFileAsync("gh", ["auth", "status"], { timeout: 15_000 })
    return check("GitHub CLI", "ok", "installed and authenticated")
  } catch (error) {
    return check(
      "GitHub CLI",
      "warn",
      `not available or not authenticated — https://cli.github.com (${errorText(error)})`,
    )
  }
}

async function checkDataDir(): Promise<CheckResult> {
  const dir = resolveDataDir()
  try {
    await ensureDataDir()
    const probe = path.join(dir, ".doctor-probe")
    await fs.writeFile(probe, new Date().toISOString())
    await fs.rm(probe, { force: true })
    return check("Data directory", "ok", `${dir} (writable)`)
  } catch (error) {
    return check(
      "Data directory",
      "fail",
      `${dir} — cannot create or write. Set ${DATA_DIR_ENV} or fix permissions. (${errorText(error)})`,
    )
  }
}

function chromeCandidates(): string[] {
  if (process.platform === "darwin") {
    return ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  }
  if (process.platform === "win32") {
    const programFiles = process.env["PROGRAMFILES"] ?? "C:\\Program Files"
    const programFilesX86 = process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)"
    const localAppData = process.env["LOCALAPPDATA"] ?? ""
    return [
      path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      ...(localAppData
        ? [path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe")]
        : []),
    ]
  }
  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/opt/google/chrome/chrome",
  ]
}

async function checkChrome(): Promise<CheckResult> {
  for (const candidate of chromeCandidates()) {
    try {
      await fs.access(candidate, constants.X_OK)
      return check("Google Chrome", "ok", candidate)
    } catch {
      // try next candidate
    }
  }
  if (process.platform !== "win32") {
    for (const binary of ["google-chrome", "google-chrome-stable", "chrome"]) {
      try {
        await execFileAsync("which", [binary], { timeout: 10_000 })
        return check("Google Chrome", "ok", `${binary} (via PATH)`)
      } catch {
        // try next binary
      }
    }
  }
  return check(
    "Google Chrome",
    "warn",
    "not found — install Chrome, or remove --browser chrome from opencode.jsonc to use bundled Chromium",
  )
}

async function checkPlaywrightMcp(): Promise<CheckResult> {
  try {
    await execFileAsync("npx", ["-y", "@playwright/mcp@latest", "--help"], {
      timeout: 60_000,
    })
    return check("Playwright MCP", "ok", "@playwright/mcp runs via npx")
  } catch (error) {
    return check(
      "Playwright MCP",
      "warn",
      `could not run @playwright/mcp — check network/npx (${errorText(error)})`,
    )
  }
}

async function checkPlaywrightCore(): Promise<CheckResult> {
  try {
    await import("playwright-core")
    return check("Playwright (PDF)", "ok", "playwright-core available for resume PDF export")
  } catch {
    return check(
      "Playwright (PDF)",
      "warn",
      "playwright-core not installed — run npm install to enable resume PDF export",
    )
  }
}

function playwrightProfileDirs(): string[] {
  if (process.platform === "darwin") {
    return [
      path.join(os.homedir(), "Library", "Caches", "ms-playwright-mcp"),
      path.join(os.homedir(), "Library", "Caches", "ms-playwright"),
    ]
  }
  if (process.platform === "win32") {
    const localAppData = process.env["LOCALAPPDATA"] ?? path.join(os.homedir(), "AppData", "Local")
    return [path.join(localAppData, "ms-playwright-mcp"), path.join(localAppData, "ms-playwright")]
  }
  return [
    path.join(os.homedir(), ".cache", "ms-playwright-mcp"),
    path.join(os.homedir(), ".cache", "ms-playwright"),
  ]
}

async function checkBrowserProfile(): Promise<CheckResult> {
  const found: string[] = []
  for (const dir of playwrightProfileDirs()) {
    let entries: string[] = []
    try {
      entries = await fs.readdir(dir)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.startsWith("mcp-")) found.push(path.join(dir, entry))
    }
  }
  if (found.length > 0) {
    return check(
      "Browser profile",
      "ok",
      `${found.length} profile(s), e.g. ${found[0]} — if a task hits a login wall, log in manually in the browser window`,
    )
  }
  return check(
    "Browser profile",
    "warn",
    "none yet — the first browser task opens a window; log into LinkedIn manually there",
  )
}

async function main(): Promise<void> {
  console.log("automate-job-search — doctor\n")
  const results: CheckResult[] = [
    checkNode(),
    await checkGh(),
    await checkDataDir(),
    await checkChrome(),
    await checkPlaywrightMcp(),
    await checkPlaywrightCore(),
    await checkBrowserProfile(),
  ]
  for (const item of results) {
    console.log(`${SYMBOL[item.level]} ${item.name}: ${item.detail}`)
  }
  const ok = results.filter((item) => item.level === "ok").length
  const warnings = results.filter((item) => item.level === "warn").length
  const failures = results.filter((item) => item.level === "fail").length
  console.log("")
  console.log(`Summary: ${ok} ok, ${warnings} warning(s), ${failures} failure(s).`)
  if (failures > 0) {
    process.exitCode = 1
  }
}

await main()
