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
