<div align="center" markdown>

![automate-job-search](https://socialify.git.ci/KiKDraS/automate-job-search/image?description=1&forks=1&issues=1&language=1&name=1&owner=1&pattern=Transparent&pulls=1&stargazers=1&theme=Auto)
[![Stars](https://img.shields.io/github/stars/KiKDraS/automate-job-search)](https://github.com/KiKDraS/automate-job-search/stargazers)
[![Forks](https://img.shields.io/github/forks/KiKDraS/automate-job-search)](https://github.com/KiKDraS/automate-job-search/forks)
[![Issues](https://img.shields.io/github/issues/KiKDraS/automate-job-search)](https://github.com/KiKDraS/automate-job-search/issues)
[![Pull requests](https://img.shields.io/github/issues-pr/KiKDraS/automate-job-search)](https://github.com/KiKDraS/automate-job-search/pulls)

**[Changelog](https://github.com/KiKDraS/automate-job-search/blob/main/CHANGELOG.md) · [Report a bug](https://github.com/KiKDraS/automate-job-search/issues) · [Request a feature](https://github.com/KiKDraS/automate-job-search/issues)**

[![OpenCode V2](https://img.shields.io/badge/OpenCode-V2-blue)](https://opencode.ai)
[![Node](https://img.shields.io/badge/Node-%E2%89%A5%2020-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](https://github.com/KiKDraS/automate-job-search/blob/main/LICENSE)

![Rule](https://cdn.jsdelivr.net/gh/andreasbm/readme/assets/lines/rainbow.png)

</div>

## What it is

An OpenCode-native job-search toolkit for technology roles. A **Coach** agent
plans the work with you, delegates to specialist subagents, and never sends
messages or publishes posts without your approval. Applications for Medium and
High fits run automatically and are logged for review.

Built for technology roles — software, data, DevOps, QA, design engineering.
Today it covers the full application loop: LinkedIn search limited to the last
48 hours, a feed scan for hiring posts, fit scoring, resume review and
tailoring, cover letters, automatic apply for Medium and High fits, and
outreach drafts. The attention layer covers profile audits, post drafts, and
comment drafts; an approved post can be published for you. Engagement
analytics is deferred.

Apply fills LinkedIn Easy Apply, Greenhouse, Lever, and any other readable
application form (Ashby, Workday, SmartRecruiters, Teamtailor, Recruitee,
Breezy, BambooHR, company career pages, custom forms) and records every field,
file, and answer. For every saved job scored Medium or High, it tailors the
resume, submits, and logs the application in `applied.md` and
`applications.md`. Account creation, CAPTCHA, or unknown required answers stop
the flow and are reported.

Every submitted application is in `<data dir>/applications.md`: date, company,
role, fit, method, confirmation, job URL, and folder. The per-job `applied.md`
has the full field-level record. Low fits are skipped. If you send one
manually, `/job/log-application` records it as user-reported.

Ask Coach for a profile audit, a post, or a comment draft. Posts start from
one real moment, not a list of achievements: if you don't have one, Coach
interviews you first. Every draft is audited; a post publishes only after you
approve the exact text. Comments and profile edits stay in your hands.

Before drafting a batch of resumes or letters, Coach checks each posting
against your profile and asks for any missing evidence in one batch. Documents
are built on verified facts, not guesses.

Setup asks for your core stack once and shows your profile for approval;
fit checks compare each posting against that stack, never an assumed one. If
a posting mentions a technology the catalog doesn't know, Coach can add it to
your local catalog; common terms join the shared catalog in releases.

Talk in your language. Coach chats in whatever language you choose at first
contact, and resumes and letters follow each posting's language.

## Quick start

You'll need [OpenCode](https://opencode.ai) V2, Node.js ≥ 20, and Chrome; the
[`gh` CLI](https://cli.github.com) is optional.

```sh
git clone https://github.com/KiKDraS/automate-job-search.git
cd automate-job-search
npm install
npm run doctor
```

Then open OpenCode in the project and start a session — Coach is the default
agent and greets you automatically. First time, run `/job/setup`; it walks you
through your resume, preferences, and work history. The first search opens a
browser window — log into LinkedIn there, once.

## Using Coach

Coach is the only agent you talk to. It plans, delegates, and brings back the
result; you never need to address a subagent directly.

1. **First run.** Start OpenCode in the project. Coach greets you, asks your
   chat language and where to keep personal data, then runs `/job/setup`:
   resume, target roles, preferences, the stack you actually use, application
   answers, and — at the end — whether to enable the daily search. It shows
   the profile for approval before any search uses it.
2. **Search.** `/job/search` looks at LinkedIn postings from the last 48 hours
   and, in the same round, scans the feed for hiring posts. Coach shows the
   plan, waits for your OK, then scores fit, saves High/Medium postings and
   leads, tailors the resume, applies to Medium/High fits, and logs every
   submission. Say “solo empleos” or “only jobs” to skip the feed. Use
   `/job/feed-search` when you want the feed scan alone.
3. **Review.** Open `<data dir>/applications.md` to see what was sent, where,
   and with which fit. Each job folder has an `applied.md` with the exact
   fields and answers.
4. **Artifacts.** `/job/tailor`, `/job/cover-letter`, and `/job/outreach`
   produce drafts. Every draft passes an internal fact and voice audit before
   Coach shows it to you. Messages, comments, and application emails stay
   draft-only.
5. **Presence.** Ask for a profile audit, a post, or a comment. Posts start
   from one real moment; Coach interviews you if you don't have one. A post
   publishes only after you approve the exact text.
6. **Manual work.** `/job/log-application` records an application you sent
   outside the agent. `/job/application-email` drafts an email for a feed lead
   that publishes an address and gives you a `mailto:` link.

Coach asks only for what it cannot know: your language, data folder, resume,
preferences, stack, and missing evidence. It does not invent facts, create
accounts, solve CAPTCHAs, or send messages without your OK.

## Automated daily search

Coach can run the search for you once a day. The onboarding offers it at the
end of `/job/setup`, and you can change it anytime with `/job/schedule`.

| Default | Value |
| --- | --- |
| Frequency | Daily; one or more times |
| Times | 09:00 local |
| Search window | 48 hours |
| Feed search | On |
| Notifications | On |
| Auto-apply | Medium/High with standing approval |
| Applications per run | No cap |
| Runtime cap | 60 minutes |
| Model | OpenCode default (the model configured in OpenCode) |

What the run does, in order:

1. Retries the saved Medium/High backlog without `applied.md`.
2. Runs the job search for the configured window (48 hours by default).
3. Runs the feed/content search.
4. Tailors, audits, and auto-applies every Medium/High fit it can fill.
5. Stops at the runtime cap or the agent step budget.
6. Writes `<data dir>/reports/YYYY-MM-DD.md` and
   `<data dir>/state/pending-search.json`.

The report has a **Needs you** section for the steps only you can do:

- solve a CAPTCHA and submit the already-filled form;
- send an application email from the prepared `mailto:` link;
- log in or create an account;
- answer a required question that is not in `application-data.md`.

If the run stops early, open the report or say **“retry the pending ones”**.
`/job/retry` continues only the pending jobs, not a new search. If you do
nothing, the next daily run picks them up as backlog.

A dropped model connection (`ECONNRESET`, timeout) gets one automatic retry
when the failed attempt submitted no application and at least half the runtime
cap remains. The report and notification say when the retry ran.

### Change the automation

```text
/job/schedule                       # status, next run, OS scheduler
/job/schedule --time 08:30          # daily at 08:30
/job/schedule --times "11:30,18:30" # two runs per day
/job/schedule --search-window 24    # look back 24 hours per run
/job/schedule --interval "every 12h"
/job/schedule --model provider/model#variant
/job/schedule --default-model
/job/schedule --no-feed
/job/schedule --notify / --no-notify
/job/schedule --max-applications 10 # 0 = no cap
/job/schedule --max-runtime 45
/job/schedule --disable / --enable
```

`opencode models` lists the model IDs. Leave the automation model empty to
inherit the OpenCode default (the model configured in OpenCode), or set an
explicit `provider/model#variant`. The model lives in
`<data dir>/automation.md`; `/job/schedule --model` changes it and applies on
the next run. The OpenCode root default does not retain variants, so include
`#max`, `#high`, or `#low` in the automation model when you want one.

The installer resolves the `opencode` CLI from `PATH` and the common install
locations: Homebrew (Apple Silicon and Intel), npm, pnpm, Bun, the curl
installer, and Windows installers. If you use a custom location, pass it
explicitly:

```text
/job/schedule --opencode-bin /path/to/opencode
```

### Where things live

| What | Location |
| --- | --- |
| Project | anywhere you cloned it, including `~/Documents` |
| Runtime copy | macOS: `~/Library/Application Support/automate-job-search/runtime` · Linux: `${XDG_DATA_HOME:-~/.local/share}/automate-job-search/runtime` · Windows: `%LOCALAPPDATA%\automate-job-search\runtime` |
| Personal data | `~/.jobsearch` (recommended) or the folder you chose |
| Scheduler log | `<runtime>/logs/scheduler.log` |
| Run logs and reports | `<data dir>/logs/`, `<data dir>/reports/` |

The scheduled job executes the runtime copy, never the project path. That is
why the project can stay wherever you cloned it: macOS protects `Desktop`,
`Documents`, `Downloads`, iCloud Drive, and external volumes from background
jobs, and Windows Controlled Folder Access can do the same.

`/job/schedule status` reports whether the runtime is current, stale, or
missing. `/job/schedule --repair` copies the latest code and reinstalls the
scheduler. The copy includes `node_modules`, so it only recopies dependencies
when `package-lock.json` changes.

### Permissions

| OS | What the agent needs | Manual step |
| --- | --- | --- |
| macOS | Write to Application Support, `~/Library/LaunchAgents`, and the data folder | None with `~/.jobsearch` |
| macOS, data in Documents/Desktop/Downloads | Full Disk Access for `node` and `opencode` | Yes, in System Settings → Privacy & Security |
| Linux | `systemd --user` or `cron`; normal access to the user profile | None |
| Windows | Task Scheduler; normal access to the user profile | None, unless Controlled Folder Access protects the data folder |

If the data folder is in a protected location, `/job/schedule` stops and asks
you to move it. The migration copies the data and keeps the old folder:

```text
npx tsx scripts/data-dir.ts migrate --to ~/.jobsearch
```

Full Disk Access is only needed when you choose to keep the data in a
protected folder. The agent never asks for `sudo` or an administrator account.

### How it runs per OS

| OS | Scheduler |
| --- | --- |
| macOS | LaunchAgent (`launchd`) |
| Linux | `systemd --user` timer; `cron` fallback |
| Windows | Task Scheduler (`schtasks`) |

With more than one time, macOS, Linux, and cron use multiple triggers in one
scheduled job; Windows creates one task per time.

The scheduler runs `opencode run --auto --agent coach` with the model you
chose, from the runtime copy. Logs are in `<data dir>/logs/`; the OS-level log
is `<runtime>/logs/scheduler.log`. Scheduled runs use a dedicated copy of the
Chrome profile, so an open interactive browser does not block them. If the
LinkedIn login expires, `/job/schedule --login` opens Chrome with that profile;
sign in once and close it.

If you change how `opencode` is installed, move the project, or change the
data folder, run `/job/schedule --repair`; the runtime resolver also falls
back to PATH and the known install locations automatically.

The machine must be on and the browser profile must still be logged into
LinkedIn. If it was asleep or off, the OS runs the job when it wakes or starts,
where supported. The agent never creates accounts, solves CAPTCHAs, sends
messages, publishes posts, or changes the repository during a scheduled run.

### Retention

The scheduled run cleans old data at the start:

- a `jobs/<folder>/` is deleted 30 days after a successful application
  (`applied.md` with a `submitted` status);
- a `feed/<date>-*.md` lead is deleted 30 days after its lead date, together
  with its `-email.md` draft.

`applications.md` and `job-history.md` keep the history. Items in
`state/pending-search.json` are never deleted. Run it manually with:

```text
npx tsx scripts/cleanup.ts          # dry run
npx tsx scripts/cleanup.ts --apply  # delete
npx tsx scripts/cleanup.ts --days 45
```

## Commands

| Command | What it does |
| --- | --- |
| `/job/setup` | Onboarding: resume, preferences, work history |
| `/job/search` | Find and score jobs posted in the last 48 hours, plus feed hiring leads |
| `/job/feed-search` | Search LinkedIn posts for hiring leads (feed only) |
| `/job/application-email` | Draft an application email for a feed lead with an email |
| `/job/tailor` | Tailored resume for a saved job |
| `/job/resume-review` | CV feedback with concrete improvements |
| `/job/cover-letter` | Cover letter for a saved job |
| `/job/apply` | Apply to a saved Medium/High fit — fills, submits, and logs it |
| `/job/apply-form` | Fill a generic application form when the ATS is not LinkedIn/Greenhouse/Lever |
| `/job/log-application` | Record an application you sent manually |
| `/job/schedule` | Configure the automated daily search |
| `/job/retry` | Retry the pending jobs from the last automated run |
| `/job/outreach` | Connection notes and follow-ups (draft-only) |
| `/job` | Show the menu anytime |

## How it works

| Agent | Role |
| --- | --- |
| **Coach** (`coach`) | Talks with you, plans, delegates, gates messages and posts |
| `job-scout` | Browser work: searches, fit scoring, saving postings, automatic apply |
| `artifact-writer` | Resumes, cover letters, outreach drafts |
| `draft-review` | Fact-check and voice audit gate before anything ships |
| `presence-coach` | LinkedIn profile audits, post drafts, comment drafts; publishes an approved post |
| `release-manager` | Git lifecycle for this repo: branches, PRs, tags, releases |

Pipeline: **plan → your approval → delegate → audit → done.** Applications
for Medium and High fits submit automatically; messages and posts get a final
OK. Scheduled runs use the standing approval in `automation.md` and leave a
daily report for anything that needs you.

## Runs on free models

No paid subscription required. The toolkit is token-aware by design:
deterministic work runs in code, browser data never floods the conversation,
and every agent has a step budget.

Pick a model for your session — Coach and all subagents inherit it. The
scheduled search uses its own model: set it with
`/job/schedule --model provider/model#variant`, or leave it empty to inherit
the OpenCode default.

## Privacy and safety

- Personal data — resume, preferences, history — lives outside this
  repository, in a data folder you choose during setup.
- Browser automation uses a dedicated profile you log into once. Credentials
  are never stored or entered by an agent.
- Approval-first for messages, comments, and posts. Applications for Medium
  and High fits submit automatically; every submission is recorded in
  `applied.md` and `applications.md` so you can review the exact fields sent.
  Outreach, profile audits, comments, and application emails stay draft-only;
  a post publishes only after you approve its exact text.
- Apply runs one application at a time. If an ATS gates Submit behind a
  CAPTCHA, the agent skips the job and reports it; you can complete it later.
  The agent never solves or bypasses a CAPTCHA. Review LinkedIn's Terms of
  Service; your account is your responsibility.
- Scheduled runs use the standing approval in `automation.md`; they search,
  auto-apply Medium/High, log, and report. They never send messages, publish
  posts, create accounts, solve CAPTCHAs, or change the repository. Disable
  them with `/job/schedule --disable`.
- External content — postings, messages — is always treated as untrusted
  input.

## License

Copyright © 2026 [KiKDraS](https://github.com/KiKDraS). This project is
[MIT](https://github.com/KiKDraS/automate-job-search/blob/main/LICENSE)
licensed. Third-party acknowledgements are in
[THIRD_PARTY_NOTICES.md](https://github.com/KiKDraS/automate-job-search/blob/main/THIRD_PARTY_NOTICES.md).
