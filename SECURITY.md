# Security Policy

## Supported versions

Only the latest release on `main` is supported. Older tags are kept for
reference but do not receive fixes.

## Reporting a vulnerability

Open a private GitHub Security Advisory:

https://github.com/KiKDraS/automate-job-search/security/advisories/new

Do not open a public issue for a vulnerability. Include:

- steps to reproduce;
- the affected version or commit;
- the impact;
- any suggested fix.

Never include personal data, credentials, tokens, or job-search data in the
report.

## Scope

- Personal data directory handling (`JOBSEARCH_HOME`, `~/.jobsearch`).
- Browser automation, session handling, and credential boundaries.
- Untrusted job postings, messages, and prompt-injection handling.
- Application logs and application-email drafts.
- Secrets or personal data committed to the repository.

## What this project does not do

- It does not store credentials or tokens in the repository.
- It does not solve or bypass CAPTCHAs, logins, or challenges.
- It does not send messages, publish posts, or submit applications without the
  user's explicit request or the documented automatic-apply rule.
- It does not run high-volume scraping or engagement automation.

## Response

Best effort, no SLA. We will confirm receipt, assess the report, and coordinate
a fix and disclosure date with the reporter.
