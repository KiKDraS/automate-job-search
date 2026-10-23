<div align="center" markdown>

<!-- TODO(public flip): enable the Socialify hero and live badges once the repository is public.
![automate-job-search](https://socialify.git.ci/KiKDraS/automate-job-search/image?description=1&forks=1&issues=1&language=1&name=1&owner=1&pattern=Transparent&pulls=1&stargazers=1&theme=Auto)
[![Stars](https://img.shields.io/github/stars/KiKDraS/automate-job-search)](https://github.com/KiKDraS/automate-job-search/stargazers)
[![Forks](https://img.shields.io/github/forks/KiKDraS/automate-job-search)](https://github.com/KiKDraS/automate-job-search/forks)
[![Issues](https://img.shields.io/github/issues/KiKDraS/automate-job-search)](https://github.com/KiKDraS/automate-job-search/issues)
[![Pull requests](https://img.shields.io/github/issues-pr/KiKDraS/automate-job-search)](https://github.com/KiKDraS/automate-job-search/pulls)
-->

**[Changelog](https://github.com/KiKDraS/automate-job-search/blob/main/CHANGELOG.md) · [Report a bug](https://github.com/KiKDraS/automate-job-search/issues) · [Request a feature](https://github.com/KiKDraS/automate-job-search/issues)**

[![OpenCode V2](https://img.shields.io/badge/OpenCode-V2-blue)](https://opencode.ai)
[![Node](https://img.shields.io/badge/Node-%E2%89%A5%2020-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](https://github.com/KiKDraS/automate-job-search/blob/main/LICENSE)

![Rule](https://cdn.jsdelivr.net/gh/andreasbm/readme/assets/lines/rainbow.png)

</div>

## What it is

An OpenCode-native job-search toolkit for technology roles. A **Coach** agent
plans the work with you, delegates to specialist subagents, and never sends,
submits, or publishes anything without your explicit approval.

Built for technology roles — software, data, DevOps, QA, design engineering.
Today it covers the full application loop: LinkedIn search with fit scoring,
resume review and tailoring, cover letters, assisted apply, and outreach
drafts. The attention layer — profile, posts, comments, engagement — is next.

Apply fills LinkedIn Easy Apply, Greenhouse, and Lever forms and shows you
every field, file, and answer before anything is sent. Submit happens only
after your OK. Other ATS are out of scope for now.

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

## Commands

| Command | What it does |
| --- | --- |
| `/job/setup` | Onboarding: resume, preferences, work history |
| `/job/search` | Find and score new jobs |
| `/job/tailor` | Tailored resume for a saved job |
| `/job/resume-review` | CV feedback with concrete improvements |
| `/job/cover-letter` | Cover letter for a saved job |
| `/job/apply` | Easy Apply application — fills, reviews, submits on your OK |
| `/job/outreach` | Connection notes and follow-ups (draft-only) |
| `/job` | Show the menu anytime |

## How it works

| Agent | Role |
| --- | --- |
| **Coach** (`coach`) | Talks with you, plans, delegates, gates every outbound action |
| `job-scout` | Browser work: searches, fit scoring, saving postings, assisted apply |
| `artifact-writer` | Resumes, cover letters, outreach drafts |
| `draft-review` | Fact-check and voice audit gate before anything ships |
| `release-manager` | Git lifecycle for this repo: branches, PRs, tags, releases |

Pipeline: **plan → your approval → delegate → audit → your approval → done.**
Nothing leaves your hands without an explicit OK.

## Runs on free models

No paid subscription required. The toolkit is token-aware by design:
deterministic work runs in code, browser data never floods the conversation,
and every agent has a step budget.

Pick a free model from [OpenCode Zen](https://opencode.ai/zen) as your session
model — Coach and all subagents inherit it.

## Privacy and safety

- Personal data — resume, preferences, history — lives outside this
  repository, in a data folder you choose during setup.
- Browser automation uses a dedicated profile you log into once. Credentials
  are never stored or entered by an agent.
- Approval-first: nothing is sent, submitted, or published without your OK on
  the exact content. Outreach stays draft-only; applications submit only
  after you approve the full review sheet.
- LinkedIn automation is low-volume and human-paced. Apply runs only when you
  ask, one application at a time. Review LinkedIn's Terms of Service; your
  account is your responsibility.
- External content — postings, messages — is always treated as untrusted
  input.

## License

Copyright © 2026 [KiKDraS](https://github.com/KiKDraS). This project is
[MIT](https://github.com/KiKDraS/automate-job-search/blob/main/LICENSE)
licensed. Third-party acknowledgements are in
[THIRD_PARTY_NOTICES.md](https://github.com/KiKDraS/automate-job-search/blob/main/THIRD_PARTY_NOTICES.md).
