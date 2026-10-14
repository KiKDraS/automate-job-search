---
name: Cover Letter
description: "Write a cover letter for a saved job using the posting and the tailored resume. Use after tailoring, or without it, when the user wants a letter. Not for resumes (use tailor-resume) or outreach notes (use outreach)."
---

# Cover Letter

Produces `cover-letter.md` in the job folder. Short, specific, human.

## Inputs

- Job folder (`posting.md`, and `resume.md` if it exists).
- `<data dir>/profile.md`.
- Length target: 150–250 words, one page (`voice-rules.md`).

## Steps

1. Read the posting and profile (and `resume.md` if present). Pick ONE
   concrete reason the user fits — the strongest requirement-to-evidence
   match. Not three reasons.
2. Write `cover-letter.md`:
   - Open with the role and that concrete reason. No flattery, no "I am
     writing to express".
   - One paragraph of evidence: a real achievement with its number, tied to a
     stated requirement.
   - One short paragraph on why this role/company specifically, grounded in
     the posting — not generic praise.
   - Close with availability. No pressure, no "I am eager to".
3. Report to Coach: file path, the one-line reason chosen, and gaps.

## Rules

- Every user claim traces to profile or resume; every employer claim to the
  posting.
- 150–250 words. If it does not fit, cut — do not cram.
- No AI vocabulary; em-dash density per `voice-rules.md`.
- `draft-review` before the user sees it (`approval-flow.md`, Gate 2).
