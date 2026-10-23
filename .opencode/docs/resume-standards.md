# Resume Standards

Canonical writing and structure rules for every resume the toolkit produces
or reviews: the base resume (`job-setup`), tailored resumes (`tailor-resume`),
and review feedback (`resume-review`). Skills point here; they never restate
these rules.

## Structure and ATS

- Plain, ATS-friendly markdown: no tables, no columns, no graphics, no icons.
- The PDF export disables ligatures so ATS text extraction does not split
  words like "flow" or "verifications".
- Standard sections, in this order when present: contact line, summary
  (optional), experience, skills, education, certifications.
- Contact line: city/country · email · LinkedIn URL.
- 1–2 pages equivalent; trim to relevance, never pad.
- One form per name — "front-end" vs "front end", "React" vs "React.js" —
  pick one and keep it everywhere, certifications included.

## Impact

- Every bullet earns its place: what changed, for whom, how much.
- Numbers where real: counts, percentages, rates, time saved. If the user
  genuinely has no number, write the honest version without one — never
  estimate or invent.
- No process descriptions. "Worked with the back end on response handling"
  explains architecture, not impact. Write what *the user* changed.
- Prefer concrete nouns over abstractions: "v3's dashboard data model and the
  v2→v3 conversion" beats "v3 structure and data conversion".

## Voice — it must read human

- Voice rules apply (`.opencode/docs/voice-rules.md`): no AI vocabulary,
  specifics over adjectives, rationed em dashes.
- The summary is the usual tell. Shape: identity first ("Front-end developer,
  8 years, React/Next.js products"), then at most two proof points written as
  sentences. Never a stacked noun-phrase list.
- Vary sentence shapes across bullets; avoid resume clichés (spearheaded,
  leveraged, orchestrated, results-driven).
- First-person implied voice ("Built…", "Designed…"), active verbs.
- Tense: current role = present, past roles = past. No verbless fragments.

## Certifications, education, timeline

- Certifications carry issuer and year: "AI Engineering — <issuer>, 2026".
- Education: institution and status (degree, expected date).
- Timeline gaps are a deliberate choice, not an accident: ask how to
  represent them (coursework, break, freelance) before finalizing.

## Missing data: ask, never guess

When material is thin, stop and ask — in ONE batched round, numbered, before
finalizing anything. Never write around a gap.

| Trigger | The ask |
| --- | --- |
| Vague noun ("v3 structure", "data conversion") | What did it cover, and what changed? |
| Achievement without a number | Roughly how many / how much faster? |
| Certification or education missing issuer/date | Who issued it, and when? |
| Timeline gap | How should we represent it? |
| Tailoring: requirement with no evidence | Have you done this anywhere? It is not in the profile. |

If the user does not have the detail: write the honest version without it and
move on. Asking once, well, beats guessing forever.
