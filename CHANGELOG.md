# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
