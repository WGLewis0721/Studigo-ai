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
