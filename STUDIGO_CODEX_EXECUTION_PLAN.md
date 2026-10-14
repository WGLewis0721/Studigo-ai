# Studigo — Codex execution plan

**Track:** document learning reliability and readable study guides.  
**Prepared:** 2026-10-13 America/Chicago (2026-10-14 UTC).  
**Repository:** [WGLewis0721/Studigo-ai](https://github.com/WGLewis0721/Studigo-ai).  
**Integration target:** `integration/document-learning-reliability`.  
**Inspected baseline:** `4d5eb989aac4f38ab487eb40d348fb22c65a0ed0`; parent/main at PR creation: `6294a0d48bd89739cd197f4c25094df8ee4a706c`.  
**Existing release PR:** [#102](https://github.com/WGLewis0721/Studigo-ai/pull/102), OPEN, integration → main.  
**Scope authority:** current `STUDIGO_DOCUMENT_INGESTION_AND_STUDY_GUIDE_PLAN.md`, version 2, 36,429 bytes; read with repository contracts and the actual integration code. This file is the sole executable queue for this track. `implementation/ENGINEERING_PLAN.md` remains the broader engineering backlog. No application code, database, merge, or production deployment is authorized by this planning deliverable.

## A. Current implementation baseline

Inspection establishes source-level implementation boundaries. No new application tests or authenticated production experiments were run for this plan. Existing PR validation is reported evidence, not independently reproduced evidence. A green Vercel status proves a deployment check, not learning quality or database migration readiness.

| Requirement | Classification | Current evidence and remaining boundary |
|---|---|---|
| Private uploads, per-document IDs, format adapters, room/owner-scoped retrieval | Implemented; source verified | Upload/process routes, `packages/documents`, `lib/retrieval.ts`, migrations. Preserve these paths; live ownership checks remain release evidence. |
| Separate visible Learn/Coach histories | Implemented in integration; reported checks | PR #102 adds `messagesByMode` and mode-captured streaming updates. The PR reports UI/type checks, and the retrieved Vercel status is success. Do not rebuild this correction. |
| Complete mode isolation | Partially implemented | `coach-panel.tsx` still shares draft, busy, error, and scroll behavior. Separate conversation refs already exist. C01 completes state ownership. |
| Safe Clear, server mode identity, Next topic | Not implemented | Chat validates room identity but not authoritative conversation surface; UI derives the first selected topic. C02–C03 add safe lifecycle and cursors. |
| Reload restoration | Partially implemented | Server messages persist; the visible transcript initializes empty. C20 restores the correct active mode/thread. |
| Single-topic Learn lesson | Partially implemented | `/api/learn` uses title/objective/key terms; `explainTopic` returns a cited outline. Reuse it. All-topic coverage and typed failure outcomes are missing: C04–C06, C21. |
| OCR/vision and text normalization | Partially implemented | Existing per-page recovery and `OCR_TEXT_THRESHOLD = 90`. OCR text is appended to thin text; no page-quality/partial-coverage contract. C07–C08 improve it. |
| Multiple uploads | Partially implemented | Per-file errors allow the loop to continue, but each file awaits full processing before the next upload. C11 removes that head-of-line wait. Do not claim only the first file is ever accepted. |
| Reindex and index preservation | Partially implemented | Claim RPC and cooldown exist. Force reset is not an atomic claim; chunks are deleted before all inserts/derivation succeed. C09 preserves the last usable revision. |
| All-source topics/corpus | Partially implemented | Retrieval can search ready documents. `refresh_topic_map` skips teacher-material topic updates when a ready guide exists; guide refresh narrows memberships and can retire unrelated topics. C10 composes objective/support memberships. |
| Hybrid retrieval | Already implemented; activation unverified | Existing optional full-text/vector RPC and `STUDIGO_HYBRID_RETRIEVAL`. Reuse only if the targeted known-term fixture needs it; no replacement retriever or blind cutoff reduction. |
| Versioned normalized source blocks | Not implemented | Extraction has pages/chunks, not persisted reading-order blocks with revision/coverage. `canonical-topic-view.ts` is learner-evidence projection, not a canonical document. C12 supplies the document projection without duplicating mastery. |
| Durable ingestion outside learner request | Not implemented | `/api/documents/process` still waits on `processDocument`. Existing Supabase-backed worker decision is retained. C13–C14 add resumable jobs and a bounded Node runner. |
| Grounded composed educational content | Not implemented | Export selects two word-overlap chunks/topic. No shared persisted `StudyGuideContent` edition. C15–C17 create educational content and lifecycle. |
| PDF publication | Partially implemented | Authenticated private/no-store download exists. Hand-built Helvetica PDF strips Unicode and slices excerpts at 520 characters; invalid date formatting is unchecked. C18 replaces publication, not auth. |
| Editable Word, native share/save | Not implemented | No DOCX exporter. Existing blob URLs are temporary local URLs. C19/C22 add editable export and honest file sharing. |
| Mobile lessons, recovery controls, companion safety | Partially implemented | Existing design system, companion, and responsive CSS remain the baseline. C21 resolves concrete layout/navigation defects; C23 adds optional restrained feedback. |
| Expanded provider work safely enabled | Blocked for live execution until existing protection work is proven | Spending/concurrency/retry fixes from PRs #98/#99 and the seven-blocker remediation must be integrated and verified at the actual chosen head. Baseline routes show a daily reservation, not proof of enforceable provider spend or durable receipts. Do not duplicate that remediation here or infer it is merged. |
| Separate PDF/DOCX facts, generic OCR replacement, deletion-based Clear, first-topic defaults | Obsolete/superseded | One content edition feeds every renderer; improve existing extraction; archive/start fresh; use explicit topic IDs. |
| Phase 0 reproduction/audit, speculative agent/framework, broad benchmarks | Superseded or deferred | Existing evidence becomes task fixtures. No investigation-only tasks. The wider onboarding/payments/native-client/game backlog is unchanged and outside this track. |

### Requirement coverage

| Master-plan area | Executable outcomes |
|---|---|
| T0 isolated windows, T1 identity/Clear, T2 navigation, T3 mobile | C01–C03, C20–C21 |
| L1 selected-topic semantics, L2 retrieval/outcomes, L3 lessons | C03–C06, C21 |
| Phase 1 extraction/coverage | C07–C08, C12 |
| Phase 2 all-document composition and source replacement | C09–C10, C24 |
| Broader engineering P1 durable ingest / P2 canonical source | C12–C14, C24 |
| Phase 3 typed educational content/caching | C15–C17 |
| Phase 4 readable on-screen/PDF/Word publication | C17–C19, C22 |
| Phase 5 upload/recovery/update UX and safeguards | C04, C08, C11, C16, C21–C24; existing security release gate |
| Reproduce/instrument | Reused named fixtures and content-free outcome metadata inside the implementation tasks; no standalone audit task |

## B. Ordered execution queue

**24 tasks: 12 P0, 11 P1, 1 P2.** Estimates are implementation planning ranges, not guarantees. Default execution is serial in table order. A dependency means its accepted commit is present in integration before branching. Independent work may use the parallel lanes below. P0 C24 is late because its consumers do not exist earlier; it remains a release blocker.

| ID | Priority | Deliverable | User-facing gain | Dependencies | Status |
|---|---|---|---|---|---|
| C01 | P0 | Complete mode-owned chat state | Drafts, loading, errors, and scrolling stay with their chat | PR #102 head | NOT STARTED |
| C02 | P0 | Safe Clear with server surface identity | Start fresh in one mode without losing progress | C01 | NOT STARTED |
| C03 | P0 | Independent topic navigation | Visit every chosen topic in each mode | C02 | NOT STARTED |
| C04 | P0 | Typed Learn outcomes and recovery | Honest errors instead of false missing-material replies | — | DONE |
| C05 | P0 | Contextual Learn retrieval | Short follow-ups and known terms use the current topic | C04 | NOT STARTED |
| C06 | P0 | Enumerated unit overview | Every selected topic has a supported section or explicit gap | C03, C05 | NOT STARTED |
| C07 | P0 | Quality-driven page recovery | Scans retain readable definitions and reading order | — | FUNCTIONAL PASS ON PREVIEW — SEC RELEASE GATE OPEN |
| C08 | P0 | Page coverage and partial-source handling | Unreadable pages are identified; readable pages remain useful | C04, C07 | DONE |
| C09 | P0 | Atomic reindex publication | A failed refresh keeps the previous usable index | — | NOT STARTED |
| C10 | P0 | All-source topic composition | Added notes enrich lessons without replacing teacher scope | C09 | NOT STARTED |
| C11 | P0 | Independent multi-file intake | File B uploads while file A is still being read | — | NOT STARTED |
| C12 | P1 | Versioned normalized source blocks | Lessons and guides retain exact source locations | C08, C09 | NOT STARTED |
| C13 | P1 | Durable ingestion admission/status | Queued work and retries survive a closed page | C09, C11 | NOT STARTED |
| C14 | P1 | Resumable bounded ingestion runner | Reading resumes after interruption without redoing finished work | C12, C13 | NOT STARTED |
| C15 | P1 | Grounded educational content edition | Definitions, explanations, examples, practice and answers | C10, C12 | NOT STARTED |
| C16 | P1 | Automatic build/rebuild lifecycle | Guide readiness and update availability are clear | C14, C15 | NOT STARTED |
| C17 | P1 | Readable study-guide preview | Read the composed guide and inspect its citations in-app | C15 | NOT STARTED |
| C18 | P1 | Student-ready PDF | Readable print layout with intact Unicode and complete sentences | C15 | NOT STARTED |
| C19 | P1 | Editable Word export | Edit the same guide in Word | C15 | NOT STARTED |
| C20 | P1 | Restore active threads on reload | Return to the correct lesson/Coach conversation | C03 | NOT STARTED |
| C21 | P1 | Mobile lessons and accessible controls | Progress, Clear, Next and citations work on iPhone/iPad | C06, C08, C17, C20 | NOT STARTED |
| C22 | P1 | Export save/share actions | Save or share actual PDF/Word files on mobile | C17, C18, C19 | NOT STARTED |
| C23 | P2 | Quiet companion/progress feedback | Brief, optional feedback without interrupting learning | C21 | NOT STARTED |
| C24 | P0 | Cross-surface source revision invalidation | Replaced/deleted source facts stop being taught as current | C06, C10, C16, C18, C19, C20 | NOT STARTED |

### Parallel lanes and ownership

- Initial independent branches: **C01, C04, C07, C09, C11**. C04 owns Learn outcomes/engine contracts; C01 owns chat state. C07 owns extraction/OCR; C09 owns ingest claim/publish. If either requires the other's file, agree on a small shared interface and land one before editing that file.
- After C15: **C17, C18, C19** can run in parallel. C17 owns preview, C18 PDF, C19 DOCX. Shared content types/design tokens belong to C15. C18/C19 may add private renderer modules in parallel, but serialize changes to the download route, package manifests and lockfile.
- **C20** can run alongside source/guide work after C03; it owns conversation hydration, not document jobs or guide rendering.
- C01 → C02 → C03 → C06 → C20 → C21 are serialized where they touch `coach-panel.tsx`. C07 → C08 → C12 and C09 → C10/C13 → C14 are serialized around ingestion/schema contracts. C16 owns guide-job lifecycle.
- C24 lands after its consumers. Do not delegate concurrent edits to shared SQL RPCs, chat orchestration, or lockfiles. Separate feature branches/worktrees do not resolve semantic conflicts.
- Parallelism is optional. This plan identifies safe assignments; it does not instruct the planning assistant to spawn agents. Each Codex assignment stops at its own PR.

## C. Individual Codex task cards

### Shared execution contract and context budget

Dispatch **one card**, this compact contract, and the prerequisite commit references to a fresh Codex task. Do not paste the entire master plan, every card, historic chats, screenshots, audit reports, or all skills. Repository `AGENTS.md` remains applicable; this track's user-specified three-check cap overrides broader suggestions to run suites.

1. Fetch integration; verify prerequisites and preserve owner changes. Create `codex/cNN-<slug>` from the latest accepted integration head. Never code directly on integration. Use an isolated worktree for parallel work.
2. Read root `AGENTS.md`, the relevant map entries in `ENGINEERING.md`, applicable directory instructions, and the card's named files. Start with at most six implementation files, one relevant existing test, and one specialist contract section. Open direct dependencies only as needed; this is a context target, not a ban on necessary code. Use scoped `rg` and bounded file ranges; avoid whole-tree dumps, logs with student content, and unrelated subsystems.
3. The card supplies the outcome; start implementing after that bounded read. Do not repeat the investigation. If a path moved, find its current owner once. If a prerequisite is absent, report that exact commit/dependency as BLOCKED rather than rebuilding it.
4. Reuse current provider, extraction, Supabase, learning, and UI boundaries. Model calls stay in `packages/ai`; software owns authorization, job state, revisions, topic navigation, and grading authority. Protect RLS, student privacy, AI limits, pending Coach receipts, and mastered history. No production credentials/content in fixtures or logs.
5. Choose the card's checks before running them. Three individual checks maximum, including retries; no passing rerun without directly affected code changes. A focused scenario may contain assertions about that one behavior; do not hide a large suite under one command. Failure does not replenish the allowance.
6. Commit the implementation and failure/evidence record before ending. Open a focused PR **to integration**, including acceptance evidence and checks consumed. Do not merge main or deploy production. Update this task's tracker row only; do not rewrite the plan. Stop after the assigned task. The caller chooses the next eligible card after review/integration.
7. DONE means every binary criterion has observable evidence at the final commit. If a defining criterion fails or remains unverified after the check cap, use NOT DONE. Missing environment/dependency before meaningful implementation is BLOCKED. A local/fixture PASS does not mean production verified.

**Handoff:** `ID; status; user-visible gain; commit; PR; integration base SHA; checks used 0–3; criteria passed/missing; failure-log path; next eligible dependency.` One short paragraph or table; no new strategic plan.

### Vendor-neutral AI engineering contract

These are implementation patterns, not instructions to install LangChain, Haystack, an agent SDK, another vector store, or a new queue service. Preserve the existing TypeScript/provider layer and 1536-dimensional embedding contract. Portability means interchangeable interfaces and explicit capability handling; it does not mean all transports support the same vision/JSON features.

| Pattern | Concrete boundary in this queue |
|---|---|
| Ports/adapters | New semantic functions accept typed inputs and return validated domain results. SDK responses/model IDs stay inside `packages/ai`; UI/domain types do not expose provider response objects. C07/C15 reuse existing transport selection. Missing vision/structured capability produces a typed unsupported-capability result, never a silent provider switch. |
| Deterministic workflow/state machine | Topic cursors, source eligibility, leases, retries and publish decisions are code/SQL. No autonomous model decides progression, writes mastery, picks a user's room, or recursively retries. C03/C13/C14. |
| Retrieval-augmented generation | Retrieval and generation are separate observable stages. Per-topic scope, source priority, evidence sufficiency and abstention are explicit. C04–C06/C10. Preserve the existing hybrid option rather than adding a framework. |
| Typed intermediate representations | Normalized source blocks and `StudyGuideContent` are versioned domain artifacts. On-screen/PDF/DOCX are deterministic projections; changing font/color makes zero AI calls. C12/C15/C17–C19. |
| Provenance and evidence validation | Every substantive generated claim, term, example, practice answer references allowed source block/chunk IDs and revision/location. Schema and citation membership checks are necessary but do not prove semantic truth; inspect the named factual fixture. Unsupported fields are explicit, not invented. C15/C24. |
| Bounded generation and repair | Set input/output/time/call budgets before provider work, reserve for all permitted attempts, and permit at most one validated repair within that reservation. Refusal/absent evidence is not repaired by inventing facts. SDK retries count toward the same application budget. C07/C14/C15. |
| Idempotent artifacts and transactional publication | Snapshot key = owner + room + ordered source revisions + topic-scope revision + explanation level + schema/prompt version. Identical requests reuse a receipt/edition. Concurrent writers need database uniqueness/locks, not in-memory flags. C09/C13/C15/C16. |
| Task-focused evaluation | One behavior fixture plus one relevant adverse condition when needed. Semantic quality is checked against source facts, not an arbitrary “95% quality” score or generator self-praise. At most three checks, no open-ended evaluator loop. |
| Content-free observability | Record operation kind, outcome, counts, duration, usage totals and schema/prompt version through existing trace hooks. Keep raw prompts, student text, OCR text and source filenames out of telemetry. Correlation IDs are access-controlled. No analytics infrastructure task. |
| Untrusted-source boundary | Uploads, filenames, topic text and retrieved passages remain data, never privileged instructions. Deterministic ownership checks precede service-role writes and source reads. Keep `asUntrustedMaterial` and existing boundaries. |

**Existing security prerequisite SEC:** before real provider executions, use the accepted spending/concurrency/receipt/forced-reindex protection from the existing remediation track. If absent, implement with disposable fixtures/adapters and keep new workloads disabled. This is an enablement gate, not a reason to stop unrelated UI work. Do not claim SEC passed from the old daily-budget helper. No second admission ledger. Final verification requiring real providers remains explicitly unverified/BLOCKED until SEC is proven; task completion evidence must state its environment.

**Fixture set:** six active Government topics in stable `order_index`; three source pages covering the named government definitions/branches; supporting note B and slide C with unique facts relevant to those objectives; one unreadable page; one deliberately unsupported topic; a source replacement. Retrieve the original uploaded government files from the master-plan attachments when real OCR/factual checks need them. Synthetic fixtures are clearly labeled and cannot stand in for verifying the original scan at release. Inspect only the fixture needed by the card.

### C01 — Complete mode-owned chat state

**Priority / size:** P0; 60–90 minutes. **Dependencies:** PR #102 head already in integration.

**Gain / deficiency:** Learn and Coach retain their own drafts, errors, loading and scroll positions. PR #102 isolates messages, but the remaining state is shared.

**Read/change:** `apps/web/components/room/coach-panel.tsx`; its existing composer/thread imports; relevant `apps/web/lib/v3-learner-ui.test.ts` case. Add one small hook/reducer beside the panel only if it simplifies ownership.

**Required changes:** mode-key draft/error/pending-stream/request generation/scroll. Capture surface and logical thread identity at send time; late events update only that thread. Switching makes no new model call. Only the streaming mode disables its Clear/Next/send controls; switching never implies provider cancellation. Do not rewrite the engines, preferences, or completed message separation.

**DONE iff:** two drafts and two transcripts survive four switches; an error/loading response stays with its originating mode; a late delta never changes the other transcript; return restores that mode's scroll; switching submits no answer and writes no mastery.

**Checks (maximum 3):** (1) focused two-mode draft/transcript/late-stream scenario; (2) one pending Coach switch scenario with unchanged evidence; (3) web typecheck. Use behavior assertions, not only source regexes.

**Deliver/stop:** branch `codex/c01-mode-state`, committed code and focused PR to integration. Apply shared safety/context/failure rules; stop when all criteria are evidenced, otherwise NOT DONE/BLOCKED; never exceed three checks.

### C02 — Safe Clear and authoritative conversation surface

**Priority / size:** P0; 90–120 minutes. **Dependencies:** C01.

**Gain / deficiency:** Clear starts fresh in one chat while preserving the other chat and earned history. Server currently accepts a room-owned conversation without validating its surface.

**Read/change:** `coach-panel.tsx`, `app/api/chat/route.ts`, `lib/coach-interaction.ts`; relevant conversation/Coach receipt migrations. Add an additive conversation-surface/archive migration and a small authenticated start-fresh route/RPC if needed.

**Required changes:** server-controlled surface metadata for new Learn/Coach conversations; preserve standalone legacy Ask behavior as a distinct purpose. Validate owner, room, surface and active thread before reuse/provider admission. Legacy unclassified conversations are preserved; do not guess their mode or destructively backfill. Start fresh archives the current mode's thread, clears its UI/draft/pending context, and creates the new thread on the next send. No DELETE of conversations/messages/evidence. Clear is visible in empty state, disabled for that mode's active stream; confirmation says earlier chats remain stored and mastery is kept.

**DONE iff:** Clear Learn leaves Coach unchanged and vice versa; next send has a new correct-surface ID; wrong-room/owner/surface reuse fails closed without a model call; recorded attempt/receipt/mastery survives Clear; repeat Clear is safe.

**Checks:** (1) start-fresh with a real disposable persisted Coach receipt; (2) wrong-owner/room/surface route scenario; (3) web typecheck.

**Deliver/stop:** `codex/c02-safe-clear`; commit migration/UI/server changes and PR to integration. Three checks total; defining failure means NOT DONE; stop at this PR, no production migration/merge.

### C03 — Independent Next-topic cursors

**Priority / size:** P0; 90–120 minutes. **Dependencies:** C02.

**Gain / deficiency:** Students visit every selected topic instead of repeating `selectedTopics[0]`.

**Read/change:** `coach-panel.tsx`, `learn-panel.tsx`, `lib/coach-route-selection.ts`, `/api/learn` and existing Coach request contract; `lib/learning` pending-state owner only as needed.

**Required changes:** separate active Learn/Coach topic IDs, selected-scope revisions and stable ordered lists. Server validates topic membership. Next advances one slot and starts a fresh scoped thread via C02. Learn opens that actual `/api/learn` lesson; Coach starts its existing diagnostic/challenge path. Confirm leaving an unanswered challenge; leave ungraded. Removed topics yield an explanation, last topic does not wrap, one-topic scope offers Choose more topics. No prompt-based cursor/grade authority.

**DONE iff:** six selected topics are visited in each mode's order independently; active header matches request ID; last/one/removed states are explicit; abandoning a pending challenge adds no grade/receipt and does not carry it to the next topic.

**Checks:** (1) deterministic six-topic progression including one/last/removed boundary; (2) one pending Coach navigation scenario with mastery unchanged; (3) web typecheck.

**Deliver/stop:** `codex/c03-topic-navigation`; committed focused PR to integration. Use shared rules; stop after acceptance evidence or NOT DONE/BLOCKED, at most three checks.

### C04 — Typed Learn outcomes and truthful recovery

**Priority / size:** P0; 90–120 minutes. **Dependencies:** none.

**Gain / deficiency:** Ready materials are no longer described as missing merely because retrieval or generation failed.

**Read/change:** `app/api/learn/route.ts`, `app/api/chat/route.ts`, `lib/engine.ts`, `lib/retrieval.ts`, `packages/ai/src/grounding.ts`, relevant UI result handler. Add a shared domain outcome type without exposing provider errors.

**Required changes:** distinguish `ready`, `partial_coverage`, `materials_processing`, `no_ready_materials`, `no_relevant_evidence`, `invalid_topic_scope`, `retrieval_error`, `generation_error`. Return safe counts, coverage IDs, reasonCode, retryable; preserve SSE/legacy cited-answer compatibility. Validate room/active scope; render recovery from typed outcomes, not text matching. Record count/outcome metadata through existing redacted trace path.

**DONE iff:** zero evidence with ready sources shows match failure and See topics; processing and genuinely empty rooms differ; retrieval exception differs from generation failure; invalid scope never silently defaults to topic one; existing successful cited answer still renders.

**Checks:** (1) one table-driven Learn outcome contract case covering only these branches; (2) one successful existing SSE answer compatibility check; (3) web typecheck.

**Deliver/stop:** `codex/c04-learn-outcomes`; commit and PR to integration. Shared limits apply; stop after the card. Unknown provider/schema behavior returns explicit failure, not a success-shaped answer.

### C05 — Topic-aware follow-ups and known-term retrieval

**Priority / size:** P0; 60–120 minutes. **Dependencies:** C04.

**Gain / deficiency:** Help and key-term questions search the current lesson; the generic path currently embeds only the literal question.

**Read/change:** `lib/engine.ts`, `lib/retrieval.ts`, `/api/chat`, `/api/learn`, `lib/coach-route-selection.ts`. Reuse existing hybrid RPC if the exact-term fixture requires it.

**Required changes:** build a bounded source-search query from server-validated active topic title/objective/key terms plus current question and, for short follow-ups, latest relevant user question in that thread. Assistant wording is never source evidence. If context is ambiguous, ask a short clarification. Term listing enumerates supported terms with citations. No global cutoff reduction or unbounded history inclusion; keep general specific-question retrieval working.

**DONE iff:** indexed Government term query returns supported definitions/citations; Help after one lesson stays on that topic or asks clarification; a fabricated fact abstains via C04; unrelated prior chat cannot become source evidence.

**Checks:** (1) known-source key-term query; (2) contextual Help plus unsupported-fact fixture in that same topic flow; (3) web typecheck. SEC applies to real model work.

**Deliver/stop:** `codex/c05-contextual-retrieval`; committed focused PR to integration; stop after criteria/check record, never exceed three checks.

### C06 — Enumerated selected-topic unit overview

**Priority / size:** P0; 90–120 minutes. **Dependencies:** C03, C05.

**Gain / deficiency:** Teach my selected topics covers the selected unit; a generic all-topics prompt currently cannot guarantee retrieval coverage.

**Read/change:** `/api/learn`, `lib/engine.ts`, `lib/retrieval.ts`, `coach-panel.tsx`, existing Learn starter logic; add a small overview orchestrator, reuse lesson generation.

**Required changes:** explicit overview request; server validates/loads ordered selected IDs and retrieves evidence independently for each topic. Natural-language Explain all topics routes to this operation. Return one compact section/status per ID, then expand one full lesson on demand. Cap scope, per-topic evidence/tokens and total calls in admission; do not fire six full lessons automatically. Keep successful sections when another lacks evidence. Do not call first-topic response an overview.

**DONE iff:** six supported IDs produce exactly six ordered distinguishable cited sections; five supported plus one unavailable retains five and names the gap; one-topic operation remains singular; invalid/out-of-room IDs do not generate content; end-to-end UI invokes the explicit operation.

**Checks:** (1) six-topic supported/partial overview fixture; (2) foreign/stale scope with zero provider calls; (3) web typecheck. SEC for live generation.

**Deliver/stop:** `codex/c06-unit-overview`; committed PR to integration. Three checks maximum; no independent retriever rewrite; stop at this feature.

### C07 — Quality-driven OCR and clean reading order

**Priority / size:** P0; 90–120 minutes. **Dependencies:** none.

**Gain / deficiency:** Suspect scans recover definitions without duplicated/fused thin-layer text. Existing OCR selects only low-character pages and appends OCR to the original text.

**Read/change:** `packages/documents/src/extract.ts`, `types.ts`, `documents.test.ts`; `packages/ai/src/ocr.ts`; `apps/web/lib/ingest.ts` OCR helper only. C09 owns publication/claim changes, so coordinate that helper boundary.

**Required changes:** deterministic page quality signals for corruption/replacement glyphs, density/spacing problems and missing page text; keep the current threshold as one signal. Preserve raw extraction; use a separately chosen normalized transcription, replacing a corrupt thin layer instead of concatenating it. Preserve headings/table-cell ordering/page labels; avoid silently guessing factual words. Recover only suspect pages with current vision adapter and configured page/time/spend caps. Unsupported provider capability has an honest result.

**DONE iff:** the original three-page government fixture recovers its named terms/branches on correct pages; a healthy text PDF invokes no OCR; a corrupt layer does not duplicate OCR paragraphs; illegible text is flagged instead of fabricated.

**Checks:** (1) three-page source recovery compared with the original page facts (or explicitly NOT DONE if unavailable); (2) healthy/corrupt-layer selection scenario; (3) documents/AI affected-package typecheck as one targeted compiler invocation. SEC before real OCR.

**Deliver/stop:** `codex/c07-page-recovery`; committed PR to integration. No new OCR platform or autonomous agent. Stop at acceptance or recorded blocker; three checks total.

### C08 — Page coverage and safe partial materials

**Priority / size:** P0; 90–120 minutes. **Dependencies:** C04, C07.

**Gain / deficiency:** Students see which pages need attention and can still use verified readable pages; current processing fails the file or labels all pages ready.

**Read/change:** `lib/ingest.ts`, `lib/rooms.ts`, `materials-panel.tsx`, document GET/process routes, extraction types, current document-status constraints and ready-source retrieval RPC. Use additive metadata/status handling.

**Required changes:** persist page-level readable/uncertain/unreadable coverage with safe reasons; explicit partial/needs-review presentation; preserve usable verified pages with warnings. Update SQL source eligibility and `read_session_source_scope` together so partial status cannot bypass source-quality rules. Publish no uncertain text as evidence. Retry a failed page without hiding other page coverage; no destructive status backfill.

**DONE iff:** one bad page is named, the readable pages remain citable, incomplete file is never unconditionally complete, and Learn/guide selection reports the precise coverage limitation. All status readers handle the additive state; whole-page failed OCR is not silently ready.

**Checks:** (1) three-page/one-unreadable processing + UI coverage scenario; (2) retrieval/source-scope RPC rejects uncertain-page evidence; (3) web/documents affected compiler invocation.

**Deliver/stop:** `codex/c08-page-coverage`; commit additive migration/server/UI and PR to integration. At most three checks, stop here; privacy/source eligibility failure is NOT DONE.

### C09 — Atomic reindex and preserved usable revision

**Priority / size:** P0; 90–120 minutes. **Dependencies:** none; consumes existing forced-reindex protection when available.

**Gain / deficiency:** A failed refresh leaves the last index usable. Current force resets are separate from claim, and chunk replacement deletes first.

**Read/change:** `lib/ingest.ts`, `app/api/documents/reindex/route.ts`, `process/route.ts`; migrations owning `claim_document`, chunks and cooldown. Do not duplicate the security admission ledger.

**Required changes:** stage a new derived revision; atomically validate owner/room, cooldown, claim token and revision before publication. Swap active chunks/status only after complete storage and derivation. Failed/cancelled/stale attempts preserve previous active revision and report refresh failure separately. Atomic claim/fencing prevents concurrent/stale publishers. Keep originals immutable. Reuse remediation RPC where integrated; maintain previous behavior for untouched documents.

**DONE iff:** induced insertion/derivation failure leaves old source retrievable; two concurrent forced attempts have one publisher; stale claim cannot overwrite newer revision; successful refresh exposes only the new active set; original object/evidence history unchanged.

**Checks:** (1) one database transaction scenario for concurrent/stale publish fencing; (2) one forced-failure preservation and then success scenario; (3) affected web typecheck. Disposable database only; SEC for live provider retries.

**Deliver/stop:** `codex/c09-atomic-reindex`; committed migration/service PR to integration. No production migration; three checks; stop at criteria or NOT DONE.

### C10 — All-source objective and support composition

**Priority / size:** P0; 90–120 minutes. **Dependencies:** C09.

**Gain / deficiency:** Notes/slides add relevant facts and citations while teacher guides retain objective emphasis. Current guide precedence suppresses supporting updates and narrows memberships.

**Read/change:** `lib/ingest.ts` topic/evidence composition, `refresh_topic_map` migration, topic APIs, `lib/study-guide-sources.ts`, active-topic source scope. Preserve learner-edited/removed semantics.

**Required changes:** separate objective-defining versus supporting memberships using additive tables/fields; reconcile the union of room active sources instead of newest-file replacement. Supporting sources enrich an existing objective, not silently widen test scope. Preserve stable topic IDs when objectives are unchanged; changed skills retire/version without transferring old mastery. Keep learner text/removals; expose conflicting source claims with both references and teacher precedence, never silently fuse them.

**DONE iff:** A guide + B notes + C slides contribute their appropriate unique facts/citations; B replacement removes obsolete B support but retains A/C; a second guide does not silently discard unrelated active objectives; user edits/removals and historical evidence survive.

**Checks:** (1) one A/B/C plus B-replacement composition scenario; (2) one edited/removed/conflicting-topic scenario with history preserved; (3) web typecheck.

**Deliver/stop:** `codex/c10-room-composition`; committed focused PR to integration. Three checks maximum; no extra topic/mastery system; stop at observable completion.

### C11 — Independent multi-file intake

**Priority / size:** P0; 60–90 minutes. **Dependencies:** none.

**Gain / deficiency:** Subsequent files upload without waiting for the first OCR request. Current per-file loop awaits upload and full process in sequence.

**Read/change:** `materials-panel.tsx`, upload/process API response types. Keep server upload byte/MIME limits untouched.

**Required changes:** separate upload intake from bounded processing dispatch, initially one active processing job unless existing admission allows more. Track unique document IDs/stages per file; deduplicate Retry/start clicks. Failure of A does not suppress B/C; source-type snapshot applies to each selected batch. Stop timers/polling on unmount; no unlimited requests or success labels from merely uploading.

**DONE iff:** B/C upload while A remains processing; each file retains its ID/type/status; A failure leaves B/C processing; duplicate start does not repeat work; completion reflects server status.

**Checks:** (1) delayed-A three-file UI/network scenario; (2) failed-A plus repeated-Retry scenario; (3) web typecheck.

**Deliver/stop:** `codex/c11-independent-uploads`; commit and focused PR to integration. Three checks total; stop after the feature, preserve privacy/budget boundaries.

### C12 — Persist normalized, versioned source blocks

**Priority / size:** P1; 90–120 minutes. **Dependencies:** C08, C09.

**Gain / deficiency:** Learners can trace composed facts to exact reading-order passages; current extraction only persists retrieval chunks.

**Read/change:** `packages/documents/src/types.ts`, `extract.ts`, `chunk.ts`; `lib/ingest.ts`; additive source-block/revision migration and original-source citation viewer owner.

**Required changes:** derive typed blocks (heading, paragraph, term/definition, table; unknown when uncertain) with stable IDs, original page/section/reading order, raw/normalized text, coverage flag and fingerprint. Persist per active derived revision under owner/room/document constraints. Link chunks to blocks while retaining current retrieval metadata. Source evidence view opens the correct original/page; block text never replaces immutable originals. This is distinct from `canonical-topic-view.ts` learner state.

**DONE iff:** ingestion stores ordered blocks and chunk links from one revision; definitions/table cells retain their locations; citation/evidence lookup resolves only owner-room active/allowed source; replacing a source changes revision without overwriting originals or learner events.

**Checks:** (1) ingest → blocks → chunk → citation round trip on one source; (2) foreign-room block-read denial; (3) affected documents/web compiler invocation.

**Deliver/stop:** `codex/c12-source-blocks`; committed migration/projection PR to integration. Three checks; no parallel document database or general editor; stop here.

### C13 — Durable processing admission and status

**Priority / size:** P1; 90–120 minutes. **Dependencies:** C09, C11.

**Gain / deficiency:** Processing and Retry are recorded even if the user closes the page; browser request lifetime currently owns work.

**Read/change:** document process/reindex/GET routes, `lib/ingest.ts`, `materials-panel.tsx`, current claim RPC; new small `lib/ingest-jobs.ts` and Supabase-backed job migration.

**Required changes:** persist job identity, document/source revision, bounded attempts, stage/lease token and result; unique operation key and deduplicated enqueue. Process returns 202 + status reference, not ready; client polls authenticated document/job status without restarting work. Reindex uses C09 atomic cooldown/claim. Retain old synchronous behavior behind a default-safe compatibility switch until C14 is integrated; the new queue must not strand existing uploads. No queue vendor or browser service credentials.

**DONE iff:** repeated submissions reuse one durable job; status is readable after reload; foreign-job access fails; queued never displays complete; existing uploads still work when the worker switch is off. New job mode is enabled only together with C14.

**Checks:** (1) enqueue/retry/reload idempotency scenario; (2) owner/room job-read and submit denial; (3) web typecheck.

**Deliver/stop:** `codex/c13-durable-jobs`; committed focused PR to integration, no switch enablement alone. Three checks; stop after this API capability and truthful status are evidenced.

### C14 — Resumable bounded ingestion runner

**Priority / size:** P1; 90–120 minutes. **Dependencies:** C12, C13.

**Gain / deficiency:** Ingestion resumes without an open browser or redoing successful OCR. Durable jobs alone have no consumer.

**Read/change:** `lib/ingest-jobs.ts`, ingest stage helpers; new Node-compatible runner entry and authenticated internal dispatcher modeled on `/api/internal/storage-cleanup`; `apps/web/vercel.json` scheduler config only if supported for the preview environment.

**Required changes:** a Supabase-backed deterministic worker, not an Edge runtime rewrite of Node parsers. Claim with fencing; checkpoint extraction, each OCR page, bounded embedding batches, topic derivation and C09 publication. Each dispatch handles bounded work inside platform time limits, persists progress, and safely yields; queued jobs are scheduled independently of learner requests. Supply a directly runnable Node entry plus protected scheduler adapter; reuse existing host scheduling rather than a queue product. Retry transient failure under one finite attempt/spend allowance; SDK retries included. No reclaim while an old executor can still publish without fencing; no “abort means provider stopped.”

**DONE iff:** with the upload page closed, a running local/disposable scheduler finishes a multi-stage job; killing/restarting between stages resumes from checkpoint without repeating completed provider work; duplicate workers yield one active revision; exhaustion surfaces a recoverable terminal status. Hosted unattended scheduling remains a separate release requirement until verified in preview.

**Checks:** (1) browser-disconnected multi-stage run with interrupted/restarted worker; (2) duplicate-worker/admission-cap fixture; (3) affected Node/web typecheck. SEC before real providers.

**Deliver/stop:** `codex/c14-ingest-runner`; commit runnable worker/adapter and PR to integration. Three checks; no production scheduler deployment; stop with exact local versus hosted evidence stated.

### C15 — Generate and persist grounded educational content

**Priority / size:** P1; 90–120 minutes. **Dependencies:** C10, C12.

**Gain / deficiency:** A guide teaches rather than printing retrieval chunks; no composed content edition currently exists.

**Read/change:** `packages/ai/src/study.ts` structured helper, `client.ts` provider boundary; new shared guide-content types/validator; new `lib/study-guide-content.ts` and authenticated build route; additive guide-edition storage migration. Reuse current source selector only as evidence selection, not body text.

**Required changes:** `StudyGuideContent` carries version, source snapshot, room/topic scope, level, chapters/objectives/facts/terms/examples/practice/answers and evidence refs. Generate a bounded chapter at a time behind the existing provider layer; runtime-validate schema, source-ID membership, locations, duplicate terms/questions and answer-key references. Missing facts are unsupported, never filled by general knowledge. Persist one immutable validated edition keyed by source/scope/level/schema/prompt versions; identical concurrent requests reuse it. At most one repair, within pre-reserved total budget; unsupported capability/refusal is typed. No blanket changes to Coach generation.

**DONE iff:** the Government fixture includes its actual definitions and distinct branch explanations, supported examples, varied source-answerable questions and matching answers; every substantive fact/answer maps to valid evidence; malformed/unsupported output does not publish; repeating the same request does not regenerate; renderers receive the same factual object.

**Checks:** (1) one factual/schema/citation inspection of the fixture edition against its source; (2) one invalid-output + concurrent duplicate-build fixture; (3) affected AI/web compiler invocation. SEC for real generation.

**Deliver/stop:** `codex/c15-composed-content`; committed implementation/schema/storage PR to integration. No tests-only/schema-only completion; three checks, stop at a persisted useful edition or NOT DONE.

### C16 — Automatic guide lifecycle and explicit rebuild

**Priority / size:** P1; 60–120 minutes. **Dependencies:** C14, C15.

**Gain / deficiency:** Add materials leads to guide readiness automatically; new uploads no longer silently overwrite the edition being read.

**Read/change:** ingestion-completion job hook, guide build route/store, `materials-panel.tsx`, download-button/status owner. C17 owns preview body.

**Required changes:** trigger a deduplicated guide build when the selected corpus is ready; if partial/unready, show coverage and wait or offer an explicit limited-scope edition. Keep first guide automatic. Once an edition is in use, changed sources show Update available; build candidate automatically but switch editions only on learner action. Room-level Rebuild from current materials replaces newest-guide-only refresh; retain per-file retry/reindex. Publish a candidate only if snapshot still matches; otherwise mark outdated, not latest. Changes to typography never generate.

**DONE iff:** three uploads converge to one complete edition; unfinished selected files show processing; changed sources preserve current reading position/edition and display update; rebuild uses A/B/C current revisions once; failed build is actionable and never overwrites a valid edition.

**Checks:** (1) upload-completion → initial edition → added-source update flow; (2) stale-build/failed-build deduplication scenario; (3) web typecheck.

**Deliver/stop:** `codex/c16-guide-lifecycle`; commit and PR to integration. SEC applies; three checks, stop after lifecycle behavior is evidenced.

### C17 — Readable in-app guide preview

**Priority / size:** P1; 60–120 minutes. **Dependencies:** C15.

**Gain / deficiency:** Students read a coherent guide before downloading; current export has no shared educational preview.

**Read/change:** `components/room/workspace.tsx`, existing guide download button; new small guide-preview component; relevant `docs/DESIGN_SYSTEM.md` typography/reading surfaces sections only. C15 owns content/token contract.

**Required changes:** render chapters, definitions, examples, varied practice and separately revealed answers from one edition; title/level/source coverage and version are visible. Concise source reference opens authorized original evidence. White reading surface, clear hierarchy, generous spacing, wrapping, semantic headings and keyboard focus. Include PDF/Word/Print action slots; render independently of export libraries. No model calls in rendering and no new citation-content improvisation.

**DONE iff:** preview contains all supported edition sections and same answer key; answers are separated from the initial practice view; long terms/citations wrap at compact width; source links resolve authorized evidence; rerender/style changes cause zero generation calls.

**Checks:** (1) one content-to-preview equivalence scenario; (2) compact-width/keyboard citation navigation inspection; (3) web typecheck.

**Deliver/stop:** `codex/c17-guide-preview`; committed focused PR to integration. Three checks; stop at a usable integrated preview, not merely an isolated component.

### C18 — Replace PDF publication with readable layout

**Priority / size:** P1; 90–120 minutes. **Dependencies:** C15.

**Gain / deficiency:** Printable guides retain Unicode, sentence endings and readable spacing. Existing manual publisher strips characters and truncates excerpts.

**Read/change:** `lib/study-guide-pdf.ts`, `/api/study-guide/download`, `study-guide-pdf.test.ts`; shared guide content/design tokens. Choose one deployment-compatible layout dependency, preferably `@react-pdf/renderer` if it fits the current Node bundle; a minimal renderer is the deliverable, not a library research spike.

**Required changes:** render only the selected validated edition; embedded licensed Unicode font; 0.65–0.8-inch margins; 20–26pt chapter headings; 12–13.5pt body at roughly 1.4–1.55 spacing; term/example blocks, wrapping tables, page numbers, compact sources, separate answer-key pages. Default US Letter; deterministic A4 option. Validate/omit missing/invalid date. No character-slice body or midword cutoff. Preserve authenticated ownership and private/no-store attachment response; return a typed error when no valid edition exists.

**DONE iff:** long paragraphs/tables paginate without clipping/overlap; diacritics survive; no Invalid Date or arbitrary truncation; factual sections/key match C15; unauthorized download returns no document bytes; print is readable in grayscale.

**Checks:** (1) render and visually inspect one long Government PDF including Unicode/invalid date; (2) one cross-room download denial; (3) web build including this renderer. The build is justified here, not repeated on unrelated cards.

**Deliver/stop:** `codex/c18-readable-pdf`; commit renderer/dependency lock update and PR to integration. Three checks; stop after actual rendered artifact evidence, no production deployment.

### C19 — Editable Word export of the same edition

**Priority / size:** P1; 90–120 minutes. **Dependencies:** C15.

**Gain / deficiency:** Students/parents can edit the guide; there is no DOCX export.

**Read/change:** shared `StudyGuideContent`; new `lib/study-guide-docx.ts`; download route format dispatch owned jointly with C18; export button after C17 where present. Serialize shared route/manifest/lockfile edits.

**Required changes:** use one established DOCX authoring dependency; native heading/paragraph/table styles and editable body text, Unicode, source notes, page breaks and separate answer key. Read the exact selected edition; no regeneration or screenshots-as-document. Preserve ownership/private attachment headers and PDF compatibility. Share deterministic metadata/date validation and document tokens.

**DONE iff:** a Word-compatible editor can edit definition text and table cells; every chapter/fact/question/answer matches the same edition exported to PDF; headings/navigation/source refs are preserved; malformed request or foreign room yields no file; download action returns DOCX MIME/filename.

**Checks:** (1) render/open one long DOCX and verify editable content plus edition equivalence; (2) one format/ownership route case; (3) web build including DOCX bundling.

**Deliver/stop:** `codex/c19-editable-word`; committed renderer/route/dependency PR to integration. Three checks; stop after actual editable artifact evidence, not ZIP validity alone.

### C20 — Restore active mode/thread on reload

**Priority / size:** P1; 90–120 minutes. **Dependencies:** C03.

**Gain / deficiency:** Reload returns to the correct topic and transcript; persisted history currently exists separately from an empty visible state.

**Read/change:** chat hydration/active-thread endpoint using C02 metadata; `coach-panel.tsx`, topic-scope/cursor persistence owner, `coach-interaction.ts` recovery. Do not alter grading replay authority.

**Required changes:** persist safe active thread/cursor/scope references server-side with ownership checks; load a bounded latest message window in chronological order; never restore an archived thread as current. Draft/scroll may be ephemeral or session-scoped; do not claim cross-device draft persistence or put student transcripts in unscoped local storage. Incomplete streams reload as interrupted/pending, not completed or resubmitted. Existing interaction/receipt IDs govern retry.

**DONE iff:** reload restores each mode's own topic/messages/citations; cleared thread stays empty after reload; pending Coach state is correctly restored without auto-submitting/grading; user/room switch exposes no prior user's transcript; message window includes current context rather than first-oldest messages only.

**Checks:** (1) two-mode reload/Clear scenario; (2) interrupted Coach + owner-switch hydration denial; (3) web typecheck.

**Deliver/stop:** `codex/c20-thread-restore`; committed focused PR to integration. Three checks; stop after exact persistence behavior is evidenced.

### C21 — Lessons-first mobile layout and accessible controls

**Priority / size:** P1; 90–120 minutes. **Dependencies:** C06, C08, C17, C20.

**Gain / deficiency:** Students see Lesson 2 of 6, an actual lesson and reachable actions instead of a clipped generic chat/topic-management view.

**Read/change:** `coach-panel.tsx`, `learn-panel.tsx`, `workspace.tsx`, `app/globals.css`, companion positioning CSS only where it obscures controls; design-system responsive/accessibility sections.

**Required changes:** unify primary Learn lesson/overview navigation around explicit cursor and coverage; keep a single scope picker and move management behind its existing link. Lessons label only once behavior meets the contract; Coach stays application/practice. Clear/Next action row visible when empty, 44px-equivalent minimum targets, safe areas, wrapping citations, scrollable long content, meaningful focus/live statuses. Keep companion expanded/minimized away from the composer/actions; no new mascot/assets or duplicated topic selector. Loading and retry preserve successful content and navigation state.

**DONE iff:** at 320/390px widths and iPad size there is no horizontal clipping or blocked essential action; enlarged text remains usable; keyboard/focus labels identify mode/topic; overview/lesson/Coach transitions preserve independent state; both mascot sizes leave controls reachable.

**Checks:** (1) compact-width/enlarged-text lesson flow inspection; (2) iPad + keyboard/focus flow with mascot expanded/minimized; (3) one physical iPhone Safari Clear/Next/citation smoke. If device evidence is unavailable, record BLOCKED/NOT DONE instead of substituting a desktop screenshot claim.

**Deliver/stop:** `codex/c21-mobile-lessons`; commit UI/CSS and PR to integration. Three checks maximum; stop after observed usable flow, not just JSX rendering.

### C22 — Honest mobile save/share and Print

**Priority / size:** P1; 60–90 minutes. **Dependencies:** C17, C18, C19.

**Gain / deficiency:** Save/share actual guide files; a temporary blob URL is not a public sharing address.

**Read/change:** `study-guide-download-button.tsx`, guide preview action row; existing client file/save utilities. Keep download auth server-side.

**Required changes:** format-specific actions for selected edition; feature-detect file sharing (`canShare`/`share`) and otherwise offer download/save. Use actual File objects, release object URLs, distinguish user cancellation from failure, prevent duplicate exports; Print uses the same preview/edition with printable answer-key setting. Never expose private signed-source URLs as public guide links; formatting/share makes no model call. Respect native Safari limitations with an actionable save fallback.

**DONE iff:** PDF/Word save correct bytes/name/edition; supported browser shares actual file; unsupported/cancelled sharing has a working safe fallback; Print excludes chrome/companion and preserves content; no persistent blob URL is advertised as shareable.

**Checks:** (1) one mobile share/save feature-supported and fallback scenario; (2) one print preview with answer-key toggle; (3) web typecheck.

**Deliver/stop:** `codex/c22-guide-sharing`; committed focused PR to integration. Three checks; stop at working file actions, no public publishing service.

### C23 — Quiet progress and companion feedback

**Priority / size:** P2; 30–60 minutes. **Dependencies:** C21.

**Gain / deficiency:** Learners receive a brief confirmation when a lesson opens/guide becomes ready; transitions currently provide limited local feedback.

**Read/change:** lesson progress/action row, existing `components/companion/engine.ts` and companion CSS, existing reduced-motion hooks. Do not generate assets or add a new animation system.

**Required changes:** one short progress transition and existing companion acknowledgement triggered by genuine ready/visited state; deduplicate on rerender/reload. Optional and skippable; reduced motion renders static status. No modal, confetti, navigation delay, artificial mastery/currency reward, repetitive praise or typing interruption. Sound/haptics are outside this card.

**DONE iff:** one successful action causes one brief feedback response; failure/loading does not pretend success; reduced-motion and minimized companion stay static/quiet; lesson is immediately readable and controls never wait on animation.

**Checks:** (1) success/error/repeated-render feedback scenario; (2) reduced-motion/minimized-state inspection. Two checks only; use CI for additional type/build coverage.

**Deliver/stop:** `codex/c23-quiet-feedback`; commit and PR to integration. Stop after these two checks/criteria; optional P2 cannot delay P0 release fixes.

### C24 — Cross-surface revision invalidation and recovery

**Priority / size:** P0 release blocker; 90–120 minutes. **Dependencies:** C06, C10, C16, C18, C19, C20.

**Gain / deficiency:** Replaced/deleted material stops appearing as current in lessons, Coach and new exports. Existing source IDs alone cannot distinguish derived revisions across new caches/editions.

**Read/change:** source replacement/delete hook, source/guide snapshot validity, Learn lesson/overview cache, restored-thread source reference owner; `lib/retrieval.ts` and current pending Coach source validation only if required. Integrate the completed paths; do not create a release-test-only task.

**Required changes:** after successful source mutation, transactionally advance corpus revision and mark affected derived lessons/guide editions stale. Active source reads/exports validate document membership and revision; deleted source content is unavailable in new use/export. Retained historical chats may remain historical but label obsolete citations and cannot re-ground a fresh answer. Pending Coach with invalidated evidence offers a new sourced challenge without grading the stale one; preserve receipts/mastery. Failed reindex keeps C09 previous usable revision and must not invalidate it. Update candidate/latest guide indicators without silently switching reading editions.

**DONE iff:** replacing B removes old B facts from new lessons/Coach/guide/export while A/C remain; deleting a source cannot leak its cached text through new authenticated exports; a stale pending challenge cannot award mastery; failed refresh preserves the valid previous edition/index; no source mutation deletes historical learning evidence.

**Checks:** (1) one A/B/C replacement journey across current lesson, Coach and guide edition; (2) one source-delete/stale-export/pending-challenge denial scenario; (3) one failed-refresh preservation scenario. These are three narrowly bounded integration scenarios, not the repository suite.

**Deliver/stop:** `codex/c24-source-freshness`; committed integration correction PR to integration. Three checks; stop after observable cross-surface corrections or NOT DONE. This card never authorizes merge/main/deploy.

## D. Three-check verification rules

- A check is one focused named behavior scenario, one targeted compiler invocation, one relevant build, one artifact render inspection, or one device smoke. Individual independent tests bundled into a huge file/suite remain individual checks; commands are not loopholes.
- Pick at most three from the card. Filter existing tests by exact name or create a directly relevant small behavior fixture only when needed. Commands such as `pnpm test`, `pnpm -r test`, a security/eval suite, or every UI test are prohibited manual validation for this queue.
- Example focused command: `pnpm --filter @studigo/web exec node --import tsx --test --test-name-pattern='exact task behavior' lib/<target>.test.ts`. Replace the placeholder with the implemented case; it is not an existing test claim. Compiler: `pnpm --filter @studigo/web typecheck`. PDF/DOCX cards intentionally reserve one web build because bundling is part of their behavior.
- Source inspection, dependency installation, git operations and reading existing CI results are preparation, not functional PASS evidence. A dependency audit/tool check, if manually executed to approve a new renderer dependency, uses one slot; replace a listed check and explicitly record the resulting verification gap. Never exceed the cap because a skill suggests extra checks.
- Every executed check consumes a slot, including failures, repeats after fixes, and manual checks. Do not reset the counter after changing code or renaming a task. Normal existing CI is independent; do not trigger a second CI run just to duplicate a passed manual check.
- Prefer two essential checks first and reserve the third for the highest-risk verification or one necessary retest. No passing rerun without directly affected changes. If a failure consumes the last slot, fix within scope but leave the final commit NOT DONE when defining behavior lacks final verification.
- Log all failures. Pre-existing/unrelated failures may remain documented while the task is DONE only when its own acceptance remains proven. Privacy/security/data integrity/financial limit/live operability regressions stop integration immediately. Do not weaken tests/assertions, hide evidence, or open-endedly debug unrelated code.
- If a check is unavailable, mark it UNVERIFIED and explain the missing device, fixture, credential, accepted protection or environment. Do not pretend an unavailable live check passed through a mock.
- Review final diff and record artifact/commit evidence without executing extra validation. DONE has no deployment implication.

## E. Failure log format

Use one append-only `implementation/codex-failures.md` for this track, created only when an actual failure/unverified defining check exists. Parallel tasks may keep their entry in the PR until the integrator appends it to avoid conflicts. Do not create a second audit/report for every task. Exclude secrets, raw student text and private source files.

```markdown
### CNN — YYYY-MM-DD — check N of maximum 3
- Final/task commit: <sha or pending>
- Check name: <one focused behavior>
- Command or manual steps: <exact sanitized command/steps>
- Environment: <fixture/local DB/preview/physical device>
- Result: FAIL | UNVERIFIED
- Failure details: <expected vs actual, relevant redacted output>
- Suspected cause: <specific hypothesis; distinguish confirmed from suspected>
- Impact: defining feature | neighboring behavior | privacy | integrity | security | financial limit | live operability | unrelated/pre-existing
- Action: <scoped fix / record and continue / stop>
- Remaining check slots: <0–2>
- Unverified acceptance criteria: <exact missing behavior>
- Task disposition: DONE | NOT DONE | BLOCKED
- Follow-up: <existing task/PR or exact blocker; no broad new audit>
```

No invented failure records: this planning pass ran no application tests. File/read/tool errors during planning are not application test failures.

## F. Completion tracker

The queue starts at NOT STARTED. Dependency waits are represented by task IDs; mark BLOCKED only when an actual prerequisite/environment prevents execution. DONE requires final commit, PR, acceptance evidence, and checks consumed; a PR number alone is insufficient. Review acceptance and integration receipt belong in the same row. Use only these five task states: **NOT STARTED, IN PROGRESS, DONE, NOT DONE, BLOCKED**.

| ID | State | Final commit / PR | Acceptance evidence / checks used | Integrated commit or blocker |
|---|---|---|---|---|
| C01 | DONE | `455573f` implementation, `d72edcc` CI repair / [PR #104](https://github.com/WGLewis0721/Studigo-ai/pull/104) | 3/3 manual checks PASS under Node 22: four switches preserved two drafts/transcripts and per-mode scroll; delayed Learn/Coach chunks, loading and error stayed in the original mode; pending Coach switch made no extra AI request or evidence write in the synthetic fixture; web typecheck passed. Automatic CI passed after the stale source assertion was updated. | Accepted for integration; no production or database verification claimed. |
| C02 | NOT STARTED | — | — | — |
| C03 | NOT STARTED | — | — | — |
| C04 | DONE | `12ee8bc` implementation / [PR #115](https://github.com/WGLewis0721/Studigo-ai/pull/115) | Manual 3/3: eight-kind outcome/recovery table and stale-topic fail-closed PASS; cited JSON/SSE legacy-field compatibility PASS; web typecheck initially failed on a test-only narrowing error, corrected before commit. Automatic Node 22 CI run `38611411725` passed typecheck, tests and build on `12ee8bc`; postgres-multisession passed. RLS-scoped reads, no mastery/admission changes; no live provider claim. | Focused PR to current main `1b095aaf` awaits review; no merge or production enablement. |
| C05 | NOT STARTED | — | — | — |
| C06 | NOT STARTED | — | — | — |
| C07 | BLOCKED | `a23be3e`, `383e14f` implementation / [draft PR #107](https://github.com/WGLewis0721/Studigo-ai/pull/107) | Clean PDF and synthetic selection checks passed; incomplete OCR response acceptance was reproduced before and rejected after `383e14f`; Node 22 web typecheck passed. Original image-only scan already selects all three pages for OCR, but actual OCR output, indexed page facts, and Learn retrieval were not verified. | Required protection is absent from integration: draft PR #98 head `2aefe6e` (atomic admission/receipt primitives and `20261008100000_ai_resource_admission.sql`) plus stacked draft PR #99 head `493ea893` (expensive-route coverage) are unmerged and unaccepted. Staging still needs the migration, server-only IP hash secret, eight explicit limits, enabled admission, WAF/provider spend controls, and concurrent/budget/lease/receipt evidence. After that, verify the original scan's named facts on the correct pages through OCR, indexing and retrieval; do not infer its failure from the separate incomplete-response defect. |
| C08 | DONE | `2d09067` / [PR #118](https://github.com/WGLewis0721/Studigo-ai/pull/118) | 3/3: three-page fixture names page 2 and keeps pages 1 and 3 citable; match/session RPCs reject uncertain pages; documents and web typecheck PASS. No status backfill and no production migration. | Stacked on C04 PR #115; not merged. |
| C09 | NOT STARTED | — | — | — |
| C10 | NOT STARTED | — | — | — |
| C11 | NOT STARTED | — | — | — |
| C12 | NOT STARTED | — | — | — |
| C13 | NOT STARTED | — | — | — |
| C14 | NOT STARTED | — | — | — |
| C15 | NOT STARTED | — | — | — |
| C16 | NOT STARTED | — | — | — |
| C17 | NOT STARTED | — | — | — |
| C18 | NOT STARTED | — | — | — |
| C19 | NOT STARTED | — | — | — |
| C20 | NOT STARTED | — | — | — |
| C21 | NOT STARTED | — | — | — |
| C22 | NOT STARTED | — | — | — |
| C23 | NOT STARTED | — | — | — |
| C24 | NOT STARTED | — | — | — |

**Dispatch rule:** choose the earliest NOT STARTED task whose dependencies are accepted in integration; give Codex only that card/contract plus prerequisite SHAs. Commit each completed assignment before any next assignment. A runner may select the next card in a new context only after the previous PR is reviewed and integrated; no agent silently chains unfinished tasks. If all eligible tasks are BLOCKED, report exact missing prerequisites once. Do not create investigative substitutes or bypass SEC.

## G. Integration and release sequence

1. **Documentation baseline:** commit this plan plus small routing links to integration. It adds no application behavior. PR #102 remains open; its scope will grow as integration accepts feature PRs, so rewrite its final title/body for the actual release before production review. Its current description covers only history isolation.
2. **Feature PRs:** branch each task from accepted integration. Before accepting a PR, review user-visible behavior, final-commit evidence, source/privacy/usage constraints, migrations and adjacent contracts. Existing CI runs its normal checks independently. Integration review is not a new broad manual test allowance.
3. **Merge authority:** implementation Codex opens PRs and stops. The owner or separately authorized integrator merges reviewed feature PRs into integration. Creation of this queue does not authorize automatic merging. Ready dependency commits unlock the next task without another architecture discussion.
4. **Batch A correctness:** C01–C11 establish conversations, Learn reliability and safe corpus mutation. Their accepted features remain behind appropriate existing flags if provider/security prerequisites are unresolved. Blocking defining failures remain NOT DONE.
5. **Batch B structured content:** C12–C17 add versioned sources, jobs, composed guides and preview. C13 and C14 enable together; prove authenticated unattended scheduling in preview before calling hosted ingestion durable. SEC must cover OCR, embeddings, overview, topic extraction and every guide-generation/repair call. A UI-only reservation is insufficient.
6. **Batch C publication/usability:** C18–C22 plus C24 provide equivalent artifacts, mobile controls, restore/save behavior and source freshness. P2 C23 is optional. Production eligibility requires original-scan factual evidence, observed PDF/DOCX layout/editability, physical-iPhone smoke, relevant ownership denial evidence, and accepted security protection. Reuse task evidence; do not automatically rerun it.
7. **Release evidence:** pin integration SHA, migration set/order, required flags/configuration and task evidence. Have focused domain review for source/topic migrations, RLS/privacy, semantic fidelity and document layout. No deployment claim based on source regexes, sample model responses, or preview build alone. Keep existing public-launch/security gate authoritative; this queue does not clear its unrelated blockers.
8. **Production approval:** present the final release PR/#102 with concrete completed behavior, remaining blockers, rollout/rollback plan and verified environment. Obtain separate authorization before merging main, applying production migrations or enabling workloads. Rollback must preserve immutable sources/history and prevent stale executor publication; prefer disabling new workload flags and compatible readers over destructive rollback migrations. Integration completion is not production release approval.

### Plan review and source notes

Every card includes a working application gain, bounded file owners, explicit dependencies, observable completion, at most three relevant checks, commit/PR delivery and a stop condition. No card exists solely to research, write docs, benchmark or add tests. The two worker cards split admission from execution; C13 cannot enable alone. No arbitrary quality percentages, new agent ecosystem, native-client rewrite, payments, gaming or unrelated remediation were added.

The context/branch workflow uses official OpenAI guidance on progressive disclosure, task-specific instructions and isolated worktrees. Vendor-neutral orchestration borrows simple workflow/composable component patterns; these references do not mandate their SDKs or override this task's cost limits:

- [ChatGPT documentation](https://learn.chatgpt.com/docs) and [AGENTS.md guidance](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
- [OpenAI: rethinking skills and prompts](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra): keep instructions relevant and reveal supporting context only as needed.
- [Worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees): isolate independent branches/chats.
- [Anthropic: building effective agents](https://www.anthropic.com/engineering/building-effective-agents): deterministic workflows versus open-ended agents and simple composable patterns. Used for architecture concepts, not current provider pricing/models.
- [Haystack pipelines](https://docs.haystack.deepset.ai/docs/pipelines): typed components, branching and bounded pipeline composition; no Haystack dependency is proposed.

Verified repository boundaries are anchored at the inspected integration SHA: `AGENTS.md`, `ENGINEERING.md`, `implementation/ENGINEERING_PLAN.md`, `docs/PRODUCT.md`, relevant design-system sections, PR #102 diff, and the named code/migrations. Future Codex tasks refresh only their own current files/prerequisite head; they do not repeat this planning review.
