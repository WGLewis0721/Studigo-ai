# Agent runbook — Living Companion v1 (self-driving loop)

For a GenAI coding agent (Cursor cloud agent / Grok Bot) working this track until v1 is done.

## 0. Read first, every session
`AGENTS.md` → `ENGINEERING.md` → `implementation/LIVING_COMPANION_V1_PLAN.md` → the one task's docs here. Do not scan the whole repo (AGENTS.md).

## 1. Verify state (before any edit)
```bash
git fetch origin --prune
git log origin/main -1 --format='%H %cI %s'
gh pr list --repo WGLewis0721/Studigo-ai --search "LC-" --state all
```
Record the SHA in the task's evidence file. If a plan assumption is contradicted by current code, current code wins; stop and report.

## 2. Pick the next task
First LC-n in the plan table whose dependencies are merged and which has no open PR. Never take two tasks at once. Never start LC-4+ before LC-1 has William's go.

## 3. Branch rule (APPROVED-BY-OWNER, Oct 25)
Branch `lc/<id>-<slug>` from current `main`; PRs target `main` as drafts and are not merged without William's approval. `AGENTS.md` requires feature branches and PRs for substantial work. GL08 overlap: LC-7 shares the event list with Guided Learn GL08 — coordinate with the GL02/UX08 owners, but the base is still `main`.

## 4. Build and test (apps/web scripts on main)
```bash
pnpm install --frozen-lockfile
pnpm --filter @studigo/web typecheck   # tsc --noEmit
pnpm --filter @studigo/web lint        # AI-boundary check
pnpm --filter @studigo/web test        # node --test lib/*.test.ts (includes companion-logic.test.ts)
pnpm --filter @studigo/web build
```

## 5. Evidence format
`design/living-companion/evidence/LC-n.md`: task, commit SHA, preview URL, commands + exit codes, screenshots/videos (paths), QA row IDs passed/failed, measured numbers with device/browser, known gaps. Never claim untested verification.

## 6. Stop conditions (stop and report to Red Ranger)
- Any change would write mastery/grades/progress/evidence, touch Supabase/RLS, or call a model provider.
- Phase 3 geometry (tuck, rail) would change.
- Art identity drifts (wings, new face/vest/tail) or needs new generated art.
- LC-1 misses its 7-day cap or fails criteria 3/4.
- CI red twice on the same cause; plan contradicts code; a secret or sign-in is needed.

## 7. Needs human sign-off (William)
LC-1 go/no-go and identity; renderer choice; performance targets (after first measurement); each outfit's art; voice delivery for LC-10; any new art; flag enablement; merging to main; production deploy.
