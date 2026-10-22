# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Assisted apply (LinkedIn Easy Apply): `/job/apply` fills a saved job's
  application from `profile.md`, the tailored `resume.pdf`, and reusable
  answers in `application-data.md`; it stops at the Review step and shows
  every field, file, and answer for the user's explicit OK, then submits,
  verifies the confirmation, and writes `applied.md`. New `apply` skill and
  `apply-log` helper; `job-scout` gains the apply flow and
  `browser_file_upload` scoped to the approved files; approval flow, browser
  setup, LinkedIn patterns, and data-directory docs updated. SPEC.md: assisted
  apply moves to In; the out-of-scope line is now autonomous outbound
  (user-approved). Coach's menu gains Apply.
- Language preferences: first contact asks for the chat language (bilingual
  EN/ES) and records it in `<data dir>/language.md`; every session greets
  and replies in it. Tailored resumes and letters follow each posting's
  language, with a per-job user override (`voice-rules.md` → Language).
  When no data directory has been chosen yet, first contact asks for it
  right after the language and records the answer — including the default —
  via `jobsearch_set_data_dir`; setup confirms instead of re-asking.
- Craft skills ship with the toolkit: `no-ai-slop` (house style for prose)
  and `write-root-readme` (README conventions — no generic emoji headings),
  both adapted with notices recorded in `THIRD_PARTY_NOTICES.md`.
- Resume text extraction: `scripts/resume-text.ts` (+ `lib/resume-text.ts`,
  pdfjs-dist) turns a text-layer resume PDF into `resume/base.txt` — the
  canonical readable source for review and tailoring, so free models without
  document support can work with any resume. Scanned/image PDFs are detected
  and reported; the skills fall back to asking for pasted text.
- Resume quality: the `resume-review` skill and `/job/resume-review` command,
  plus `.opencode/docs/resume-standards.md` — the canonical rules for
  structure, ATS, impact, consistency, and a human-reading voice. Creation
  flows (`job-setup`, `tailor-resume`) write to the standards and ask one
  batched clarification round instead of writing around missing data;
  rewrites pass `draft-review`.
- SPEC.md: resumes scope now includes review (user-approved).
- Data directory automation: setup asks where data should live and calls
  `jobsearch_set_data_dir` — the new `data-dir` plugin validates the path,
  creates the folder, stores the choice
  (`~/.config/opencode/jobsearch.json`), and grants the session access. No
  manual config edits, shell profiles, or restarts; doctor reports the
  resolved path and its source.
- `SPEC.md`: new principle — the simplest path for the user; no manual setup.
- `SPEC.md`: the project's single intent document — mission, principles
  (warmth, token economy, approval-first, deterministic-first, no rule
  copies, data privacy), system map, scope (in / deferred / out), and how we
  work. Modifications require explicit user approval; `check:skills`
  validates its doc pointers; the PR template carries the approval gate.
- Greeting on launch: `coach-greeting` now ships as a two-part plugin
  package. The server half nudges fresh Coach sessions; the TUI half opens a
  greeted welcome session when OpenCode starts (reusing it while the user
  has not typed in it). README documents an `opencode --prompt "/job"`
  alias as an alternative.
- Coach greets new sessions: a session-start plugin (`coach-greeting`) nudges
  fresh top-level Coach sessions with a synthetic message; the greeting menu
  lives in the Coach contract, and `/job` shows it on demand.

### Changed

- Artifact facts: before drafting a batch, Coach runs one gap scan over the
  saved postings, asks for missing evidence in one batch, and writes the
  answers to `profile.md` (and the base resume) before tailoring. Rejections
  that trace to the profile or base are fixed at the source and propagated.
  Cover letters close with a neutral availability line instead of an
  unverified start date.
- Job search: `job-scout` gets 50 steps, postings are saved as each High fit
  is confirmed, and history appends the filtered list. Subagent shell
  contracts point to `read`/`glob` and the allowed scripts.
- `README.md` is now user documentation — what the project is and how to use
  it. The documentation split is recorded in `SPEC.md` and enforced by the PR
  checklist: README updates ride with user-visible changes.
- Prose craft rules (vocabulary, em dashes, patterns) now have one source —
  the `no-ai-slop` skill; `voice-rules.md` keeps the project-specific rules
  and points there.

### Fixed

- Outreach: `<job folder>/outreach.md` is now the documented draft file, and
  `outreach-history.md` records every draft version and status change
  (`drafted`, `rejected`, `approved`, `sent`) instead of leaving rejected and
  approved drafts indistinguishable.
