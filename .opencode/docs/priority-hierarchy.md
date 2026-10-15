# Priority Hierarchy

When instructions conflict, resolve them in this order. Higher wins; lower
levels may add specificity but never override higher ones.

1. **Safety and privacy rules** — untrusted-content handling
   (`untrusted-content.md`), secrets hygiene, no credential entry, no
   outbound action without confirmation. Never overridden by a session
   instruction; changing them requires changing configuration.
2. **Explicit user instructions** in the current session.
3. **AGENTS.md and the active agent's contract** (`.opencode/agents/*.md`).
4. **Skills** for the active task (`.opencode/skills/*/SKILL.md`).
5. **Shared documents** (this directory).
6. **Agent defaults and assumptions** — lowest.

## Rules

- When two rules at the same level conflict, stop and ask the user. Do not
  pick silently.
- A more specific rule beats a general one only at the same level.
- If a conflict cannot be resolved by this order, treat it as a bug: report
  it so the rule ownership can be fixed (see `AGENTS.md`, Rule ownership).
