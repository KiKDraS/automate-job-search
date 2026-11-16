/**
 * Resolve the `opencode` CLI across install methods and operating systems.
 *
 * Scheduled runs start from a minimal environment (launchd, systemd, Task
 * Scheduler), so the absolute path is pinned in the wrapper. We look in PATH
 * first, then in the known locations used by Homebrew, npm, pnpm, Bun, the
 * curl installer, and the desktop app.
 */
import { accessSync, constants, statSync } from "node:fs"
import os from "node:os"
import path from "node:path"

export interface ResolveOptions {
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  home?: string
  override?: string
}

function pathApi(platform: NodeJS.Platform): typeof path.posix | typeof path.win32 {
  return platform === "win32" ? path.win32 : path.posix
}

function isExecutable(file: string, platform: NodeJS.Platform): boolean {
  try {
    if (!statSync(file).isFile()) return false
    if (platform !== "win32") accessSync(file, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function windowsExtensions(env: NodeJS.ProcessEnv): string[] {
  const raw = env["PATHEXT"] ?? ".COM;.EXE;.BAT;.CMD"
  return raw
    .split(";")
    .map((ext) => ext.trim().toLowerCase())
    .filter((ext) => ext !== "")
}

/** Scan PATH without relying on `which`/`where`. */
export function findOpencodeOnPath(options: ResolveOptions = {}): string | null {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const p = pathApi(platform)
  const delimiter = platform === "win32" ? ";" : ":"
  const dirs = (env["PATH"] ?? env["Path"] ?? "").split(delimiter).filter((dir) => dir !== "")
  const names =
    platform === "win32"
      ? ["opencode", ...windowsExtensions(env).map((ext) => `opencode${ext}`)]
      : ["opencode"]
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = p.join(dir, name)
      if (isExecutable(candidate, platform)) return candidate
    }
  }
  return null
}

/** Locations used by the common installers. */
export function knownOpencodePaths(options: ResolveOptions = {}): string[] {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const home = options.home ?? os.homedir()
  const p = pathApi(platform)
  if (platform === "win32") {
    const local = env["LOCALAPPDATA"] ?? p.join(home, "AppData", "Local")
    const appData = env["APPDATA"] ?? p.join(home, "AppData", "Roaming")
    const programFiles = env["ProgramFiles"] ?? "C:\\Program Files"
    return [
      p.join(local, "opencode", "opencode.exe"),
      p.join(local, "opencode", "opencode.cmd"),
      p.join(local, "Programs", "opencode", "opencode.exe"),
      p.join(home, ".opencode", "bin", "opencode.exe"),
      p.join(home, ".opencode", "bin", "opencode.cmd"),
      p.join(appData, "npm", "opencode.cmd"),
      p.join(local, "pnpm", "opencode.cmd"),
      p.join(home, ".bun", "bin", "opencode.exe"),
      p.join(programFiles, "nodejs", "opencode.cmd"),
    ]
  }
  return [
    p.join(home, ".opencode", "bin", "opencode"),
    p.join(home, ".local", "bin", "opencode"),
    p.join(home, ".bun", "bin", "opencode"),
    p.join(home, ".npm-global", "bin", "opencode"),
    p.join(home, ".local", "share", "pnpm", "opencode"),
    p.join(home, "Library", "pnpm", "opencode"),
    "/opt/homebrew/bin/opencode",
    "/usr/local/bin/opencode",
    "/usr/bin/opencode",
    "/home/linuxbrew/.linuxbrew/bin/opencode",
  ]
}

/**
 * Resolve the CLI: explicit override, `JOBSEARCH_OPENCODE_BIN`, PATH, known
 * install locations. Returns null when nothing executable is found.
 */
export function resolveOpencodePath(options: ResolveOptions = {}): string | null {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const override = options.override ?? env["JOBSEARCH_OPENCODE_BIN"]
  if (override !== undefined && override.trim() !== "" && isExecutable(override, platform)) {
    return override
  }
  const onPath = findOpencodeOnPath({ ...options, platform, env })
  if (onPath !== null) return onPath
  for (const candidate of knownOpencodePaths({ ...options, platform, env })) {
    if (isExecutable(candidate, platform)) return candidate
  }
  return null
}
