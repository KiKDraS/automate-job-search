#!/usr/bin/env node
/**
 * schedule — install, update, inspect and remove the daily search scheduler.
 *
 * Usage:
 *   npx tsx scripts/schedule.ts status
 *   npx tsx scripts/schedule.ts enable  [--times "09:00,18:00"] [--time 09:00]
 *                                       [--interval daily|every 12h]
 *                                       [--search-window 48]
 *                                       [--model provider/model] [--default-model]
 *                                       [--opencode-bin /path/to/opencode]
 *                                       [--max-applications 0] [--max-runtime 60]
 *                                       [--notify|--no-notify] [--feed|--no-feed]
 *                                       [--apply|--no-apply] [--dry-run]
 *                                       [--allow-protected-data-dir]
 *   npx tsx scripts/schedule.ts update  [same flags]
 *   npx tsx scripts/schedule.ts disable
 *   npx tsx scripts/schedule.ts remove
 *   npx tsx scripts/schedule.ts repair  [--force-deps]
 *   npx tsx scripts/schedule.ts run-now
 *   npx tsx scripts/schedule.ts login
 *
 * The config lives in <data dir>/automation.md. Scheduled runs execute from
 * a runtime copy in the user's application-data directory, so the project can
 * live anywhere — including protected folders such as ~/Documents. No
 * personal data enters the repo.
 */
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { resolveDataDir } from "../lib/data-dir.ts"
import {
  automationReady,
  DEFAULT_AUTOMATION,
  formatAutomationConfig,
  nextRunAt,
  parseAutomationConfig,
  parseTimes,
  SEARCH_LOCK_FILE,
  validateAutomationConfig,
  type AutomationConfig,
} from "../lib/automation.ts"
import {
  buildCronLines,
  buildLaunchdPlist,
  buildPosixWrapper,
  buildSystemdService,
  buildSystemdTimer,
  buildWindowsTaskArgs,
  buildWindowsWrapper,
  detectScheduler,
  windowsTaskName,
  type SchedulerSpec,
  type WrapperSpec,
} from "../lib/scheduler.ts"
import { findNodePath, knownOpencodePaths, resolveOpencodePath } from "../lib/opencode-bin.ts"
import { resolveOpencodeDefaultModel } from "../lib/model.ts"
import {
  buildRuntimeOpencodeConfig,
  findChromePath,
  playwrightProfileDir,
  protectedPath,
  resolveRuntimeDir,
  runtimeBrowserProfileDir,
  runtimeStatus,
  safePathEnv,
  seedBrowserProfile,
  syncRuntime,
  type RuntimeStatus,
} from "../lib/runtime.ts"
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
const logsDir = path.join(dataDir, "logs")
const stateDir = path.join(dataDir, "state")
const runtimePath = resolveRuntimeDir()
const runtimeBinDir = path.join(runtimePath, "bin")
const runtimeLogsDir = path.join(runtimePath, "logs")
const wrapperName = process.platform === "win32" ? "scheduled-search.cmd" : "scheduled-search.sh"
const wrapperPath = path.join(runtimeBinDir, wrapperName)
const legacyWrapperPath = path.join(dataDir, "bin", wrapperName)
const tsxCliPath = path.join(runtimePath, "node_modules", "tsx", "dist", "cli.mjs")
const runnerPath = path.join(runtimePath, "scripts", "scheduled-search.ts")
const schedulerLogPath = path.join(runtimeLogsDir, "scheduler.log")

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

function schedulerSpec(config: AutomationConfig): SchedulerSpec {
  return {
    times: config.times,
    interval: config.interval,
    wrapperPath,
    logsDir: runtimeLogsDir,
    label: LABEL,
    taskName: TASK_NAME,
  }
}

function resolveOpencode(override?: string): string {
  const resolved = resolveOpencodePath({ override })
  if (resolved === null) {
    return fail(
      SCRIPT,
      `opencode CLI not found. Install it or pass --opencode-bin <path>. Known locations: ${knownOpencodePaths().join(
        ", ",
      )}`,
    )
  }
  return resolved
}

function wrapperSpec(opencodePath: string): WrapperSpec {
  return {
    runtimeDir: runtimePath,
    dataDir,
    nodePath: findNodePath() ?? process.execPath,
    tsxCliPath,
    runnerPath,
    opencodePath,
    pathEnv: safePathEnv(process.env["PATH"] ?? ""),
  }
}

function formatNext(config: AutomationConfig): string {
  const next = nextRunAt(config)
  return next === null ? "not scheduled" : next.toLocaleString()
}

function formatModel(config: AutomationConfig): string {
  if (config.model.trim() !== "") return config.model
  const fallback = resolveOpencodeDefaultModel()
  return fallback === null ? "OpenCode default" : `OpenCode default (${fallback})`
}

