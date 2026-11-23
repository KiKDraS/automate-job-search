/**
 * Runtime copy for scheduled runs.
 *
 * macOS protects Desktop, Documents, Downloads, iCloud Drive, and external
 * volumes with TCC. A `launchd` job cannot read the project when it lives in
 * one of those folders, so scheduled runs execute from a copy of the code in
 * the user's application-data directory instead of from the project itself.
 *
 * The project can stay wherever the user cloned it. `scripts/schedule.ts`
 * synchronizes the runtime before installing the OS scheduler and reports
 * whether the copy is current, stale, or missing.
 */
import { createHash } from "node:crypto"
import { accessSync, constants, promises as fs, statSync } from "node:fs"
import { spawnSync } from "node:child_process"
import os from "node:os"
import path from "node:path"

export const RUNTIME_ENV = "JOBSEARCH_RUNTIME"
export const RUNTIME_MANIFEST = ".runtime.json"
export const RUNTIME_SCHEMA = 1

/** Source directories copied into the runtime on every sync. */
export const RUNTIME_DIRS = [".opencode", "lib", "scripts"] as const

/** Root files copied into the runtime. `opencode.jsonc` is generated. */
export const RUNTIME_FILES = [
  "AGENTS.md",
  "SPEC.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
] as const

export const RUNTIME_DEPENDENCIES = "node_modules"

export interface RuntimeOptions {
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  home?: string
}

export interface RuntimeManifest {
  schema: number
  version: string
  source: string
  sourceCommit: string | null
  sourceDirty: boolean
  syncedAt: string
  lockHash: string
}

export interface ProjectState {
  version: string
  commit: string | null
  dirty: boolean
}

export interface RuntimeExpectation {
  source: string
  version: string
  sourceCommit: string | null
  sourceDirty: boolean
}

export type RuntimeState = "current" | "stale" | "missing"

export interface RuntimeComparison {
  state: RuntimeState
  reasons: string[]
}

export interface RuntimeStatus extends RuntimeComparison {
  manifest: RuntimeManifest | null
  project: ProjectState
}

export interface RuntimeSyncOptions {
  repoPath: string
  runtimePath: string
  /** Contents for the runtime copy of `opencode.jsonc`. */
  opencodeConfig: string
  forceDependencies?: boolean
}

export interface RuntimeSyncResult {
  manifest: RuntimeManifest
  dependenciesCopied: boolean
}

export interface RuntimeConfigResult {
  content: string
  injected: boolean
}

export interface ProtectedPath {
  path: string
  label: string
  reason: string
}

function pathApi(platform: NodeJS.Platform): typeof path.posix | typeof path.win32 {
  return platform === "win32" ? path.win32 : path.posix
}

function normaliseForCompare(value: string, platform: NodeJS.Platform): string {
  const p = pathApi(platform)
  const resolved = p.resolve(value).replace(/[\\/]+$/, "")
  return platform === "darwin" || platform === "win32" ? resolved.toLowerCase() : resolved
}

/** True when `target` is `root` or lives inside it. */
export function isInsidePath(
  target: string,
  root: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const separator = platform === "win32" ? "\\" : "/"
  const t = normaliseForCompare(target, platform)
  const r = normaliseForCompare(root, platform)
  return t === r || t.startsWith(`${r}${separator}`)
}

/** Platform default for the runtime copy. `JOBSEARCH_RUNTIME` overrides it. */
export function resolveRuntimeDir(options: RuntimeOptions = {}): string {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const home = options.home ?? os.homedir()
  const p = pathApi(platform)
  const override = env[RUNTIME_ENV]?.trim()
  if (override !== undefined && override !== "") return p.resolve(override)
  if (platform === "darwin") {
    return p.join(home, "Library", "Application Support", "automate-job-search", "runtime")
  }
  if (platform === "win32") {
    const local = env["LOCALAPPDATA"]?.trim() || p.join(home, "AppData", "Local")
    return p.join(local, "automate-job-search", "runtime")
  }
  const dataHome = env["XDG_DATA_HOME"]?.trim() || p.join(home, ".local", "share")
  return p.join(dataHome, "automate-job-search", "runtime")
}

/**
 * Folders the OS guards from scheduler-launched processes. Returns null on
 * Linux and on any path outside the guarded folders.
 */
