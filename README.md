# automate-job-search

An OpenCode-native job-search toolkit. A **Coach** agent plans the work with
you, delegates to specialist subagents, and never sends, submits, or publishes
anything without your explicit approval.

> **Status: early development (Phase 1 of 9).** The repository skeleton, agent
> team, and job-search skills land progressively — see
> [CHANGELOG.md](CHANGELOG.md). First usable release: `v0.1.0`.

## What it does

- **Search** LinkedIn for roles that match your resume and preferences, with
  fit scoring and dedupe against your history.
- **Tailor** your resume and **write** cover letters for specific postings.
- **Outreach**: connection notes and follow-ups that sound like a person.
- **Presence** (later phases): profile optimization, posts, comments, and
  engagement tracking to build visibility.

Everything runs from a conversation with Coach inside OpenCode. Your personal
data (resume, preferences, history) lives outside the repo in `~/.jobsearch/`
(override with `JOBSEARCH_HOME`).

## How it works

| Agent | Role |
| --- | --- |
| **Coach** (`coach`) | Talks with you, plans, delegates, gates every outbound action |
| `job-scout` | Browser work: searches, fit scoring, saving postings |
| `artifact-writer` | Resumes, cover letters, outreach drafts |
| `draft-review` | Fact-check + voice audit gate before anything ships |
| `release-manager` | Git lifecycle for this repo (branches, PRs, tags, releases) |
| `presence-coach` | *(later)* LinkedIn attention layer |

Pipeline: **Plan → your approval → delegate → audit → your approval → done.**

## Requirements

- [OpenCode](https://opencode.ai) V2
- Node.js ≥ 20
- Chrome (for browser automation via Playwright MCP)
- [`gh` CLI](https://cli.github.com) (optional; used by `release-manager` workflows)

## Quick start

```sh
git clone https://github.com/KiKDraS/automate-job-search.git
cd automate-job-search
npm install
npm run doctor
```

Then open OpenCode in the project and start a session — Coach is the default
agent.

Feature skills arrive in later phases; `npm run doctor` tells you what works
today.

## Privacy & safety

- Personal data lives in `~/.jobsearch/` (or `JOBSEARCH_HOME`), never in this
  repository.
- Browser automation uses a dedicated Playwright profile that you log into
  once. Credentials are never stored or entered by the agent.
- Approval-first: nothing is sent, submitted, or published without an explicit
  OK from you. Drafts are shown in full before any outbound action.
- LinkedIn automation is read-mostly, low-volume, and human-paced. Review
  LinkedIn's Terms of Service; you are responsible for your account.
- External content (job postings, messages) is always treated as untrusted
  input.

## Project structure

```text
opencode.jsonc       OpenCode config: agents, permissions, MCP servers
AGENTS.md            Session rules: agent roster, gates, git flow
.opencode/
  agents/            Coach + specialist subagents
  skills/            Job-search skills (the toolkit itself)
  commands/          /job/... slash commands
  docs/              Shared rules referenced by skills and agents
lib/                 TypeScript helpers (data dir, job store, URL parsing)
scripts/             doctor.ts, check-skills.ts
```

## Development

```sh
npm run doctor        # environment self-check
npm run check:skills  # validate skill frontmatter
npm test              # unit tests for the helper lib
npm run typecheck     # TypeScript check
```

Git flow: `main` (releases) ← `release/*` ← `develop` ← `feature/*`.
All merges go through pull requests.

## Roadmap

1. Repository skeleton and toolchain
2. OpenCode config, Coach, release-manager
3. Shared docs (data directory, approval flow, browser setup, …)
4. Helper lib and full environment doctor
5. Setup + job-search skills
6. Resume, cover letter, and outreach skills
7. Hardening and first release
8. Attention layer (profile, posts, comments, engagement)
9. Apply automation and network scan (deferred)

## License

MIT — see [LICENSE](LICENSE). Third-party acknowledgements are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