function describeDataDir(): string {
  const protectedInfo = protectedPath(dataDir)
  return protectedInfo === null
    ? `${dataDir} (safe)`
    : `${dataDir} (protected: ${protectedInfo.label} — ${protectedInfo.reason})`
}

function describeRuntime(status: RuntimeStatus): string {
  if (status.state === "missing") {
    return `${runtimePath} (missing — run /job/schedule --repair)`
  }
  if (status.state === "current") return `${runtimePath} (current)`
  return `${runtimePath} (stale: ${status.reasons.join(", ")} — run /job/schedule --repair)`
}

async function writeWrapper(opencodePath: string): Promise<void> {
  await fs.mkdir(runtimeBinDir, { recursive: true })
  await fs.mkdir(runtimeLogsDir, { recursive: true })
  const content =
    process.platform === "win32"
      ? buildWindowsWrapper(wrapperSpec(opencodePath))
      : buildPosixWrapper(wrapperSpec(opencodePath))
  await fs.writeFile(wrapperPath, content, { mode: 0o755 })
  if (process.platform !== "win32") await fs.chmod(wrapperPath, 0o755)
}

async function assertNoRunningSearch(): Promise<void> {
  try {
    const lock = JSON.parse(
      await fs.readFile(path.join(dataDir, SEARCH_LOCK_FILE), "utf8"),
    ) as { startedAt?: string }
    const started = Date.parse(lock.startedAt ?? "")
    const maxAge = 75 * 60 * 1000
    if (Number.isFinite(started) && Date.now() - started < maxAge) {
      fail(
        SCRIPT,
        `a scheduled search started at ${lock.startedAt} is still running. Wait for it to finish, then run again.`,
      )
    }
  } catch {
    // no lock
  }
}

async function syncRuntimeFiles(forceDependencies = false): Promise<void> {
  const opencodeSource = await fs.readFile(path.join(repoPath, "opencode.jsonc"), "utf8")
  const browserProfile = runtimeBrowserProfileDir(runtimePath)
  const seeded = await seedBrowserProfile(playwrightProfileDir(repoPath), browserProfile)
  const runtimeConfig = buildRuntimeOpencodeConfig(opencodeSource, browserProfile)
  const result = await syncRuntime({
    repoPath,
    runtimePath,
    opencodeConfig: runtimeConfig.content,
    forceDependencies,
  })
  console.log(`Runtime: ${runtimePath}`)
  if (result.dependenciesCopied) console.log("Dependencies copied into the runtime.")
  if (seeded === "copied") {
    console.log(`Browser profile copied for scheduled runs: ${browserProfile}`)
  }
  if (seeded === "missing") {
    console.log(
      "No browser profile yet. The first scheduled browser task opens a fresh window; run /job/schedule --login to sign in once.",
    )
  }
  if (!runtimeConfig.injected) {
    console.log(
      "Warning: could not add the browser profile flag to the runtime config; scheduled runs may need a LinkedIn login.",
    )
  }
}

