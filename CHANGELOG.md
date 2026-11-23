# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.14.1] - 2026-11-23

### Fixed

- The job search strips an `f_SAL` salary filter that the authenticated
  LinkedIn UI re-injects, and treats a `/jobs/search-results/?currentJobId=`
  redirect as a blocked UI instead of an empty result list. Added
  `linkedin.ts clean-url` for cleaning a copied URL.

## [0.14.0] - 2026-11-23

### Added

- Friendly HTML report at `reports/YYYY-MM-DD.html` with pending items as
  cards, clickable links, and paths. The OS opens it after each run
  (`openReport`, default on).
- Notifications show the first two pending items instead of only the count.
- `/job/report` prints the pending items and their paths; `--open` opens the
  HTML.

### Changed

- `automation.md` adds `openReport`; `/job/schedule --open-report` and
  `--no-open-report` control it.

## [0.13.0] - 2026-11-23

### Added

- `applications.md` is the applied index: the search filter, backlog, and apply
  flows block a second application by normalized URL or company+role, even when
  the job has no `applied.md`.
- `history.ts applied` checks a job before filling a form;
  `history.ts backlog` lists saved folders that are neither applied nor in the
  index, and skips `Excluded companies` from `preferences.md`.

### Fixed

- New Coach sessions get the session-start greeting. The plugin no longer
  requires the `session.created` event to carry the agent and accepts the
  canonical project location.

## [0.12.0] - 2026-11-21

### Added

- Retention cleanup: the scheduled run deletes `jobs/` folders 30 days after
  a successful application and `feed/` leads 30 days after their lead date,
  skipping pending items. `scripts/cleanup.ts` runs the same cleanup manually,
  with a dry run by default.

### Changed

- `feed-search` caps doubled: 10 scrolls, 60 posts, and 20 saved leads per run.

## [0.11.1] - 2026-11-19

### Fixed

- Handoff forms stay open in the automation browser window, and the report
  tells the user to complete them there instead of reopening the link in a
  different browser profile. The agent verifies every handoff tab before
  closing others.

## [0.11.0] - 2026-11-19

### Added

- The automation model defaults to the model configured in OpenCode;
  `/job/schedule status` shows the resolved model. `automation.md` keeps an
  explicit `provider/model#variant` when the user wants one, so `#max` and
  other variants survive.

### Changed

- Setup, schedule, and README explain that `/models` applies only to the
  current session, the automation model is stored in `automation.md`, and
  changing it applies on the next run.

## [0.10.1] - 2026-11-19

### Fixed

- A transient model transport error (`ECONNRESET`, timeout) gets one automatic
  retry when the failed attempt submitted no application and at least half the
  runtime cap remains. The retry is logged and reported.

## [0.10.0] - 2026-11-17

### Added

- Multiple daily run times: `times` in `automation.md`, set with
  `--times "11:30,18:30"`. macOS and Linux use multiple triggers in one
  scheduled job; Windows creates one task per time.
- Configurable search window: `searchWindowHours`, set with
  `--search-window 24`; the scheduled prompt uses it. The default stays 48
  hours.

### Changed

- `job-scout` closes the browser tabs it opens before returning. A tab left
  for a CAPTCHA, login, or missing answer is listed under "Needs you" with its
  URL and action.

## [0.9.0] - 2026-11-17

### Added

- Scheduled runs execute from a runtime copy in the user's application-data
  directory, so the project can live anywhere, including `~/Documents`.
  `/job/schedule status` reports the project, the runtime state, and the data
  directory safety; `repair` resynchronizes the copy.
- `scripts/data-dir.ts` reports whether the data directory is safe for
  scheduled runs and can migrate it to a new location with
  `migrate --to <path>`.
- Scheduled runs use a dedicated copy of the project's Playwright MCP Chrome
  profile, seeded on install, so an interactive browser does not lock the run
  and the LinkedIn login carries over. `/job/schedule --login` refreshes it.

### Changed

- The scheduler wrapper, its log, and `node_modules` live in the runtime
  directory instead of `<data dir>/bin/` and the project.
- `/job/schedule` refuses a protected data directory unless
  `--allow-protected-data-dir` is passed; the agent offers a migration first.
- `npm run doctor` warns when an enabled automation has a missing or stale
  runtime.
- Coach can run `npx tsx scripts/schedule.ts` for `/job/schedule` and
  onboarding.

### Fixed

- Scheduled runs no longer mistake the runner's own `state/search.lock` for a
  competing search and stop before the browser work.

## [0.8.0] - 2026-11-16

### Changed

- Manual searches include `feed-search` in the same `job-scout` round by
  default; the user can ask for jobs only to skip it. `/job/feed-search` still
  runs the feed scan alone.

## [0.7.0] - 2026-11-16

### Added

- Automated daily search: `automation.md` in the data dir, a cross-platform
  scheduler (launchd, systemd/cron, Task Scheduler), `/job/schedule`,
  `/job/retry`, native notifications with a text fallback, daily reports, and
  a pending-state handoff for CAPTCHA, email, login, and missing answers.
- Model choice for scheduled runs: `--model provider/model` or the OpenCode
  default.
- `schedule` skill and `/job/schedule` command.

### Changed