export function protectedPath(
  target: string,
  options: RuntimeOptions = {},
): ProtectedPath | null {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const home = options.home ?? os.homedir()
  const p = pathApi(platform)
  const roots: ProtectedPath[] = []

  if (platform === "darwin") {
    roots.push(
      {
        path: p.join(home, "Desktop"),
        label: "~/Desktop",
        reason: "macOS blocks it for scheduler-launched processes",
      },
      {
        path: p.join(home, "Documents"),
        label: "~/Documents",
        reason: "macOS blocks it for scheduler-launched processes",
      },
      {
        path: p.join(home, "Downloads"),
        label: "~/Downloads",
        reason: "macOS blocks it for scheduler-launched processes",
      },
      {
        path: p.join(home, "Library", "Mobile Documents"),
        label: "iCloud Drive",
        reason: "macOS blocks it for scheduler-launched processes",
      },
      {
        path: p.join(home, "Library", "CloudStorage"),
        label: "a cloud-storage folder",
        reason: "macOS blocks it for scheduler-launched processes",
      },
      {
        path: "/Volumes",
        label: "an external volume",
        reason: "macOS blocks removable volumes for scheduler-launched processes",
      },
    )
  } else if (platform === "win32") {
    for (const name of ["Desktop", "Documents", "Downloads"]) {
      roots.push({
        path: p.join(home, name),
        label: `%USERPROFILE%\\${name}`,
        reason: "Windows Controlled Folder Access may block scheduler-launched processes",
      })
    }
    for (const key of ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"]) {
      const value = env[key]?.trim()
      if (value !== undefined && value !== "") {
        roots.push({
          path: value,
          label: `%${key}%`,
          reason: "Windows Controlled Folder Access may block scheduler-launched processes",
        })
      }
    }
  }

  for (const root of roots) {
    if (isInsidePath(target, root.path, platform)) return root
  }
  if (platform === "win32" && /[\\/]onedrive[\\/]/i.test(p.resolve(target))) {
    return {
      path: target,
      label: "a OneDrive folder",
      reason: "Windows Controlled Folder Access may block scheduler-launched processes",
    }
  }
  return null
}

/** One-line description for status output; null when the path is safe. */
export function protectedPathReason(
  target: string,
  options: RuntimeOptions = {},
): string | null {
  const match = protectedPath(target, options)
  return match === null ? null : `${match.label} — ${match.reason}`
}

/** Browser profile used by scheduled runs, next to the runtime copy. */
export function runtimeBrowserProfileDir(runtimePath: string): string {
  return path.join(path.dirname(path.resolve(runtimePath)), "browser-profile")
}

const BROWSER_PROFILE_LOCK_FILES = new Set([
  "SingletonLock",
  "SingletonSocket",
  "SingletonCookie",
  "lockfile",
  "DevToolsActivePort",
])

export type BrowserProfileSeed = "copied" | "kept" | "missing"

/**
 * Give the dedicated scheduled profile the interactive profile's LinkedIn
 * login. Chrome lock files are skipped so a running browser does not block
 * the copy.
 */
export async function seedBrowserProfile(
  source: string,
  target: string,
): Promise<BrowserProfileSeed> {
  const targetExists = await fs
    .stat(target)
    .then((stat) => stat.isDirectory(), () => false)
  if (targetExists) return "kept"
  const sourceExists = await fs
    .stat(source)
    .then((stat) => stat.isDirectory(), () => false)
  if (!sourceExists) return "missing"

  await fs.mkdir(path.dirname(target), { recursive: true })
  try {
    await fs.cp(source, target, {
      recursive: true,
      filter: (entry) => !BROWSER_PROFILE_LOCK_FILES.has(path.basename(entry)),
    })
    return "copied"
  } catch (error) {
    await fs.rm(target, { recursive: true, force: true })
    throw error
  }
}

/** Locations used by Chrome on each platform. */
export function knownChromePaths(options: RuntimeOptions = {}): string[] {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const home = options.home ?? os.homedir()
  const p = pathApi(platform)
  if (platform === "darwin") {
    return ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  }
  if (platform === "win32") {
    const programFiles = env["PROGRAMFILES"] ?? "C:\\Program Files"
    const programFilesX86 = env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)"
    const local = env["LOCALAPPDATA"] ?? p.join(home, "AppData", "Local")
    return [
      p.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      p.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      p.join(local, "Google", "Chrome", "Application", "chrome.exe"),
    ]
  }
  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/opt/google/chrome/chrome",
  ]
}

/** First installed Chrome binary, or null. */
export function findChromePath(options: RuntimeOptions = {}): string | null {
  const platform = options.platform ?? process.platform
  for (const candidate of knownChromePaths(options)) {
    try {
      if (!statSync(candidate).isFile()) continue
      if (platform !== "win32") accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      // try next candidate
    }
  }
  return null
}

