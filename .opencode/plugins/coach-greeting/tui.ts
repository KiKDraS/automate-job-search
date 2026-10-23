import { Plugin } from "@opencode/plugin/tui"

/**
 * coach-greeting (TUI half) — land the user in a greeted Coach session.
 *
 * On TUI start: find a reusable welcome session (top-level, titled
 * "Welcome", no user messages) or create a fresh Coach session; then
 * navigate to it. The server half (`index.ts`) nudges new sessions, so the
 * greeting is on screen by the time the user looks.
 *
 * Bookmark-free by design: nothing is persisted between launches. The
 * reuse decision comes from what the server reports right now, so a
 * deleted, renamed or used welcome session can never wedge the greeting —
 * the next launch finds nothing and creates a fresh one.
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
 *   favor of a client-side `!parentID` check (one less param to get wrong).
 * - On a fresh launch `router.current()` reports `{ type: "home" }`; with a
 *   session open it reports `{ type: "session", sessionID }`. The resume
 *   guard below relies on that distinction.
 * - Plugin console output is not captured by OpenCode's log file. When
 *   debugging this plugin, write temporary lines to a file instead.
 */

const WELCOME_TITLE = "Welcome"
const LIST_LIMIT = 10

let welcomedThisProcess = false

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

export default Plugin.define({
  id: "coach-greeting.tui",
  async setup(context) {
    try {
      if (welcomedThisProcess) return
      welcomedThisProcess = true

      const location = context.location ?? context.data.location.default()
      if (!location) return
      const directory = typeof location.directory === "string" ? location.directory : ""

      // Never yank the user out of a session they are resuming.
      const current = context.ui.router.current() as RouterLike | undefined
      if (current && typeof current.sessionID === "string" && current.sessionID !== "") return

      // A welcome session is reusable while it exists, is still ours
      // (top-level "Welcome", coach), and the user has not sent anything in it.
      const isReusable = async (id: string): Promise<boolean> => {
        try {
          await context.data.session.message.sync(id)
        } catch {
          return false
        }
        const messages = context.data.session.message.list(id) as MessageLike[] | undefined
        return (
          Array.isArray(messages) &&
          messages.length > 0 &&
          !messages.some((message) => message.type === "user")
        )
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
        for (const candidate of candidates) {
          if (await isReusable(candidate.id as string)) {
            sessionID = candidate.id as string
            break
          }
        }
      } catch {
        // listing failed (offline?): fall through and try to create fresh
      }

      if (sessionID === "") {
        const created = (await context.client.session.create({
          agent: "coach",
          title: WELCOME_TITLE,
          location,
        })) as { id?: string; data?: { id?: string } } | undefined
        const newID = created?.id ?? created?.data?.id
        if (typeof newID !== "string" || newID === "") return
        sessionID = newID
        // Best effort: get the session into client state before navigating,
        // so the TUI's own session-open check cannot race the created event.
        try {
          await context.data.session.sync(sessionID)
        } catch {
          // the navigate below still works in practice
        }
      }

      context.ui.router.navigate({ type: "session", sessionID })
    } catch (error) {
      console.error("[coach-greeting.tui]", error)
    }
  },
})
