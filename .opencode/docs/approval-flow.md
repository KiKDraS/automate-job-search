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

A new draft gets a full audit. A revision after REJECTED gets a targeted
re-audit of the changed sections and the previous issues; a change outside
the requested fixes gets a full audit (`.opencode/agents/draft-review.md`).

## Gate 3 — Outbound confirmation (messages and posts)

Before anything is sent, published, or posted:

1. Show the final content in full.
2. State exactly what will happen and to whom or where.
3. Ask for explicit confirmation.

Approval is per action, never per session. A "yes" for one message is not a
"yes" for the next. If content changes after approval, the changed version
needs a new confirmation.

### Applications (automatic for Medium and High fits)

Every saved job scored Medium or High is eligible. The agent tailors the
resume, fills the form, and submits without asking. Low fits are skipped.

- Record every submission in `<job folder>/applied.md` and in
  `<data dir>/applications.md`; the consolidated log is what the user reviews.
- Verify the form still matches the answers before clicking Submit. Any
  difference needs to be resolved before submitting, not approved later.
- Stop on a login wall, checkpoint, CAPTCHA, or challenge; never bypass one.
  If a CAPTCHA blocks Submit, skip the job and report it
  (`browser-setup.md`).
- If a required answer is missing, a required cover letter is absent, or the
  ATS is unsupported, skip the job and report it. Do not ask in the middle of
  an autonomous run; the user reviews the log afterward.
- One application at a time. Never apply to a Low fit or a job already in
  history.
- If a submit times out, do not click Submit again. Verify the job page and
  the applied-jobs list first; the recovery steps live in the `apply` skill.
- The same rule applies to LinkedIn Easy Apply, Greenhouse, Lever, and any
  other readable form via `apply-form`.

### Posts

A LinkedIn post is one more outbound action:

- Show the exact post text and state that it will be published to the user's
  LinkedIn feed as them.
- Ask for explicit confirmation of that text.
- Publish only after that OK. The publisher verifies the composer contains the
  approved text before clicking Post; any difference needs a new OK.
- One post per confirmation. Never publish a comment, edit the profile, send a
  connection request, or schedule a post.
- If a click times out, do not click Post again; check the feed first. If
  LinkedIn shows a login wall or challenge, stop and report it.

## What does not need approval

- Reading public pages, searching, and evaluating results.
- Writing to the data directory during an approved plan (saving postings,
  history entries, drafts in progress).
- Internal subagent work inside the approved plan.
- Submitting an application to a Medium or High fit, with the record in
  `applied.md` and `applications.md`.

## Repo changes

Follow `git-flow.md`. Nothing lands on `main` without explicit user approval.

## REJECTED loop

1. `draft-review` returns REJECTED with a numbered list of issues.
2. The writer fixes exactly those issues — no unrelated rewrites.
3. Resubmit. Repeat until APPROVED or the writer reports it cannot comply.
