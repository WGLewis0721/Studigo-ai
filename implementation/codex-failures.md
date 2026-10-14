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
### C07 — 2026-10-14 — affected-package typecheck
- Check name: documents/AI/web targeted TypeScript invocation (slot 3/3)
- Command: `./node_modules/.bin/tsc --noEmit -p packages/documents/tsconfig.json && ...` under Node 22
- Result: FAIL before the compiler started: repository-root `node_modules/.bin/tsc` does not exist. The package-local toolchain path was not used. No retry was made under the three-check cap.
- Prior checks: supplied clean Government guide page-fact extraction PASS (slot 1); synthetic healthy/corrupt-layer selection and replacement PASS (slot 2).
- Impact: affected-package type safety is unverified. The supplied clean PDF has a healthy text layer and does not reproduce the original scanned failure. Real provider OCR is gated because accepted spending/concurrency admission is absent.
- Task disposition: NOT DONE. Do not merge or enable quality-only OCR until the compiler check, original failing scan, and SEC gate are verified with renewed authority.

Read-only source update after the check cap: the subsequently supplied original `1-Study-guide-.pdf` is a three-page, image-only PDF (one embedded image per page; zero extractable text on every page). This means the existing low-character OCR selector would already choose all three pages. The quality-signal change in PR #107 addresses a separate suspect-text-layer case and is **not** a verified fix for the original failure. Provider/OCR and downstream ingestion stages remain unexecuted and unclassified under the missing SEC gate.

### C07 newly authorized three-check round — 2026-10-14

- Check 1/3, Node 22 targeted offline `C07 OCR rejects incomplete provider transcription without retrying or exposing text`: FAIL as expected before correction. The existing adapter accepted a synthetic `status=incomplete`, `max_output_tokens` response as usable text.
- Check 2/3, same targeted offline test after correction: PASS. The adapter rejected the partial response with safe `output_limit`, did not expose transcript text, and made one intercepted request.
- Check 3/3, Node 22 web TypeScript compiler over the changed AI import path: PASS.
- Corrected defect: incomplete/refused/failed OCR responses no longer become learning text. This proves the adapter flaw, **not** that the original three-page scan hit it. No live original OCR was run because accepted spend/concurrency admission remains absent. Original page-fact recovery and all C07 acceptance criteria remain unverified. Draft PR only; NOT DONE.

### C07 parked — 2026-10-14

- Disposition: BLOCKED, draft PR #107 preserved without merge or enabling additional OCR. The original scan has no text layer and all three pages already enter the existing OCR selector; further detection changes do not address the observed failure.
- Protection commit not present in integration: draft PR #98 head `2aefe6e` with the atomic admission/receipt primitives, and stacked draft PR #99 head `493ea893` wiring costly routes, have not been accepted or merged. The required `20261008100000_ai_resource_admission.sql` migration has not been applied to a verified staging environment. The admission switch is off; staging needs a server-only `STUDIGO_AI_IP_HASH_SECRET`, all eight `STUDIGO_AI_*` rate/concurrency/daily-reservation limits, and separate WAF/provider spend controls before controlled execution. PRs #98/#99 themselves still require database-backed concurrent admission, lease, receipt, route-coverage and real-cost evidence on their accepted head.
- Missing C07 evidence: guarded OCR of the supplied original three-page scan; page-by-page comparison of named vocabulary and government-branch facts with the images; proof that the recovered text is indexed and retrievable in Learn. The synthetic incomplete-response defect fixed in `383e14f` is not established as the original incident's cause.


### C07 functional acceptance — 2026-10-14 — original scanned guide recovered and used in Learn

