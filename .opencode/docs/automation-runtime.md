# Automation Runtime

The scheduled search never executes code from the project path. Before
installing the OS scheduler, `scripts/schedule.ts` copies the code it needs to
a runtime directory the OS lets a background job read.

## Locations

| OS | Runtime |
| --- | --- |
| macOS | `~/Library/Application Support/automate-job-search/runtime` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/automate-job-search/runtime` |
| Windows | `%LOCALAPPDATA%\automate-job-search\runtime` |

`JOBSEARCH_RUNTIME` overrides the location (advanced setups and tests).

The runtime holds `.opencode/`, `lib/`, `scripts/`, `node_modules/`,
`AGENTS.md`, `SPEC.md`, `package.json`, `package-lock.json`, `tsconfig.json`,
and a generated `opencode.jsonc`. `bin/scheduled-search.sh` (or `.cmd`) and
`logs/scheduler.log` are generated there too. No personal data enters the
runtime.

The project can live anywhere — including `~/Documents`, `~/Desktop`, or an
external volume. The scheduler points at the runtime, so the project path is
never read by `launchd`, systemd, cron, or Task Scheduler.

## Data directory safety

The runner writes reports, logs, and state to the data directory. On macOS, a
data directory inside `~/Desktop`, `~/Documents`, `~/Downloads`, iCloud Drive,
`~/Library/CloudStorage`, or `/Volumes` is blocked for scheduler-launched
processes unless `node` and `opencode` have Full Disk Access. On Windows,
Controlled Folder Access can block `Documents`, `Desktop`, `Downloads`, and
OneDrive folders.

`scripts/schedule.ts` refuses to install with a protected data directory
unless `--allow-protected-data-dir` is passed. The supported flow:

1. `npx tsx scripts/data-dir.ts` prints the path, its source, and its safety.
2. If protected, `npx tsx scripts/data-dir.ts migrate --to ~/.jobsearch`
   copies the data, updates `~/.config/opencode/jobsearch.json`, and leaves
   the old directory in place for verification.
3. `jobsearch_set_data_dir` with the new path grants the current session.
4. `/job/schedule --repair` resynchronizes the runtime and reinstalls.

Only pass `--allow-protected-data-dir` after the user grants Full Disk Access
to the `node` and `opencode` binaries. The recommended flow needs no manual
permission.

## Sync and status

- `enable`, `update`, and `repair` synchronize the runtime before installing.
- Code directories are replaced; `node_modules` is copied only when missing or
  when `package-lock.json` changed. `--force-deps` forces the copy.
- `status` reports `Project`, `Runtime` (`current`, `stale`, or `missing`), and
  `Data dir` (`safe` or `protected`).
- `repair` fixes a stale or missing runtime and reinstalls the scheduler.
- The runtime manifest is `<runtime>/.runtime.json`.

## Browser profile

Scheduled runs use a dedicated copy of the project's Playwright MCP Chrome
profile at `<app data>/automate-job-search/browser-profile`. The first install
copies the project profile (without Chrome lock files), so an existing
LinkedIn login carries over and an interactive browser can stay open without
blocking the scheduled run. If the login expires, `/job/schedule --login`
opens Chrome with the scheduled profile; sign in once and close the window.

## Logs

| Path | Contents |
| --- | --- |
| `<runtime>/logs/scheduler.log` | OS-level job output; always writable |
| `<data dir>/logs/search-*.log` | One log per scheduled run |
| `<data dir>/reports/` | Daily reports |
| `<data dir>/state/` | lock, pending search, last run |

Paths and rules for personal data live in `data-directory.md`.
