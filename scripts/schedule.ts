#!/usr/bin/env node
/**
 * schedule — install, update, inspect and remove the daily search scheduler.
 *
 * Usage:
 *   npx tsx scripts/schedule.ts status
 *   npx tsx scripts/schedule.ts enable  [--time 09:00] [--interval daily|every 12h]
 *                                       [--model provider/model] [--default-model]
 *                                       [--max-applications 0] [--max-runtime 60]
 *                                       [--notify|--no-notify] [--feed|--no-feed]
 *                                       [--apply|--no-apply] [--dry-run]
 *   npx tsx scripts/schedule.ts update  [same flags]
 *   npx tsx scripts/schedule.ts disable
 *   npx tsx scripts/schedule.ts remove
 *   npx tsx scripts/schedule.ts repair
 *   npx tsx scripts/schedule.ts run-now
 *
 * The config lives in <data dir>/automation.md. The wrapper and scheduler
 * files live outside the repository; no personal data enters the repo.
 */
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { resolveDataDir } from "../lib/data-dir.ts"
import {
  automationReady,
  DEFAULT_AUTOMATION,
  formatAutomationConfig,
  nextRunAt,
  parseAutomationConfig,
  validateAutomationConfig,
  type AutomationConfig,
} from "../lib/automation.ts"
import {
  buildCronLine,
  buildLaunchdPlist,
  buildPosixWrapper,
  buildSystemdService,
  buildSystemdTimer,
  buildWindowsTaskArgs,
  buildWindowsWrapper,
  detectScheduler,
  type SchedulerSpec,
  type WrapperSpec,
} from "../lib/scheduler.ts"
import { fail } from "./args.ts"

const SCRIPT = "schedule"
const LABEL = "com.kikdras.automate-job-search.search"
const TASK_NAME = "automate-job-search-search"
const SERVICE_NAME = "automate-job-search"
const CRON_BEGIN = "# BEGIN automate-job-search"
const CRON_END = "# END automate-job-search"

const repoPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = resolveDataDir()
const configPath = path.join(dataDir, "automation.md")
const binDir = path.join(dataDir, "bin")
const logsDir = path.join(dataDir, "logs")
const stateDir = path.join(dataDir, "state")
const wrapperPath = path.join(binDir, process.platform === "win32" ? "scheduled-search.cmd" : "scheduled-search.sh")
const tsxCliPath = path.join(repoPath, "node_modules", "tsx", "dist", "cli.mjs")
const runnerPath = path.join(repoPath, "scripts", "scheduled-search.ts")

interface RunResult {
  status: number | null
  stdout: string
  stderr: string
  error?: Error
}

function run(command: string, args: string[], input?: string): RunResult {
  const result = spawnSync(command, args, { encoding: "utf8", input })
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  }
}

function has(args: string[], flag: string): boolean {
  return args.includes(flag)
}

function optionalValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index === -1) return undefined
  const value = args[index + 1]
  if (value === undefined || value.startsWith("--")) return fail(SCRIPT, `missing value for ${flag}`)
  return value
}

async function readConfig(): Promise<AutomationConfig> {
  try {
    return parseAutomationConfig(await fs.readFile(configPath, "utf8"))
  } catch {
    return { ...DEFAULT_AUTOMATION }
  }
}

function schedulerSpec(): SchedulerSpec {
  return {
    time: "09:00",
    interval: "daily",
    wrapperPath,
    logsDir,
    label: LABEL,
    taskName: TASK_NAME,
  }
}

function resolveOpencode(): string {
  const command = process.platform === "win32" ? "where" : "which"
  const result = run(command, ["opencode"])
  const first = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line !== "")
  return result.status === 0 && first !== undefined ? first : "opencode"
}

function wrapperSpec(): WrapperSpec {
  return {
    repoPath,
    dataDir,
    nodePath: process.execPath,
    tsxCliPath,
    runnerPath,
    opencodePath: resolveOpencode(),
  }
}

function formatNext(config: AutomationConfig): string {
  const next = nextRunAt(config)
  return next === null ? "not scheduled" : next.toLocaleString()
}

