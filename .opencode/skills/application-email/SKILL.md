---
name: Application Email
description: "Draft a short application email for a feed lead that publishes an email address. Draft-only; the user sends."
---

# Application Email

Drafts one email for a feed lead that includes an email address. It never
sends, never opens a mail client, and never handles credentials.

## Inputs

- The feed lead file in `<data dir>/feed/` with `- Email:`.
- `<data dir>/profile.md`, the base resume, and `voice-rules.md`.
- The post text for the role and requirements.
- The job folder's tailored `resume.pdf` when one exists; otherwise the base
  resume is the attachment the user will send.

## Steps

1. Confirm the feed lead has an email address. If it does not, stop and report.
2. Draft:
   - **To:** the address from the feed lead.
   - **Subject:** `Application — <role> — Anahí Foresi` in the post's language.
   - **Body:** 120–180 words.
     - Greeting.
     - The role and where it was seen (the LinkedIn post).
     - Two or three proof points from the profile that match the post:
       React.js/TypeScript in production, identity capture at 1,000+
       verifications/day, React.js to Next.js migration with 15% faster loads,
       remote from Argentina, English C1. Use only what the post asks for.
     - Mention the attached resume.
     - Close with availability for a call.
   - No invented facts, no rate unless `preferences.md` states one, no
     "I am passionate" filler.
3. Write `<data dir>/feed/<same-slug>-email.md`:

   ```md
   # Application email — <role> at <company>

   - To: <address>
   - Subject: <subject>
   - Status: draft, not sent
   - Source: feed/<lead-file>.md
   - Attach: resume.pdf

   ## Body

   <body>

   ## Evidence

   | Claim | Source |
   | --- | --- |
   | ... | ... |
   ```

4. Print the `mailto:` handoff (do not open it):

       npx tsx scripts/mailto.ts --file <data dir>/feed/<slug>-email.md

   Report to Coach: file path, the `mailto:` link, one-line summary, and any
   gap. `draft-review` runs before the user sees it.

## Rules

- Draft-only. Never send, never use SMTP/API, never open a mail client.
- Use only the email address present in the feed lead; never guess or build
  one from a name and domain.
- Every claim traces to `profile.md`, the resume, the post, or the user's
  brief.
- Follow the post's language; the user's per-job override wins.
- No attachments are created here. The user attaches `resume.pdf` when sending.