/**
 * Drop PATH entries the OS may block from a scheduler-launched process.
 * Keeps the install-time PATH otherwise intact so user-installed tools work.
 */
export function safePathEnv(
  pathEnv: string,
  options: RuntimeOptions = {},
): string {
  const platform = options.platform ?? process.platform
  const delimiter = platform === "win32" ? ";" : ":"
  return pathEnv
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "" && protectedPath(entry, { ...options, platform }) === null)
    .join(delimiter)
}

/**
 * Playwright MCP's persistent Chrome profile for a workspace. Scheduled runs
 * share the project's profile so the LinkedIn login carries over.
 */
export function playwrightProfileDir(
  workspace: string,
  options: RuntimeOptions = {},
): string {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const home = options.home ?? os.homedir()
  const p = pathApi(platform)
  const cache =
    platform === "darwin"
      ? p.join(home, "Library", "Caches")
      : platform === "win32"
        ? env["LOCALAPPDATA"]?.trim() || p.join(home, "AppData", "Local")
        : env["XDG_CACHE_HOME"]?.trim() || p.join(home, ".cache")
  const hash = createHash("sha256").update(workspace).digest("hex").slice(0, 7)
  return p.join(cache, "ms-playwright-mcp", `mcp-chrome-${hash}`)
}

/**
 * Add `--headless` and `--user-data-dir` to the Playwright MCP command in a
 * copy of the project config. Scheduled runs use this copy, so their browser
 * never opens a visible window; interactive sessions keep the project config
 * headful. Returns the source unchanged when the marker is absent.
 */
export function buildRuntimeOpencodeConfig(
  source: string,
  userDataDir: string,
): RuntimeConfigResult {
  const marker = '"--allow-unrestricted-file-access"'
  if (!source.includes(marker)) return { content: source, injected: false }
  const hasHeadless = source.includes('"--headless"')
  const hasProfile = source.includes('"--user-data-dir"')
  if (hasHeadless && hasProfile) return { content: source, injected: true }
  const index = source.indexOf(marker)
  const lineStart = source.lastIndexOf("\n", index) + 1
  const indent = source.slice(lineStart, index).match(/^[ \t]*/)?.[0] ?? ""
  const additions: string[] = []
  if (!hasHeadless) additions.push('"--headless"')
  if (!hasProfile) additions.push('"--user-data-dir"', JSON.stringify(userDataDir))
  const insert = additions.map((value) => `,\n${indent}${value}`).join("")
  const end = index + marker.length
  return { content: source.slice(0, end) + insert + source.slice(end), injected: true }
}

/** Project version, commit, and dirty flag used to detect a stale runtime. */
export async function projectState(repoPath: string): Promise<ProjectState> {
  const version = await fs
    .readFile(path.join(repoPath, "package.json"), "utf8")
    .then((source) => (JSON.parse(source) as { version?: unknown }).version)
    .then((value) => (typeof value === "string" ? value : "0.0.0"))
    .catch(() => "0.0.0")
  const git = (args: string[]): string | null => {
    const result = spawnSync("git", ["-C", repoPath, ...args], { encoding: "utf8" })
    return result.status === 0 ? result.stdout.trim() : null
  }
  const commit = git(["rev-parse", "--short", "HEAD"])
  const dirtyOutput = git(["status", "--porcelain"])
  return { version, commit, dirty: dirtyOutput !== null && dirtyOutput !== "" }
}

export function parseRuntimeManifest(source: string): RuntimeManifest | null {
  try {
    const parsed = JSON.parse(source) as Record<string, unknown>
    if (
      typeof parsed["schema"] !== "number" ||
      typeof parsed["version"] !== "string" ||
      typeof parsed["source"] !== "string" ||
      typeof parsed["syncedAt"] !== "string" ||
      typeof parsed["lockHash"] !== "string" ||
      typeof parsed["sourceDirty"] !== "boolean"
    ) {
      return null
    }
    const commit = parsed["sourceCommit"]
    return {
      schema: parsed["schema"],
      version: parsed["version"],
      source: parsed["source"],
      sourceCommit: typeof commit === "string" ? commit : null,
      sourceDirty: parsed["sourceDirty"],
      syncedAt: parsed["syncedAt"],
      lockHash: parsed["lockHash"],
    }
  } catch {
    return null
  }
}