async function writeWrapper(): Promise<void> {
  await fs.mkdir(binDir, { recursive: true })
  const content =
    process.platform === "win32"
      ? buildWindowsWrapper(wrapperSpec())
      : buildPosixWrapper(wrapperSpec())
  await fs.writeFile(wrapperPath, content, { mode: 0o755 })
  if (process.platform !== "win32") await fs.chmod(wrapperPath, 0o755)
}

async function installLaunchd(config: AutomationConfig): Promise<string> {
  const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`)
  await fs.mkdir(path.dirname(plistPath), { recursive: true })
  await fs.mkdir(logsDir, { recursive: true })
  const spec = { ...schedulerSpec(), time: config.time, interval: config.interval }
  await fs.writeFile(plistPath, buildLaunchdPlist(spec))
  const uid = process.getuid?.()
  if (uid === undefined) fail(SCRIPT, "cannot resolve the macOS user id")
  run("launchctl", ["bootout", `gui/${uid}`, plistPath])
  const bootstrap = run("launchctl", ["bootstrap", `gui/${uid}`, plistPath])
  if (bootstrap.status !== 0) {
    return fail(SCRIPT, `launchctl bootstrap failed: ${bootstrap.stderr || bootstrap.stdout}`)
  }
  run("launchctl", ["enable", `gui/${uid}/${LABEL}`])
  return plistPath
}

async function installSystemd(config: AutomationConfig): Promise<string> {
  const dir = path.join(os.homedir(), ".config", "systemd", "user")
  await fs.mkdir(dir, { recursive: true })
  await fs.mkdir(logsDir, { recursive: true })
  const spec = { ...schedulerSpec(), time: config.time, interval: config.interval }
  const servicePath = path.join(dir, `${SERVICE_NAME}.service`)
  const timerPath = path.join(dir, `${SERVICE_NAME}.timer`)
  await fs.writeFile(servicePath, buildSystemdService(spec))
  await fs.writeFile(timerPath, buildSystemdTimer(spec))
  const reload = run("systemctl", ["--user", "daemon-reload"])
  const enable = run("systemctl", ["--user", "enable", "--now", `${SERVICE_NAME}.timer`])
  if (reload.status !== 0 || enable.status !== 0) {
    throw new Error(
      `systemd user timer failed (${enable.stderr || reload.stderr || "systemctl unavailable"})`,
    )
  }
  return timerPath
}

async function installCron(config: AutomationConfig): Promise<string> {
  const spec = { ...schedulerSpec(), time: config.time, interval: config.interval }
  const existing = run("crontab", ["-l"])
  const current = existing.status === 0 ? existing.stdout : ""
  const lines = withoutCronBlock(current)
  const block = [CRON_BEGIN, buildCronLine(spec), CRON_END]
  const next = [...lines, ...block, ""].join("\n")
  const install = run("crontab", ["-"], next)
  if (install.status !== 0) {
    return fail(SCRIPT, `crontab install failed: ${install.stderr || install.stdout}`)
  }
  return "user crontab"
}

function withoutCronBlock(source: string): string[] {
  const out: string[] = []
  let inBlock = false
  for (const line of source.split(/\r?\n/)) {
    if (line.trim() === "") continue
    if (line.includes(CRON_BEGIN)) {
      inBlock = true
      continue
    }
    if (line.includes(CRON_END)) {
      inBlock = false
      continue
    }
    if (!inBlock) out.push(line)
  }
  return out
}

async function installWindows(config: AutomationConfig): Promise<string> {
  await fs.mkdir(logsDir, { recursive: true })
  const spec = { ...schedulerSpec(), time: config.time, interval: config.interval }
  const result = run("schtasks", buildWindowsTaskArgs(spec))
  if (result.status !== 0) {
    return fail(SCRIPT, `schtasks failed: ${result.stderr || result.stdout}`)
  }
  return TASK_NAME
}

async function install(config: AutomationConfig): Promise<string> {
  if (!(await fs.stat(tsxCliPath).catch(() => null))) {
    fail(SCRIPT, `missing ${tsxCliPath}; run npm install first`)
  }
  await writeWrapper()
  if (process.platform === "darwin") return installLaunchd(config)
  if (process.platform === "win32") return installWindows(config)
  try {
    return await installSystemd(config)
  } catch {
    return installCron(config)
  }
}

async function removeLaunchd(): Promise<void> {
  const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`)
  const uid = process.getuid?.()
  if (uid !== undefined) run("launchctl", ["bootout", `gui/${uid}`, plistPath])
  await fs.rm(plistPath, { force: true })
}

