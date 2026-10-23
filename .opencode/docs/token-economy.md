# Token Economy

This project is built to work on free models with tight context budgets.
Every agent follows these rules. They are product requirements, not advice.

## Why

Free models are the primary audience. Token waste is not a cost problem here —
it is the difference between a usable tool and an unusable one. Retries are
double cost, so deterministic code is preferred over model reasoning wherever
a task allows it.

## Deterministic first

- When a task has a deterministic part (building URLs, parsing, dedupe,
  formatting, arithmetic), it belongs in `lib/` with a thin script wrapper in
  `scripts/`. Agents call the script and use its output.
- Never hand-build a URL or hand-format data the code can build.
- Wrappers print compact output designed for context, not verbose logs.
- Before tailoring, a deterministic stack check compares the saved posting
  with the stack the user confirmed in `profile.md`; it never assumes one.
  It merges the optional local catalog and returns compact `candidates` for
  unknown terms. It is cheaper than a full artifact pass.
- The shared tech catalog ships with releases; user-specific additions live
  in the data directory. Neither is loaded into the model context.

## Context budget

- `AGENTS.md` stays lean; details live in `.opencode/docs/` and are read on
  demand, never bulk-loaded.
- Skill descriptions are listed on every model step. Keep each under about
  40 words.
- Never re-read a file that is already in context.
- Prefer targeted `grep` and partial reads over full-file reads.
- Summarize long tool output immediately; never carry raw pages through a
  conversation.
- `profile.md` is shown once for explicit approval in setup; the stack is
  confirmed, not inferred. Do not re-ask on every search.

## Delegation economics

Subagents start fresh: every call costs their system prompt plus the context
handed over (roughly 2–3k tokens of fixed overhead). Delegate when:

- Browser work — page context is huge and isolation pays for itself.
- Draft review — the gate is a product feature.

Do it inline when: trivial reads, single lookups, and small writes in the
data directory. When delegating, pass excerpts and exact goals — not whole
files or histories.

## Targeted re-audits

A new draft gets a full `draft-review`. A revision after a rejection audits
only the changed sections and the previously flagged issues, plus a
regression scan. If the writer changes anything outside the requested fixes,
the audit goes back to full. One full audit per artifact, not one per
revision.

## Browser

- Browser only for login-walled flows; use `webfetch` for public pages
  (employer postings, careers pages).
- Batch browser operations into one `execute` call; never let snapshots or
  raw page text enter context (see `browser-setup.md`).
- External apply uses one ATS adapter at a time, extracts form fields as
  compact JSON, and never carries form HTML into context.
- Never take screenshots unless the user asks.
- Extraction caps: first N results (default 25), one page at a time.
- Extract with a single scoped selector; save large output to a file and read
  selectively.
- Only the browser tools we actually use are enabled; unused ones are denied
  in `opencode.jsonc` and therefore hidden from model context.

## Step budgets

Agents declare `steps` limits so a weak model cannot loop indefinitely. When
an agent nears its cap it stops and reports, rather than thrashing.

## Presence

Presence drafts (profile audit, post, comment) use the user's brief and the
approved profile only. No feed scraping, no browser, one piece at a time.

## Where to spend

Drafts (resumes, cover letters, outreach) are the one place to spend tokens
liberally — quality is the product. Everything else stays minimal.
