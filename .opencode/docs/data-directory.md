# Data Directory

All personal job-search data lives outside the repository, in one directory.

## Resolution

1. `JOBSEARCH_HOME` environment variable, if set (absolute path) — advanced
   setups.
2. The user config file (`~/.config/opencode/jobsearch.json`), written by
   `jobsearch_set_data_dir`.
3. `~/.jobsearch` otherwise — resolved with `os.homedir()`, so it works on
   macOS, Linux, and Windows (`%USERPROFILE%\.jobsearch`).

`npx tsx scripts/data-dir.ts` prints the resolved path and its source
(`env`, `config`, or `default`). `default` means the user has not chosen yet:
first contact asks (language first, then the location) and records the answer
— including the default — via `jobsearch_set_data_dir`.

The canonical implementation is `lib/data-dir.ts`. Scripts and skills use it;
never hand-build the path.

## Layout

```text
<data dir>/
├── resume/                    # source resume files (PDF) + extracted base.txt
├── profile.md                 # work-history interview output
├── preferences.md             # target roles, locations, compensation, constraints
├── language.md                # chat language + optional document-language override
├── job-history.md             # append-only log of every job seen
├── company-careers.json       # cache: company → careers page URL
├── outreach-history.md        # outreach log (who, when, what, status)
├── application-data.md        # reusable application answers
├── .tmp/                      # transient handoff files (safe to delete)
└── jobs/
    └── <company>-<role>-<date>/
        ├── posting.md         # saved job description (raw, delimited)
        ├── resume.md          # tailored resume
        ├── resume.pdf         # tailored resume export (uploaded by apply)
        ├── cover-letter.md    # cover letter
        ├── outreach.md        # current outreach draft: recipient, language, text, evidence
        └── applied.md         # application record: what was sent, when, confirmation
```

## Rules

- Files are created lazily: no empty scaffolds; a skill creates a file the
  first time it has real content.
- `language.md` is tiny and read at the start of every session: the chat
  language plus an optional document-language override. First contact (or
  setup) writes it; users may edit it by hand.
- `job-history.md` and `outreach-history.md` are append-only. Never rewrite
  history; corrections get new entries. Outreach rows use the statuses
  defined in the `outreach` skill.
- `<job folder>/outreach.md` is the current outreach draft: recipient (or
  "no contact"), language, text, character count, and the evidence used. The
  log is the index, not the draft.
- `.tmp/` holds transient files handed between steps (candidate lists,
  section JSON). Scripts may recreate it; deleting it is always safe.
- Saved postings keep the raw text, delimited as untrusted content (see
  `untrusted-content.md`). Do not summarize away details needed for tailoring.
- `application-data.md` holds reusable answers only — contact details,
  logistics, recurring questions. Answers come from the user, never guessed.
- `<job folder>/applied.md` is written only after a confirmed submission; it
  records the exact values sent and the confirmation text.
- The data directory is never committed, copied into the repo, or included in
  prompts that leave the session except where a skill explicitly says so.
- Paths in this repository are written with forward slashes; code resolves
  them with `path.join`, never by string concatenation.

## Custom location

First contact asks where the data should live when nothing is recorded yet
(language first, then the location); setup confirms the recorded choice
instead of re-asking. Either flow calls `jobsearch_set_data_dir` (the
`data-dir` plugin) — including when the user keeps the default, so the
choice is recorded. The tool validates the path, creates the folder, writes
the user config file (`~/.config/opencode/jobsearch.json`), and grants the
running session access. New sessions are granted automatically — no manual
configuration, no restarts.

`npm run doctor` shows the resolved path and where the choice came from.
