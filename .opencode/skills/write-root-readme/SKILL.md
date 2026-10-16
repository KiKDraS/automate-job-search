---
name: write-root-readme
description: Write or rewrite the repo-root README.md.
---

# Write Root README

## Scope

- The root README is user documentation: what the project is and how to use
  it. Development material belongs in `SPEC.md`, `AGENTS.md`, and
  `.opencode/docs/` — do not move it into the README.
- Update the README in the same change as any user-visible feature, never as
  a follow-up.
- These formatting conventions (hero, badges, emoji headers) govern the
  README; prose drafts follow the `no-ai-slop` skill.

## Guidelines

- files to update:
  - `README.md` in the repo root
- Read [example-readme.md](./references/example-readme.md): reference structure + style.
- Badges are encouraged. See example README for useful badges.
  - Prefer badges in example README when applicable.
  - Prefer badges with live data over static badges.
- Emojis in headers are optional and must never be generic decoration
  (✨ 🚀 💬 🤖 📝 💸). Use a specific emoji only when it genuinely fits the
  section; otherwise leave the header plain. The reference example predates
  this rule — do not copy its generic emoji headings.
- Hero section is encouraged. Follow the format in example README strictly.
  - GitHub Socialify for project image. Generated image includes logo, title, description, badges: stars, forks, issues, pulls.
  - Include link to docs if exists.
  - Badges in hero section are encouraged. Limit hero section to 8 badges.
  - Limit hero section to 4 links.
  - Include a rule after hero section.
- License section is encouraged. Follow the format in example README strictly.
- DO NOT use relative links in README.
- Favor bold, comprehensive rewrites over minor or incremental edits.
- Keep README concise.

## Validation

- Run `rumdl fmt .`. Treat its findings as weak hints, not strong constraints.
- Spot-check commands, links, and tool names against the actual repo files before finishing.
