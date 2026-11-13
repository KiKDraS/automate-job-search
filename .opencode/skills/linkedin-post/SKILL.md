---
name: LinkedIn Post
description: "Write a story-first LinkedIn post from one real moment in the user's work: 900–1,300 characters, one idea, a clear takeaway. Publish only after the user approves the exact text."
---

# LinkedIn Post

Drafts one post at a time from a real moment in the user's work. A post is a
story, not a list of achievements. An approved post can be published by
`presence-coach`; nothing publishes without the user's per-action OK on the
exact text.

## Inputs

- `<data dir>/profile.md` and the base resume for facts.
- The story, lesson, or moment the user wants to share. The user provides it;
  never scrape the feed.
- `<data dir>/presence/story-bank.md` if it exists, so a story already told is
  not asked for again.
- The audience and the profile language. If either is unclear, ask once.

## Step 1 — Find the story before writing

If the user gave a concrete moment, use it. If not, do not assemble a post
from profile facts. Run one short interview, in one batch, and stop:

1. The last time this actually happened: a day, a place, who was there.
2. What you believed before, and what you believe now.
3. One number and how it was measured. If there is none, say "not gathered";
   never estimate.
4. Who the post is for, and who would push back.
5. What you would tell that reader to try on Monday.

Record the answers in `<data dir>/presence/story-bank.md`, dated, with the
user's own phrasing kept verbatim. Mark anything they did not confirm as
`soft`. Never invent a scene, a student, a quote, a date, or an outcome to fill
a gap.

## Step 2 — Choose one idea

Pick ONE moment and ONE point. If the material has no scene, no date, and no
figure, say so and ask for one more detail; do not pad it with a career
summary. Five points are five posts.

## Step 3 — Draft the arc

- **Hook (first 1–2 lines):** the specific moment, tension, or surprising
  result. It must work before "see more".
- **Scene:** one sentence of context, enough for a stranger to follow.
- **Turn:** what changed, what the user did, or what they got wrong.
- **Insight:** what the moment taught them, in their own words.
- **Reader:** what the reader can use, without a lecture.
- **Close:** a genuine question or a line that lingers. No "agree?", no
  "comment YES", no "share this".

Short paragraphs, one to three sentences. Use real numbers only. No motivational
poster lessons, no manufactured vulnerability, no recycled viral formats.

## Step 4 — Check the draft

- Length: 900–1,300 characters.
- One idea, one story, one takeaway.
- Every claim traces to `profile.md`, the resume, the story bank, or the user's
  brief.
- The user's register, not "LinkedIn voice". No AI vocabulary; follow
  `voice-rules.md`.
- Hashtags: at most 3, only if they help.
- Read it aloud. If it sounds like a resume bullet list, rewrite it as a scene.

## Step 5 — Save and report

Write `<data dir>/presence/posts/<YYYY-MM-DD>-<slug>.md` with the draft, the
story source, the evidence used, and `Status: draft, not posted`. Report to
Coach: file path, one-line summary, and any gap. `draft-review` runs before the
user sees it.

## Publishing an approved post

Run this only when the user explicitly asks to publish and has approved the
exact text (Gate 3, `approval-flow.md`).

1. Re-read the post file. Confirm `draft-review` approved it and the body is
   exactly the text the user approved. If anything changed, stop and get a new
   OK.
2. Navigate to `https://www.linkedin.com/feed/`. If LinkedIn shows a login
   wall, checkpoint, or challenge, stop and report it.
3. Open the post composer, paste the approved text, and verify the composer
   contains exactly that text.
4. Click Post once. Do not retry a timed-out click; check the feed first.
5. Update the post file to `Status: published`, with the date and the post URL
   if LinkedIn shows one. Report the path and URL to Coach.

## Rules

- Every claim traces to `profile.md`, the resume, the story bank, or the user's
  brief. No invented metrics, roles, dates, scenes, or stories.
- One post per request. No content calendar, no scheduling, no automation.
- No feed scraping; the user brings the story and any post context.
- No AI vocabulary; follow `voice-rules.md`.
- Never publish without the user's explicit OK on the exact text. Never
  publish a comment, edit the profile, send a connection request, or schedule
  anything.
