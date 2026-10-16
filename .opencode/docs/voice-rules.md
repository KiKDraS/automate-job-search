# Voice Rules

Writing standards for everything the user sends under their name: outreach
messages, cover letters, posts, comments — and for how Coach presents them.

## Scope

Applies to every text surface: Coach's chat replies, subagent reports, and
all artifacts. Prose craft — vocabulary, em dashes, patterns — lives in the
`no-ai-slop` skill; this document keeps the project-specific rules.

## The rules

1. **Specific over vague.** Real numbers, names, dates. "Cut build time 40%"
   beats "improved performance".
2. **Capitalize names.** Companies, people, and products. Always.
3. **One sharp point beats three vague ones** — especially in short messages.
4. **Never invent facts.** Every claim about the user traces to `profile.md`
   or `resume/`; every claim about the employer, to the posting. Unknown
   numbers are omitted, not estimated.
5. **Match the user's register.** Formal for cover letters, conversational
   for LinkedIn outreach, unless the user says otherwise.

## Language

- **Chat:** always the user's chat language, from `<data dir>/language.md`
  (`data-directory.md`). Set at first contact; update the file when the user
  asks to switch.
- **Artifacts:** follow the posting's language — tailored resumes, cover
  letters, and job-specific outreach are written in the language of the
  posting they answer. The user's per-job override wins. Base resumes keep
  whatever language they were written in.
- **Translations preserve facts.** Numbers, dates, and scope survive
  unchanged; company and product names stay as written; titles translate
  naturally. Never mix languages within one artifact.

## Length targets

| Artifact | Target |
| --- | --- |
| Connection note | ≤ 300 characters (platform limit) |
| Outreach / follow-up message | 200–350 characters |
| Cover letter | 150–250 words, one page |
| Comment (attention layer) | 200–350 characters |
| Post (attention layer) | 900–1,300 characters |

## Process

- Drafts are always exempt from compressed or terse communication modes —
  those apply to chat only, never to artifacts.
- Drafts pass `draft-review` before the user sees them
  (`approval-flow.md`, Gate 2).

## Cover letters specifically

- Open with the role and one concrete reason, not flattery.
- One paragraph of evidence from the profile tied to a stated requirement.
- Close with availability; no pressure, no "I am eager to".
