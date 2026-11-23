# Apply review file

Every apply skill writes `<job folder>/apply-review.md` after it fills a form
and before it submits or stops. The report reads this file to show the apply
URL, every field and value used, what is still blank, the CAPTCHA state, the
blocker, and the resume to send — so the user can finish the application even
if the browser tab is gone.

## Format

```md
# Apply review — <role> at <company>

- URL: <apply URL>
- ATS: <ATS name or page>
- Fit: <High | Medium>
- Status: <submitted | blocked | captcha | needs_answer>

## Filled state

| Field | Value |
| --- | --- |
| <label> | <value> |

## Pre-marked checkboxes

- <label>: <state>

## Still blank

- <required label>

## CAPTCHA

<what appeared and when, or "None">

## Blocker

<exact reason the run stopped, or "None">
```

## Rules

- Write the file after the form is filled, before submitting. On a stop
  (CAPTCHA, missing answer, account wall after filling), write it before
  returning.
- One table row per field, with the value that was entered. Keep the form's
  own labels; do not translate them.
- `Still blank` lists required fields with no answer. Optional blanks go in
  the table as `left blank`.
- `CAPTCHA` names the challenge; never store a token or cookie.
- `Blocker` is the exact stop reason; use `None` after a successful submit.
- Never write passwords, tokens, or cookies. Personal data is expected and
  stays in the data directory.
