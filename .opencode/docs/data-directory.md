# Data Directory

All personal job-search data lives outside the repository, in one directory.

## Resolution

1. `JOBSEARCH_HOME` environment variable, if set (absolute path).
2. `~/.jobsearch` otherwise — resolved with `os.homedir()`, so it works on
   macOS, Linux, and Windows (`%USERPROFILE%\.jobsearch`).

The canonical implementation is `lib/data-dir.ts`. Scripts and skills use it;
never hand-build the path.

## Layout

```text
<data dir>/
├── resume/                    # source resume files (PDF/DOCX)
├── profile.md                 # work-history interview output
├── preferences.md             # target roles, locations, compensation, constraints
├── job-history.md             # append-only log of every job seen
├── company-careers.json       # cache: company → careers page URL
├── outreach-history.md        # outreach log (who, when, what, status)
├── application-data.md        # reusable application answers
├── .tmp/                      # transient handoff files (safe to delete)
└── jobs/
    └── <company>-<role>-<date>/
        ├── posting.md         # saved job description (raw, delimited)
        ├── resume.md          # tailored resume
        ├── cover-letter.md    # cover letter
        └── applied.md         # application log entry (assisted-apply phase)
```

## Rules

- Files are created lazily: no empty scaffolds; a skill creates a file the
  first time it has real content.
- `job-history.md` and `outreach-history.md` are append-only. Never rewrite
  history; corrections get new entries.
- `.tmp/` holds transient files handed between steps (candidate lists,
  section JSON). Scripts may recreate it; deleting it is always safe.
- Saved postings keep the raw text, delimited as untrusted content (see
  `untrusted-content.md`). Do not summarize away details needed for tailoring.
- The data directory is never committed, copied into the repo, or included in
  prompts that leave the session except where a skill explicitly says so.
- Paths in this repository are written with forward slashes; code resolves
  them with `path.join`, never by string concatenation.
