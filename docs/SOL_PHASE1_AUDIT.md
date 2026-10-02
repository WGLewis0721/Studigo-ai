# Sol Phase 1 foundation audit

Scope: sequential GPT 6.1 Sol low pass, 2026-10-02 UTC. Implementation foundation only; Claude retains UI/UX ownership. PR #59 and downloadable-study-guide P0 acceptance remain prerequisites. This pass neither deploys nor closes those gates.

## Learning flow and surface inventory

| Boundary/surface | Existing implementation and authority |
| --- | --- |
| Coach issuance | `apps/web/lib/coach-router.ts` delegates through `coach-director.ts`; `learning/persistence.ts` loads owned event history; `packages/learning/src/director.ts` issues versioned ChallengeSpec. Route/reference KB and one-shot stretch are distinct from persisted state. |
| Render and response | `coach-render.ts` and `packages/ai/src/coach.ts` render one task with permitted room chunks and global explanation level, evaluate semantic concept evidence, and generate support. `coach-material-state.ts` revalidates pending source material. |
| Evidence and persistence | `coach-learning-events.ts` derives observations from issued spec/encounter, not learner claims. `coach-evidence-store.ts`, `coach-interaction.ts` and `learning/atomic-coach.ts` support issued encounters, accepted semantic evaluations, revision checks and atomic turn/event/projection writes. Additive adaptive SQL migration supplies service-only RPCs and RLS. |
| Replay and next task | Web learning modules re-export the shared pure `packages/learning` policy. Reducer counts encounter-wide support, independent evidence, recovery, transfer and rematches. Session projection derives retention and evidence stages. Next Coach issuance consumes that history. |
| Session recommendation | `learning/session-service.ts` and shared `session.ts` prioritize due review/rematch and teacher coverage, reject unsupported topics, respect explicit learner selection, and finish pending encounters before budget completion. Durable session start/resume remains incomplete beyond Coach encounters. |
| Quiz | Generate through `/api/quiz`; grade through `/api/quiz/attempt` using trusted answer keys and `record_quiz_attempt`. Historical attempt conversion enters canonical replay conservatively; complete production issuance provenance is still missing. |
| Practice Test | `/api/practice-tests` and `/submit` hold keys until whole-test grading; submission RPC commits once. Local beta exercises drafts and shared projection; hosted issued-task provenance remains a gate. |
| Flashcards | `/api/flashcards/review` commits schedule/rating/attempt through `review_flashcard`. Self-report cannot certify independent mastery. Existing card schedule is distinct from assessed concept-retention intervals. |
| Learn / Ask | Grounded answer and optional Socratic checks support understanding; Learn does not manufacture mastery. Shared typo handling resides in `packages/ai/src/typos.ts`. |
| Progress / Weak Areas / Plan / Cram | Hosted v1 progress reads canonical server projections; compatibility percentages and existing mastery/planning helpers still exist. `packages/mastery`, `apps/web/lib/mastery.ts`, `study-planning.ts` and SQL attempt RPCs must be checked before claiming all competing scoring removed. Existing UI presentation belongs to Claude. |
| Materials / export | Upload queues files; process/ingest extracts pages, OCRs, chunks and embeds through `packages/documents`, `packages/ai`, `apps/web/lib/ingest.ts`. Study-guide download selects bounded relevant source content. Hosted/mobile/print/user acceptance remains outstanding. |
| Local sandbox | `local-beta.ts` and local-beta routes use persistent synthetic SQLite state, issued tasks and receipts. Development-only authenticated-session substitute cannot establish live grounding or native acceptance. |

One architectural seam needs Medium review: `coach-director.ts` edits the returned spec to force a scheduled recall after `nextChallenge`, behind the session flag. Consolidate that decision into the pure director with explicit inputs/tests before declaring the director the sole spec authority.

## RAG, Python and native inventory

Canonical TypeScript retrieval: `apps/web/lib/retrieval.ts` embeds through `packages/ai/src/embeddings.ts`, calls room-scoped `match_study_chunks` under caller RLS, and assembles document/page metadata through `toRetrievedChunks`. Pending-question source IDs are fetched again under room/RLS and ready-document checks. Source priority is stored data, not just a prompt. `packages/ai/src/grounding.ts` maps source markers and filters unused/invented citation indices; this proves marker membership, not semantic claim support. Provider calls and untrusted-course-data rules remain in `packages/ai`; Responses API and structured evaluation contracts are present.

