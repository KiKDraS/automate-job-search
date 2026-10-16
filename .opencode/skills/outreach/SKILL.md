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
2. Draft the message: short sentences, specifics, the user's register.
3. Show Coach the draft in full plus recipient and context. The user sends it
   themselves.
4. Append a log entry to `<data dir>/outreach-history.md` (append-only):
   date, company, person (or "no contact"), type, status "drafted", preview.

## Rules

- Draft-only: no sending, no connection requests, no automation.
- Never invent a person, a mutual connection, or shared history.
- No AI vocabulary; em-dash density per `voice-rules.md`.
- Language: job-tied messages follow the posting's language; otherwise the
  chat language. The user's override wins (`voice-rules.md`).
- `draft-review` before the user sees it (`approval-flow.md`, Gate 2).
