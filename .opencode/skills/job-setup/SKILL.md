---
name: Job Setup
description: "One-time onboarding: resume, preferences, work-history profile, application answers, and optional daily automation. Use for first-time setup or refreshing preferences. Not for job searching (use job-search)."
---

# Job Setup

Coach runs this in conversation; it creates the files the rest of the toolkit
reads. Keep it to one batch of questions at a time.

## Files created

- `resume/` — the user's source resume file(s)
- `preferences.md` — targets, locations, compensation, constraints
- `profile.md` — compact, structured work history used for tailoring
- `application-data.md` — reusable contact and application answers
- `automation.md` — optional scheduled search (created only if enabled)

## Steps

### 1. Data folder and existing setup

Run `npx tsx scripts/data-dir.ts` first — it prints the path and its source.
If the source is `env` or `config`, the user already chose: confirm the path
in one line, and change it only if they want (then call
`jobsearch_set_data_dir` with the new absolute path). If the source is
`default`, ask: "Where should I keep your job-search data?" Default:
`~/.jobsearch` (recommended — outside this repository, so nothing personal
can be committed). Never accept a path inside the repo, and always call
`jobsearch_set_data_dir` with the chosen path — it validates, creates the
folder, records the choice, and grants this session access. No manual
configuration, no restarts.

Then confirm the chat language: read `<data dir>/language.md`. If it is
missing, ask the bilingual question (`coach.md`, "First contact") and write
the file; if present, confirm it in one line and change it only if the user
wants.

If `profile.md` and `preferences.md` already exist, summarize their current
values and ask what to change. Only touch what the user wants changed. If
`profile.md` exists but has no `## Stack`, ask the stack question once
(step 4). Before the first search, show the profile for explicit approval
(step 5).

### 2. Resume — have one, or build one?

Ask: "Do you have a resume already (PDF), or should I build one from your
work history?"

- **Has one**: ask them to copy it into `<data dir>/resume/`, then verify
  the file exists with the glob/read tools — never shell (it is denied for
  this flow). If it is a PDF, extract the text once so every later step can
  read it:

      npx tsx scripts/resume-text.ts --file <data dir>/resume/<name>.pdf

  It writes `<name>.txt` beside the PDF. Scanned or image-only PDFs are
  reported, not written — then ask the user to paste the resume text or
  share a text-based export (DOCX included). Offer a `resume-review` pass
  before continuing.
- **No resume**: ask which language the resume should be in — English is
  common for international roles; the chat language works for local markets.
  Then run the extended interview — for each role: company, title,
  dates, one line of scope, 2–3 bullets with real numbers; plus education
  (with institution), certifications (with issuer and year), and a contact
  line (name, city, email, LinkedIn URL). Write `<data dir>/resume/base.md`
  with `assets/resume-template.md`, following
  `.opencode/docs/resume-standards.md`. Before finalizing, run one batched
  clarification round for anything vague or missing (standards: "Missing
  data: ask, never guess"). Then offer the PDF export:

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

Then propose the `## Stack` split from the resume and the skills answer:
which technologies are **Primary** and which are **Working knowledge**. Show
the proposal and ask the user to confirm, correct, or add missing terms.
Never write the section from inference alone; write only what the user
confirms.

Write `profile.md` using `assets/profile-template.md`. Structured and
factual: tailoring may only use what is in this file.

### 5. Profile approval

Show `<data dir>/profile.md` in full and ask for explicit approval in the
user's chat language (for example, "Does this look right?"). Only after the
explicit OK, use it for tailoring or search. If the user changes anything,
update the file and show the changed lines again.

For an existing profile, do this once before the first search that uses it.
If `## Stack` is missing, propose it from the resume and ask for confirmation
first.

### 6. Application answers

Ask in one batch, prefilled from the resume and preferences:

- Full name, email, phone, location, LinkedIn, GitHub or portfolio.
- Authorized to work in Argentina; needs sponsorship; can issue contractor
  invoices; will keep residing/working where the employer can contract.
- Rate, current company, notice period, earliest start, relocation, work mode,
  salary expectation.

Write `<data dir>/application-data.md` using the bullets from the `apply`
skill. Never guess: if the user does not know an answer, write `not recorded`
and note that automated forms needing it will be skipped and queued.

### 7. Automation

Only after the profile is approved and `application-data.md` exists. Ask in
one batch, with defaults:

1. Enable the automated search? (default no; explain what it does)
2. Time (09:00)
3. Frequency (`daily` or `every 12h`)
4. Model (default OpenCode model, or `provider/model`; `opencode models` lists them)
5. Include feed search? (yes)
6. Notifications? (yes)
7. Standing auto-apply for Medium/High? (yes)
8. Maximum applications per run? (0 = no cap)
9. Runtime cap in minutes? (60)

If the user says yes, run:

    npx tsx scripts/schedule.ts enable --time "09:00" --interval daily \
      --notify --feed --apply --max-applications 0 --max-runtime 60

Add `--model "<provider/model>"` only when the user chose one. Show the
summary: schedule, next run, model, OS scheduler, and how to change it with
`/job/schedule`. If the OS scheduler fails, show the exact error.

If the user says no, do not install anything; `/job/schedule` stays available.

### 8. Wrap up

Summarize the files written (including any PDF), the automation status, and
remind the user that the first search opens a browser window where they log
into LinkedIn manually, once.

## Rules

- Never invent history details; write only what the user states.
- Never write `## Stack` from inference alone; write only the user's
  confirmed Primary / Working knowledge split.
- Show `profile.md` for explicit approval before any skill uses it.
- Never install the scheduler before the profile is approved and
  `application-data.md` exists. Automation is optional; the user must confirm.
- Keep both files compact — they are read often.
- Data lives in `~/.jobsearch` (or `JOBSEARCH_HOME`) — never in the repo.
