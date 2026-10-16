# SPEC — automate-job-search

What this project is, who it serves, and how it should work. Behavior rules
live in `.opencode/docs/` and are linked here, never restated. Change history
lives in `CHANGELOG.md`.

> **Modifications to this document require explicit user approval.** Propose
> the exact change, get an OK, then apply it — in the same change as the
> decision that caused it.

## Mission

Free-model-first job search. Anyone can run an AI-assisted job search —
finding roles, tailoring applications, reaching out — on OpenCode's free
models, with no subscription required.

## Principles

- **Simplest path for the user.** No manual setup, ever — no config files to
  edit, no shell profiles, no environment variables. Choices happen in
  conversation; everything else works out of the box.
- **Warmth is the goal.** User-facing text — chat, reports, artifacts — is
  warm, clear, and specific. Nothing user-facing is compressed or terse for
  its own sake. (`.opencode/docs/voice-rules.md`)
- **Token economy is a product requirement.** Free models are the primary
  audience; every design choice survives a tight context budget.
  (`.opencode/docs/token-economy.md`)
- **Approval-first.** Nothing outbound — sent, submitted, published — without
  the user's explicit OK on the exact content.
  (`.opencode/docs/approval-flow.md`)
- **Deterministic-first.** Mechanical work (URLs, dedupe, file shaping,
  rendering) lives in code; the model does judgment.
- **No rule copies.** One canonical home per rule; everything else points.
  (`AGENTS.md`)
- **Personal data never enters the repo.** Everything personal lives in the
  data directory. (`.opencode/docs/data-directory.md`)

## System map

- **Agents** — Coach leads; job-scout, artifact-writer, draft-review,
  release-manager, later presence-coach. Roster: `AGENTS.md`
- **Skills** — job-setup, job-search, resume-review, tailor-resume,
  cover-letter, outreach; craft skills no-ai-slop and write-root-readme
  (`.opencode/skills/`)
- **Plugins** — coach-greeting (server + TUI halves): greets on launch
  (`.opencode/plugins/coach-greeting/`)
- **Helpers** — deterministic wrappers over `lib/` (`scripts/`)
- **Data directory** — `~/.jobsearch` or `JOBSEARCH_HOME`
  (`.opencode/docs/data-directory.md`)

## Scope

**In:** setup, job search, resumes (build, review, tailoring), cover letters,
outreach drafts, launch greeting.

**Deferred:**

- Assisted apply — highest-risk surface; ships with a hard stop before submit
- Network scan — waiting on a LinkedIn contacts export
- Scheduled/headless runs

**Out:**

- A standalone application — this is an OpenCode-native toolkit
- Automated sending, submitting, or publishing — drafts are always the user's
  to send
- API-based publishing integrations — draft-only by design
- The Playwright CLI as the browser layer — measured against MCP + Code Mode;
  decision and numbers in `.opencode/docs/browser-setup.md`

## How we work

- **Git flow** — `main` released, `develop` integration, every merge a PR.
  (`.opencode/docs/git-flow.md`)
- **The hardening loop** — live test → session export to `~/.jobsearch/.tmp/`
  → mined findings → fixes → PR. Repeated before and after releases.
- **Documentation split** — `README.md` is user documentation: what the
  project is and how to use it, kept in sync with every user-visible change.
  Development material lives in `SPEC.md`, `AGENTS.md`, and
  `.opencode/docs/`; change history in `CHANGELOG.md`.
- **Decision changes** — when a decision changes how, why, or what the
  project does, this document is updated in the same change, with explicit
  user approval.
