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
import { isInsidePath } from "./runtime.ts"

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

/** Record the chosen data directory in the user config file. */
export async function writeDataDirConfig(dir: string): Promise<string> {
  const file = configFilePath()
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, `${JSON.stringify({ dataDir: path.resolve(dir) }, null, 2)}\n`)
  return file
}

export interface MigrateDataDirResult {
  source: string
  target: string
  files: number
  bytes: number
}

async function summarizeDirectory(dir: string): Promise<{ files: number; bytes: number }> {
  let files = 0
  let bytes = 0
  const walk = async (current: string): Promise<void> => {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      if (!entry.isFile()) continue
      const stat = await fs.stat(full).catch(() => null)
      if (stat === null) continue
      files += 1
      bytes += stat.size
    }
  }
  await walk(dir)
  return { files, bytes }
}

/**
 * Copy the whole data directory to a new location. The source is left in
 * place so the user can verify the scheduled run before deleting it. Generated
 * scheduler artifacts tied to the old path are dropped from the copy.
 */
export async function migrateDataDirectory(
  source: string,
  target: string,
  options: { force?: boolean } = {},
): Promise<MigrateDataDirResult> {
  const from = path.resolve(source)
  const to = path.resolve(target)
  if (from === to) throw new Error("source and target are the same directory")
  if (isInsidePath(to, from)) throw new Error("target cannot be inside the source")
  if (isInsidePath(from, to)) throw new Error("source cannot be inside the target")

  const stat = await fs.stat(from).catch(() => null)
  if (stat === null || !stat.isDirectory()) {
    throw new Error(`source directory not found: ${from}`)
  }
  const existing = await fs.readdir(to).catch(() => [] as string[])
  if (existing.length > 0 && options.force !== true) {
    throw new Error(`target is not empty: ${to} (pass --force to merge)`)
  }

  await fs.mkdir(to, { recursive: true })
  await fs.cp(from, to, { recursive: true, force: true })
  await fs.rm(path.join(to, "bin"), { recursive: true, force: true })
  await fs.rm(path.join(to, "state", "search.lock"), { force: true })
  await fs.rm(path.join(to, "logs", "scheduler.log"), { force: true })
  return { source: from, target: to, ...(await summarizeDirectory(to)) }
}