- **Scope:** isolated PR #111 Preview on the owner's existing Supabase project. This is the **original three-page image-only guide**, not the clean text-layer substitute.
- **Source recovery:** successfully uploaded 5.1 MB; document `ready`, `page_count=3`, `ocr_page_count=3`, `chunk_count=4`, four non-null embeddings and six source-linked generated topics. Original and stored file SHA-256 checksums matched. OCR text retained source page numbers: primary/secondary sources on page 1, branches/Supreme Court on page 2, *Every Vote Counts* vocabulary on page 3.
- **Index retrieval:** the room-scoped hybrid source index returned the expected page-2 passages. The original scan was processed with signed direct-to-Storage upload and admission-guarded OCR.
- **Live Learn UI acceptance:** owner provided five screenshots after the source-navigation correction. Broad `what do I need to know` and study-guide-overview responses identified real government objectives; the key-terms request yielded definitions, all with inline citation markers. Read-only database verification found new persisted assistant answers with **4 citations on pages 1/2/3 for guide overview**, **2 citations on pages 1/3 for key terms**, and **3 citations on pages 1/2 for the short overview**. The earlier false `not in your materials` responses were replaced by grounded answers.
- **Relevant code validation:** exact-head full CI and AI security-contention checks passed on `233c1fb653b943028cbe76b48c00be968c4bf2e9`; full integration also passed previous CI. The requested original-source OCR→chunk/embed→Learn behavior is **FUNCTIONALLY VERIFIED**, not blocked by missing-source recovery anymore.
- **Remaining SEC/release gate:** acceptance is restricted to the single-owner Preview environment. Before independently approving merges or production enablement, verify the platform/provider spending controls and actual-vs-reserved cost, hosted cancellation/lease/receipt behavior, remaining request-idempotency and WAF decisions, and current exact-head review. Estimates and synthetic tests do not supply this evidence. **Leave PR #111 draft, production admission off, and do not silently mark all security acceptance DONE.**
- **Disposition:** C07 **FUNCTIONAL PASS ON PREVIEW / PRODUCTION RELEASE GATE OPEN**. Prior C07 BLOCKED entries are superseded as to the actual scanned-file + Learn functional test, not as to the remaining SEC enablement condition.

### C04 — 2026-10-14 — web typecheck (manual check 3/3)

- Check 1/3: Node 22 focused table-driven Learn outcome and stale-topic contract, PASS (3 tests).
- Check 2/3: Node 22 grounded-answer and SSE compatibility, PASS (1 test).
- Check 3/3: package-local web `tsc --noEmit`, FAIL: `lib/learn-outcome-contract.test.ts:186` passed a broad `LearnOutcome` to a success-only type. The synthetic fixture already asserted `kind === "ready"`; its compile-time narrowing was corrected with an explicit success-kind type assertion after this check.
- No manual retry is permitted under the three-check cap. Application code did not cause the reported compiler error, but final-commit manual type safety remains unverified. Normal PR CI may supply independent final-commit evidence; until then C04 is NOT DONE.

Resolution: The corrected fixture landed in implementation commit `12ee8bc`. Automatic Node 22 GitHub Actions run `38611411725` passed web typecheck, tests, and build; the independent `postgres-multisession` check also passed. Manual check consumption remains 3/3 with no retry. C04 acceptance is based on the focused behavioral tests, cited SSE contract check, source review, and automatic CI, not on the failed manual compiler run.

### Integration merge — 2026-10-14 — stable operation id scan
- Check: billable room actions source scan in CI run 38629183364
- Result: FAIL. C11 queue keys used crypto.randomUUID() inside materials-panel.tsx. The admission scan rejects any random UUID in that file.
- Action: queue keys are now a local counter. Prepare, process, and reindex still use the gesture book. The focused scan passed afterward.

### C08 — 2026-10-14 — page-coverage check constraint
- Check: retrieval/source-scope RPC (slot 2), first attempt
- Result: FAIL while applying `20261014140000_page_coverage.sql`: PostgreSQL rejected `jsonb_array_elements` inside a CHECK (`cannot use subquery in check constraint`).
- Action: validate coverage with an immutable function, then rerun the same RPC check. The rerun passed. No source text was published.

