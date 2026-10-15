import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { isAbsolute, join, resolve } from "node:path"
import { Plugin } from "@opencode/plugin"

/**
 * data-dir — keep the personal data directory working wherever the user
 * chooses it, with zero manual setup.
 *
 * - On `session.created`: grants the session access (external_directory,
 *   read, edit) to the configured custom data directory. Child sessions
 *   inherit the rules.
 * - Registers one tool, `jobsearch_set_data_dir`, for the setup flow:
 *   validates the path, creates it, writes the user config file, and grants
 *   the current session immediately.
 *
 * Canonical resolution order lives in `lib/data-dir.ts` (env > config file >
 * ~/.jobsearch). Keep the config path and format in sync with it.
 */

const CONFIG_DIR = join(
  process.env["XDG_CONFIG_HOME"]?.trim() || join(homedir(), ".config"),
  "opencode",
)
const CONFIG_FILE = join(CONFIG_DIR, "jobsearch.json")

function configuredDataDir(): string | null {
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as { dataDir?: unknown }
    if (typeof parsed.dataDir === "string" && parsed.dataDir.trim() !== "") {
      return resolve(parsed.dataDir.trim())
    }
  } catch {
    // no config file or unreadable: nothing to grant
  }
  return null
}

function dataDirPermissions(dir: string): Array<{ action: string; resource: string; effect: string }> {
  return [
    { action: "external_directory", resource: `${dir}/*`, effect: "allow" },
    { action: "read", resource: `${dir}/*`, effect: "allow" },
    { action: "edit", resource: `${dir}/*`, effect: "allow" },
  ]
}

export default Plugin.define({
  id: "data-dir",
  async setup(ctx) {
    // Grant access to every new session in this location.
    const controller = new AbortController()
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          const parsed = typeof event === "string" ? JSON.parse(event) : event
          if (parsed?.type !== "session.created") continue
          if (parsed.location?.directory !== ctx.location.directory) continue
          const sessionID = parsed.data?.sessionID ?? parsed.durable?.aggregateID
          if (typeof sessionID !== "string") continue
          const dir = configuredDataDir()
          if (dir === null) continue
          await ctx.session.update({ sessionID, permissions: dataDirPermissions(dir) })
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[data-dir]", error)
        }
      }
    })()

    // One tool for the setup flow: pick a location, done.
    await ctx.tool.transform((editor) => {
      editor.namespace({ name: "jobsearch", description: "Job-search setup helpers" })
      editor.add({
        name: "set_data_dir",
        description:
          "Set the personal data directory. Validates the path, creates it, stores it for scripts and future sessions, and grants the current session access. Use during setup after the user picks a location.",
        input: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Absolute path for the data directory, outside this repository",
            },
          },
          required: ["path"],
          additionalProperties: false,
        },
        options: { namespace: "jobsearch", codemode: true },
        execute: async (input, context) => {
          const raw =
            typeof (input as { path?: unknown }).path === "string"
              ? (input as { path: string }).path.trim()
              : ""
          if (raw === "") return { content: "error: path is required" }
          if (!isAbsolute(raw)) return { content: "error: path must be absolute" }
          const dir = resolve(raw)
          const repo = resolve(ctx.location.directory)
          if (dir === repo || dir.startsWith(`${repo}/`)) {
            return { content: "error: the data directory must be outside this repository" }
          }
          try {
            mkdirSync(dir, { recursive: true })
            mkdirSync(CONFIG_DIR, { recursive: true })
            writeFileSync(CONFIG_FILE, `${JSON.stringify({ dataDir: dir }, null, 2)}\n`)
          } catch (error) {
            return {
              content: `error: cannot use ${dir} (${error instanceof Error ? error.message : String(error)})`,
            }
          }
          const sessionID = (context as { sessionID?: string } | undefined)?.sessionID
          if (typeof sessionID === "string") {
            await ctx.session.update({ sessionID, permissions: dataDirPermissions(dir) })
          }
          return { content: `data directory set to ${dir}` }
        },
      })
    })

    return () => controller.abort()
  },
})
