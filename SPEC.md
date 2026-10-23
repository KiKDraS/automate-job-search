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
  release-manager, presence-coach (Phase 8). Roster: `AGENTS.md`
- **Skills** — job-setup, job-search, resume-review, tailor-resume,
  cover-letter, outreach, apply; craft skills no-ai-slop and write-root-readme
  (`.opencode/skills/`)
- **Plugins** — coach-greeting (server + TUI halves): greets on launch
  (`.opencode/plugins/coach-greeting/`)
- **Helpers** — deterministic wrappers over `lib/` (`scripts/`)
- **Data directory** — `~/.jobsearch` or `JOBSEARCH_HOME`
  (`.opencode/docs/data-directory.md`)

## Scope

**In:** setup, job search, resumes (build, review, tailoring), cover letters,
outreach drafts, assisted apply (LinkedIn Easy Apply and external ATS —
Greenhouse and Lever — when the user explicitly asks, with a full
review-and-approve gate before the final submit), launch greeting, attention
layer (profile audit, post drafts, comment drafts — draft-only).

**Deferred:**

- Network scan — waiting on a LinkedIn contacts export
- Scheduled/headless runs
- External ATS beyond Greenhouse and Lever (BairesDev, Bionic Talent)
- Attention-layer analytics (engagement metrics)

**Out:**

- A standalone application — this is an OpenCode-native toolkit
- Autonomous outbound — nothing sends, submits, or publishes unattended;
  messages, posts, and outreach stay draft-only, and applications submit only
  on the user's explicit request and approval
- API-based publishing integrations — draft-only by design
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
