---
name: Profile Audit
description: "Audit the user's LinkedIn profile against target roles and draft headline, About, and experience suggestions. Draft-only; the user edits the profile. Use when the user asks for profile feedback."
---

# Profile Audit

Reviews the user's current LinkedIn profile against the roles they want, then
drafts concrete copy they can paste. Nothing is published or edited by an
agent.

## Inputs

- `<data dir>/profile.md`, the base resume, and `preferences.md`.
- The user's current profile text: headline, About, experience, skills. The
  user pastes it; never scrape LinkedIn or use a browser.
- `<data dir>/language.md` for the profile language. The profile may be in a
  different language from the chat; ask once.

## Steps

1. Read the profile, resume, and target roles. Note the gaps between what the
   profile proves and what the target roles ask for.
2. If the current profile text is missing, ask for it in one batch:
   headline, About, experience entries, and skills. Do not guess or fetch it.
3. Audit, in this order:
   - **Targeting**: does the headline name the role the user wants?
   - **Evidence**: are claims specific and backed by the resume/profile?
   - **Keywords**: do the target roles' real terms appear naturally?
   - **Consistency**: titles, dates, and names match the resume.
   - **Seniority**: the scope described matches the real work.
   List only gaps that change the copy. No generic advice.
4. Draft suggestions in the profile language:
   - **Headline** — role + specialty + one proof; ≤ 220 characters.
   - **About** — 3–5 short paragraphs: what the user does, two concrete
     achievements with real numbers, what they are looking for; ≤ 2,600
     characters.
   - **Experience** — 2–4 bullets for the most relevant roles, using real
     numbers from the profile/resume; reorder skills to lead with the target.
   Mark each block as "copy/paste"; keep notes separate.
5. Write `<data dir>/presence/profile-audit.md` with the audit, the suggested
   copy, and the evidence used. Do not publish or change LinkedIn.
6. Report to Coach: file path, the top three changes, and any missing facts.
   `draft-review` runs before the user sees it.

## Rules

- Never invent achievements, numbers, titles, dates, or skills.
- No keyword stuffing; every keyword must be backed by evidence.
- No AI vocabulary; follow `voice-rules.md`.
- Keep the user's real voice; the audit is a proposal, not a rewrite of who
  they are.
- Draft-only: the user edits their profile. No browser, no publishing.