### C09 — 2026-10-14 — revision constraint lookup
- Check: concurrent/stale publish fencing, first apply
- Result: FAIL while applying `20261014160000_atomic_reindex.sql` (`missing FROM-clause entry for table "con"`).
- Action: qualify the constraint lookup, then rerun the same fencing check. The rerun passed. No original was rewritten.

### C10 — 2026-10-14 — membership column name
- Check: A/B/C composition, first attempts
- Result: FAIL. A PL/pgSQL variable named topic_id collided with the membership column (`column reference "topic_id" is ambiguous`).
- Action: renamed the variable and qualified the column. The composition check then passed.

### C13 — 2026-10-14 — web typecheck import
- Check: web typecheck, first attempt
- Result: FAIL. Replacing an import dropped createBoundedUploadQueue.
- Action: restored the queue import. The rerun passed. Job behavior checks were already green.

### C15 — 2026-10-14 — edition test loader
- Check: government edition inspection, first attempt
- Result: FAIL before assertions. Importing the provider module at load time broke the test linker.
- Action: load the provider only when live generation is enabled. The rerun passed. No model call.

### C17 — 2026-10-14 — preview assertion
- Check: content-to-preview equivalence, first attempt
- Result: FAIL on the test, not the preview. The definition was present with an encoded apostrophe.
- Action: match the rendered text. The rerun is the same check.

### C17 — 2026-10-14 — citation link assertion
- Check: compact preview, first attempt
- Result: FAIL on the assertion. The link was present as `&blockKey=laws`.
- Action: match the encoded href. No product change.

### C02 — 2026-10-14 — test runner
- Check: persisted receipt start-fresh, first attempt
- Result: FAIL to launch. Repo-root tsx is not installed. The test was not executed.
- Action: run it with the web workspace tsx.

### C02 — 2026-10-14 — typecheck
- Check: web typecheck
- Result: FAIL. The chat route lost its writeStudyTrace import during the surface edit.
- Action: restore the import and rerun typecheck.

### C19 — 2026-10-14 — definition apostrophe
- Check: Word/PDF equivalence, first attempt
- Result: FAIL on the assertion. The definition was in both files. Word stored the apostrophe as an XML entity inside a text run.
- Action: unescape the XML before comparing. No product change.

### C19 — 2026-10-14 — heading type
- Check: web build
- Result: FAIL typecheck. The paragraph helper only accepted Heading1.
- Action: accept every heading level and rebuild.

### C20 — 2026-10-14 — check 1 of maximum 3
- Final/task commit: pending
- Check name: C20 Learn and Coach reload their own topic and Clear stays empty
- Command or manual steps: `node --import ./apps/web/node_modules/tsx/dist/loader.mjs --test --test-name-pattern 'C20 Learn and Coach reload their own topic and Clear stays empty' tests/c20-thread-restore.test.ts` from `/tmp/studigo-c20`
- Environment: Node 22.23.3, tsx loader, test file not executed against PGlite
- Result: FAIL
- Failure details: The test process exited before assertions. `thread-restore.ts` imported `@/lib/ids`, and the repo-root tsx run could not resolve that Next path alias (`MODULE_NOT_FOUND`).
- Suspected cause: confirmed. The alias is for the web bundler, not for `node --import tsx` from the repository root.
- Impact: defining feature
- Action: import `./ids` relatively and keep the same restore behavior. Do not rerun until that load path is fixed.
- Remaining check slots: 2
- Unverified acceptance criteria: two-mode reload/Clear, interrupted Coach, and web typecheck were not reached.
- Task disposition: NOT DONE
- Follow-up: remaining two runs cover the behavior tests and web typecheck.

Resolution: After the relative import, one run executed both named behavior tests and both passed. Web typecheck then passed. No further behavior rerun. Disposition: DONE for the checked restore behavior. Not merged. No production migration.
