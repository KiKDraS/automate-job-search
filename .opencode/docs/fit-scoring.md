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

Before scoring a fit High, run the deterministic stack check on the saved
posting:

    npx tsx scripts/stack-check.ts --posting <job folder>/posting.md \
      --profile <data dir>/profile.md [--resume <data dir>/resume/base.md]

It extracts a curated set of mismatch-prone technologies (Angular, .NET,
C#, Java, PHP, Vue, Svelte, Unity, PixiJS, Flutter, Node.js, AWS, ...) and
reports which are absent from the profile/base resume. A missing primary
stack is a weak Skills dimension: score Medium at most and do not tailor.
The check is a heuristic, not a verdict — the requirements still decide.

## Verdicts

- **High** — no weak dimensions; at most one partial. Save the full posting.
- **Medium** — core is fine, but one dimension is weak or two are partial.
  Note the gap; do not save the full posting.
- **Low** — two or more weak dimensions, or any hard-constraint conflict.
  Log only.

## Rules

- Never score above the evidence in `profile.md`. Unknown is not strong.
- Compensation: when unstated, write "not stated"; never estimate as fact.
- Exclude and log duplicates (same company + title + location), expired
  postings, and jobs already in `job-history.md` — unless the user asks to see
  them.
- Every verdict carries a one-line "why" and the gap, if any.
