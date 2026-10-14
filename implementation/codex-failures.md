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

### C07 — 2026-10-14 — affected-package typecheck
- Check name: documents/AI/web targeted TypeScript invocation (slot 3/3)
- Command: `./node_modules/.bin/tsc --noEmit -p packages/documents/tsconfig.json && ...` under Node 22
- Result: FAIL before the compiler started: repository-root `node_modules/.bin/tsc` does not exist. The package-local toolchain path was not used. No retry was made under the three-check cap.
- Prior checks: supplied clean Government guide page-fact extraction PASS (slot 1); synthetic healthy/corrupt-layer selection and replacement PASS (slot 2).
- Impact: affected-package type safety is unverified. The supplied clean PDF has a healthy text layer and does not reproduce the original scanned failure. Real provider OCR is gated because accepted spending/concurrency admission is absent.
- Task disposition: NOT DONE. Do not merge or enable quality-only OCR until the compiler check, original failing scan, and SEC gate are verified with renewed authority.
