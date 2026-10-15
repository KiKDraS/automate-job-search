import { Plugin } from "@opencode/plugin/tui"

/**
 * coach-greeting (TUI half) — land the user in a greeted Coach session.
 *
 * On TUI start: reuse the stored welcome session when it exists and the
 * user has not sent anything in it; otherwise create a fresh Coach session.
 * Then navigate to it — the server half (`index.ts`) nudges new sessions,
 * so the greeting is on screen by the time the user looks.
 *
 * Runs once per TUI process. Failures are caught and logged; the TUI must
 * never break because of this plugin.
 */

const WELCOME_TITLE = "Welcome"
const WELCOME_KEY = "welcome"

let welcomedThisProcess = false

interface MessageLike {
  type?: string
}

interface RouterLike {
  sessionID?: string
  type?: string
}

function readAccessor<T>(value: unknown): T | undefined {
  if (typeof value === "function") {
    try {
      return (value as () => T)()
    } catch {
      return undefined
    }
  }
  return value as T | undefined
}

export default Plugin.define({
  id: "coach-greeting.tui",
  async setup(context) {
    try {
      if (welcomedThisProcess) return
      welcomedThisProcess = true

      const location = context.location ?? context.data.location.default()
      if (!location) return

      // Never yank the user out of a session they are resuming.
      const current = context.ui.router.current() as RouterLike | undefined
      if (current && typeof current.sessionID === "string" && current.sessionID !== "") return

      const [welcomeStore, setWelcomeStore] = context.storage.store(WELCOME_KEY, {
        initial: { sessionID: "" },
      })
      let sessionID = readAccessor<{ sessionID?: string }>(welcomeStore)?.sessionID ?? ""

      if (sessionID !== "") {
        try {
          await context.data.session.message.sync(sessionID)
        } catch {
          // list below decides what to do with an unknown session
        }
        const messages = context.data.session.message.list(sessionID) as MessageLike[] | undefined
        if (messages === undefined) {
          sessionID = "" // gone or unknown: create a fresh welcome session
        } else if (messages.some((message) => message.type === "user")) {
          sessionID = "" // the user used it; start fresh next launch
        }
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
        await setWelcomeStore((draft: { sessionID: string }) => {
          draft.sessionID = sessionID
        })
      }

      context.ui.router.navigate({ type: "session", sessionID })
    } catch (error) {
      console.error("[coach-greeting.tui]", error)
    }
  },
})
