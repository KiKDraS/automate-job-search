# LinkedIn UI Patterns

Working reference for LinkedIn pages. LinkedIn changes its DOM often — treat
selectors as hints, verify against the live UI, and prefer accessible
roles/text over CSS class names.

## Jobs search URL

`https://www.linkedin.com/jobs/search/?keywords=<terms>&location=<place>`

Useful query parameters:

| Param | Meaning | Values |
| --- | --- | --- |
| `f_TPR` | Date posted | `r86400` (24h), `r172800` (48h), `r604800` (week), `r2592000` (month) |
| `f_WT` | Work mode | `1` on-site, `2` remote, `3` hybrid |
| `f_E` | Experience level | `1` internship … `6` executive |
| `f_AL` | Easy Apply only | `true` |
| `geoId` | Location ID | numeric; prefer `location` text unless a stable id is known |
| `sortBy` | Sort order | `DD` (most recent) |

Parameter names can change; if a filter visibly fails to apply, verify
manually in the UI and update this document.

## Reading a results page

- Results are cards: title, company, location, posted time, and the job URL.
  Extract only those fields (see `browser-setup.md`).
- Paginate deliberately: one page at a time, cap results per run.
- Mark and exclude "Promoted" cards from scoring.

## Reading a posting

- Capture both the LinkedIn URL and, when available, the employer's own
  careers-page URL.
- Extract the description body once into `posting.md`, URL at the top. Full
  text, not a summary, delimited as untrusted content.
- Some postings offer "Easy Apply". The apply skill fills it, verifies the
  Review step, and submits in the same run; the review sheet is recorded in
  `applied.md` (`approval-flow.md`, "Applications").

## Assisted apply (Easy Apply)

The `apply` skill drives this flow. Selectors are hints — verify against the
live UI.

- Apply controls: the job page shows "Easy Apply" in the top card and the
  bottom bar (`button.jobs-apply-button`). If it says "Applied", stop.
- Modal: `[role="dialog"]` containing the form; the header shows
  "Apply to <Company>" and "X of Y" progress.
- Steps: Contact info (email, phone, country, resume) → additional questions
  (dynamic: text, textarea, select, radio, checkbox) → Review. Footer
  controls: "Back", "Review"/"Next", "Submit application", "Dismiss".
- Resume: an "Upload resume" control inside the Contact info step opens the
  file chooser; `browser_file_upload` takes the absolute path. Previously
  uploaded resumes can also be selected.
- Review: the form's own summary of every field, the resume filename, and an
  optional cover-letter text area. This summary is the review sheet the agent
  records in `applied.md` after submitting.
- Confirmation: the modal switches to "Your application was sent…" — capture
  the exact text before closing. Never click Submit twice.
- "Easy Apply" missing, "Applied" shown, or a redirect to an employer site →
  stop and report. Greenhouse/Lever redirects go to `apply-external`; other
  ATS are out of scope.

## Post search for hiring leads (job search)

- Default: LinkedIn content search,
  `https://www.linkedin.com/search/results/content/?keywords=<encoded>&datePosted=%22past-week%22&sortBy=%22date_posted%22`.
  LinkedIn has no 48-hour content filter; keep only posts whose relative time
  is `min`, `h`, `1 d`, or `2 d`.
- Results use `main div[role="listitem"]`; the page scrolls inside `main`.
  Scroll to `scrollHeight - 300`, not the absolute bottom.
- Save post text to a file with the `filename` option. Skip promoted posts and
  candidate posts (`#OpenToWork`, "busco trabajo").
- Post URLs are often absent in content results; use `not available`, never
  invent one. Author + post text identify the lead.
- Home feed fallback (only when asked): `https://www.linkedin.com/feed/`,
  selector `div[data-testid="mainFeed"] div[role="listitem"]`, scroll `main`
  with `main.scrollBy(0, 800)`.
- No likes, comments, connection requests, messages, follows, or reposts.

## Messaging and connections (attention layer)

- Connection notes: 300-character maximum; the outreach skill supplies the
  content.
- Messaging: draft into the composer and stop before Send; the user sends.
- Respect limits: no mass connection requests, no bulk messages.

## Never automate

- Applications outside the automatic Medium/High flow; sends and posts without
  per-action user confirmation (`approval-flow.md`).
- CAPTCHA/challenge solving, auth bypass, or credential entry.
- High-volume fetching, fake accounts, or engagement automation.
- Profile scraping beyond what the current task needs.

When a pattern fails twice, stop and report it with a screenshot reference;
fix and update this document as part of the same change.
