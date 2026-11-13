# Fit Scoring

Canonical criteria for evaluating a job against the candidate. Used by
`job-scout` when searching and by Coach when presenting a shortlist.

## Inputs

- `preferences.md` — target roles, locations, work mode, compensation,
  constraints.
- `profile.md` — work history, skills, seniority.
- The posting itself.

## Dimensions

Score each dimension strong / partial / weak:

| Dimension | Strong | Weak |
| --- | --- | --- |
| Role match | Title and scope match target roles | Different function or clearly below/above level |
| Skills | Core requirements met with evidence in profile | Missing most core requirements |
| Seniority | Aligned with experience | Off by a level or more |
| Location / work mode | Matches preferences (e.g. remote, city) | Relocation or on-site outside preferences |
| Compensation | Meets or exceeds target, or not stated | Clearly below target when stated |
| Constraints | No conflicts (visa, travel, schedule) | Violates a stated hard constraint |

## Stack check

The check compares the posting's required and optional technologies with the
stack the user explicitly confirmed in `profile.md` (`## Stack`). It never
assumes a stack: if the section is missing, the check stops and Coach asks
the user to confirm it.

    npx tsx scripts/stack-check.ts --posting <job folder>/posting.md \
      --profile <data dir>/profile.md \
      --preferences <data dir>/preferences.md

The script also merges an optional local catalog at
`<data dir>/tech-catalog.json` with the shipped `lib/tech-catalog.ts`. The
local file adds niche terms; it is personal data and never part of the repo.

It returns `targetRoles`, `sectionsFound`, `required`, `optional`, `matched`,
`requiredNotInStack`, `optionalNotInStack`, `mentioned`, and `candidates`.
`candidates` are terms in the required/optional sections that the catalog does
not recognize; they are questions for the Coach, not confirmed gaps.

A required primary-stack gap is a weak Skills dimension; usually Medium at
most. The check is advisory: the fit scorer decides. A Medium fit may still be
tailored and applied to, but the resume must not claim the missing stack. If
`sectionsFound` is false, use `mentioned` as a hint and read the posting; do
not treat every term as required. When a candidate is real, the Coach asks the
user whether to add it to their local catalog (and to `## Stack` only if they
have it).

To add a confirmed term:

    npx tsx scripts/tech-catalog.ts add --name "<Name>" --aliases "<alias,alias>"

The shipped catalog is updated by PR/release; the local overlay stays in the
data directory.

## Verdicts

- **High** — no weak dimensions; at most one partial. Save the full posting;
  eligible for automatic application.
- **Medium** — core is fine, but one dimension is weak or two are partial.
  Save the full posting and note the gap; eligible for automatic application.
  Tailor honestly and keep the gap visible.
- **Low** — two or more weak dimensions, or any hard-constraint conflict.
  Log only.

## Rules

- Never score above the evidence in `profile.md`. Unknown is not strong.
- Compensation: when unstated, write "not stated"; never estimate as fact.
- Exclude and log duplicates (same company + title + location), expired
  postings, and jobs already in `job-history.md` — unless the user asks to see
  them.
- Every verdict carries a one-line "why" and the gap, if any.
