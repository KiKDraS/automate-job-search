---
name: Resume Review
description: "Review the base resume and recommend concrete improvements. Use when the user asks for CV feedback. Not for tailoring to a job (use tailor-resume)."
---

# Resume Review

Reviews the base resume against `.opencode/docs/resume-standards.md` and
returns concrete, prioritized feedback. Facts only — suggestions never invent
or estimate.

## Inputs

- The resume text in `<data dir>/resume/`: `base.txt` (extracted from a PDF),
  `base.md` (built here), or any `.txt`/`.md`. If only a PDF exists, extract
  it first:
  `npx tsx scripts/resume-text.ts --file <data dir>/resume/<name>.pdf`
  (scanned PDFs are reported — ask the user to paste the text instead).
- `<data dir>/profile.md` for verification.
- `<data dir>/preferences.md` for target-role relevance.
- The standards: `.opencode/docs/resume-standards.md`.

## Steps

1. Read the resume, profile, and target roles.
2. Evaluate against every standards section: structure and ATS, impact,
   consistency, summary shape, voice ("reads human"), certifications and
   timeline.
3. Write `<data dir>/resume/review.md`:
   - **Top 3 improvements** first — each quotes the exact line, explains the
     problem in one sentence, and gives the concrete fix.
   - Then the full findings, grouped by section, same format.
   - **Questions** last — the batched asks for anything missing (standards:
     "Missing data: ask, never guess"). When data is thin, these are the
     review's most valuable part.
4. Report to Coach: file path, the top 3, and the question count.

Advice is not an outbound artifact — the review itself does not go through
`draft-review`.

## Applying the review

When the user wants the improvements applied: ask the batched questions
FIRST, then rewrite the base resume with the answers (still facts-only, to
the standards). The rewrite is an artifact — it passes `draft-review` before
the user sees it (`approval-flow.md`, Gate 2).
