/**
 * Welcome-session helpers shared by the coach-greeting TUI plugin and tests.
 *
 * A session is reusable only after the greeting exists and before the user
 * has sent anything. An empty session is never navigated to: the TUI waits for
 * the greeting and falls back to home instead of showing a blank screen.
 */

export interface GreetingMessage {
  type?: string
}

export function hasGreeting(messages: readonly GreetingMessage[] | undefined): boolean {
  return Array.isArray(messages) && messages.some((message) => message.type === "assistant")
}

export function hasUserMessage(messages: readonly GreetingMessage[] | undefined): boolean {
  return Array.isArray(messages) && messages.some((message) => message.type === "user")
}

export function isReusableWelcome(
  messages: readonly GreetingMessage[] | undefined,
): boolean {
  return hasGreeting(messages) && !hasUserMessage(messages)
}

/** Poll until an assistant message appears or the timeout expires. */
export async function waitForGreeting(
  read: () => Promise<readonly GreetingMessage[] | undefined>,
  timeoutMs: number,
  intervalMs = 500,
): Promise<boolean> {
  const deadline = Date.now() + Math.max(0, timeoutMs)
  while (Date.now() < deadline) {
    if (hasGreeting(await read())) return true
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)))
  }
  return false
}
