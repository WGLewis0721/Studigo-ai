# Guided Learn reconciliation

**Date:** 2026-10-16. **Code inspected:** `main` / `guided-learn` at `df20d66` (Merge PR #197).  
**Plan:** `docs/GUIDED_LEARN_PLAN.md`. **Queue segment:** `STUDIGO_CODEX_EXECUTION_PLAN.md` section H.  
This report checks the code. Queue status words and older docs are evidence of what was claimed, not proof of what runs.

PR #201 was open and unmerged at inspection time. Nothing here depends on it.

## What changes the build order

1. **Branch from `guided-learn`, which matches current `main` (`df20d66`).** `integration/document-learning-reliability` is `bfa3e58`, an ancestor of `main`, 115 commits behind. Section F of the C queue still says many cards are "Not merged" / "Not on main". That tracker is stale. The C code below is on `main`. Do not restart the C queue, and do not branch Guided Learn from the old integration branch.
2. **Do not dispatch `docs/GUIDED_LEARN_ENGINEERING_PLAN.md`.** It is a different, earlier note already on `main`. It puts hear / say / type in wave 1, tells the player not to add Mission | Chat | Topics, and gates rooms with `PHASE3_ROOM2_ROOM_IDS`. The owner plan puts speech in wave 2 (GL05), read-aloud in wave 3 (GL07), and adds Mission beside the current Chat and Topics. Section H follows the owner plan.
3. **GL02 extends the mission cursor that already exists.** `learn_mission_cursors` and `learn_mission_receipts` (`supabase/migrations/20261015010000_learn_mission_cursor.sql`) store one room cursor: `brief → show → try → check → done`, one chunk, one `source_revision`. `apps/web/lib/learn-tap.ts` `missionBeats()` rebuilds choice / blank / checkbox plays in the client from a single excerpt. Resume restores the phase, not a versioned beat list. Add the plan and beat index on that row (or a child of it). A second session store would split Learn state.
4. **GL01 has no prerequisite graph to reuse.** Searches of `supabase/`, `packages/`, and `apps/web` found no topic-edge table or prerequisite column. Missing foundations have to be an explicit `unsupported_prerequisite` outcome on the new plan. That is new work the owner plan treats as an input.
5. **Do not point the new flag at `phase3Learn`.** `apps/web/app/app/rooms/[roomId]/page.tsx` sets `phase3Learn = false`. `docs/PHASE3_ROOM2_LEARN.md` says the room page reads `PHASE3_ROOM2_ROOM_IDS`; the page does not. The mission API still 404s unless that allowlist matches (`apps/web/app/api/learn/mission/route.ts`). The fixture room (`roomId === "fixture"`) still mounts `LearnMission`. Turning the new flag on by setting `phase3Learn` would ship that paused one-excerpt player.
6. **GL05 waits on more than the answer envelope.** `apps/web/next.config.ts` sends `Permissions-Policy: microphone=()`. There is no transcription adapter. `apps/web/lib/ai-admission-core.ts` skips receipts and concurrency unless `STUDIGO_AI_ADMISSION=1`. Speech is a new paid call and must stay disabled until that guard is proven. The owner plan already allows GL05 to start once the envelope is stable; the envelope in this foundation is types only, so GL05 is still not eligible to call a provider.
7. **GL04 word highlights have to use page coverage, not block coverage.** `packages/documents/src/source-blocks.ts` sets every block `coverage: "readable"`. OCR uncertainty lives on `documents.page_coverage` and `chunk_page_is_eligible`. A spotlight that trusts `source_blocks.coverage` will claim precision the row does not have.
8. **The UX draft of `MissionView` omitted `foundation`.** GL02 requires it. `packages/learning/src/mission.ts` includes `foundation` in `MISSION_VIEW_STAGES` so UX03 and GL02 share one stage list.
9. **C07 is not a closed spend gate.** The queue table says `FUNCTIONAL PASS ON PREVIEW — SEC RELEASE GATE OPEN`. Section F says `BLOCKED`. OCR code is present. New provider work, including speech, still waits on admission being enabled and proven. Guide LLM generation stays off unless `STUDIGO_GUIDE_GENERATION=1` (`packages/ai` guide path used by edition build). GL01 can read source blocks and deterministic editions while a generated guide is absent.

## C01–C24 against the code

Section A of the execution plan is the pre-implementation baseline. The status column and section F were updated later and disagree with each other in the cells noted below. The code column is this inspection.

| ID | Queue claim | Code on `df20d66` |
|---|---|---|
| C01 | Table: NOT STARTED. Tracker: DONE | **Exists.** `apps/web/components/room/coach-panel.tsx` keeps drafts, pending, errors, scroll, and messages per Coach/Learn mode. |
| C02 | DONE | **Exists.** `apps/web/lib/conversation-surface.ts` admits a thread only on its surface. Clear archives one surface. |
| C03 | DONE | **Exists.** Separate `coachTopicIds` / `learnTopicIds` and cursors. Thread rows are per surface (`supabase/migrations/20261014230000_chat_thread_pointers.sql`). |
| C04 | DONE | **Exists.** `apps/web/lib/learn-outcome.ts` `classifyLearnOutcome` (`ready`, `partial_coverage`, `materials_processing`, `no_ready_materials`, `no_relevant_evidence`, `invalid_topic_scope`, `retrieval_error`, `generation_error`). There is no separate `abstain` kind. Empty evidence uses `no_relevant_evidence`. |
| C05 | DONE | **Exists for Learn chat.** `apps/web/lib/contextual-retrieval.ts` `planContextualSearch` / `passagesForLesson`. `/api/learn` lesson POST does not pass chat history into that planner. Follow-up context is the chat engine path (`apps/web/lib/engine.ts`). |
| C06 | DONE | **Exists.** `apps/web/lib/unit-overview.ts` and the overview branch of `apps/web/app/api/learn/route.ts`. No model call on that branch. |
| C07 | Table: functional pass, SEC open. Tracker: BLOCKED | **Partial.** Page OCR and reading-order recovery exist under `packages/documents` and `packages/ai`. Live original-scan proof and enabled spend protection were not re-run here. Treat SEC as open. |
| C08 | DONE | **Exists.** `packages/documents/src/page-coverage.ts` and SQL `chunk_page_is_eligible`. Unreadable pages can be excluded while other pages stay citable. |
| C09 | DONE | **Exists.** `claim_document` / `commit_document_revision` / `abort_document_revision` in `supabase/migrations/20261014160000_atomic_reindex.sql`. Active revision stays until commit. |
| C10 | DONE | **Exists.** `supabase/migrations/20261014170000_topic_composition.sql` `refresh_topic_map`: guide documents are objectives, notes and slides are support. Retrieval still boosts `documents.source_priority`. |
| C11 | DONE | **Exists.** `apps/web/lib/ingest-jobs.ts`. Durable mode runs only when `STUDIGO_DURABLE_INGEST=1`. |
| C12 | DONE | **Partial, reusable.** `source_blocks` (`supabase/migrations/20261014180000_source_blocks.sql`, `packages/documents/src/source-blocks.ts`) have `revision`, `page_number`, `reading_order`, `block_key`. Chunks remain the RAG rows. There is no Canonical Studigo Document table. Block coverage is the constant `"readable"`. No section id on the block. |
| C13 | DONE | **Exists, flag off.** Job admission in `apps/web/lib/ingest-jobs.ts`. `STUDIGO_DURABLE_INGEST` defaults off. |
| C14 | DONE | **Exists, flag off.** Resumable runner is present and idle unless the durable flag and `CRON_SECRET` match. |
| C15 | DONE | **Partial, reusable.** `packages/ai/src/guide-content.ts` `StudyGuideContent` and `guide_editions`. `editionKey()` includes schema, prompt, room, level, sorted topic ids, and block text. Owner is the DB column, not the key string. Default composition is deterministic. Live generation is off. |
| C16 | DONE | **Exists.** `apps/web/lib/guide-lifecycle.ts` and `guide_editions.stale`. A pinned edition stays readable with `updateAvailable` (`apps/web/lib/guide-reading.ts`). Stale text is not rewritten in place. |
| C17 | DONE | **Exists.** `apps/web/components/room/guide-preview.tsx` reads the edition and can open a block quote. |
| C18 | DONE | **Exists.** `apps/web/lib/study-guide-pdf.ts` and `apps/web/app/api/study-guide/download/route.ts`. This is the generated guide, not the teacher original. |
| C19 | DONE | **Exists.** `apps/web/lib/study-guide-docx.ts`. Same generated edition. |
| C20 | DONE | **Exists.** `apps/web/lib/thread-restore.ts` restores per-surface messages. `shouldAutoResumeStoredTurn()` does not auto-submit. Stored citations are not re-labeled when the corpus moves. |
| C21 | DONE | **Exists in layout code.** `LessonMobileFrame`, `apps/web/lib/mobile-lessons.test.ts`, 44px targets and safe-area in `apps/web/app/globals.css`. Physical device passes are outside this inspection. |
| C22 | DONE | **Exists.** `apps/web/lib/guide-share.ts` shares or downloads the generated PDF/DOCX. Print in the guide preview prints the edition text. |
| C23 | DONE | **Exists, narrow.** `apps/web/lib/quiet-feedback.ts` acknowledges `lesson-open` and `guide-ready` once. Reduced motion is honored in `apps/web/components/companion/engine.ts`. |
| C24 | DONE in the tracker | **Partial.** See the revision section below. New retrieval, the mission RPC, Coach pending grades, and guide export filtering honor the active revision. Old chat transcripts and a pinned stale edition do not. |

## Systems the GL / UX cards say they reuse

### Source blocks

**Exists:** `source_blocks` keyed by `(document_id, revision, block_key)`, written in `apps/web/lib/ingest.ts` from `deriveSourceBlocks`, read by `read_source_block` and `apps/web/app/api/guides/source/route.ts` at `documents.active_revision`.  
**Gap:** coverage is always `"readable"`; location is page plus reading order, not a section id; chunks are still what Learn retrieves.  
**Risk:** GL01/GL04 treating a block row as word-precise OCR truth.

### Revision invalidation

**Exists:** `match_study_chunks` requires `c.revision = d.active_revision`. `study_rooms.corpus_revision` advances on successful publish and document delete (`supabase/migrations/20261014220000_corpus_revision.sql`). Mission read/commit refuses a cursor whose document revision moved. `apps/web/lib/coach-router.ts` refuses mastery when the pending challenge corpus or chunk hash is stale. `filterGuideEditionExport` in `apps/web/lib/source-freshness.ts` drops facts whose block key is gone.  
**Gap:** `selectFreshChunks` keeps a chunk when `sourceRevision == null`, and `RetrievedChunk` does not carry that field, so the TypeScript check does not add a second gate. `historicalCitation()` is only referenced from its test. Restored chat shows stored citations as they were saved. Abort does not advance the corpus. A stale guide edition remains readable.  
**Risk:** GL02 "stale missions stop" is true for the mission RPC and false for Learn chat history. Do not describe chat restore as revision-safe.

### Topic scope

**Exists:** Independent Coach and Learn selections, server thread pointers, `refresh_topic_map` objective vs support roles, `scopeTopicsForRequest()` in `apps/web/lib/engine.ts` rejecting unknown topic ids.  
**Gap:** Thread restore checks UUID shape, not current `topics.active`. Engine retrieval is room-wide plus semantic filters; it does not filter `source_document_ids`. No prerequisite edges.  
**Risk:** GL01 "every selected supported concept appears once" needs an explicit plan built from the selected id list. Retrieval scope alone will not guarantee that.

### Learn retrieval

**Exists:** `/api/learn` (`explainTopic` in `packages/ai/src/study.ts`), typed outcomes, contextual chat retrieval, enumerated overview. Learn routes do not call `record_learning_event`. `apps/web/app/api/learn/check/route.ts` is a formative check.  
**Gap:** Three Learn surfaces already: cursor lesson + composer in `coach-panel.tsx`, topic lessons in `learn-panel.tsx`, and `LearnMission` for the fixture / paused flag. `/api/learn` lesson generation does not see chat history. `packages/learning` lists activity `'learn'` and no production caller uses `nextChallenge` with it.  
**Risk:** GL03 adding a fourth surface, or GL02 calling the Coach director and writing mastery. The director stays Coach-owned.

### Coach control plane

**Exists:** `packages/learning/src/director.ts`, `reducer.ts`, `session.ts`. Idempotent `LearningEvent.id`. Coach path: `apps/web/lib/coach-director.ts`, `coach-router.ts`, `adaptive_turn_receipts`. Assessed mastery is `evidence: 'assessed'` with scaffold recorded.  
**Gap:** Nothing in Learn calls this director.  
**Risk:** Reusing `reduceLearningEvent` for an ungraded mission step. The new answer envelope keeps `authority: 'formative' | 'assessed'` so that choice stays in application code. `LEARN_MISSION_WRITES_MASTERY` is `false`.

### Companion

**Exists:** `apps/web/lib/companion-logic.ts` events `correct | wrong | blindspot | setDone | cardGood | cardMiss`. Quiz and cards dispatch them. `NEXT_PUBLIC_STUDIGO_COMPANION=off` removes the window. `prefers-reduced-motion` is honored. Speech lines are opt-in and are not learner audio.  
**Gap:** No mission events (`ready`, `listening`, `demonstrating`, `thinking`, `hinting`, `trying_again`, `checkpoint_complete`). Coach grading does not call `companion.event`. There is no sound-mute separate from the speech toggle. Quiet feedback covers only lesson-open and guide-ready.  
**Risk:** GL08 adding a second mascot controller, or playing the graded-win burst on an ungraded check.

### Exports, originals, spotlight

**Exists:** Generated PDF/DOCX download and share (`study-guide-pdf.ts`, `study-guide-docx.ts`, `guide-share.ts`). Materials Open / Download hit `/api/documents/download` (signed URL, owner via the user-scoped client). Phase 3 shelf copy says "Original files & Studigo guide" and "GENERATED FROM YOUR SOURCES" (`materials-panel.tsx`). Guide preview can print the **generated** edition (`aria-label="Print generated Studigo guide"`). Source spotlight (`guide-preview.tsx`) shows the extracted block and links "Open original at page N" for PDFs. `CitationChips` in `citations.tsx` opens the original at a page.  
**Gap:** There is no Print original action. Open tells the browser "view or print" and depends on the new tab. Non-phase3 top bar label is "Download study guide" (`study-guide-download-button.tsx`). Spotlight does not draw a word-level highlight on the original file. Original bytes stay available when the guide fails to load (the preview says so).  
**Risk:** GL09 relabeling the generated Print button as the teacher file. UX09 "one-touch print original" is still new, including a fallback when the file type cannot print.

### Spend and receipts

**Exists:** `consume_ai_budget` daily cap, used on chat. `guardAiRequest` / `claim_studigo_ai_receipt` when `STUDIGO_AI_ADMISSION=1` (`apps/web/lib/ai-admission.ts`). Learn client sends `x-studigo-operation-id` (`ai-operation-client.ts`). Mission receipts and Coach turn receipts are durable. `/api/learn` uses admission when the flag is on and does not call `reserveAiBudget` (chat does).  
**Gap:** Admission defaults off, so those routes currently run without the receipt layer. No speech operation exists to bill.  
**Risk:** GL05 or any new model call shipping ahead of `STUDIGO_AI_ADMISSION=1`.

## Card-by-card

### GL01 — LearningMissionPlan

**Exists:** topic ids and order, explanation level (`simpler | standard | deeper`), source blocks, guide editions, corpus revision, typed partial coverage. Contract skeleton: `packages/learning/src/mission.ts` (`LearningMissionPlan`, familiarity separate from `explanationLevel`, `unsupported_prerequisite`).  
**Gap:** no persisted plan, no prerequisite graph, no familiarity field in the room, beats recomputed in the client.  
**Risk:** building the plan from one excerpt the way `missionBeats()` does, or encoding age as the explanation level.

### GL02 — Director and persistence

**Exists:** mission RPC with pause, resume, back, advance, restart, expected revision, and request-id receipts. Stale source returns `sourceCurrent: false` and blocks commit. Learn does not write mastery.  
**Gap:** stored state is a five-phase reading cursor, not briefing → foundation → demonstration → learner_action → formative_check. No assistance history. No beat index. Same inputs do not replay a plan, because there is no plan.  
**Risk:** a parallel cursor table. Extend `learn_mission_cursors`.

### GL03 — Mission player

**Exists:** Coach | Learn switch, Chat | Topics, `LessonMobileFrame`, molded controls, design system, canonical companion. `LearnMission` (`apps/web/components/room/learn-mission.tsx`) is the paused player and only mounts for the fixture while `phase3Learn` is false.  
**Gap:** real rooms still get a lesson plus a composer. No Mission tab. The player asks the learner to tap a line from one excerpt and does not offer a typed or spoken answer on every beat.  
**Risk:** mounting `LearnMission` as the GL03 screen, or adding a second app shell. UX02/UX03 belong under `CoachPanel`.

### GL04 — Find it

**Exists:** citation chips, guide source route, materials spotlight, original open at a PDF page, page-eligibility checks.  
**Gap:** no mission-step spotlight, no reliable word highlight, no return-to-step contract, no learner highlight as an ungraded action. Assessed answer protection is a Coach/Quiz rule and is not wired to a Find it action.  
**Risk:** fabricating a highlight when `quoteSpan` is null. The contract uses null for that case.

### GL05 — Speech

**Exists:** text composer (`studigo-composer.tsx`), answer paths for Coach chat, Learn check, and quiz, admission hook, operation ids.  
**Gap:** no microphone capture, no transcript review, permission policy denies `microphone`. Companion "speech" is mascot lines.  
**Risk:** auto-submit, storing child audio, or billing a transcriber while admission is off. GL05 also has to change `Permissions-Policy` on purpose; this foundation does not.

### GL06 — Tap / selection answers

**Exists:** local `MissionBeat` choice, blank, and boxes in `learn-tap.ts`, used by the fixture mission. Quiz has `selectedChoice`. Scaffold ladder includes `constrained_choices` for assessed Coach work.  
**Gap:** no shared envelope was in the product (this change adds the type only). Plays are derived for every short excerpt, not chosen when the source supports them. They are not posted as answers. Ordering does not exist.  
**Risk:** a hinted choice calling `reduceLearningEvent` with assessed evidence. Keep `authority: 'formative'` on Learn.

### GL07 — Read-aloud

**Exists:** reduced motion, companion speech toggle for mascot lines.  
**Gap:** no read-aloud control, no OS speech adapter, no play/pause/speed for a step.  
**Risk:** a paid TTS call. The owner plan prefers device speech and zero new model spend for ordinary playback.

### GL08 — Companion feedback

**Exists:** one companion, graded quiz celebration, quiet ack, off switch, reduced motion.  
**Gap:** mission semantic events are absent. Errors do not have a dedicated gentle mission reaction beyond quiz `wrong`.  
**Risk:** blocking the next action on an animation, or replaying the quiz burst for a formative check.

### GL09 — Original rescue

**Exists:** private bucket, signed download, Open and Download on the shelf, originals still listed when the generated guide fails, phase 3 labels that separate "Studigo guide" from original files.  
**Gap:** Print original. The visible Print button prints the generated guide. The workspace button can still read "Download study guide" when the phase 3 shelf is off.  
**Risk:** one control that sometimes returns the teacher file and sometimes the edition.

### GL10 — Handoff and evaluation

**Exists:** Coach and Practice are separate modes. Topic ids can be passed in the room UI. Fixture samples exist for the Room 2 mission (`/dev/study`). Learn writes no mastery today.  
**Gap:** no "Try with Coach" handoff that preserves topic and source revision without copying formative results into mastery. No government-vocabulary plus college-physics mission harness. No privacy-safe mission analytics events.  
**Risk:** counting mission completion as mastery, or logging raw answers.

### UX01–UX10

| ID | Exists to reuse | Gap | Risk |
|---|---|---|---|
| UX01 | Room shell, Coach \| Learn, Chat \| Topics, V2 tokens in `docs/DESIGN_SYSTEM.md` and phase 3 CSS | No approved mission layout. The older engineering note forbids the Mission tab the owner plan asks for | Building the wireframe as a second app, or following the older note and dropping Chat |
| UX02 | Lesson header and topic scope | Entry is still a lesson plus composer. Resume restores chat phase, not a mission beat | A blank composer remaining the hero |
| UX03 | `LearnMission` column for the fixture; mobile lesson frame | Stages are not one director-backed sequence | UI advancing the stage locally, which `missionBeats()` already does |
| UX04 | Guide spotlight and citation page links | Phone sheet / desktop pane for a **mission** step; honest OCR limitation copy on that step | A drawn highlight without alignment data |
| UX05 | Local choice/blank/boxes; molded buttons; 44px targets | No action dock tied to permitted actions; no assisted-vs-independent record | Showing an answer format the source does not support |
| UX06 | Composer text submit | Whole speech lifecycle | Auto-submit of a transcript |
| UX07 | Text remains usable with companion speech off | Read-aloud and a help sheet that returns to the same step | Lesson depending on audio |
| UX08 | Canonical dragon and quiz celebration | Mission event map | A second dragon, or celebration that implies a grade |
| UX09 | Original open/download; generated PDF/Word/print; mode navigation | Print original; explicit handoff with no mastery grant | Original and edition sharing one label |
| UX10 | Layout tests, reduced motion, keyboard paths on the current lesson | No cross-device mission pilot, no mic-denied case, no source-revision case on a mission player | Calling the current lesson a pass for the new mission |

## Flag and contracts this change adds

- Flag: `apps/web/lib/guided-learn-flag.ts`. Off unless `STUDIGO_GUIDED_LEARN` and `NEXT_PUBLIC_STUDIGO_GUIDED_LEARN` are both `1`. The room shell sets `data-guided-learn="off"` by default. `phase3Learn` stays false. Coach panel mission mounting is unchanged.
- Contracts: `packages/learning/src/mission.ts`, re-exported from `packages/learning/src/index.ts`. Types and vocabularies only. No reducer, no I/O, no mastery write.

## Out of scope confirmation

No new agent framework, model provider, vector store, or queue. Retrieval stays `match_study_chunks`. Mastery writes stay on Coach and Quiz. The Python FAISS service stays off the production path.
