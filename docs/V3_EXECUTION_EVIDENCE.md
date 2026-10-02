# V3 execution evidence

## Current status

Reviewed PR #59 at commit `c30094a3a2597c65a513b4b3ff6d258a2afedf43`. The handoff now distinguishes persistent Challenge me from one-shot Try a harder question, specifies uploaded prompt-injection regression coverage, and sequences V3 after study-guide P0 validation.

[CI run 36955659920](https://github.com/WGLewis0721/Studigo-ai/actions/runs/36955659920) completed successfully for that exact commit. Its workflow runs workspace typechecking, tests (including database security), game tests and the web build. This is existing CI evidence, not a fresh local run or proof of hosted/device acceptance.

The execution workspace failed to start; environment status reports offline connectivity and no command capabilities. Local tests, PDF rendering, authenticated hosted checks, RAG benchmarks and native device flows have not been run in this execution. Sonnet 6.1 and Opus are not available in this chat; no phase has been relabeled as having run on those models.

## Study-guide P0 source inspection

Inspected `apps/web/app/api/study-guide/download/route.ts` and `apps/web/lib/study-guide-pdf.test.ts`.

| Acceptance area | Source evidence | Remaining verification |
| --- | --- | --- |
| Authentication / room access | requireApiUser and assertRoomAccess precede room-scoped reads | Hosted anonymous and two-account denial checks |
| Topic edits / removals / ordering | Reads current active topics ordered by order_index | Edited/removed-topic export and re-ingestion scenarios |
| Empty-room behavior | Returns explicit errors for no topics or no chunks | Visible UI error and successful retry |
| Read-only export | Route contains reads and PDF generation, no learning-state writes | Before/after attempts, mastery and source checks |
| Download response | application/pdf, attachment filename, private/no-store | Desktop, iPhone/iPad open/share and print layout |
| PDF test | Checks PDF envelope, topic/source strings and check-yourself content | Rendering, pagination, long text, Unicode and actual citation correctness |
| Grounded source selection | Keyword scoring and linked-document filtering | Defects below must be reproduced and addressed |

## Source-selection findings to reproduce first

1. The route adds three points to every chunk from a linked document, even with no topic-term match. It also falls back to the first ranked chunk when no score is positive. An unrelated passage can therefore appear under a topic as supporting material. Add a route/source-selection regression with an unsupported topic and unrelated room chunks; require an explicit missing-support result rather than arbitrary evidence.
2. Chunk reads are capped at 1,200 without pagination or a truncation signal. Supporting material beyond that cap can be omitted. Add a room exceeding the cap and verify complete, bounded retrieval or an explicit partial/error result.
3. The document query restricts metadata to ready documents, but the chunk query does not restrict chunks to those document IDs. Verify failed/reprocessing document chunks cannot be exported with generic source metadata.

These are static findings, not executed reproductions. They do not establish a cross-user data leak.

## Gate evidence still required

Use the protocol in [USER_TEST_CASES.md](USER_TEST_CASES.md), including the P0 download case, UT-11, UT-12, UT-16 and UT-17. Record commit, hosted deployment, device/browser, fixture identifiers without private source contents, actual result, evidence location and remaining defect for each run.

- [ ] Reproduce and repair source-selection findings with meaningful tests.
- [ ] Run fresh workspace tests/typecheck/build on the implementation branch.
- [ ] Verify hosted auth and two-account isolation.
- [ ] Verify edited topic order, removed topics and unsupported-topic handling.
- [ ] Compare learning/source state before and after export.
- [ ] Open/share the PDF on desktop, iPhone and iPad; inspect printed layout.
- [ ] Perform learner trust validation and record findings.

The prerequisite gate remains open. After evidence closes it, begin Phase 1 with the existing TypeScript path as the baseline and compare Python over the same authorized Supabase data; do not treat the existing `services/retrieval` prototype as an already-selected production architecture.