async function installLaunchd(config: AutomationConfig): Promise<string> {
  const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`)
  await fs.mkdir(path.dirname(plistPath), { recursive: true })
  await fs.mkdir(runtimeLogsDir, { recursive: true })
  const spec = schedulerSpec(config)
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
  await fs.mkdir(runtimeLogsDir, { recursive: true })
  const spec = schedulerSpec(config)
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
  const spec = schedulerSpec(config)
  const existing = run("crontab", ["-l"])
  const current = existing.status === 0 ? existing.stdout : ""
  const lines = withoutCronBlock(current)
  const block = [CRON_BEGIN, ...buildCronLines(spec), CRON_END]
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
  await fs.mkdir(runtimeLogsDir, { recursive: true })
  const spec = schedulerSpec(config)
  run("schtasks", ["/Delete", "/F", "/TN", spec.taskName])
  for (let index = 0; index < 5; index += 1) {
    run("schtasks", ["/Delete", "/F", "/TN", `${spec.taskName}-${index + 1}`])
  }
  const names: string[] = []
  for (const [index, time] of spec.times.entries()) {
    const name = windowsTaskName(spec, index)
    const result = run("schtasks", buildWindowsTaskArgs(spec, time, name))
    if (result.status !== 0) {
      return fail(SCRIPT, `schtasks failed: ${result.stderr || result.stdout}`)
    }
    names.push(name)
  }
  return names.join(", ")
}

async function install(
  config: AutomationConfig,
  opencodePath: string,
  forceDependencies = false,
): Promise<string> {
  const sourceTsx = path.join(repoPath, "node_modules", "tsx", "dist", "cli.mjs")
  if (!(await fs.stat(sourceTsx).catch(() => null))) {
    fail(SCRIPT, `missing ${sourceTsx}; run npm install first`)
  }
  const nodePath = findNodePath() ?? process.execPath
  for (const [label, value] of [
    ["node", nodePath],
    ["opencode", opencodePath],
  ] as const) {
    const reason = protectedPath(value)
    if (reason !== null) {
      return fail(
        SCRIPT,
        `${label} is inside ${reason.label} (${reason.reason}). Install it outside protected folders, or grant Full Disk Access to both binaries.`,
      )
    }
  }
  await assertNoRunningSearch()
  await syncRuntimeFiles(forceDependencies)
  await writeWrapper(opencodePath)
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

async function remove(config: AutomationConfig): Promise<void> {
  if (process.platform === "darwin") {
    await removeLaunchd()
  } else if (process.platform === "win32") {
    run("schtasks", ["/Delete", "/F", "/TN", TASK_NAME])
    for (let index = 0; index < 5; index += 1) {
      run("schtasks", ["/Delete", "/F", "/TN", `${TASK_NAME}-${index + 1}`])
    }
  } else {
    await removeSystemd()
    await removeCron()
  }
  await fs.rm(wrapperPath, { force: true })
  await fs.rm(legacyWrapperPath, { force: true })
}

async function isInstalled(config: AutomationConfig): Promise<boolean> {
  if (process.platform === "darwin") {
    const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`)
    return fs.access(plistPath).then(
      () => true,
      () => false,
    )
  }
  if (process.platform === "win32") {
    const spec = schedulerSpec(config)
    return spec.times.every(
      (_time, index) =>
        run("schtasks", ["/Query", "/TN", windowsTaskName(spec, index)]).status === 0,
    )
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
  const runtime = await runtimeStatus(repoPath, runtimePath)
  console.log(`Automation: ${config.enabled ? "enabled" : "disabled"}`)
  console.log(
    `Schedule: ${
      config.interval === "daily"
        ? `daily at ${config.times.join(", ")}`
        : config.interval
    }`,
  )
  console.log(`Search window: ${config.searchWindowHours} hours`)
  console.log(`Model: ${formatModel(config)}`)
  console.log(`Next run: ${formatNext(config)}`)
  console.log(`Scheduler: ${detectScheduler()}`)
  console.log(`Installed: ${(await isInstalled(config)) ? "yes" : "no"}`)
  console.log(`Project: ${repoPath}${formatProject(runtime)}`)
  console.log(`Runtime: ${describeRuntime(runtime)}`)
  console.log(`Data dir: ${describeDataDir()}`)
  console.log(`OpenCode CLI: ${resolveOpencodePath() ?? "not found"}`)
  console.log(`Node: ${findNodePath() ?? "not found"}`)
  console.log(`Scheduler log: ${schedulerLogPath}`)
  console.log(`Browser profile: ${runtimeBrowserProfileDir(runtimePath)}`)
  console.log(`Config: ${configPath}`)
  console.log(`Setup: ${missing.length === 0 ? "ready" : `missing ${missing.join(", ")}`}`)
  console.log(`Applications: ${config.maxApplicationsPerRun === 0 ? "no cap" : config.maxApplicationsPerRun}`)
  console.log(`Runtime cap: ${config.maxRuntimeMinutes} minutes`)
  console.log(`Notifications: ${config.notify ? "on" : "off"}`)
  console.log(`Feed search: ${config.includeFeedSearch ? "on" : "off"}`)
  console.log(`Standing auto-apply: ${config.standingApproval ? "on" : "off"}`)
}

function formatProject(runtime: RuntimeStatus): string {
  if (runtime.project.commit === null) return runtime.project.dirty ? " (dirty)" : ""
  return ` @ ${runtime.project.commit}${runtime.project.dirty ? " (dirty)" : ""}`
}

