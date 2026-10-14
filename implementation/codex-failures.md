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

### C01 — 2026-10-14 — recheck 1 of maximum 3
- Final/task commit: CSS scope fix in this change
- Check name: focused two-mode draft/transcript/late-stream scenario
- Command or manual steps: `STUDIGO_UI_TEST_URL=http://127.0.0.1:3102 node apps/web/scripts/verify-c01-mode-state.mjs two-mode` against `next dev` on the integration head
- Environment: Node 22.23.3, pnpm 10.0.0, Playwright Chromium, viewport 1280×900, local `/dev/study` fixture
- Result: FAIL before assertions
- Failure details: Send click timed out. `.coachChat` computed height was 0. `overflow: hidden` clipped the composer, so hit-testing returned `.modeSurface.modeSurfaceFramed`.
- Suspected cause: unscoped `.coachBody { flex: 1 1 0; min-height: 0 }` collapses a content-sized Coach page. The signed-in shell already had a definite height.
- Impact: fixture could not exercise mode-owned chat. No security, privacy, mastery, or provider path was reached.
- Action: scope the zero-basis flex to `.appShell:has(.coachChat)` only. Do not rerun until that layout is in the tree under test.
- Remaining check slots: 2
- Unverified acceptance criteria: two-mode survival; pending Coach switch; this round's web typecheck.
- Task disposition: NOT DONE until the behavior checks pass on the fixed layout.
- Follow-up: rerun the two named browser scenarios only.

Resolution: After the scope fix, the same two-mode command passed, and `pending-coach` passed. Both used the two remaining slots. Web typecheck was not re-executed. Prior C01 typecheck evidence is unchanged because no TypeScript changed. Disposition: behavior proven on the fixed layout.

### C11 — 2026-10-14 — check 1 of maximum 3
- Final/task commit: pending
- Check name: web typecheck
- Command or manual steps: `npm exec --yes --package=node@22 -- pnpm --filter @studigo/web typecheck`
- Environment: isolated worktree `/workspace/work/c11-worktree`, Node 24 pnpm runtime; Node 22 package requested
- Result: FAIL
- Failure details: pnpm v11 attempted to install dependencies and purge the existing linked modules directory, then aborted with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. Typecheck did not start.
- Suspected cause: the isolated worktree had no dependency links; invoking pnpm through npm exec still ran pnpm under the environment's Node 24 runtime.
- Impact: defining feature verification; no application code was reached.
- Action: recorded and continued; do not mutate another worktree's dependency installation.
- Remaining check slots: 2
- Unverified acceptance criteria: delayed-A three-file intake; failed-A plus repeated Retry; web typecheck.
- Task disposition: NOT DONE
- Follow-up: restore dependencies within this worktree before retrying the remaining checks.

### C11 — 2026-10-14 — check 2 of maximum 3
- Final/task commit: pending
- Check name: web typecheck under Node 22
- Command or manual steps: invoke TypeScript directly with the Node 22 binary and the existing TypeScript package's `bin/tsc --noEmit`
- Environment: isolated worktree `/workspace/work/c11-worktree`, Node 22.23.3; app dependencies were not linked
- Result: FAIL
- Failure details: TypeScript emitted missing-module errors for Next, React, Supabase, workspace packages, and Node types; dependency resolution was unavailable.
- Suspected cause: the worktree had no app or workspace `node_modules` links. A temporary root link was insufficient because pnpm's package links were still absent for this checkout.
- Impact: defining feature verification; no typecheck conclusion about the changed component.
- Action: recorded, removed the temporary symlink, and stopped before the check cap.
- Remaining check slots: 1
- Unverified acceptance criteria: delayed-A three-file UI/network behavior; failed-A plus repeated Retry; clean web typecheck.
- Task disposition: NOT DONE
- Follow-up: restore isolated worktree dependencies, then run only the remaining scoped checks.

