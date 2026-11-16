#!/usr/bin/env node
/**
 * scheduled-search — run one automated search through OpenCode.
 *
 * Called by the OS scheduler wrapper. It checks the user's data, takes a
 * lock, runs `opencode run --auto --agent coach` with the scheduled prompt,
 * writes a log, sends a native notification (with a text fallback), and
 * records the last run. It never sends messages, publishes posts, or changes
 * the repository.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { resolveDataDir } from "../lib/data-dir.ts"
import {
  automationReady,
  buildScheduledPrompt,
  parseAutomationConfig,
  parsePendingState,
  validateAutomationConfig,
  AUTOMATION_FILE,
  DEFAULT_AUTOMATION,
  PENDING_FILE,
  type AutomationConfig,
} from "../lib/automation.ts"
import { buildNotificationCommand, formatNotificationFallback } from "../lib/notify.ts"
import { todayIso } from "../lib/jobstore.ts"

const repoPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = resolveDataDir()
const reportsDir = path.join(dataDir, "reports")
const logsDir = path.join(dataDir, "logs")
const stateDir = path.join(dataDir, "state")
const lockPath = path.join(stateDir, "search.lock")

interface RunResult {
  status: number | null
  stdout: string
  stderr: string
  error?: Error
}

function quoteWindowsArg(value: string): string {
  if (!/[\s&|<>^]/.test(value)) return value
  return `"${value.replaceAll('"', '""')}"`
}

function runOpenCode(prompt: string, config: AutomationConfig): RunResult {
  const args = ["run", "--auto", "--agent", "coach"]
  if (config.model.trim() !== "") args.push("--model", config.model.trim())
  args.push(prompt)
  const options = {
    cwd: repoPath,
    encoding: "utf8" as const,
    timeout: config.maxRuntimeMinutes * 60 * 1000,
    maxBuffer: 20 * 1024 * 1024,
  }
  if (process.platform !== "win32") {
    const result = spawnSync("opencode", args, options)
    return {
      status: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      error: result.error,
    }
  }
  const command = [process.env["ComSpec"] ?? "cmd.exe"]
  const line = ["opencode", ...args.map(quoteWindowsArg)].join(" ")
  const result = spawnSync(command[0] ?? "cmd.exe", ["/d", "/s", "/c", line], options)
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  }
}

async function notify(title: string, body: string, enabled: boolean): Promise<void> {
  if (!enabled) return
  const command = buildNotificationCommand(process.platform, title, body)
  const result = spawnSync(command.command, command.args, { encoding: "utf8" })
  if (result.error || result.status !== 0) {
    await fs.mkdir(stateDir, { recursive: true })
    await fs.appendFile(path.join(stateDir, "last-notification.txt"), formatNotificationFallback(title, body))
  }
}

async function readConfig(): Promise<AutomationConfig> {
  try {
    return parseAutomationConfig(await fs.readFile(path.join(dataDir, AUTOMATION_FILE), "utf8"))
  } catch {
    return { ...DEFAULT_AUTOMATION }
  }
}

async function writeSetupReport(missing: string[]): Promise<string> {
  await fs.mkdir(reportsDir, { recursive: true })
  const target = path.join(reportsDir, `${todayIso()}-setup-incomplete.md`)
  const body = `# Search not run — setup incomplete

Missing:

${missing.map((item) => `- ${item}`).join("\n")}

Run \`/job/setup\` to finish the missing data, then retry with \`/job/retry\`.
`
  await fs.writeFile(target, body)
  return target
}

async function main(): Promise<void> {
  const config = await readConfig()
  if (!config.enabled) {
    console.log("Automation is disabled; nothing to do.")
    return
  }

  const errors = validateAutomationConfig(config)
  if (errors.length > 0) {
    await fs.mkdir(reportsDir, { recursive: true })
    const target = path.join(reportsDir, `${todayIso()}-automation-invalid.md`)
    await fs.writeFile(
      target,
      `# Search not run — invalid automation config\n\n${errors.map((error) => `- ${error}`).join(
        "\n",
      )}\n\nFix it with \`/job/schedule\`.\n`,
    )
    await notify("Búsqueda diaria no ejecutada", `Configuración inválida. Reporte: ${target}`, config.notify)
    console.log(`invalid automation config: ${errors.join("; ")}`)
    process.exitCode = 2
    return
  }

  const missing = await automationReady(dataDir)
  if (missing.length > 0) {
    const report = await writeSetupReport(missing)
    await notify("Búsqueda diaria no ejecutada", `Falta configuración: ${missing.join(", ")}. Reporte: ${report}`, config.notify)
    console.log(`setup incomplete: ${missing.join(", ")}`)
    process.exitCode = 2
    return
  }

  await fs.mkdir(reportsDir, { recursive: true })
  await fs.mkdir(logsDir, { recursive: true })
  await fs.mkdir(stateDir, { recursive: true })

  try {
    const lock = JSON.parse(await fs.readFile(lockPath, "utf8")) as { startedAt?: string }
    const started = Date.parse(lock.startedAt ?? "")
    const maxAge = (config.maxRuntimeMinutes + 15) * 60 * 1000
    if (Number.isFinite(started) && Date.now() - started < maxAge) {
      console.log("Another scheduled search is running; exiting.")
      return
    }
    await fs.rm(lockPath, { force: true })
  } catch {
    // no lock
  }

  await fs.writeFile(lockPath, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`)
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const logPath = path.join(logsDir, `search-${todayIso()}-${stamp}.log`)
  const startedAt = Date.now()

  try {
    const prompt = buildScheduledPrompt(dataDir, config)
    const result = runOpenCode(prompt, config)
    const elapsed = Date.now() - startedAt
    const log = [
      `# Scheduled search ${new Date().toISOString()}`,
      `Model: ${config.model === "" ? "OpenCode default" : config.model}`,
      `Exit: ${result.status ?? "null"}`,
      result.error ? `Error: ${result.error.message}` : "",
      "",
      result.stdout,
      result.stderr,
    ]
      .filter((line) => line !== "")
      .join("\n")
    await fs.writeFile(logPath, `${log}\n`)

    const reportPath = path.join(reportsDir, `${todayIso()}.md`)
    try {
      await fs.access(reportPath)
    } catch {
      await fs.writeFile(
        reportPath,
        `# Daily search — ${todayIso()}

The scheduled run did not finish its report. See the log:

- ${logPath}

Exit code: ${result.status ?? "null"}
${result.error ? `Error: ${result.error.message}` : ""}
`,
      )
    }

    let pending = 0
    try {
      const state = parsePendingState(await fs.readFile(path.join(dataDir, PENDING_FILE), "utf8"))
      pending = state?.items.length ?? 0
    } catch {
      // no pending state
    }

    await fs.writeFile(
      path.join(stateDir, "last-run.json"),
      `${JSON.stringify(
        {
          finishedAt: new Date().toISOString(),
          exitCode: result.status,
          durationMs: elapsed,
          pending,
          log: logPath,
          report: reportPath,
        },
        null,
        2,
      )}\n`,
    )

    if (result.status === 0) {
      const body =
        pending > 0
          ? `Run terminado. ${pending} pendiente(s). Reporte: ${reportPath}`
          : `Run terminado sin pendientes. Reporte: ${reportPath}`
      await notify("Búsqueda diaria terminada", body, config.notify)
    } else {
      await notify("Búsqueda diaria con error", `Revisá el reporte: ${reportPath}`, config.notify)
      process.exitCode = result.status ?? 1
    }
  } finally {
    await fs.rm(lockPath, { force: true })
  }
}

await main()
