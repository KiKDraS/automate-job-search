---
name: Job Search
description: "Search LinkedIn for new jobs matching preferences, published in the last 48 hours, score fit, dedupe against history, and save postings. Use for daily or ad-hoc searches. Not for first-time setup (use job-setup)."
---

# Job Search

Runs a search end-to-end and returns a compact shortlist to Coach. Follow the
steps in order; use the exact commands.

## Prerequisites

- `profile.md` and `preferences.md` exist in the data directory. If not, stop
  and tell Coach to run `job-setup` first.
- Browser: the first run opens a window where the user logs into LinkedIn
  manually (`browser-setup.md`). Guest discovery works without a session; the
  login is only for opening a job and applying. If a login wall appears while
  applying, stop and report "login required" — never attempt credentials or
  bypasses.

## Token discipline

- ONE `execute` call per browser step: navigate + extract together, return
  only compact JSON. Never let page snapshots enter the conversation.
- Posting bodies go to files via the `filename` parameter, never into context.
- Never read `job-history.md`; use `scripts/history.ts`.

## Steps

### 1. Resolve paths and load context

- Data directory: `npx tsx scripts/data-dir.ts` (once per run).
- Read `preferences.md` and `profile.md` once (they are small).
- Read `Excluded companies` in `preferences.md`: drop those companies before
  scoring, saving, or applying.

### 2. Build guest search URLs

Discovery uses the **guest search API**, not the authenticated
`/jobs/search/` page. The guest API has no session, no salary facet, and does
not redirect to `/jobs/search-results/`.

For each keyword set:

    npx tsx scripts/linkedin.ts guest-search-url --keywords "<terms>" --location "<place>" --posted 48h --mode remote --recent --start 0

Use `--posted 48h` for every run. This is a hard limit: only postings
published in the last 48 hours. Do not widen to week or month unless the user
explicitly asks for an exception.

Paginate with `--start 25` and `--start 50`. Stop at 60 cards, at the first
page with no cards, or on HTTP 429/999. Do not use `search-url` for discovery;
the authenticated search UI is only for opening a job and applying.

Never add `f_SAL`: the builder deletes it and the guest endpoint does not have
a salary facet. If a copied URL carries it, run `linkedin.ts clean-url`; if it
returns after one retry, stop and report instead of using the authenticated
search page.

### 3. Extract candidates from the guest API

Navigate to the guest URL. The API returns list items with a job ID, title,
company, location, posted time, and a `/jobs/view/<id>` link. One `execute`
call per page:

```js
const searchUrl = URL
await tools.playwright.browser_navigate({ url: searchUrl })
const result = await tools.playwright.browser_evaluate({
  function: `() => {
    const items = Array.from(document.querySelectorAll('li')).filter((li) =>
      li.querySelector('.base-search-card__title')
    )
    const cards = items.slice(0, 25).map((el) => {
      const link = el.querySelector("a.base-card__full-link, a[href*='/jobs/view/']")
      const urn = el.querySelector('[data-entity-urn]')?.getAttribute('data-entity-urn') || ''
      const href = link?.href || ''
      const id = (href.match(/\\/jobs\\/view\\/(\\d+)/) || urn.match(/(\\d+)$/) || [])[1] || null
      const text = (selector) => (el.querySelector(selector)?.innerText || '').trim()
      return {
        id,
        title: text('.base-search-card__title'),
        company: text('.base-search-card__subtitle'),
        location: text('.job-search-card__location'),
        posted: text('time'),
        postedAt: el.querySelector('time')?.getAttribute('datetime') || '',
        href
      }
    }).filter((card) => card.title)
    return { cards, total: items.length }
  }`
})
return result
```

If the API returns 0 cards, report "guest search empty" and stop. If it returns
429/999 or a login/challenge page, report "guest search blocked" and stop; do
not retry more than once. Keep cards without an ID in `unresolved` with title,
company, and href. Do not click cards; the guest cards expose the ID or a
`/jobs/view/<id>` link.

Skip any listing whose `postedAt` is older than 2 days; if `postedAt` is empty,
use the relative `posted` label. The posted date is the source of truth.

### 4. Dedupe and count

The guest extraction returns `{ cards, total }` per page:

- `seen`: total cards read across pages, before dedupe.
- `resolved`: cards with a numeric job ID, canonicalized to
  `https://www.linkedin.com/jobs/view/<id>/`.
- `unresolved`: cards with no ID; keep title, company, `href`, and the reason.