async function removeSystemd(): Promise<void> {
  run("systemctl", ["--user", "disable", "--now", `${SERVICE_NAME}.timer`])
  const dir = path.join(os.homedir(), ".config", "systemd", "user")
  await fs.rm(path.join(dir, `${SERVICE_NAME}.service`), { force: true })
  await fs.rm(path.join(dir, `${SERVICE_NAME}.timer`), { force: true })
  run("systemctl", ["--user", "daemon-reload"])
}

async function removeCron(): Promise<void> {
  const existing = run("crontab", ["-l"])
  if (existing.status !== 0) return
  const lines = withoutCronBlock(existing.stdout)
  run("crontab", ["-"], [...lines, ""].join("\n"))
}

async function remove(): Promise<void> {
  if (process.platform === "darwin") {
    await removeLaunchd()
  } else if (process.platform === "win32") {
    run("schtasks", ["/Delete", "/F", "/TN", TASK_NAME])
  } else {
    await removeSystemd()
    await removeCron()
  }
  await fs.rm(wrapperPath, { force: true })
}

async function isInstalled(): Promise<boolean> {
  if (process.platform === "darwin") {
    const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`)
    return fs.access(plistPath).then(
      () => true,
      () => false,
    )
  }
  if (process.platform === "win32") {
    return run("schtasks", ["/Query", "/TN", TASK_NAME]).status === 0
  }
  const timerPath = path.join(os.homedir(), ".config", "systemd", "user", `${SERVICE_NAME}.timer`)
  const systemd = await fs.access(timerPath).then(
    () => true,
    () => false,
  )
  if (systemd) return true
  const crontab = run("crontab", ["-l"])
  return crontab.status === 0 && crontab.stdout.includes(CRON_BEGIN)
}

async function statusLine(config: AutomationConfig): Promise<void> {
  const missing = await automationReady(dataDir)
  console.log(`Automation: ${config.enabled ? "enabled" : "disabled"}`)
  console.log(`Schedule: ${config.interval === "daily" ? `daily at ${config.time}` : config.interval}`)
  console.log(`Model: ${config.model === "" ? "OpenCode default" : config.model}`)
  console.log(`Next run: ${formatNext(config)}`)
  console.log(`Scheduler: ${detectScheduler()}`)
  console.log(`Installed: ${(await isInstalled()) ? "yes" : "no"}`)
  console.log(`Wrapper: ${wrapperPath}`)
  console.log(`Config: ${configPath}`)
  console.log(`Setup: ${missing.length === 0 ? "ready" : `missing ${missing.join(", ")}`}`)
  console.log(`Applications: ${config.maxApplicationsPerRun === 0 ? "no cap" : config.maxApplicationsPerRun}`)
  console.log(`Runtime cap: ${config.maxRuntimeMinutes} minutes`)
  console.log(`Notifications: ${config.notify ? "on" : "off"}`)
  console.log(`Feed search: ${config.includeFeedSearch ? "on" : "off"}`)
  console.log(`Standing auto-apply: ${config.standingApproval ? "on" : "off"}`)
}

async function dryRun(config: AutomationConfig): Promise<void> {
  const spec = { ...schedulerSpec(), time: config.time, interval: config.interval }
  console.log(`# ${configPath}\n`)
  console.log(formatAutomationConfig(config))
  console.log(`# ${wrapperPath}\n`)
  console.log(
    process.platform === "win32" ? buildWindowsWrapper(wrapperSpec()) : buildPosixWrapper(wrapperSpec()),
  )
  console.log(`# ${detectScheduler()}\n`)
  if (process.platform === "darwin") console.log(buildLaunchdPlist(spec))
  else if (process.platform === "win32") console.log(`schtasks ${buildWindowsTaskArgs(spec).join(" ")}`)
  else {
    console.log(buildSystemdService(spec))
    console.log(buildSystemdTimer(spec))
    console.log(buildCronLine(spec))
  }
}

async function main(): Promise<void> {
  const [command = "status", ...args] = process.argv.slice(2)
  const dry = has(args, "--dry-run")

  if (command === "status") {
    await statusLine(await readConfig())
    return
  }

  if (command === "disable") {
    const config = { ...(await readConfig()), enabled: false }
    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(configPath, formatAutomationConfig(config))
    if (!dry) await remove()
    console.log("Automation disabled. Config kept; run /job/schedule --enable to resume.")
    return
  }

  if (command === "remove") {
    const config = { ...(await readConfig()), enabled: false }
    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(configPath, formatAutomationConfig(config))
    if (!dry) await remove()
    console.log("Scheduler removed. automation.md kept with enabled: false.")
    return
  }

  if (command === "run-now") {
    const config = await readConfig()
    if (!config.enabled) fail(SCRIPT, "automation is disabled")
    if (process.platform === "darwin") {
      const uid = process.getuid?.()
      if (uid !== undefined) run("launchctl", ["kickstart", "-k", `gui/${uid}/${LABEL}`])
    } else if (process.platform === "win32") {
      run("schtasks", ["/Run", "/TN", TASK_NAME])
    } else {
      run("systemctl", ["--user", "start", `${SERVICE_NAME}.service`])
    }
    console.log("Run requested.")
    return
  }

  if (!["enable", "apply", "update", "repair"].includes(command)) {
    return fail(SCRIPT, "usage: status | enable | update | disable | remove | repair | run-now [flags]")
  }

  const config = await readConfig()
  const time = optionalValue(args, "--time")
  const interval = optionalValue(args, "--interval")
  const model = optionalValue(args, "--model")
  const maxApplications = optionalValue(args, "--max-applications")
  const maxRuntime = optionalValue(args, "--max-runtime")

  if (time !== undefined) config.time = time
  if (interval !== undefined) config.interval = interval
  if (model !== undefined) config.model = model
  if (has(args, "--default-model")) config.model = ""
  if (maxApplications !== undefined) config.maxApplicationsPerRun = Number(maxApplications)
  if (maxRuntime !== undefined) config.maxRuntimeMinutes = Number(maxRuntime)
  if (has(args, "--notify")) config.notify = true
  if (has(args, "--no-notify")) config.notify = false
  if (has(args, "--feed")) config.includeFeedSearch = true
  if (has(args, "--no-feed")) config.includeFeedSearch = false
  if (has(args, "--apply")) config.standingApproval = true
  if (has(args, "--no-apply")) config.standingApproval = false
  if (command !== "update") config.enabled = true

  const errors = validateAutomationConfig(config)
  if (errors.length > 0) return fail(SCRIPT, errors.join("; "))

  const missing = await automationReady(dataDir)
  if (missing.length > 0) {
    return fail(
      SCRIPT,
      `setup incomplete (${missing.join(", ")}). Finish /job/setup before enabling automation.`,
    )
  }

  if (dry) {
    await dryRun(config)
    return
  }

  await fs.mkdir(dataDir, { recursive: true })
  await fs.mkdir(logsDir, { recursive: true })
  await fs.mkdir(stateDir, { recursive: true })
  await fs.writeFile(configPath, formatAutomationConfig(config))
  const target = await install(config)
  console.log(`Automation ${config.enabled ? "enabled" : "updated"}.`)
  console.log(`Next run: ${formatNext(config)}`)
  console.log(`Scheduler target: ${target}`)
  console.log(`Config: ${configPath}`)
  console.log(`Change later: /job/schedule --time 08:30 | --interval "every 12h" | --model <provider/model>`)
}

await main()
