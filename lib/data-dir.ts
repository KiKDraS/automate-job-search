/**
 * Personal data directory resolution — cross-platform.
 *
 * Order:
 *   1. JOBSEARCH_HOME environment variable (advanced setups)
 *   2. The user config file `~/.config/opencode/jobsearch.json`
 *      ({ "dataDir": "<absolute path>" }), written by the setup flow via the
 *      `jobsearch_set_data_dir` tool
 *   3. ~/.jobsearch (default)
 *
 * All code paths must go through this module instead of concatenating home
 * directories by hand. The data-dir plugin keeps the same config path and
 * format in sync (`.opencode/plugins/data-dir.ts`).
 */
import { promises as fs, readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

export const DATA_DIR_ENV = "JOBSEARCH_HOME"
export const DEFAULT_DATA_DIR_NAME = ".jobsearch"

export type DataDirSource = "env" | "config" | "default"

export interface ResolvedDataDir {
  dir: string
  source: DataDirSource
}

/** Fixed location of the user-level config file (never inside the repo). */
export function configFilePath(): string {
  const configHome = process.env["XDG_CONFIG_HOME"]?.trim() || path.join(os.homedir(), ".config")
  return path.join(configHome, "opencode", "jobsearch.json")
}

/** Parse the config file contents; null when missing or invalid. */
export function parseDataDirConfig(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { dataDir?: unknown }
    if (typeof parsed.dataDir === "string" && parsed.dataDir.trim() !== "") {
      return parsed.dataDir.trim()
    }
  } catch {
    // malformed config: fall through
  }
  return null
}

/** Resolve the data directory and where the choice came from. */
export function resolveDataDirWithSource(): ResolvedDataDir {
  const override = process.env[DATA_DIR_ENV]?.trim()
  if (override) {
    return { dir: path.resolve(override), source: "env" }
  }

  try {
    const fromConfig = parseDataDirConfig(readFileSync(configFilePath(), "utf8"))
    if (fromConfig !== null) {
      return { dir: path.resolve(fromConfig), source: "config" }
    }
  } catch {
    // no config file: fall through to the default
  }

  return { dir: path.join(os.homedir(), DEFAULT_DATA_DIR_NAME), source: "default" }
}

/** Resolve the data directory without touching the filesystem. */
export function resolveDataDir(): string {
  return resolveDataDirWithSource().dir
}

/** Resolve the data directory and create it (recursively) if missing. */
export async function ensureDataDir(): Promise<string> {
  const dir = resolveDataDir()
  await fs.mkdir(dir, { recursive: true })
  return dir
}

/** Join path segments onto the resolved data directory. */
export function dataPath(...segments: string[]): string {
  return path.join(resolveDataDir(), ...segments)
}
