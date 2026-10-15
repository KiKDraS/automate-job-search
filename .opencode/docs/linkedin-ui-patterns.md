# LinkedIn UI Patterns

Working reference for LinkedIn pages. LinkedIn changes its DOM often — treat
selectors as hints, verify against the live UI, and prefer accessible
roles/text over CSS class names.

## Jobs search URL

`https://www.linkedin.com/jobs/search/?keywords=<terms>&location=<place>`

Useful query parameters:

| Param | Meaning | Values |
| --- | --- | --- |
| `f_TPR` | Date posted | `r86400` (24h), `r604800` (week), `r2592000` (month) |
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
- Some postings offer "Easy Apply"; note it, but never submit. Assisted apply
  (later phase) stops before Submit by contract.

## Messaging and connections (attention layer)

- Connection notes: 300-character maximum; the outreach skill supplies the
  content.
- Messaging: draft into the composer and stop before Send; the user sends.
- Respect limits: no mass connection requests, no bulk messages.

## Never automate

- Applications, sends, or posts without per-action user confirmation
  (`approval-flow.md`).
- CAPTCHA/challenge solving, auth bypass, or credential entry.
- High-volume fetching, fake accounts, or engagement automation.
- Profile scraping beyond what the current task needs.

When a pattern fails twice, stop and report it with a screenshot reference;
fix and update this document as part of the same change.
