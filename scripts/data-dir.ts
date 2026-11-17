#!/usr/bin/env node
/**
 * data-dir — print, check, or migrate the personal data directory.
 *
 * Usage:
 *   npx tsx scripts/data-dir.ts
 *   npx tsx scripts/data-dir.ts --path <path>
 *   npx tsx scripts/data-dir.ts migrate --to <path> [--force]
 *
 * `env` and `config` mean the user chose the location; `default` means
 * nothing is recorded yet — first contact asks, never assumes.
 */
import os from "node:os"
import path from "node:path"
import {
  migrateDataDirectory,
  resolveDataDirWithSource,
  writeDataDirConfig,
} from "../lib/data-dir.ts"
import { isInsidePath, protectedPathReason } from "../lib/runtime.ts"
import { fail } from "./args.ts"

const SCRIPT = "data-dir"

function expandHome(value: string): string {
  if (value === "~") return os.homedir()
  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(os.homedir(), value.slice(2))
  }
  return value
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function printSafety(dir: string): void {
  const reason = protectedPathReason(dir)
  console.log(`safety: ${reason === null ? "safe" : `protected — ${reason}`}`)
}

function flagValue(args: string[], flag: string): string {
  const index = args.indexOf(flag)
  const value = index === -1 ? undefined : args[index + 1]
  if (value === undefined || value.startsWith("--")) {
    return fail(SCRIPT, `missing value for ${flag}`)
  }
  return value
}

async function main(): Promise<void> {
  const [command = "", ...args] = process.argv.slice(2)

  if (command === "migrate") {
    const { dir: source, source: sourceKind } = resolveDataDirWithSource()
    const target = path.resolve(expandHome(flagValue(args, "--to")))
    if (isInsidePath(target, process.cwd())) {
      fail(SCRIPT, "the data directory must be outside this repository")
    }
    const result = await migrateDataDirectory(source, target, {
      force: args.includes("--force"),
    })
    const config = await writeDataDirConfig(target)
    console.log(`Copied ${result.files} files (${formatBytes(result.bytes)}) from ${source} to ${target}.`)
    console.log(`Config updated: ${config}`)
    console.log(`Source (${sourceKind}) kept in place: ${source}`)
    console.log(
      "Next: call jobsearch_set_data_dir with the new path to grant this session access, then run /job/schedule --repair.",
    )
    return
  }

  if (command === "--path") {
    const dir = path.resolve(expandHome(flagValue([command, ...args], "--path")))
    console.log(dir)
    printSafety(dir)
    return
  }
  if (command !== "") fail(SCRIPT, `unknown command ${command} (usage: [--path <path>] | migrate --to <path>)`)

  const { dir, source } = resolveDataDirWithSource()
  console.log(dir)
  console.log(`source: ${source}`)
  printSafety(dir)
}

await main()
