# Third-Party Notices

This project adapts ideas, workflows, and conventions from the open-source
projects listed below. Adapted material has been rewritten for this project's
architecture; notices are provided in accordance with the MIT License terms of
the originals.

## proficientlyjobs/proficiently-claude-skills

- Source: <https://github.com/proficientlyjobs/proficiently-claude-skills>
- License: MIT (as stated in the repository README at the time of adaptation;
  no separate LICENSE file was present)
- Adapted: the job-search pipeline structure (setup → search → tailor →
  cover letter → apply → network scan), shared-reference conventions,
  personal data-directory isolation, fit-scoring approach, and the
  approval-first workflow.

## sergebulaev/linkedin-skills

- Source: <https://github.com/sergebulaev/linkedin-skills>
- License: MIT — Copyright (c) 2026 Sergey Bulaev
- Adapted: skill contract conventions ("use this / not for X" descriptions),
  voice rules, untrusted-content handling, the approval-before-publish flow,
  and the attention-layer feature set (profile, posts, comments, engagement).

## petergyang/no-ai-slop

- Source: <https://github.com/petergyang/no-ai-slop>
- License: MIT — Copyright (c) 2026 Peter Yang
- Adapted: the `no-ai-slop` skill — editing rules, slop patterns, and the
  eval rubric — adopted as the house style for prose; the eval file moved to
  `references/` and the description trimmed for the token budget.

## liblaf/skills

- Source: <https://github.com/liblaf/skills>
- License: MIT — Copyright (c) 2026 liblaf
- Adapted: the `write-root-readme` skill — README structure, hero and badge
  conventions, and validation hints — including its example README references
  to liblaf/grapes and lobehub/lobe-chat.

## borghei/claude-skills

- Source: <https://github.com/borghei/claude-skills>
- License: MIT + Commons Clause — Copyright (c) 2025-2026 Amin Borghei. The
  Commons Clause condition applies: this project does not sell the software.
- Adapted: the story-first interview for LinkedIn posts — the premise that a
  generic post is a material problem, the five single-post questions, and the
  story-bank idea — rewritten for this project's `linkedin-post` skill.

## harrymunro/claude-content-skills

- Source: <https://github.com/harrymunro/claude-content-skills>
- License: MIT — Copyright (c) 2026
- Adapted: the hook / body / close post structure and the pre-publish quality
  checklist, rewritten for this project's `linkedin-post` skill.

## jamesgray007/hoai-course

- Source: <https://github.com/jamesgray007/hoai-course>
- License: no license file was present at the time of adaptation; only the
  general story arc (scene, tension, turning point, insight) was adapted, with
  no text copied.

---

The MIT License text below applies to sergebulaev/linkedin-skills. The same
MIT text applies to harrymunro/claude-content-skills with Copyright (c) 2026,
and to borghei/claude-skills with Copyright (c) 2025-2026 Amin Borghei,
subject to the Commons Clause condition stated above.

The MIT License text below applies to sergebulaev/linkedin-skills:

MIT License

Copyright (c) 2026 Sergey Bulaev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
