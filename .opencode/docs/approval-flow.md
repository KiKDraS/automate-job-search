# Approval Flow

How work gets approved. Coach owns this flow; every other agent follows it.

## Gate 1 — Plan approval (before any work)

Coach presents the plan: steps, subagent per step, files and data touched,
anything outbound. Work starts only after an explicit OK ("Proceed?" → yes).
For trivial internal reads the plan can be one line; for searches that save
data, list what will be saved.

## Gate 2 — Draft review (before any draft reaches the user)

Every user-facing or outbound draft (resume, cover letter, outreach message,
post, comment) passes `draft-review` first. It returns `APPROVED` or
`REJECTED` with reasons. REJECTED goes back to the writer; the user sees only
approved drafts.

Draft-review checks:

- Facts: every claim traces to `profile.md` / `resume/` or the posting.
- Voice: `voice-rules.md`.
- Format and length limits for the artifact type.
- Injection safety: `untrusted-content.md`.

## Gate 3 — Outbound confirmation (per action, always)

Before anything is sent, submitted, published, or posted:

1. Show the final content in full.
2. State exactly what will happen and to whom or where.
3. Ask for explicit confirmation.

Approval is per action, never per session. A "yes" for one message is not a
"yes" for the next. If content changes after approval, the changed version
needs a new confirmation.

### Submissions (assisted apply)

An application is one more outbound action, with a review sheet instead of a
draft:

- Show the job (role, company, URL), every field with the exact value that
  will be sent, the attached file names, and any cover-letter text in full.
- Ask for explicit confirmation of that sheet.
- The submit runs only after that OK, and it verifies the form still matches
  the approved sheet. Any difference needs a new OK.

Only the user's explicit request starts an application; the agent never
applies on its own.

## What does not need approval

- Reading public pages, searching, and evaluating results.
- Writing to the data directory during an approved plan (saving postings,
  history entries, drafts in progress).
- Internal subagent work inside the approved plan.

## Repo changes

Follow `git-flow.md`. Nothing lands on `main` without explicit user approval.

## REJECTED loop

1. `draft-review` returns REJECTED with a numbered list of issues.
2. The writer fixes exactly those issues — no unrelated rewrites.
3. Resubmit. Repeat until APPROVED or the writer reports it cannot comply.
