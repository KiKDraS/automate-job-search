#!/usr/bin/env node
/**
 * ats — classify an application URL.
 *
 * Usage:
 *   npx tsx scripts/ats.ts detect --url "<url>"
 *
 * Prints one of: linkedin | greenhouse | lever | external | unknown.
 */
import { detectAts } from "../lib/ats.ts"
import { fail, flagValue } from "./args.ts"

const SCRIPT = "ats"
const [command, ...args] = process.argv.slice(2)

if (command !== "detect") {
  fail(SCRIPT, "usage: detect --url <url>")
}

const url = flagValue(SCRIPT, args, "--url")
if (url === undefined) {
  fail(SCRIPT, "usage: detect --url <url>")
}

console.log(detectAts(url))
