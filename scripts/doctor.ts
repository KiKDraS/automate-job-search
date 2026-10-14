#!/usr/bin/env node
/**
 * doctor — environment self-check.
 *
 * Phase 1 scope: toolchain and data-directory checks. Browser-session checks
 * and deeper skill validation land in later phases.
 */
import { execFile } from "node:child_process"
import { constants, promises as fs } from "node:fs"
import { promisify } from "node:util"
import { DATA_DIR_ENV, resolveDataDir } from "../lib/data-dir.ts"

const execFileAsync = promisify(execFile)

const MIN_NODE_MAJOR = 20

interface CheckResult {
  name: string
  ok: boolean
  detail: string
}

function mark(ok: boolean): string {
  return ok ? "✓" : "✗"
}

function checkNode(): CheckResult {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10)
  const ok = major >= MIN_NODE_MAJOR
  return {
    name: "Node.js",
    ok,
    detail: ok
      ? `v${process.versions.node}`
      : `v${process.versions.node} — Node ${MIN_NODE_MAJOR}+ required`,
  }
}

async function checkGh(): Promise<CheckResult> {
  try {
    await execFileAsync("gh", ["auth", "status"], { timeout: 15_000 })
    return { name: "GitHub CLI", ok: true, detail: "installed and authenticated" }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      name: "GitHub CLI",
      ok: false,
      detail: `not available or not authenticated — install: https://cli.github.com (${message
        .split("\n")[0]
        ?.trim()})`,
    }
  }
}

async function checkDataDir(): Promise<CheckResult> {
  const dir = resolveDataDir()
  try {
    await fs.access(dir, constants.W_OK)
    return { name: "Data directory", ok: true, detail: `${dir} (writable)` }
  } catch {
    try {
      await fs.access(dir)
      return {
        name: "Data directory",
        ok: false,
        detail: `${dir} exists but is not writable — check permissions or set ${DATA_DIR_ENV}`,
      }
    } catch {
      return {
        name: "Data directory",
        ok: true,
        detail: `${dir} not created yet (created during setup), or set ${DATA_DIR_ENV}`,
      }
    }
  }
}

async function main(): Promise<void> {
  console.log("automate-job-search — doctor\n")
  const checks = [checkNode(), await checkGh(), await checkDataDir()]
  for (const check of checks) {
    console.log(`${mark(check.ok)} ${check.name}: ${check.detail}`)
  }
  const failed = checks.filter((check) => !check.ok)
  console.log("")
  if (failed.length > 0) {
    console.log(`${failed.length} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log("All checks passed.")
  }
}

await main()
