---
name: Schedule
description: "Configure the automated daily search: enable/disable, time, interval, model, feed scan, notifications, standing auto-apply, and runtime cap. Use for /job/schedule or any request to change the automation."
---

# Schedule

Owns `<data dir>/automation.md` and the OS scheduler. Use
`scripts/schedule.ts`; do not edit `automation.md` by hand.

## Defaults

- Daily at **09:00 local**.
- Feed search **on**.
- Notifications **on**.
- Standing auto-apply **on** when enabling.
- No application cap (`0`).
- Runtime cap **60 minutes**.
- Model: **OpenCode default** (empty).

## Commands

    npx tsx scripts/schedule.ts status
    npx tsx scripts/schedule.ts enable  [flags]
    npx tsx scripts/schedule.ts update  [flags]
    npx tsx scripts/schedule.ts disable
    npx tsx scripts/schedule.ts remove
    npx tsx scripts/schedule.ts repair
    npx tsx scripts/schedule.ts run-now

Flags:

- `--time HH:MM`
- `--interval "daily"` or `--interval "every 12h"` (1–24 hours)
- `--model <provider/model>` — empty means OpenCode default; `--default-model` clears it
- `--opencode-bin <path>` — override the CLI path when auto-detection fails
- `--max-applications N` — `0` means no cap
- `--max-runtime N` — 5–240 minutes
- `--notify` / `--no-notify`
- `--feed` / `--no-feed`
- `--apply` / `--no-apply`
- `--dry-run`

## Steps

1. Read the current state with `npx tsx scripts/schedule.ts status`.
2. Map the user's request to flags. Examples:
   - “todos los días a las 8:30” → `--time 08:30 --interval daily`
   - “cada 12 horas” → `--interval "every 12h"`
   - “usá el modelo X” → `--model X`
   - “sin feed” → `--no-feed`
   - “sin auto-apply” → `--no-apply`
3. If the user asks to enable, confirm that this installs a standing approval
   for the search and Medium/High auto-apply. Do not enable before
   `/job/setup` is complete; the script refuses and lists what is missing.
4. Run the script. Show:
   - schedule and next run,
   - model (or OpenCode default),
   - OS scheduler used,
   - config path,
   - how to change it later.
5. If the OS scheduler fails, report the exact error and the manual command
   from the script output. Do not silently fall back to a background process.
6. The installer resolves `opencode` from PATH and the known Homebrew, npm,
   pnpm, Bun, curl, and Windows locations. If it cannot find the CLI, it stops
   with a clear error; ask the user for the path and rerun with
   `--opencode-bin <path>`.

## Rules

- The automation may search, tailor, auto-apply Medium/High, log, and report.
- It never publishes posts, sends messages, creates accounts, solves CAPTCHAs,
  or changes the repository.
- If the user is not ready, leave it disabled; `/job/schedule` can run later.
- Do not store credentials or personal data in the scheduler files.
