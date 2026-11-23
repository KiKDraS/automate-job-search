/**
 * Cross-platform scheduler command generation.
 *
 * macOS uses launchd, Linux uses a systemd user timer (or cron fallback),
 * Windows uses Task Scheduler. This module only builds strings and argument
 * lists; `scripts/schedule.ts` performs the installation.
 */

export type SchedulerKind = "launchd" | "systemd" | "cron" | "task-scheduler"

export interface SchedulerSpec {
  /** One or more local times; multiple times require a daily interval. */
  times: string[]
  interval: string
  wrapperPath: string
  logsDir: string
  label: string
  taskName: string
}

export interface WrapperSpec {
  /** Runtime copy the scheduler executes; never the project path. */
  runtimeDir: string
  dataDir: string
  nodePath: string
  tsxCliPath: string
  runnerPath: string
  opencodePath: string
  pathEnv: string
}

export function detectScheduler(platform: NodeJS.Platform = process.platform): SchedulerKind {
  if (platform === "darwin") return "launchd"
  if (platform === "win32") return "task-scheduler"
  return "systemd"
}

export function parseTime(time: string): { hour: number; minute: number } {
  const [hours = "0", minutes = "0"] = time.split(":")
  return { hour: Number(hours), minute: Number(minutes) }
}

export function intervalHours(interval: string): number | null {
  const match = interval.match(/^every\s+(\d+)h$/)
  return match ? Number(match[1]) : null
}

export function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function psQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

export function buildLaunchdPlist(spec: SchedulerSpec): string {
  const hours = intervalHours(spec.interval)
  const schedule =
    hours === null
      ? `    <key>StartCalendarInterval</key>
    <array>
${spec.times
  .map((time) => {
    const { hour, minute } = parseTime(time)
    return `        <dict>
            <key>Hour</key>
            <integer>${hour}</integer>
            <key>Minute</key>
            <integer>${minute}</integer>
        </dict>`
  })
  .join("\n")}
    </array>`
      : `    <key>StartInterval</key>
    <integer>${hours * 60 * 60}</integer>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${xmlEscape(spec.label)}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/sh</string>
        <string>${xmlEscape(spec.wrapperPath)}</string>
    </array>
    <key>RunAtLoad</key>
    <false/>
    <key>ProcessType</key>
    <string>Background</string>
    <key>LowPriorityIO</key>
    <true/>
    <key>Nice</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>${xmlEscape(`${spec.logsDir}/scheduler.log`)}</string>
    <key>StandardErrorPath</key>
    <string>${xmlEscape(`${spec.logsDir}/scheduler.log`)}</string>
${schedule}
</dict>
</plist>
`
}

export function buildSystemdService(spec: SchedulerSpec): string {
  return `[Unit]
Description=Automate Job Search scheduled search

[Service]
Type=oneshot
ExecStart=/bin/sh ${shellQuote(spec.wrapperPath)}
Nice=10
IOSchedulingClass=idle
`
}

export function buildSystemdTimer(spec: SchedulerSpec): string {
  const hours = intervalHours(spec.interval)
  const schedule =
    hours === null
      ? `${spec.times.map((time) => `OnCalendar=*-*-* ${time}:00`).join("\n")}
Persistent=true`
      : `OnBootSec=5min
OnUnitActiveSec=${hours}h
Persistent=true`
  return `[Unit]
Description=Automate Job Search scheduled search timer

[Timer]
Unit=automate-job-search.service
${schedule}

[Install]
WantedBy=timers.target
`
}

export function buildCronLines(spec: SchedulerSpec): string[] {
  const hours = intervalHours(spec.interval)
  if (hours === null || hours >= 24) {
    return spec.times.map((time) => {
      const { hour, minute } = parseTime(time)
      return `${minute} ${hour} * * * ${shellQuote(spec.wrapperPath)} # automate-job-search`
    })
  }
  return [`0 */${hours} * * * ${shellQuote(spec.wrapperPath)} # automate-job-search`]
}

/** Windows task name: one task per time; the first keeps the legacy name. */
export function windowsTaskName(spec: SchedulerSpec, index: number): string {
  return spec.times.length === 1 ? spec.taskName : `${spec.taskName}-${index + 1}`
}

export function buildWindowsTaskArgs(
  spec: SchedulerSpec,
  time: string,
  taskName: string = spec.taskName,
): string[] {
  const hours = intervalHours(spec.interval)
  const schedule =
    hours === null || hours >= 24
      ? ["/SC", "DAILY", "/ST", time]
      : ["/SC", "HOURLY", "/MO", String(hours), "/ST", time]
  return [
    "/Create",
    "/F",
    ...schedule,
    "/TN",
    taskName,
    "/TR",
    `"${spec.wrapperPath}"`,
  ]
}

export function buildPosixWrapper(spec: WrapperSpec): string {
  return `#!/bin/sh
cd ${shellQuote(spec.runtimeDir)} || exit 1
export PATH=${shellQuote(spec.pathEnv)}
export JOBSEARCH_OPENCODE_BIN=${shellQuote(spec.opencodePath)}
export JOBSEARCH_HOME=${shellQuote(spec.dataDir)}
exec ${shellQuote(spec.nodePath)} ${shellQuote(spec.tsxCliPath)} ${shellQuote(
    spec.runnerPath,
  )} >> ${shellQuote(`${spec.runtimeDir}/logs/scheduler.log`)} 2>&1
`
}

export function buildWindowsWrapper(spec: WrapperSpec): string {
  return `@echo off\r
cd /d "${spec.runtimeDir}"\r
set "PATH=${spec.pathEnv};%PATH%"\r
set "JOBSEARCH_OPENCODE_BIN=${spec.opencodePath}"\r
set "JOBSEARCH_HOME=${spec.dataDir}"\r
start "" /LOW /B /WAIT "${spec.nodePath}" "${spec.tsxCliPath}" "${spec.runnerPath}" >> "${spec.runtimeDir}\\logs\\scheduler.log" 2>&1\r
`
}

export function buildNotificationScript(title: string, body: string): string {
  return `Add-Type -AssemblyName System.Windows.Forms
$n = New-Object System.Windows.Forms.NotifyIcon
$n.Icon = [System.Drawing.SystemIcons]::Information
$n.Visible = $true
$n.ShowBalloonTip(5000, ${psQuote(title)}, ${psQuote(body)}, [System.Windows.Forms.ToolTipIcon]::Info)
Start-Sleep -Seconds 1
$n.Dispose()
`
}
