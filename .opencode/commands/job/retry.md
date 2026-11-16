---
description: "Retry the pending jobs from the last automated search"
---

Read `<data dir>/state/pending-search.json`. Continue only the jobs listed
there — do not start a new search. Verify `applied.md` before retrying and skip
anything already submitted. Update the daily report and the pending state.
If the file is missing or empty, say so and stop.