Existing Python is **not** the approved same-Supabase comparison: `services/retrieval` is FastAPI, LangChain splitting/HuggingFace embeddings, MiniLM 384-dimension vectors, per-room FAISS and spaCy rule cards. `retrieval-client.ts` supplies optional supplementary indexing/search/card calls and a 20-second timeout. Its request headers contain no service authentication, and Python endpoints accept room IDs without an authenticated principal. Do not expose it as production private retrieval. It does not share canonical pgvector(1536), and no benchmark makes it a replacement. Inventory it rather than creating another unexamined service.

Native inventory: `apps/desktop` is a Tauri shell scaffold. No universal Expo/React Native learner app is present. PWA/browser viewport checks are not iPhone/iPad lifecycle, secure-token, OAuth, offline, native PDF sharing, or physical-device evidence. Moon Road is a separate frozen game prototype, not the learning app/native client.

## Evidence baseline and low-pass change

Prior recorded baseline in `ADAPTIVE_BETA_EVIDENCE.md`: typecheck and 384 tests, including 35 database security/transaction checks; desktop/phone viewport synthetic browser coverage. Those are existing recorded results, not rerun live-provider claims.

This pass ran `pnpm typecheck` and the full `pnpm test`: **388 passed, zero failures** (17 mastery, 10 learning, 75 AI, 8 documents, 243 web, 35 database). Runtime was Node 25.6.1 and pnpm 10.0.0; package engine requires Node 22.x, so repeat release checks on the supported runtime. Test log: `C:/Users/Willi/projects/Labs/artifacts/results/studigo-sol-low-tests.log`.

Six added pure regression scenarios cover mixed partial/incorrect struggle, optional explicit topic choice, assisted due review, transfer-rematch constraints and earliest due date, and shuffled equal-time help with duplicate/conflicting receipts, including support between assessed failures and neutral self-report/legacy outcomes. The sole policy repair adds a derived consecutive `failureStreak`: mixed struggles now split/offer topic change at the existing two-failure threshold. Only assessed success or explicit skip resets that streak; help/reveal and self-report are neutral, and only assessed partial/incorrect attempts increment it; reasoning advancement remains two independent successes, ten reasoning rungs and six scaffolds remain unchanged. Complete history replay derives the new field; no event/database schema migration is needed. No UI edits.

## Actual release blockers and Medium priorities

1. Resolve prerequisite PR #59 and capture hosted PDF authorization, source deletion, mobile open/share, print layout and learner-use acceptance. Synthetic PDF/browser checks do not close P0.
2. Exercise hosted adaptive flags with authenticated live generation, source revision/deletion, stale pending encounters, retry and multi-tab concurrency. Verify transaction rollback and accepted evaluation reuse end to end.
3. Complete trusted Quiz/Practice Test issuance provenance and cross-surface canonical evidence; keep unknown assistance conservative. Audit remaining weighted mastery/SQL/UI compatibility paths for competing authority.
4. Move scheduled-recall override into the pure decision boundary; add durable session start/resume and stale-topic/source handling. Ensure optional topic changes never silently override explicit choice.
5. Produce 120 reviewed permission-safe RAG cases and live TypeScript versus Python/FastAPI + LangChain measurements on the same canonical source store. Measure citation support, source recall, priority, abstention, room isolation, prompt injection, duplicates, p50/p95, tokens/cost and maintenance. **Architecture choice is not closed**; keep Python advisory/offline pending evidence.
6. Native Expo client and device/OAuth/accessibility acceptance remain absent. Guardian/learner principals, consent/privacy/vendor/ZDR, durable worker operations, offline BKT evaluation and measured performance/cost release gates remain outstanding.

Low-pass audit is a reviewable foundation, not an assertion that Phase 1 or TestFlight is complete. Medium should repair hosted authority/provenance seams before prompt tuning; XHigh should audit that integrated result against the same gates. Return UI/UX work to Claude after the sequential passes.

Follow-up verification: after tightening assessed-attempt streak semantics, the focused learning suite passed 12/12. The earlier full 388-test result predates those two additional tests; the final full suite must be rerun before commit.
