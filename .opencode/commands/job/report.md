---
description: "Show the latest daily report, pending items, and report actions"
---

Run `npx tsx scripts/report.ts` and show its output. Email cards include the
full body and form cards include every field used, so the user can copy from
the terminal. Report actions and company preferences are listed at the end.

To open the interactive report, run `npx tsx scripts/report.ts --open`; it
starts the localhost server when possible and falls back to the static HTML.
Use `npx tsx scripts/report.ts --serve` to print the interactive URL without
opening a browser, and `--serve --no-open` to only print it.

Do not start a search or retry.
