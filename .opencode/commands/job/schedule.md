---
description: "Configure the automated daily search — time, interval, model, feed, notifications"
---

Load the `schedule` skill. Request or flags: $ARGUMENTS.

Use `npx tsx scripts/schedule.ts` to show, enable, update, disable, repair, or
run the automation. Do not enable it before `/job/setup` is complete. The
default is daily at 09:00 local; the user can choose the model with
`--model provider/model`.
