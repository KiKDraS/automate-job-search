---
name: LinkedIn Post
description: "Write a LinkedIn post from the user's real work: one specific story with a clear takeaway, 900–1,300 characters. Draft-only; the user posts. Use when the user wants a post."
---

# LinkedIn Post

Drafts one post at a time from real work. Nothing is published by an agent;
the user posts.

## Inputs

- `<data dir>/profile.md` and the base resume for facts.
- The story, lesson, or achievement the user wants to share. The user provides
  it; never scrape the feed.
- The audience and the profile language. If either is unclear, ask once.

## Steps

1. Pick ONE concrete story: a problem, what the user changed, the result.
   If the user has not chosen one, propose 2–3 from the profile and ask which.
   Do not invent details.
2. Draft:
   - **Hook**: the specific situation or result, not a generic question.
   - **Context**: enough for someone outside the project to follow.
   - **What changed**: the user's decision or work, with real numbers.
   - **Takeaway**: one sentence the reader can use.
   No engagement bait, no "agree?", no fake vulnerability.
3. Length: 900–1,300 characters. Short paragraphs, the user's register.
   Hashtags: at most 3, only if they help; never a wall of tags.
4. Write `<data dir>/presence/posts/<YYYY-MM-DD>-<slug>.md` with the draft,
   the evidence used, and `Status: draft, not posted`.
5. Report to Coach: file path, one-line summary, and any gap or fact the user
   must confirm. `draft-review` runs before the user sees it.

## Rules

- Every claim traces to `profile.md`, the resume, or the user's brief.
  No invented metrics, roles, dates, or stories.
- One post per request. No content calendar, no scheduling, no automation.
- No AI vocabulary; follow `voice-rules.md`.
- No feed scraping; the user brings the story and any post context.
- The user posts. Never publish, schedule, or connect on their behalf.
