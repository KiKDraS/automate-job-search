---
name: Outreach
description: "Draft LinkedIn outreach: connection notes (300 chars max), messages, and follow-ups. Draft-only — the user sends. Use for warm intros or follow-ups on saved jobs. Not for cover letters (use cover-letter)."
---

# Outreach

Drafts LinkedIn messages that sound like the user. Nothing is ever sent by an
agent.

## Inputs

- Job or company context (the job folder, or Coach's brief).
- Person details only if the user provided them (name, role). Never guess.
- `<data dir>/profile.md`; length limits in `voice-rules.md`.
- `<data dir>/language.md` for any document-language override.

## Steps

1. Pick the message type:
   - **Connection note** — 300 characters max. One specific hook tied to the
     person or company, one line on the user. No "pick your brain".
   - **Message / InMail** — 200–350 characters. Context, one concrete value
     point, one clear ask.
   - **Follow-up** — 200–350 characters. Reference the previous touch, add
     one new piece of value, keep it light. At most two follow-ups per
     thread, then stop.
2. Write `<job folder>/outreach.md`: recipient (or "no contact"), language,
   the draft, character count, and the evidence used. This file holds the
   current draft; a revision replaces the text and keeps the evidence list.
3. Show Coach the draft in full plus recipient and context. `draft-review`
   runs before the user sees it. The user sends it themselves.
4. Append a row to `<data dir>/outreach-history.md` for every draft version
   or status change. On first use, create the file with this header:

   ```md
   # Outreach history

   Append-only. One row per draft version or status change. The agent never
   sends; `sent` means the user confirmed sending.

   | Date | Company | Person | Type | Status | Preview |
   | --- | --- | --- | --- | --- | --- |
   ```

   Statuses: `drafted` (written), `rejected` (`draft-review` rejected it),
   `approved` (`draft-review` passed it), `sent` (the user confirmed
   sending). Coach reports the review outcome and the send confirmation;
   append the matching row when it does. If an existing header says "Nothing
   here has been sent", replace that sentence when you add the first `sent`
   row. Add the version or a short note in the preview when there is more
   than one. Append-only: a revision or status change is a new row, never an
   edit (`data-directory.md`).

## Rules

- Draft-only: no sending, no connection requests, no automation.
- Never invent a person, a mutual connection, or shared history.
- No AI vocabulary; em-dash density per `voice-rules.md`.
- Language: job-tied messages follow the posting's language; otherwise the
  chat language. The user's override wins (`voice-rules.md`).
- `draft-review` before the user sees it (`approval-flow.md`, Gate 2).