### C11 — 2026-10-14 — newly authorized validation round, 3 of 3
- Final/task commit: pending review; existing draft PR #108
- Environment: isolated `/workspace/work/c11-worktree`; Node 22.23.3; `pnpm install --offline --frozen-lockfile` completed and linked 84 packages before validation. Dependency setup did not run a check.
- Check 1, delayed-A three-file browser UI/network scenario: FAIL before upload assertions. A temporary Playwright fixture bundled the real `MaterialsPanel`, but its file input never rendered; the first run timed out waiting for the input.
- Check 2, the same scenario after adding fixture diagnostics: FAIL before upload assertions. Browser page error was `process is not defined`, leaving the fixture root empty.
- Check 3, the same scenario after defining `process.env.NODE_ENV` in the fixture bundle: FAIL before upload assertions with the same `process is not defined` page error. Some bundled dependency still expects the Node `process` global.
- Command for each run: `/workspace/.studigo-toolchain/node_modules/node/bin/node /workspace/work/c11-ui-check.mjs delayed`. The fixture lives outside the checkout under `/workspace/work/`; it is not product code.
- Impact: no application upload, process, or Retry behavior was exercised; the failed-A/repeated-Retry scenario and web typecheck were not run. There is no evidence to call C11 DONE.
- Action: retained all prior failure entries and kept application code unchanged. Further validation needs a separately authorized check round with a working browser fixture or direct app route harness.
- Remaining check slots in this newly authorized round: 0. Task disposition: NOT DONE.

### C11 — 2026-10-14 — user-authorized final verification round, 3 of 3
- Setup confirmed before checks: isolated worktree `/workspace/work/c11-worktree`; pinned Node 22.23.3 at `/workspace/.studigo-toolchain/node_modules/node/bin/node`; worktree-local `apps/web/node_modules` with Next, React and TypeScript; package-local compiler at `apps/web/node_modules/typescript/bin/tsc`. Existing frozen-lockfile dependencies were reused. No application code or server upload limits were changed to repair the fixture.
- Check 1, delayed-A browser UI/network scenario: FAIL before assertions. The panel mounted, but the standalone `about:blank` fixture observed no upload requests after file selection. The fixture did not capture its page error at timeout; missing `crypto.randomUUID` in that insecure-context fixture is consistent with the failure, not independently proven as its sole cause. This failure remains recorded.
- Check 2, failed-A/repeated-Retry browser UI/network scenario: PASS under Node 22 after adding only test-fixture browser globals and diagnostics. It also covers the delayed-A intake criterion: A/B/C issued distinct upload requests with the batch's original `study_guide` type; B/C were uploaded and queued while A's process response was held; A's server error did not stop B/C; two rapid Retry clicks produced one queued retry; B/C then A completed from `status: ready` responses. Exactly three uploads and four process requests were observed, with no page errors. No live Supabase, OCR, or provider call.
- Check 3, package-local web typecheck: PASS under Node 22.23.3 using `apps/web/node_modules/typescript/bin/tsc --noEmit --incremental false` on the unchanged C11 application implementation.
- Acceptance: the second functional check covers both delayed upload and failed/retry behavior; the first failure is a fixture failure, not a product pass. Earlier failed rounds remain above. Task disposition: DONE for C11's isolated UI/network contract, subject to normal PR review; no production/storage or OCR claim.

### C11 — 2026-10-14 — review correction after the manual cap
- Review found that each selection started its own three-worker upload pool. Overlapping selections could therefore exceed three simultaneous upload requests; the original three-file browser fixture did not cover this case. This narrowed the prior DONE claim until corrected.
- Commit `ce2e978` replaces per-selection workers with one mounted-panel queue and adds an overlapping-batch regression test; source type remains captured per selection, and the existing serialized processing queue is unchanged.
- No fourth manual validation was run. Automatic PR CI run `38612994010` passed the new regression, Node 22 typecheck, web tests and build. This is local/CI evidence, not a live Storage/OCR claim. Prior failed fixture checks remain recorded above.
