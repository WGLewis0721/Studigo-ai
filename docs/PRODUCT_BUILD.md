# Studigo next product layer

This branch extends the integrated core app. It reuses topic extraction, pgvector retrieval, the AI provider in `packages/ai`, the existing question bank and grading, flashcards, earned mastery, source links, and the WebForge visual system.

## New learner flows

- **Weak Areas:** ranked topics with the evidence behind each recommendation and a direct Learn, Quiz, or Flashcards action.
- **Practice Test:** 6/10/15/20 questions across multiple active topics; mixed multiple-choice and short-response questions, saved drafts, question navigation, one whole-test submission, per-topic results, explanations and original-source links. No correctness, explanation, or answer key is sent before submission. The ordinary Quiz grading endpoint rejects practice-test question IDs.
- **Cram Mode:** 15/30/60/120-minute sessions embed the existing Learn, Quiz and Flashcards components. A deadline-based timer supports pause/resume and never submits responses automatically. Switching workspace modes preserves the session while the page remains open. A page reload resets Cram; saved practice evidence persists.
- **Study Plan:** up to seven days toward the room's test date (three days without one). Current weak topics, due cards, a rehearsal before the test, and a short test-day Cram session. Completion and skip events are bookkeeping, never mastery evidence.
- **Readiness:** Strong / Needs work / Not practiced groups, explanations of what holds readiness down, and direct next actions. The existing earned score is unchanged.
- **Navigation:** Study, Practice, Progress, Plan and Materials groups, each with a small secondary navigation. Contextual companion appearances accompany explanations and outcomes. High-scoring tests celebrate; lower scores suggest review. The existing orange character remains secondary to the study task.

## Decision rules

Weak Areas reads the latest 1,000 room attempts, then up to 12 recent attempts per topic. It examines up to three quiz answers and three self-reported card recalls in that window. Urgency combines mastery gap × 0.42, teacher priority × 0.18, 18 for an unpracticed topic, recent quiz miss ratio × 22, 4 per missed card recall, and up to 14 days since practice. These are transparent recommendation heuristics, not a calibrated prediction of exam performance. Fresh mastered topics leave the list; new misses or a week without practice bring them back. The UI shows evidence rather than the internal urgency number.

Practice Test allocation gives each affordable topic one question before distributing extras by priority divided by current allocation. It includes at least two topics. Each topic retrieves its own supporting chunks; generation must return the requested type/count and valid source markers. Generation fails rather than saving an incomplete test. The first allocated topic uses short response; the others use multiple choice. Coverage is explicitly shown when the question budget cannot cover every topic. True/false and fill-in-the-blank are future additions.

Cram selects the most urgent topics, budgets time for learning and recall, and adds more quiz time when the test is within two days. Each supported duration sums exactly to the selected time. The quiz and rapid-recall steps focus on the highest-ranked topic. A mixed-topic Cram quiz is a future enhancement.

Study Plan recomputes on server refresh after real practice, topic/material changes, date edits and plan events. Finished or skipped actions disappear for that date; skipped topic work moves into the next visible day. Missed past days restart from current weak areas. Dates use UTC calendar days. The plan deliberately avoids a calendar or a second mastery system.

## Additive implementation

Migration `20260912021422_study_planning.sql` adds:

- `practice_tests`: owner-readable, service-written drafts, topic snapshot and final result.
- `quiz_questions.practice_test_id` and `test_position`: reuse the existing private answer bank with safe browser column grants.
- `study_plan_events`: owner-scoped intention tracking.
- Service-only `create_practice_test` and `submit_practice_test` functions. Submission locks the room/test and invokes the existing attempt/mastery transaction for every question. Failure rolls back the full test; replay returns the original result.

New APIs: `/api/practice-tests` (list/open/create/autosave), `/api/practice-tests/submit`, `/api/study-plan`. New UI: `weak-areas-panel`, `practice-test-panel`, `cram-panel`, `study-plan-panel`. Decision helpers live in `lib/study-planning.ts`; `lib/study-evidence.ts` loads existing evidence. No additional framework, database, or AI vendor.

## Verification and remaining product work

`pnpm test` runs unit tests and actual PostgreSQL migrations through PGlite/pgvector. New coverage checks recommendation evidence, allocation, exact Cram budgets, adaptive plans, cross-user practice-test/plan access, private keys, all-question submission, transaction rollback, and idempotent mastery. This proves database behavior; it does not substitute for hosted Supabase Auth/Storage or model-quality testing.

Local visual fixture: `STUDIGO_VISUAL_QA=1 pnpm dev`, then `/dev/study?mode=weak`, `plan`, `cram`, `mastery`, or `test`. Add `&phone=1` for a 390px iframe. It contains explicitly labeled synthetic evidence and always returns 404 in production. This session's browser blocked localhost, so desktop/mobile visual QA remains outstanding.

Hosted acceptance still requires a Studigo Supabase project, the migrations and configured Supabase/OpenAI environment variables. Creation was blocked by the account's active free-project limit. Do not label the app beta-safe until upload → topic map → practice → test → source → plan → Cram has run against the hosted services with two real accounts.

Product opportunities: more question types; mixed-topic Cram recall; persisted Cram resume across devices; debounced draft saves with cross-tab conflict handling; local-time study days; student-informed tuning of recommendation weights. Visual and live-model quality checks remain release gates.
