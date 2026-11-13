---
name: Log Application
description: "Record an application the user sent manually or outside the agent: write applied.md and append applications.md. Use when the user reports a manual submission."
---

# Log Application

Records an application the user already sent. This skill never submits
anything and never talks to an ATS.

## Inputs

- The job folder under `<data dir>/jobs/` with `posting.md` inside.
- What the user knows: date, method (manual, email, LinkedIn, Greenhouse,
  Lever), confirmation text, fit if known, and any note.
- The resume filename, if one was sent.

## Steps

1. Find the job folder by company and role. If it does not exist, save the
   posting first (`job-search` / `save-posting.ts`). If the posting is gone,
   create a minimal `posting.md` with the role, company, URL, and
   `Saved: <date>`; never invent a posting body.
2. Ask only for what is missing: date, method, and confirmation. If the user
   has no confirmation text, use `User reported manual submission on <date>`
   and say so in the record.
3. Write `<data dir>/.tmp/manual-application.json`:

   ```json
   {
     "role": "<role>",
     "company": "<company>",
     "url": "<job URL>",
     "method": "<manual | email | LinkedIn | Greenhouse | Lever>",
     "fit": "<High | Medium | not recorded>",
     "source": "user",
     "status": "submitted (manual)",
     "date": "<YYYY-MM-DD>",
     "resume": "resume.pdf",
     "confirmation": "<what the user saw, or the reported line>",
     "note": "<optional context>",
     "fields": [{ "label": "<label>", "value": "<value>" }]
   }
   ```

   Include in `fields` only what the user confirms was sent. Never reconstruct
   answers from memory.
4. Run:

       npx tsx scripts/apply-log.ts --folder <job folder> --file <data dir>/.tmp/manual-application.json

   It writes `<job folder>/applied.md` and appends or updates the row for that
   folder in `<data dir>/applications.md`.
5. Report both paths. State that the record is user-reported; never claim the
   agent submitted it.

## Rules

- The user's report is the source. Do not invent a confirmation, a date, a
  method, or an answer.
- Manual records use `source: "user"` and `status: "submitted (manual)"`.
- One record per job. If `applied.md` already exists, do not overwrite it
  unless the user says the earlier record is wrong. Re-running the logger
  updates the `applications.md` row for the same folder instead of duplicating
  it.
- This skill does not browse, does not fill forms, and does not submit.
