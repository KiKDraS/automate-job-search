/**
 * Open a local file with the OS default application.
 *
 * The command builder is pure and testable per platform; `openFile` is the
 * only place that spawns a process.
 */
import { spawnSync } from "node:child_process"

export interface OpenCommand {
  command: string
  args: string[]
}

export function buildOpenCommand(
  platform: NodeJS.Platform,
  file: string,
): OpenCommand {
  if (platform === "darwin") return { command: "open", args: [file] }
  if (platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", file] }
  }
  return { command: "xdg-open", args: [file] }
}

/** Best effort: true when the opener started successfully. */
export function openFile(file: string): boolean {
  const { command, args } = buildOpenCommand(process.platform, file)
  const result = spawnSync(command, args, { stdio: "ignore", timeout: 5000 })
  return result.error === undefined && result.status === 0
}
