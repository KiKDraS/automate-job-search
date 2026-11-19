---
name: Schedule
description: "Configure the automated daily search: enable/disable, time, interval, model, feed scan, notifications, standing auto-apply, runtime cap, and runtime repair. Use for /job/schedule or any request to change the automation."
---

# Schedule

Owns `<data dir>/automation.md` and the OS scheduler. Use
`scripts/schedule.ts`; do not edit `automation.md` by hand. The runtime copy
and permission rules are in `.opencode/docs/automation-runtime.md`.

## Defaults

- Daily at **09:00 local**, or one or more times per day.
- Search window **48 hours**.
- Feed search **on**.
- Notifications **on**.
- Standing auto-apply **on** when enabling.
- No application cap (`0`).
- Runtime cap **60 minutes**.
- Model: **OpenCode default** (the model configured in OpenCode; empty in
  `automation.md`).

## Commands

    npx tsx scripts/schedule.ts status
    npx tsx scripts/schedule.ts enable  [flags]
    npx tsx scripts/schedule.ts update  [flags]
    npx tsx scripts/schedule.ts disable
    npx tsx scripts/schedule.ts remove
    npx tsx scripts/schedule.ts repair  [--force-deps]
    npx tsx scripts/schedule.ts run-now
    npx tsx scripts/schedule.ts login

Flags:

- `--times "HH:MM,HH:MM"` — one to four daily times
- `--time HH:MM` — shorthand for a single time
- `--search-window N` — hours to look back per run (1–168)
- `--interval "daily"` or `--interval "every 12h"` (1–24 hours; multiple times require daily)
- `--model <provider/model#variant>` — explicit automation model; empty means the OpenCode default; `--default-model` clears it
- `--opencode-bin <path>` — override the CLI path when auto-detection fails
- `--max-applications N` — `0` means no cap
- `--max-runtime N` — 5–240 minutes
- `--notify` / `--no-notify`
- `--feed` / `--no-feed`
- `--apply` / `--no-apply`
- `--allow-protected-data-dir` — only with Full Disk Access already granted
- `--dry-run`

## Steps

1. Read the current state with `npx tsx scripts/schedule.ts status`. It prints
   `Project`, `Runtime` (`current`, `stale`, or `missing`), and `Data dir`
   (`safe` or `protected`).
2. If `Data dir` says `protected`, do not enable yet. Explain the OS block in
   one line and offer to move the data:

       npx tsx scripts/data-dir.ts migrate --to ~/.jobsearch

   Then call `jobsearch_set_data_dir` with the new path, and continue with the
   same command after `--repair`. Only use `--allow-protected-data-dir` when
   the user explicitly chooses to keep the path and has granted Full Disk
   Access to `node` and `opencode`.
3. Map the request to flags. Examples:
   - “todos los días a las 8:30” → `--time 08:30 --interval daily`
   - “a las 11:30 y 18:30” → `--times "11:30,18:30" --interval daily`
   - “buscá las últimas 24 horas” → `--search-window 24`
   - “cada 12 horas” → `--interval "every 12h"`
   - “usá el modelo X” → `--model X#max` (or the variant you want)
   - “volvé al modelo por defecto” → `--default-model`
   - “sin feed” → `--no-feed`
   - “sin auto-apply” → `--no-apply`
   - “repará el scheduler” → `repair`
4. If the user asks to enable, confirm that this installs a standing approval
   for the search and Medium/High auto-apply. Do not enable before
   `/job/setup` is complete; the script refuses and lists what is missing.
5. Run the script. It synchronizes the runtime copy, writes the wrapper and
   scheduler files, and prints:
   - times and next run,
   - search window,
   - model (explicit, or the resolved OpenCode default),
   - OS scheduler used,
   - runtime path and data-dir safety,
   - config path,
   - how to change it later.
6. If the OS scheduler fails, report the exact error and the manual command
   from the script output. Do not silently fall back to a background process.
7. `repair` resyncs the runtime even when automation is disabled. Use it after
   changing the code, moving the project, or changing the data directory.
8. The scheduled run uses a dedicated browser profile seeded from the project
   profile. If a run reports a LinkedIn login wall, run
   `npx tsx scripts/schedule.ts login`, sign in in the window it opens, and
   close it.
9. The installer resolves `opencode` from PATH and the known Homebrew, npm,
   pnpm, Bun, curl, and Windows locations. If it cannot find the CLI, it stops
   with a clear error; ask the user for the path and rerun with
   `--opencode-bin <path>`.

## Rules

- The automation may search, tailor, auto-apply Medium/High, log, and report.
- The scheduled process runs from the runtime copy, never from the project
  path. The project can stay in `~/Documents` or anywhere else.
- It never publishes posts, sends messages, creates accounts, solves CAPTCHAs,
  or changes the repository.
- If the user is not ready, leave it disabled; `/job/schedule` can run later.
- Do not store credentials or personal data in the scheduler files or the
  runtime.
