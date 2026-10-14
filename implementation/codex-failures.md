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
