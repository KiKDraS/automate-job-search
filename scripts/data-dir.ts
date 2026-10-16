#!/usr/bin/env node
/**
 * Print the resolved data directory and its source.
 *
 * `env` and `config` mean the user chose the location; `default` means
 * nothing is recorded yet — first contact asks, never assumes.
 */
import { resolveDataDirWithSource } from "../lib/data-dir.ts"

const { dir, source } = resolveDataDirWithSource()
console.log(dir)
console.log(`source: ${source}`)
