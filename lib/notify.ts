/**
 * Native desktop notifications with a text fallback.
 *
 * The runner tries the platform command; if it fails, it writes
 * `<data dir>/state/last-notification.txt` instead.
 */
import { buildNotificationScript } from "./scheduler.ts"

export interface NotificationCommand {
  command: string
  args: string[]
}

export function buildNotificationCommand(
  platform: NodeJS.Platform,
  title: string,
  body: string,
): NotificationCommand {
  if (platform === "darwin") {
    return {
      command: "osascript",
      args: ["-e", `display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)}`],
    }
  }
  if (platform === "win32") {
    return {
      command: "powershell",
      args: ["-NoProfile", "-Command", buildNotificationScript(title, body)],
    }
  }
  return { command: "notify-send", args: [title, body] }
}

export function formatNotificationFallback(title: string, body: string): string {
  return `${new Date().toISOString()} — ${title}\n${body}\n`
}
