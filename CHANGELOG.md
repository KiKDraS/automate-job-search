# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