export async function readRuntimeManifest(
  runtimePath: string,
): Promise<RuntimeManifest | null> {
  try {
    return parseRuntimeManifest(
      await fs.readFile(path.join(runtimePath, RUNTIME_MANIFEST), "utf8"),
    )
  } catch {
    return null
  }
}

export function compareRuntime(
  manifest: RuntimeManifest | null,
  expected: RuntimeExpectation,
): RuntimeComparison {
  if (manifest === null) {
    return { state: "missing", reasons: ["no runtime manifest"] }
  }
  const reasons: string[] = []
  if (manifest.schema !== RUNTIME_SCHEMA) reasons.push("old runtime format")
  if (!isSamePath(manifest.source, expected.source)) {
    reasons.push(`built from ${manifest.source}`)
  }
  if (manifest.version !== expected.version) {
    reasons.push(`version ${manifest.version} → ${expected.version}`)
  }
  if (manifest.sourceCommit !== expected.sourceCommit) {
    reasons.push(
      `commit ${manifest.sourceCommit ?? "unknown"} → ${expected.sourceCommit ?? "unknown"}`,
    )
  }
  if (manifest.sourceDirty !== expected.sourceDirty) reasons.push("project changes")
  return { state: reasons.length === 0 ? "current" : "stale", reasons }
}

function isSamePath(a: string, b: string): boolean {
  return normaliseForCompare(a, process.platform) === normaliseForCompare(b, process.platform)
}

export async function runtimeStatus(
  repoPath: string,
  runtimePath: string,
): Promise<RuntimeStatus> {
  const project = await projectState(repoPath)
  const manifest = await readRuntimeManifest(runtimePath)
  const comparison = compareRuntime(manifest, {
    source: repoPath,
    version: project.version,
    sourceCommit: project.commit,
    sourceDirty: project.dirty,
  })
  return { ...comparison, manifest, project }
}

async function copyTree(from: string, to: string): Promise<void> {
  await fs.rm(to, { recursive: true, force: true })
  await fs.cp(from, to, {
    recursive: true,
    filter: (source) => path.basename(source) !== ".DS_Store",
  })
}

async function hashFile(file: string): Promise<string> {
  const source = await fs.readFile(file).catch(() => Buffer.alloc(0))
  return createHash("sha256").update(source).digest("hex")
}

/**
 * Copy code, configuration, and dependencies into the runtime. Code
 * directories are replaced so deleted skills disappear; `node_modules` is
 * copied only when it is missing or the lockfile changed.
 */
export async function syncRuntime(options: RuntimeSyncOptions): Promise<RuntimeSyncResult> {
  const repoPath = path.resolve(options.repoPath)
  const runtimePath = path.resolve(options.runtimePath)
  await fs.mkdir(runtimePath, { recursive: true })
  const previous = await readRuntimeManifest(runtimePath)
  const lockHash = await hashFile(path.join(repoPath, "package-lock.json"))
  const project = await projectState(repoPath)

  for (const entry of RUNTIME_DIRS) {
    await copyTree(path.join(repoPath, entry), path.join(runtimePath, entry))
  }
  for (const file of RUNTIME_FILES) {
    const source = path.join(repoPath, file)
    const stat = await fs.stat(source).catch(() => null)
    if (stat === null) continue
    await fs.copyFile(source, path.join(runtimePath, file))
  }
  await fs.writeFile(path.join(runtimePath, "opencode.jsonc"), options.opencodeConfig)

  const dependenciesPath = path.join(runtimePath, RUNTIME_DEPENDENCIES)
  const dependenciesExist = await fs
    .stat(dependenciesPath)
    .then((stat) => stat.isDirectory(), () => false)
  let dependenciesCopied = false
  if (
    !dependenciesExist ||
    previous?.lockHash !== lockHash ||
    options.forceDependencies === true
  ) {
    await copyTree(path.join(repoPath, RUNTIME_DEPENDENCIES), dependenciesPath)
    dependenciesCopied = true
  }

  await fs.mkdir(path.join(runtimePath, "bin"), { recursive: true })
  await fs.mkdir(path.join(runtimePath, "logs"), { recursive: true })

  const manifest: RuntimeManifest = {
    schema: RUNTIME_SCHEMA,
    version: project.version,
    source: repoPath,
    sourceCommit: project.commit,
    sourceDirty: project.dirty,
    syncedAt: new Date().toISOString(),
    lockHash,
  }
  await fs.writeFile(
    path.join(runtimePath, RUNTIME_MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  return { manifest, dependenciesCopied }
}