- `slugify` truncates on a word boundary, so folder names no longer end in
  fragments like `...-flutt`.
- `history.ts append` drops duplicates already in history or repeated within
  the section, and reports how many it skipped.
- Greeting self-heals when the welcome session is gone: the TUI half no
  longer stores a session id between launches. Each launch finds an unused
  "Welcome" session from the server (or creates one), so deleting, renaming,
  or using the welcome session can never wedge the greeting with
  "Session not found" again.

## [0.1.0] - 2026-10-15

### Added

- Live-test hardening: voice rules now bind every text surface (chat,
  reports, artifacts); shortlists include canonical job URLs; setup asks
  where the data folder lives (guided custom-path flow); setup can build a
  base resume from scratch with PDF export via `scripts/render-resume.ts`
  (playwright-core + system Chrome).
- `check:skills` now validates `.opencode/docs/` references and skill-local
  `assets/`/`references/` files, and warns when a description exceeds the
  token-economy budget.
- Doctor checks `playwright-core` for resume PDF export.
- Artifact pipeline: `artifact-writer` and `draft-review` agents,
  `tailor-resume` / `cover-letter` / `outreach` skills, and `/job/tailor` /
  `/job/cover-letter` / `/job/outreach` commands. Nothing outbound passes
  without an APPROVED review; outreach is draft-only and logged to
  `outreach-history.md`.
- Core skills: `job-setup` (onboarding interview, preferences and profile
  files) and `job-search` (batched browser extraction, dedupe, fit scoring,
  saved postings), with `/job/setup` and `/job/search` commands and the
  `job-scout` subagent.
- Deterministic CLI wrappers: `scripts/linkedin.ts` (search URLs, job URL
  normalization), `scripts/history.ts` (dedupe, append, folders),
  `scripts/save-posting.ts` (posting bodies into job folders), and
  `scripts/data-dir.ts`.
- Browser-layer decision recorded with measured evidence: trimmed Playwright
  MCP + Code Mode over the CLI; batching discipline added to
  `browser-setup.md`.
- `.tmp/` transient area added to the data-directory layout.
- Token-economy groundwork: `.opencode/docs/token-economy.md` (context
  budgets, delegation economics, deterministic-first rules), unused
  Playwright MCP tools denied so they stay out of model context, and `steps`
  caps on the Coach and release-manager agents.
- README section on running the toolkit on free models.
- Helper library: `lib/linkedin-url.ts` (search URL builder, job URL
  extraction and canonicalization, tracking-parameter stripping) and
  `lib/jobstore.ts` (append-only job history, duplicate keys, per-job
  folders).
- `npm run doctor` now probes the data directory with a real write, detects
  Chrome, checks that Playwright MCP runs via npx, and reports browser
  profile/login guidance.
- Unit tests for the helper library (`npm test`, Node's test runner via tsx).
- Nine shared documents in `.opencode/docs/`: priority hierarchy, data
  directory, approval flow, git flow, fit scoring, browser setup, LinkedIn UI
  patterns, untrusted content, and voice rules.
- `git-flow.md` is now the single source for branch and release flow;
  the release-manager contract points to it instead of duplicating it.
- OpenCode configuration (`opencode.jsonc`): Coach as the default agent,
  global permission policy, and the Playwright MCP server (persistent Chrome
  profile, `browser_run_code_unsafe` and `browser_file_upload` blocked).
- `AGENTS.md`: agent roster, hard rules, rule-ownership convention, and
  shared-document pointers.
- `coach` primary agent: plan → approve → delegate protocol with per-action
  approval gates and a subagent allowlist.
- `release-manager` subagent: git-flow authority for this repository, with a
  force-push guard in its permission rules.
- Guarded `.opencode/secrets/` directory.
- Repository skeleton: `.gitignore`, `.gitattributes`, MIT `LICENSE`,
  `THIRD_PARTY_NOTICES.md`, `README.md`, `CHANGELOG.md`.
- GitHub issue and pull-request templates.
- TypeScript toolchain (`typescript`, `tsx`) with `doctor`, `check:skills`,
  and `typecheck` scripts.
- Cross-platform data-directory resolver (`lib/data-dir.ts`) using
  `JOBSEARCH_HOME` or `~/.jobsearch`.
- Environment self-check (`npm run doctor`) covering Node, the `gh` CLI, and
  the data directory.
- Skill validator (`npm run check:skills`) covering directory naming and
  `SKILL.md` frontmatter.
