import { Plugin } from "@opencode/plugin"

/**
 * coach-greeting (server half) — nudge fresh Coach sessions to greet.
 *
 * Reacts to `session.created` events: top-level Coach sessions in this
 * location, still empty, not greeted before. The nudge is a synthetic
 * message; the greeting itself is defined in the Coach agent contract
 * (`First contact` in `.opencode/agents/coach.md`).
 *
 * The TUI half (`tui.ts`) creates a welcome session on launch so this
 * nudge has somewhere to land before the user types anything.
 */
const NUDGE =
  "Session start — greet the user: one warm line, then a short menu (setup, search, artifacts, apply, schedule, help), then ask what they want to do. Greet in the chat language from language.md; if no language is set yet, ask for it first (bilingual EN/ES) and record it. If <data dir>/state/pending-search.json exists with items, add one line: “Quedaron N pendientes del run del <date>. ¿Los reintento?” If <data dir>/state/user-actions.json has pending actions, add one line: “Hay N acciones nuevas del reporte.” Do not start a retry or process actions without an answer."

const GREETED_PREFIX = "coach-greeting/greeted/"

interface SessionCreatedEvent {
  type?: string
  location?: { directory?: string }
  data?: { sessionID?: string; agent?: string }
  durable?: { aggregateID?: string }
}

interface SessionLike {
  agent?: string
  parentID?: string
  location?: { directory?: string }
}

function matchesLocation(
  directory: string | undefined,
  roots: string[],
): boolean {
  if (directory === undefined || directory === "") return true
  return roots.some(
    (root) => directory === root || directory.startsWith(`${root}/`),
  )
}

export default Plugin.define({
  id: "coach-greeting",
  async setup(ctx) {
    const controller = new AbortController()
    const roots = [ctx.location.directory, ctx.location.project?.canonical].filter(
      (root): root is string => typeof root === "string" && root !== "",
    )
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          const parsed: SessionCreatedEvent = typeof event === "string" ? JSON.parse(event) : event
          if (parsed.type !== "session.created") continue
          const sessionID = parsed.data?.sessionID ?? parsed.durable?.aggregateID
          if (typeof sessionID !== "string") continue

          const key = GREETED_PREFIX + sessionID
          if (await ctx.storage.get(key)) continue

          const session = (await ctx.session.get({ sessionID })) as SessionLike
          if (session.parentID) continue

          const agent = parsed.data?.agent ?? session.agent
          if (agent !== undefined && agent !== "coach") continue
          if (
            !matchesLocation(parsed.location?.directory, roots) &&
            !matchesLocation(session.location?.directory, roots)
          ) {
            continue
          }

          const messages = await ctx.session.context({ sessionID })
          if (messages.length > 0) continue

          await ctx.storage.set(key, true)
          await ctx.session.synthetic({ sessionID, text: NUDGE, description: "Session start" })
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[coach-greeting]", error)
        }
      }
    })()
    return () => controller.abort()
  },
})
