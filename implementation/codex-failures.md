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

### C09 — 2026-10-14 — check 1 of maximum 3
- Final/task commit: uncommitted `codex/c09-atomic-reindex`, integration base `2388152963988c8b405c647e1a95c8ec66e5a8fa`; parent owns commit/PR after review.
- Check name: concurrent forced claims and stale publication fencing.
- Command or manual steps: `node --test --test-name-pattern='^C09 concurrent forced claims and stale publication are fenced$' tests/database-security.test.mjs`.
- Environment: disposable PGlite 0.3.14 with pgvector; default Node 24.19.0; synthetic fixtures only.
- Result: FAIL.
- Failure details: PGlite WASM raised `table index is out of bounds` around two seconds; teardown raised `memory access out of bounds`. No useful database assertion evidence obtained.
- Suspected cause: embedded database/runtime failure; exact cause unverified.
- Impact: defining transactional acceptance remains unverified; no production/provider calls or migration application.
- Action: stop database checks per parent instruction; no repeated harness/Docker workaround. Keep the two focused regression scenarios for later review.
- Remaining check slots: 1 after check 2, the planned affected web compiler, passed using `/workspace/.studigo-toolchain/node_modules/node/bin/node ./node_modules/typescript/bin/tsc --noEmit --incremental false` from `apps/web`.
- Unverified acceptance criteria: insertion/derivation failure leaves previous index retrievable; concurrent/stale publication fences; success exposes only new chunks; original object, receipts and mastery preserved. Preservation/success scenario not executed. Database advisors unavailable without a working disposable database.
- Task disposition: NOT DONE; no commit, push or PR performed.
- Follow-up: parent reviews isolated diff and migration; database acceptance requires a functioning disposable environment and authorization to resume after standby. SEC is absent at this base; no live provider retries performed.
