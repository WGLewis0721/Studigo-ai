### C01 — 2026-10-13 — automatic CI outside the three manual checks
- Final/task commit: pending CI repair on PR #104
- Check name: GitHub Actions validate, web tests
- Command or manual steps: automatic PR validation; no additional manual run
- Environment: GitHub Actions, Node 22
- Result: FAIL
- Failure details: 325 of 326 web tests passed. The static Apply test expected a one-line conversation reset and did not match the new conditional reset that also invalidates the mode-owned request identity.
- Suspected cause: confirmed stale source-pattern assertion; the focused browser behavior and TypeScript checks passed before this CI run.
- Impact: CI gate; no observed functional, privacy, integrity, security, or financial regression.
- Action: update the assertion to cover the full mode-specific reset and await automatic CI.
- Remaining check slots: 0 manual slots; automatic CI is independent.
- Unverified acceptance criteria: none in the focused browser checks; CI must pass before integration.
- Task disposition: NOT DONE until the CI gate passes.
- Follow-up: review the automatic check on PR #104 before merging into integration.

Resolution: The source assertion was updated in `d72edcc`; automatic GitHub Actions run 38503354107 passed, including web tests, typecheck and build. The three manual C01 checks remain the acceptance evidence. Disposition: DONE, accepted for integration.

### C02 — 2026-10-13 — check 1 of maximum 3
- Final/task commit: pending draft PR
- Check name: start fresh with a disposable persisted Coach receipt
- Command or manual steps: attempted local Supabase startup as test setup; the required persisted-receipt scenario could not execute. A synthetic fixture Clear interaction passed in its check slot.
- Environment: disposable local Supabase attempt; synthetic local browser fixture
- Result: UNVERIFIED
- Failure details: Supabase Postgres image unpack failed with `no space left on device` under the Docker VFS driver. No disposable database or receipt was created. Synthetic Clear preserved the other visible mode, worked in the empty state, and repeated safely, but it cannot prove receipt or mastery persistence.
- Suspected cause: local Docker image storage limit; the workspace filesystem itself had free space. The exact Docker storage quota is unconfirmed.
- Impact: defining feature; migration, RLS, archive persistence and receipt retention remain unverified.
- Action: stop local database setup; keep C02 as NOT DONE and do not integrate the draft PR.
- Remaining check slots: 0; the synthetic UI, admission unit scenario and web typecheck consumed all three.
- Unverified acceptance criteria: persisted receipt/mastery survives Clear; next send has a new correct-surface ID against real storage; RLS enforcement of wrong-owner/room/surface archive and admission.
- Task disposition: NOT DONE
- Follow-up: provide a disposable database environment with enough image storage, then assign a new authorized verification run; no production migration or live learner data.

### C02 newly authorized verification — 2026-10-14

- Check 1/3: PASS in disposable PostgreSQL 17/pgvector. The additive migration and synthetic fixtures ran in one rollback-only transaction. Authenticated Clear archived only the owner/room/surface-matched Coach conversation; repeat Clear was safe; wrong owner, room, surface and unclassified legacy threads failed under RLS. The persisted Coach turn receipt, learning event, message, Learn thread and mastery score remained unchanged, and a new unarchived Coach-surface conversation could be created. No production data or provider call.
- Check 2/3: PASS, focused Node 22 `lib/v3-learner-ui.test.ts` (10/10). This is a static compatibility check, not functional Clear proof; the earlier synthetic Clear browser interaction and admission test remain the functional/unit evidence.
- Check 3/3 remains unused. The old PR #105 automatic CI run failed in its Test step; hosted job logs could not be retrieved (log endpoint returned Forbidden), so the exact CI failure is unclassified. Do not merge until automatic CI passes and next-send identity is fully accepted.