async function dryRun(config: AutomationConfig, opencodePath: string): Promise<void> {
  const spec = schedulerSpec(config)
  console.log(`# ${configPath}\n`)
  console.log(formatAutomationConfig(config))
  console.log(`# Runtime: ${runtimePath}\n`)
  console.log(`# ${wrapperPath}\n`)
  console.log(
    process.platform === "win32"
      ? buildWindowsWrapper(wrapperSpec(opencodePath))
      : buildPosixWrapper(wrapperSpec(opencodePath)),
  )
  console.log(`# ${detectScheduler()}\n`)
  if (process.platform === "darwin") console.log(buildLaunchdPlist(spec))
  else if (process.platform === "win32") {
    for (const [index, time] of spec.times.entries()) {
      console.log(
        `schtasks ${buildWindowsTaskArgs(spec, time, windowsTaskName(spec, index)).join(" ")}`,
      )
    }
  } else {
    console.log(buildSystemdService(spec))
    console.log(buildSystemdTimer(spec))
    for (const line of buildCronLines(spec)) console.log(line)
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
    if (!dry) await remove(config)
    console.log("Automation disabled. Config kept; run /job/schedule --enable to resume.")
    return
  }

  if (command === "remove") {
    const config = { ...(await readConfig()), enabled: false }
    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(configPath, formatAutomationConfig(config))
    if (!dry) await remove(config)
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
      run("schtasks", ["/Run", "/TN", windowsTaskName(schedulerSpec(config), 0)])
    } else {
      run("systemctl", ["--user", "start", `${SERVICE_NAME}.service`])
    }
    console.log("Run requested.")
    return
  }

  if (command === "login") {
    const chrome = findChromePath()
    if (chrome === null) {
      return fail(
        SCRIPT,
        "Google Chrome not found. Install Chrome, or open the scheduled profile manually and sign in to LinkedIn.",
      )
    }
    const profile = runtimeBrowserProfileDir(runtimePath)
    await fs.mkdir(profile, { recursive: true })
    const child = spawn(
      chrome,
      [`--user-data-dir=${profile}`, "https://www.linkedin.com/login"],
      { detached: true, stdio: "ignore" },
    )
    child.unref()
    console.log(`Chrome opened with the scheduled profile: ${profile}`)
    console.log(
      "Sign in to LinkedIn, close that window, and scheduled runs will reuse the session.",
    )
    return
  }

  if (!["enable", "apply", "update", "repair"].includes(command)) {
    return fail(
      SCRIPT,
      "usage: status | enable | update | disable | remove | repair | run-now | login [flags]",
    )
  }

  const config = await readConfig()
  const times = optionalValue(args, "--times")
  const time = optionalValue(args, "--time")
  const interval = optionalValue(args, "--interval")
  const searchWindow = optionalValue(args, "--search-window")
  const model = optionalValue(args, "--model")
  const maxApplications = optionalValue(args, "--max-applications")
  const maxRuntime = optionalValue(args, "--max-runtime")
  const opencodeOverride = optionalValue(args, "--opencode-bin")

  if (times !== undefined) config.times = parseTimes(times)
  else if (time !== undefined) config.times = [time]
  if (interval !== undefined) config.interval = interval
  if (searchWindow !== undefined) config.searchWindowHours = Number(searchWindow)
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
  if (command === "enable" || command === "apply") config.enabled = true

  const errors = validateAutomationConfig(config)
  if (errors.length > 0) return fail(SCRIPT, errors.join("; "))

  if (command === "repair" && !config.enabled) {
    await syncRuntimeFiles(has(args, "--force-deps"))
    console.log("Automation is disabled; enable it with /job/schedule --enable.")
    return
  }

  if (config.enabled) {
    const missing = await automationReady(dataDir)
    if (missing.length > 0) {
      return fail(
        SCRIPT,
        `setup incomplete (${missing.join(", ")}). Finish /job/setup before enabling automation.`,
      )
    }
  }

  const protectedInfo = protectedPath(dataDir)
  if (protectedInfo !== null && !has(args, "--allow-protected-data-dir")) {
    return fail(
      SCRIPT,
      `data directory ${dataDir} is inside ${protectedInfo.label}, which ${protectedInfo.reason}. ` +
        "Move it with `npx tsx scripts/data-dir.ts migrate --to ~/.jobsearch` (or another path outside " +
        "Documents, Desktop, Downloads, iCloud, and external volumes) and run again. " +
        "If you granted Full Disk Access to node and opencode, pass --allow-protected-data-dir.",
    )
  }

  if (dry) {
    await dryRun(config, resolveOpencode(opencodeOverride))
    return
  }

  await fs.mkdir(dataDir, { recursive: true })
  await fs.mkdir(logsDir, { recursive: true })
  await fs.mkdir(stateDir, { recursive: true })
  await fs.writeFile(configPath, formatAutomationConfig(config))

  if (!config.enabled) {
    console.log("Automation is disabled. Config saved; nothing installed.")
    return
  }

  const target = await install(config, resolveOpencode(opencodeOverride), has(args, "--force-deps"))
  console.log(`Automation ${config.enabled ? "enabled" : "updated"}.`)
  console.log(`Schedule: ${config.interval === "daily" ? `daily at ${config.times.join(", ")}` : config.interval}`)
  console.log(`Search window: ${config.searchWindowHours} hours`)
  console.log(`Model: ${formatModel(config)}`)
  console.log(`Next run: ${formatNext(config)}`)
  console.log(`Scheduler target: ${target}`)
  console.log(`Data dir: ${describeDataDir()}`)
  console.log(`Config: ${configPath}`)
  console.log(
    `Change later: /job/schedule --times "08:30,18:30" | --search-window 24 | --model <provider/model>`,
  )
}

await main()
