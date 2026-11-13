---
name: Job Search
description: "Search LinkedIn for new jobs matching preferences, score fit, dedupe against history, and save postings. Use for daily or ad-hoc searches. Not for first-time setup (use job-setup)."
---

# Job Search

Runs a search end-to-end and returns a compact shortlist to Coach. Follow the
steps in order; use the exact commands.

## Prerequisites

- `profile.md` and `preferences.md` exist in the data directory. If not, stop
  and tell Coach to run `job-setup` first.
- Browser: the first run opens a window where the user logs into LinkedIn
  manually (`browser-setup.md`). If a login wall appears, stop and report
  "login required" — never attempt credentials or bypasses.

## Token discipline

- ONE `execute` call per browser step: navigate + extract together, return
  only compact JSON. Never let page snapshots enter the conversation.
- Posting bodies go to files via the `filename` parameter, never into context.
- Never read `job-history.md`; use `scripts/history.ts`.

## Steps

### 1. Resolve paths and load context

- Data directory: `npx tsx scripts/data-dir.ts` (once per run).
- Read `preferences.md` and `profile.md` once (they are small).

### 2. Build search URLs

Pick 1–3 keyword sets from the target roles in `preferences.md`. For each:

    npx tsx scripts/linkedin.ts search-url --keywords "<terms>" [--location "<place>"] [--posted week] [--mode remote] [--recent]

Use `--posted week` for a first run, `--posted 24h` for daily runs.

### 3. Extract candidates (one execute call per URL)

Batch navigate + extract; return only the fields needed, capped at 25:

```js
const nav = await tools.playwright.browser_navigate({ url: URL })
const r = await tools.playwright.browser_evaluate({
  function: "() => Array.from(document.querySelectorAll('li.scaffold-layout__list-item')).slice(0, 25).map(li => { const a = li.querySelector('a[href*=\"/jobs/view/\"]'); return { title: (a?.innerText ?? '').trim(), company: (li.querySelector('.artdeco-entity-lockup__subtitle')?.innerText ?? '').trim(), location: (li.querySelector('.artdeco-entity-lockup__caption')?.innerText ?? '').trim(), posted: (li.querySelector('time')?.innerText ?? '').trim(), url: (a?.href ?? '').split('?')[0] } }).filter(x => x.title && x.url)"
})
return r
```

If the result is empty, take ONE `browser_snapshot` with a small `depth` to
find the current list container, fix the selector, and retry once. If it is
still empty, report the failure with the page URL.

### 4. Dedupe

Write the candidates array to `<data dir>/.tmp/candidates.json` (JSON array),
then:

    npx tsx scripts/history.ts filter --file <data dir>/.tmp/candidates.json

Output is JSON with only new candidates. If empty: report "no new jobs" with
counts and stop.

### 5. Score fit

Score each new candidate per `.opencode/docs/fit-scoring.md` using
preferences and profile: High / Medium / Low plus a one-line why. Score from
listing data first; do not open postings yet.

### 6. Save postings as you go (High and Medium fits)

For each High or Medium fit, one `execute` call per posting that saves the body
to a file. Save each one as soon as it is confirmed — do not wait for the
whole list, so an interrupted run keeps what is already saved:

```js
const nav = await tools.playwright.browser_navigate({ url: POSTING_URL })
const r = await tools.playwright.browser_evaluate({
  function: "() => document.querySelector('.jobs-description__content, .jobs-box__html-content, article')?.innerText ?? ''",
  filename: ".playwright-mcp/posting.txt"
})
return "saved"
```

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

- Terms used, URLs searched, counts: new / High / Medium / Low, skipped
  duplicates.
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
