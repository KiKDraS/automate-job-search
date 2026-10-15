# Git Flow

Canonical flow for this repository. `release-manager` executes it; everyone
else requests operations through Coach.

## Branches

| Branch | Meaning | Lifetime |
| --- | --- | --- |
| `main` | Released, stable | permanent |
| `develop` | Integration, next release | permanent |
| `feature/<name>` | One change, from `develop` | deleted after merge |
| `release/vX.Y.Z` | Stabilization, from `develop` | deleted after back-merge |
| `hotfix/<name>` | Urgent fix, from `main` | deleted after back-merge |

Bootstrap exception: the first commits (Phases 1–2) landed directly on
`main`/`develop` before agents existed. Everything after follows this flow.

## Feature flow

1. `feature/<name>` branches from `develop`.
2. Commit in small, conventional steps (`feat:`, `fix:`, `docs:`, `chore:`).
3. Push; open a PR to `develop` with a summary and the checklist.
4. Merge is **squash**; delete the branch after merge.

## Release flow

1. `release/vX.Y.Z` branches from `develop`; only stabilizing commits.
2. Pre-release gate (defined in the release-manager contract) must pass.
3. PR to `main`; merge is a **merge commit**; tag `vX.Y.Z`; GitHub Release.
4. Back-merge `main` into `develop` (never rewrite `develop`).
5. Delete the release branch.

## Hotfix flow

Same as release, but branched from `main`, version bumped as a patch.

## Rules

- Every merge is a PR. No direct pushes to `main` or `develop`.
- Never force-push any shared branch. Never delete `main` or `develop`.
- Only `release-manager` pushes, opens PRs, merges, or tags.
- Run discrete git commands, one per shell call. Compound commands are
  decomposed by the permission scanner and can be denied mid-chain.
- Merge to `main` requires explicit user approval, relayed through Coach.
- No secrets, tokens, or personal data (`data-directory.md`) in any commit.
