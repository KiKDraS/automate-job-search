# SPEC — automate-job-search

What this project is, who it serves, and how it should work. Behavior rules
live in `.opencode/docs/` and are linked here, never restated. Change history
lives in `CHANGELOG.md`.

> **Modifications to this document require explicit user approval.** Propose
> the exact change, get an OK, then apply it — in the same change as the
> decision that caused it.

## Mission

Free-model-first job search for technology roles. Anyone can run an
AI-assisted job search — finding roles, tailoring applications, reaching
out — on OpenCode's free models, with no subscription required.

## Principles

- **Simplest path for the user.** No manual setup, ever — no config files to
  edit, no shell profiles, no environment variables. Choices happen in
  conversation; everything else works out of the box.
- **No assumptions.** Every fact, preference, stack, default, or scope
  decision comes from the user or the data directory. When something is
  missing, ask; never infer, default, or generalize from a sample. Validate
  new behavior with the user before building on it.
- **Warmth is the goal.** User-facing text — chat, reports, artifacts — is
  warm, clear, and specific. Nothing user-facing is compressed or terse for
  its own sake. (`.opencode/docs/voice-rules.md`)
- **Token economy is a product requirement.** Free models are the primary
  audience; every design choice survives a tight context budget.
  (`.opencode/docs/token-economy.md`)
- **Approval-first, except applications.** Messages, comments, and posts
  require the user's explicit OK on the exact content. Applications for saved
  jobs scored Medium or High submit automatically and are logged in
  `applications.md`; there is no per-application gate.
  (`.opencode/docs/approval-flow.md`)
- **Deterministic-first.** Mechanical work (URLs, dedupe, file shaping,
  rendering) lives in code; the model does judgment.
- **No rule copies.** One canonical home per rule; everything else points.
  (`AGENTS.md`)
- **Personal data never enters the repo.** Everything personal lives in the
  data directory. (`.opencode/docs/data-directory.md`)

## System map

- **Agents** — Coach leads; job-scout, artifact-writer, draft-review,
  release-manager, presence-coach. Roster: `AGENTS.md`
- **Skills** — job-setup, job-search, feed-search, resume-review, tailor-resume,
  cover-letter, outreach, apply, apply-external, apply-form, log-application,
  application-email, profile-audit, linkedin-post, linkedin-comment; craft
  skills no-ai-slop and write-root-readme (`.opencode/skills/`)
- **Plugins** — coach-greeting (server + TUI halves): greets on launch
  (`.opencode/plugins/coach-greeting/`)
- **Helpers** — deterministic wrappers over `lib/` (`scripts/`)
- **Data directory** — `~/.jobsearch` or `JOBSEARCH_HOME`
  (`.opencode/docs/data-directory.md`)

## Scope

**In:** setup, job search (postings from the last 48 hours), feed lead scan
(hiring posts that match the target roles), resumes (build, review, tailoring),
cover letters, outreach drafts, application email drafts, automatic apply for
saved jobs scored Medium or High (LinkedIn Easy Apply, Greenhouse, Lever, and
any readable generic form via `apply-form`), with a consolidated log in
`applications.md`, launch greeting, attention layer (profile audit, post
drafts, comment drafts, and publishing a post the user approved — no
autonomous publishing).

**Deferred:**

- Network scan — waiting on a LinkedIn contacts export
- Scheduled/headless runs
- ATS-specific optimizations beyond the generic form filler
- Attention-layer analytics (engagement metrics)

**Out:**

- A standalone application — this is an OpenCode-native toolkit
- Autonomous outbound beyond applications — applications for Medium and High
  fits submit automatically and are logged; messages, comments, and outreach
  stay draft-only; a post publishes only after the user approves the exact
  text
- API-based publishing integrations — publishing is browser-assisted, one post
  at a time
- The Playwright CLI as the browser layer — measured against MCP + Code Mode;
  decision and numbers in `.opencode/docs/browser-setup.md`

## How we work

- **Git flow** — `main` released, `develop` integration, every merge a PR.
  (`.opencode/docs/git-flow.md`)
- **The hardening loop** — live test → session export to `~/.jobsearch/.tmp/`
  → mined findings → fixes → PR. Repeated before and after releases.
- **Fit checks** — a deterministic stack check compares a posting's required
  technologies with the stack the user confirmed in `profile.md`; a local
  catalog adds niche terms and it never assumes a stack
  (`.opencode/docs/fit-scoring.md`).
- **Tech catalog** — the shared catalog ships with releases; user-specific
  terms live in the data directory and never enter the repo
  (`.opencode/docs/fit-scoring.md`, `.opencode/docs/data-directory.md`).
- **User-validated data** — setup writes `profile.md` from the user's answers
  and shows it for explicit approval before use; the stack is confirmed,
  never inferred (`.opencode/docs/data-directory.md`).
- **Audits** — a new draft gets a full `draft-review`; a revision gets a
  targeted re-audit, and a change outside the requested fix gets a full audit
  (`.opencode/docs/token-economy.md`, `.opencode/docs/approval-flow.md`).
- **Documentation split** — `README.md` is user documentation: what the
  project is and how to use it, kept in sync with every user-visible change.
  Development material lives in `SPEC.md`, `AGENTS.md`, and
  `.opencode/docs/`; change history in `CHANGELOG.md`.
- **Decision changes** — when a decision changes how, why, or what the
  project does, this document is updated in the same change, with explicit
  user approval.