- `job-search` resolves each result card's job ID by clicking the card and
  reading `currentJobId` or `/jobs/view/<id>/`; it reports seen, resolved,
  new, duplicates, and unresolved cards. The search URL no longer carries the
  `f_SAL` salary filter.
- `job-setup` now collects application answers and offers the automation step
  after the profile is approved.
- README documents the automated search, defaults, model choice, OS behavior,
  reports, and retry.
- Scheduled runs draft application emails and queue CAPTCHA, login, email, and
  missing-answer actions in the daily report; the README notes that the run
  uses the checked-out code and how to repair after changing the OpenCode
  install method.

### Fixed

- The scheduler resolves the `opencode` CLI across Homebrew, npm, pnpm, Bun,
  the curl installer, and Windows installers. The wrapper pins the absolute
  path and the install-time `PATH`; `--opencode-bin` handles custom installs.
  It also resolves a stable `node` path and falls back at runtime if the
  pinned CLI disappears.

## [0.6.0] - 2026-11-13

### Added

- `apply-form` skill and `/job/apply-form` command: fill and submit any
  readable application form that is not LinkedIn Easy Apply, Greenhouse, or
  Lever — Ashby, Workday, SmartRecruiters, Teamtailor, Recruitee, Breezy,
  BambooHR, company career pages, and custom forms. Stops on account creation,
  CAPTCHA, unreadable forms, or unknown required answers.

### Changed

- Automatic apply for Medium/High fits now covers generic application forms in
  addition to LinkedIn Easy Apply, Greenhouse, and Lever.

## [0.5.0] - 2026-11-13

### Added

- `feed-search` skill and `/job/feed-search` command: search LinkedIn posts
  for hiring leads that match the target roles, score fit, dedupe, and save
  High/Medium leads under `<data dir>/feed/` and `job-history.md`. Low-volume,
  discovery only; no engagement actions.
- `application-email` skill and `/job/application-email` command: when a feed
  lead publishes an email, store the address and draft a short application
  email. Draft-only; the user sends.
- `SECURITY.md`: private vulnerability reporting through GitHub Security
  Advisories, scope, and response expectations.

### Changed

- Job searches are limited to postings published in the last 48 hours
  (`f_TPR=r172800`); the search skill skips anything older and does not widen
  the window without an explicit user exception.
- Test data uses fictional names; no personal data in the repository.

## [0.4.0] - 2026-11-13

### Added

- Consolidated application log at `<data dir>/applications.md`: one row per
  submitted application with date, company, role, fit, method, confirmation,
  job URL, and folder. `applied.md` keeps the per-job detail.
- `log-application` skill and `/job/log-application` command: record an
  application the user sent manually, marked `source: user` and
  `status: submitted (manual)`, without claiming the agent submitted it.

### Changed

- `presence-coach` can publish an approved LinkedIn post after Gate 3;
  comments and profile edits stay draft-only.
- Applications for saved jobs scored Medium or High submit automatically;
  every submission is appended to `applications.md` for review. Low fits are
  skipped. Messages, comments, and posts keep their approval gate.
- CAPTCHA handoff: when an ATS gates Submit behind a CAPTCHA, the agent stops
  and reports it; in an autonomous run it skips the job so the user can
  complete the challenge later. It never solves or bypasses one.
- LinkedIn posts are story-first: `linkedin-post` interviews the user for one
  concrete moment and refuses to pad a fact list. Stories live in
  `presence/story-bank.md`.

## [0.3.0] - 2026-11-13

### Added

- Attention layer: `presence-coach` audits the LinkedIn profile and drafts
  posts and comments from the user's real work; every draft passes
  `draft-review`, and the user publishes. No feed scraping, engagement
  analytics, or scheduling.
- External ATS apply: the `apply-external` skill fills Greenhouse and Lever
  applications with the same review-and-approve gate, resume/cover-letter
  upload, and `applied.md` logging. `lib/ats.ts` and `scripts/ats.ts` detect
  the ATS from the URL; other ATS stay out of scope.

### Changed

- `applied.md` records the actual ATS method (LinkedIn Easy Apply,
  Greenhouse, or Lever) instead of always LinkedIn.

## [0.2.0] - 2026-10-23

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

- Scope: SPEC moves external ATS (Greenhouse, Lever) and the attention layer
  (profile audit, post drafts, comment drafts) into In; external ATS beyond
  those two and attention-layer analytics stay deferred (user-approved).
- Token economy: the deterministic stack check compares a posting's
  required/optional technologies with the stack the user confirmed in
  `profile.md`; it never assumes one and the result is advisory. Unknown
  terms come back as `candidates`; the user can add them to a local
  `tech-catalog.json` overlay, while common terms join the shipped catalog in
  releases. Setup asks for the stack once and shows `profile.md` for explicit
  approval. `draft-review` re-audits revisions against the changed sections.
  SPEC adds the no-assumptions principle and the technology-role focus;
  fit-scoring, data-directory, approval, token-economy, job-setup, and resume
  docs updated.
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

- Resume PDF export disables font ligatures, so ATS text extraction no longer
  splits words like "flow" or "verifications".
- Apply submit-timeout recovery: verify the job page and applied-jobs list
  before retrying; never click Submit twice.
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
