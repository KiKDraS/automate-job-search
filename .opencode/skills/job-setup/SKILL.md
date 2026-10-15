---
name: Job Setup
description: "One-time onboarding: resume, preferences, and a compact work-history profile in the data directory. Use for first-time setup or refreshing preferences. Not for job searching (use job-search)."
---

# Job Setup

Coach runs this in conversation; it creates the files the rest of the toolkit
reads. Keep it to one batch of questions at a time.

## Files created

- `resume/` — the user's source resume file(s)
- `preferences.md` — targets, locations, compensation, constraints
- `profile.md` — compact, structured work history used for tailoring

## Steps

### 1. Data folder and existing setup

Ask: "Where should I keep your job-search data?" Default: `~/.jobsearch`
(recommended — outside this repository, so nothing personal can be
committed). Never accept a path inside the repo.

If the user wants a custom path, call the `jobsearch_set_data_dir` tool with
it — it validates the path, creates the folder, and grants this session
access. No manual configuration, no restarts.

If `profile.md` and `preferences.md` already exist, summarize their current
values and ask what to change. Only touch what the user wants changed.

### 2. Resume — have one, or build one?

Ask: "Do you have a resume already (PDF), or should I build one from your
work history?"

- **Has one**: ask them to copy it into `<data dir>/resume/`, then verify
  the file exists with the glob/read tools — never shell (it is denied for
  this flow).
- **No resume**: run the extended interview — for each role: company, title,
  dates, one line of scope, 2–3 bullets with real numbers; plus education,
  certifications, and a contact line (name, city, email, LinkedIn URL).
  Write `<data dir>/resume/base.md` with `assets/resume-template.md`
  (ATS-plain markdown). Then offer the PDF export:

      npx tsx scripts/render-resume.ts --file <data dir>/resume/base.md

  It writes `base.pdf` next to the file.

### 3. Preferences (one batch of questions)

Ask in one message, numbered, with defaults:

1. Target roles (2–4 titles)
2. Locations + work mode (city / remote / hybrid)
3. Compensation target (number + currency, or "not stated")
4. Hard constraints (visa, schedule, travel, industries to avoid)

Write `preferences.md` using `assets/preferences-template.md` from this
skill, filled in — short lines, no prose.

### 4. Work history (compact interview)

Ask for, in one batch: current/most recent role (company, title, dates),
2–3 previous roles, top 8 skills, and 3–5 concrete achievements with real
numbers where possible.

Write `profile.md` using `assets/profile-template.md`. Structured and
factual: tailoring may only use what is in this file.

### 5. Wrap up

Summarize the files written (including any PDF) and remind the user that the
first search opens a browser window where they log into LinkedIn manually,
once.

## Rules

- Never invent history details; write only what the user states.
- Keep both files compact — they are read often.
- Data lives in `~/.jobsearch` (or `JOBSEARCH_HOME`) — never in the repo.