Merge pages, dedupe by job ID, then write only the `resolved` array to
`<data dir>/.tmp/candidates.json` (JSON array), then:

    npx tsx scripts/history.ts filter --file <data dir>/.tmp/candidates.json

The output is a JSON array with only new candidates. `filter` drops jobs
already in `job-history.md` and any job already present in `applications.md`
(by URL or company+role), even when it has no `applied.md`. Compute:

- `new` = length of the filtered array.
- `duplicates` = `resolved.length - new` (includes already applied).
- `unresolved` = the extraction's unresolved list.

If `resolved` is empty: report "no resolvable jobs" with `seen` and
`unresolved`, and stop. If the filtered array is empty: report "no new jobs"
with `seen`, `new: 0`, `duplicates`, and `unresolved`, and stop.

### 5. Score fit

Score each new candidate per `.opencode/docs/fit-scoring.md` using
preferences and profile: High / Medium / Low plus a one-line why. Score from
listing data first; do not open postings yet.

### 6. Save postings as you go (High and Medium fits)

For each High or Medium fit, one `execute` call per posting that saves the body
to a file. Prefer the guest posting endpoint so reading does not depend on the
authenticated UI:

```js
const nav = await tools.playwright.browser_navigate({
  url: `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${JOB_ID}`
})
const r = await tools.playwright.browser_evaluate({
  function: "() => document.querySelector('.show-more-less-html__markup, .jobs-description__content, .jobs-box__html-content, article')?.innerText ?? ''",
  filename: ".playwright-mcp/posting.txt"
})
return "saved"
```

If the guest body is empty, open the canonical `/jobs/view/<id>/` URL in the
authenticated browser and try the same extraction. If it shows a login wall or
is gone, note it and continue. Save each one as soon as it is confirmed — do
not wait for the whole list, so an interrupted run keeps what is already saved.

Then move it into the job folder (never read the file yourself):

    npx tsx scripts/save-posting.ts --file .playwright-mcp/posting.txt --company "<company>" --role "<role>" --url "<url>"

Then run the adaptive stack check before calling the fit High:

    npx tsx scripts/stack-check.ts --posting <job folder>/posting.md --profile <data dir>/profile.md --preferences <data dir>/preferences.md

If it exits with "no ## Stack section", stop and tell Coach to confirm the
user's stack with `job-setup`. Never guess a stack.

The script merges the optional local catalog at
`<data dir>/tech-catalog.json`. `candidates` are terms the catalog does not
know: report them so Coach can ask the user, but do not treat them as gaps.

If `requiredNotInStack` includes the posting's primary stack, note the gap;
do not claim it in the resume. A Medium fit is still eligible for automatic
application. The check is advisory; the fit scorer decides.

If a posting shows a login wall or is gone, note it and continue.

### 7. Append history (the filtered new candidates)

Use the records from step 4's `filter` output — not the raw candidate list.
Write `<data dir>/.tmp/section.json`:

```json
{ "terms": "<search terms>", "records": [
  { "title": "...", "company": "...", "location": "...", "salary": "not stated", "fit": "High", "notes": "<one-line why>" }
] }
```

Then:

    npx tsx scripts/history.ts append --file <data dir>/.tmp/section.json

`append` also drops duplicates already in history or repeated in the section,
and reports how many it skipped. If it skips rows, that is expected — do not
retry them or re-add them by hand.

### 8. Report (compact)

Return to Coach:

- Terms used and guest API URLs (`start` pages).
- Counts: `seen`, `resolved`, `new`, `duplicates`, `unresolved`, and
  High/Medium/Low.
- Unresolved IDs: title — company — `href` or card selector — reason. If none,
  say "none".
- Shortlist rows for High and Medium fits: role — company — location — job
  URL — why — folder path. Canonicalize each URL first with
  `npx tsx scripts/linkedin.ts normalize-job "<url>"`, and include the
  employer URL when one was resolved. Both fits are eligible for automatic
  application.
- Anything skipped or failed (login walls, missing postings).
- Stack check for each saved fit: `requiredNotInStack`, `optionalNotInStack`,
  and `candidates`; a missing primary stack belongs in the why.
- If you hit the step limit, report the partial result: what is saved, what
  is missing, and the `candidates.json` path. Do not restart the search.
- Verify saved folders with `read`/`glob`. Never re-run `save-posting` just
  to check a folder.

No raw page text. No posting bodies.
