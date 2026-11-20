# LC-1 feasibility: layered rig result

Status: IN PROGRESS. Measurements and the go/no-go recommendation are added by task H-A. Physical-device rows stay `OPEN (human)`.

Rive research lives in [rive-licensing-notes.md](rive-licensing-notes.md). The Rive candidate (A) has not been built; only the mesh rig (B) exists.

## Baseline on laptop 2026-11-20

Machine: owner's Windows 11 laptop, local worktree `studigo-living-companion-upgrade-ee0706`. Node 22.23.5 (nvm; `.nvmrc` says 22). pnpm 10.0.0 (`packageManager` pnpm@10.0.0).

Branch `claude/studigo-living-companion-upgrade-ee0706` at `261496a` (fast-forwarded from `e55bc2d`; the two new commits are status docs from aws-dev-wgl). Distance from `origin/main`: 0 behind, 57 ahead. `main` is still `056066f` (#266), so there is nothing in companion code, `mode-header.tsx` or the room header to reconcile.

| Check | Command (repo root unless noted) | Exit | Result |
|---|---|---|---|
| Install | `pnpm install --frozen-lockfile` | 0 | lockfile unchanged |
| Typecheck | `pnpm --filter @studigo/web typecheck` | 0 | clean |
| Lint | `pnpm --filter @studigo/web lint` (AI provider boundary) | 0 | `ai provider boundary ok` |
| LC unit tests | from `apps/web`: `node --import tsx --test lib/companion-mood.test.ts lib/companion-logic.test.ts lib/companion-motion.test.ts lib/companion-mouth.test.ts lib/companion-outfits.test.ts lib/quiet-feedback.test.ts lib/mobile-lessons.test.ts` | 0 | 102 pass, 0 fail |
| Full web suite | from `apps/web`: `node --import tsx --test lib/*.test.ts` | 1 | 558 pass, 1 fail: `C19 Word file matches the PDF edition and stays editable` (needs `pymupdf`; known, unrelated, not fixed) |
| Build | `pnpm --filter @studigo/web build` | 0 | Next 16.4.6 production build succeeds |

Rive CLI (`rive doctor`, 2026-11-20): version 1.9.2 ok (1.10.0 available, not installed); **auth: not logged in** (the 2026-11-16 handoff recorded auth ok); live-link port 9640 ok; no `rive.yaml` project; adb missing (not needed). Nothing was installed or signed in.

PR #268 checks at this SHA (from `gh pr checks`, 2026-11-20): validate pass, postgres-multisession pass, Vercel pass, synthetic-four-width pending at time of reading.
