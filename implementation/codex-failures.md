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
# C04 focused Learn UI check — 2026-10-14

- Check 2/3, `node scripts/verify-c04-learn-ui.mjs` under Node 22: FAIL before the first mocked SSE request. Playwright timed out clicking the disabled Send button at line 46. The fixture navigation/fill ran without waiting for client hydration; this is a harness timing failure, not evidence that the typed outcome or cited-answer rendering works or fails. Added an explicit Learn-mode DOM wait for a future review run, but did not rerun because the three-check policy counts failed attempts and disallows retries.

### C04 newly authorized three-check round — 2026-10-14

- Check 1/3, `node scripts/verify-c04-learn-ui.mjs` (Node 24 inadvertently selected by shell): FAIL before any mocked SSE call; `.coachChat[data-chat-mode="learn"]` never appeared after Learn click.
- Check 2/3, same command after adding a React-props hydration wait (Node 24): FAIL waiting for the hydration marker before the Learn click.
- Check 3/3, `/workspace/.studigo-toolchain/node_modules/node/bin/node scripts/verify-c04-learn-ui.mjs` (Node 22.23.3): FAIL at the same hydration marker. Diagnostic showed the server-rendered Coach/Learn buttons and 33 scripts, but no React props marker and no page error. The marker may be unsuitable; this does not prove a product defect. No mocked SSE request or successful cited answer was exercised. The diagnostic harness edit was reverted. The earlier outcome-contract PASS and typecheck PASS remain recorded; neither was repeated. C04 remains NOT DONE and C05 stays ineligible.
