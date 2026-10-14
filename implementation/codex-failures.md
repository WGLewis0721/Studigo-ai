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

### C09 — 2026-10-14 — separately authorized second validation round (3/3 used)
- Environment: disposable PostgreSQL 17 with pgvector in a Docker container; repository migrations and synthetic Auth/Storage catalogs only. No production database or provider calls.
- Check 1: concurrent/stale SQL scenario stopped on a psql variable-quoting error after fixture creation. No acceptance assertion completed. FAIL.
- Check 2: corrected combined SQL scenario stopped on a fixture `topics` INSERT missing the `owner_id` value. No publication assertion completed. FAIL.
- Check 3: corrected scenario reached concurrent claims but its `dblink_get_result` call waited inside the transaction holding the document lock required by the second connection. The query was canceled in the disposable database. No acceptance assertion completed. FAIL.
- Root cause of these three failures: test-harness defects; they do not establish a product defect or a pass. The earlier PGlite WASM failure and earlier pre-guard Node 22 typecheck remain recorded above.
- Remaining checks: 0. Final-head typecheck, failure preservation, concurrent/stale fencing, successful replacement, and history preservation remain unverified. Disposition: NOT DONE. No production migration, provider execution, commit, push, or merge.

### C09 — 2026-10-14 — check 1 of maximum 3
- Final/task commit: `f4c8900`, draft PR #109, integration base `2388152963988c8b405c647e1a95c8ec66e5a8fa`.
- Check name: concurrent forced claims and stale publication fencing.
- Command or manual steps: `node --test --test-name-pattern='^C09 concurrent forced claims and stale publication are fenced$' tests/database-security.test.mjs`.
- Environment: disposable PGlite 0.3.14 with pgvector; default Node 24.19.0; synthetic fixtures only.
- Result: FAIL.
- Failure details: PGlite WASM raised `table index is out of bounds` around two seconds; teardown raised `memory access out of bounds`. No useful database assertion evidence obtained.
- Suspected cause: embedded database/runtime failure; exact cause unverified.
- Impact: defining transactional acceptance remains unverified; no production/provider calls or migration application.
- Action: stop database checks per parent instruction; no repeated harness/Docker workaround. Keep the two focused regression scenarios for later review.
- Remaining check slots: 1 after check 2, the planned affected web compiler, passed using `/workspace/.studigo-toolchain/node_modules/node/bin/node ./node_modules/typescript/bin/tsc --noEmit --incremental false` from `apps/web`. Review then added an empty-topic guard; the final head was not rechecked.
- Unverified acceptance criteria: insertion/derivation failure leaves previous index retrievable; concurrent/stale publication fences; success exposes only new chunks; original object, receipts and mastery preserved. Preservation/success scenario not executed. Database advisors unavailable without a working disposable database.
- Task disposition: NOT DONE; no commit, push or PR performed.
- Follow-up: database acceptance requires a functioning disposable environment and authorization to resume after standby. SEC is absent at this base; no live provider retries performed.
