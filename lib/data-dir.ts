/**
 * Personal data directory resolution — cross-platform.
 *
 * Order:
 *   1. JOBSEARCH_HOME (absolute or relative path; `~` is not expanded, pass a
 *      real path)
 *   2. ~/.jobsearch, via os.homedir() — works on macOS, Linux, and Windows
 *      (%USERPROFILE%\.jobsearch)
 *
 * All code paths must go through this module instead of concatenating home
 * directories by hand.
 */
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"

export const DATA_DIR_ENV = "JOBSEARCH_HOME"
export const DEFAULT_DATA_DIR_NAME = ".jobsearch"

/** Resolve the data directory without touching the filesystem. */
export function resolveDataDir(): string {
  const override = process.env[DATA_DIR_ENV]?.trim()
  if (override) {
    return path.resolve(override)
  }
  return path.join(os.homedir(), DEFAULT_DATA_DIR_NAME)
}

/** Resolve the data directory and create it (recursively) if missing. */
export async function ensureDataDir(): Promise<string> {
  const dir = resolveDataDir()
  await fs.mkdir(dir, { recursive: true })
  return dir
}
