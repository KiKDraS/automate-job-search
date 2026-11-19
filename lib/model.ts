/**
 * Resolve the default model configured for OpenCode.
 *
 * `opencode run` without `--model` uses the root `model` from the user's
 * OpenCode config. The scheduled runner omits `--model` when `automation.md`
 * has no explicit model, so it inherits this value.
 */
import { readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

export interface ModelOptions {
  env?: NodeJS.ProcessEnv
  home?: string
}

function stripJsonComments(source: string): string {
  let out = ""
  let inString = false
  let escaped = false
  let inLineComment = false
  let inBlockComment = false
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? ""
    const next = source[index + 1] ?? ""
    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false
        out += char
      }
      continue
    }
    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false
        index += 1
      }
      continue
    }
    if (inString) {
      out += char
      if (escaped) {
        escaped = false
        continue
      }
      if (char === "\\") {
        escaped = true
        continue
      }
      if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      out += char
      continue
    }
    if (char === "/" && next === "/") {
      inLineComment = true
      index += 1
      continue
    }
    if (char === "/" && next === "*") {
      inBlockComment = true
      index += 1
      continue
    }
    out += char
  }
  return out
}

function parseJsonc(source: string): unknown {
  const withoutComments = stripJsonComments(source)
  const withoutTrailingCommas = withoutComments.replace(/,\s*([}\]])/g, "$1")
  return JSON.parse(withoutTrailingCommas)
}

/** Read `model` from the OpenCode config (`opencode.jsonc` then `.json`). */
export function resolveOpencodeDefaultModel(options: ModelOptions = {}): string | null {
  const env = options.env ?? process.env
  const home = options.home ?? os.homedir()
  const configHome = env["XDG_CONFIG_HOME"]?.trim() || path.join(home, ".config")
  const candidates = [
    path.join(configHome, "opencode", "opencode.jsonc"),
    path.join(configHome, "opencode", "opencode.json"),
  ]
  for (const file of candidates) {
    let source: string
    try {
      source = readFileSync(file, "utf8")
    } catch {
      continue
    }
    let parsed: unknown
    try {
      parsed = parseJsonc(source)
    } catch {
      continue
    }
    if (typeof parsed !== "object" || parsed === null) continue
    const model = (parsed as { model?: unknown }).model
    if (typeof model === "string" && model.trim() !== "") return model.trim()
    if (typeof model === "object" && model !== null) {
      const providerID = (model as { providerID?: unknown }).providerID
      const modelID = (model as { model?: unknown }).model
      if (typeof providerID === "string" && typeof modelID === "string") {
        return `${providerID}/${modelID}`
      }
    }
  }
  return null
}
