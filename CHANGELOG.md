# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
