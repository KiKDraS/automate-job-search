import { Plugin } from "@opencode/plugin/tui"
import { appendFileSync, mkdirSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { isReusableWelcome, waitForGreeting } from "../../../lib/greeting.ts"

/**
 * coach-greeting (TUI half) — land the user in a greeted Coach session.
 *
 * On TUI start: find a reusable welcome session (top-level, titled
 * "Welcome", already greeted, no user messages) or create a fresh Coach
 * session. Never navigate to an empty session: wait for the greeting and fall
 * back to home + toast instead of showing a blank screen.
 *
 * Bookmark-free by design: nothing is persisted between launches. The reuse
 * decision comes from what the server reports right now, so a deleted,
 * renamed or used welcome session can never wedge the greeting.
 *
 * Runs once per TUI process. Failures are caught and logged; the TUI must
 * never break because of this plugin.
 *
 * Maintainer notes (learned the hard way; keep in mind when editing):
 * - Never persist a session id and trust it later: users delete sessions
 *   from the list, deletions are not logged, and a stale id wedges the
 *   greeting — every launch navigated to a dead session and toasted
 *   "Session not found". Discovery goes through `client.session.list`.
 * - `data.session.message.list(id)` is not an existence check: for a
 *   session that is gone it returns stale/empty state, not "unknown".
 *   Always `message.sync(id)` first (fetch), and treat an empty result as
 *   "not reusable".
 * - `context.client.session.create(...)` resolves to the session object
 *   itself — the id is at the top level (`{ id }`), not `{ data: { id } }`.
 *   Both shapes are accepted below, defensively. `client.session.list`
 *   resolves to the `{ data: [...] }` envelope; both shapes are handled.
 * - `client.session.list` params are flat (`search`, `directory`, `order`,
 *   `limit`); the server-side `parentID: null` filter is avoided here in
 *   favor of a client-side `!parentID` check.
 * - On a fresh launch `router.current()` reports `{ type: "home" }`; with a
 *   session open it reports `{ type: "session", sessionID }`.
 * - Plugin console output is not captured by OpenCode's log file. This file
 *   appends diagnostics to `<data dir>/logs/welcome.log`.
 */

const WELCOME_TITLE = "Welcome"
const LIST_LIMIT = 10
const GREETING_TIMEOUT_MS = 12_000
const STARTED_KEY = "__coachGreetingTuiStarted"

interface MessageLike {
  type?: string
}

interface SessionLike {
  id?: string
  title?: string
  agent?: string
  parentID?: string
  location?: { directory?: string }
  time?: { updated?: number }
}

interface RouterLike {
  sessionID?: string
  type?: string
}

function logWelcome(event: string, data?: Record<string, unknown>): void {
  try {
    const dataDir =
      process.env["JOBSEARCH_HOME"]?.trim() || path.join(os.homedir(), ".jobsearch")
    const dir = path.join(dataDir, "logs")
    mkdirSync(dir, { recursive: true })
    appendFileSync(
      path.join(dir, "welcome.log"),
      `${new Date().toISOString()} ${event}${data === undefined ? "" : ` ${JSON.stringify(data)}`}\n`,
    )
  } catch {
    // diagnostics must never break the TUI
  }
}

export default Plugin.define({
  id: "coach-greeting.tui",
  async setup(context) {
    try {
      const state = globalThis as unknown as Record<string, unknown>
      if (state[STARTED_KEY] === true || state[STARTED_KEY] === "done") return
      state[STARTED_KEY] = "done"

      const location = context.location ?? context.data.location.default()
      if (!location) {
        logWelcome("no-location")
        return
      }
      const directory = typeof location.directory === "string" ? location.directory : ""

      // Never yank the user out of a session they are resuming.
      const current = context.ui.router.current() as RouterLike | undefined
      if (current && typeof current.sessionID === "string" && current.sessionID !== "") {
        logWelcome("resume", { sessionID: current.sessionID })
        return
      }

      const messagesFor = async (id: string): Promise<MessageLike[] | undefined> => {
        try {
          await context.data.session.message.sync(id)
        } catch {
          return undefined
        }
        return context.data.session.message.list(id) as MessageLike[] | undefined
      }

      let sessionID = ""
      try {
        const params: Record<string, unknown> = {
          search: WELCOME_TITLE,
          order: "desc",
          limit: LIST_LIMIT,
        }
        if (directory !== "") params.directory = directory
        const result = (await context.client.session.list(params)) as
          | SessionLike[]
          | { data?: SessionLike[] }
          | undefined
        const candidates = (Array.isArray(result) ? result : result?.data ?? [])
          .filter((session) => typeof session?.id === "string")
          .filter((session) => session.title === WELCOME_TITLE && !session.parentID)
          .filter((session) => session.agent === undefined || session.agent === "coach")
          .filter(
            (session) =>
              !directory ||
              !session.location?.directory ||
              session.location.directory === directory,
          )
          .sort((a, b) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0))
        logWelcome("candidates", { count: candidates.length, directory })
        for (const candidate of candidates) {
          const messages = await messagesFor(candidate.id as string)
          if (isReusableWelcome(messages)) {
            sessionID = candidate.id as string
            break
          }
        }
      } catch (error) {
        logWelcome("list-failed", { error: String(error) })
      }

      let created = false
      if (sessionID === "") {
        const result = (await context.client.session.create({
          agent: "coach",
          title: WELCOME_TITLE,
          location,
        })) as { id?: string; data?: { id?: string } } | undefined
        const newID = result?.id ?? result?.data?.id
        if (typeof newID !== "string" || newID === "") {
          logWelcome("create-empty")
          throw new Error("welcome session create returned no id")
        }
        sessionID = newID
        created = true
        logWelcome("created", { sessionID })
        try {
          await context.data.session.sync(sessionID)
        } catch {
          // navigate still works in practice
        }
      }

      if (created) {
        const greeted = await waitForGreeting(
          () => messagesFor(sessionID),
          GREETING_TIMEOUT_MS,
        )
        if (!greeted) {
          logWelcome("greeting-timeout", { sessionID })
          try {
            context.ui.router.navigate({ type: "home" })
          } catch {
            // already home
          }
          context.ui.toast.show({
            message: "No llegó el saludo de bienvenida. Probá con Nueva sesión.",
            variant: "warning",
            duration: 8000,
          })
          return
        }
      }

      logWelcome("navigate", { sessionID, created })
      context.ui.router.navigate({ type: "session", sessionID })
    } catch (error) {
      logWelcome("error", { error: String(error) })
      console.error("[coach-greeting.tui]", error)
      try {
        context.ui.router.navigate({ type: "home" })
      } catch {
        // home unavailable
      }
      try {
        context.ui.toast.show({
          message: "Welcome unavailable; open a new session",
          variant: "warning",
          duration: 5000,
        })
      } catch {
        // toast unavailable
      }
    }
  },
})
