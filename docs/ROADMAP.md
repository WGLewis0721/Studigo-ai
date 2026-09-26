# Studigo Engineering Roadmap

The order matters. The core product loop now works in production, so the
priority has changed from proving the architecture to proving repeatable learner
value.

## Current P0 — Downloadable study guide

The #1 missing user-facing feature is a simple way to **download the study guide
Studigo has built from the room**.

First-release acceptance:

- one visible **Download study guide** action from the Study Room;
- PDF is the default and requires no format picker;
- file opens on desktop/mobile and prints cleanly;
- current topic order and learner edits are preserved;
- concise explanations/key facts remain grounded in room sources;
- references let the learner trace important claims back to source material;
- include check-yourself/retrieval prompts so the PDF supports active recall;
- insufficient source evidence produces an honest in-product state instead of a
  polished-looking fabricated guide;
- export does not change mastery, attempts, scheduling, topics, or source files.

Canonical acceptance test: [`USER_TEST_CASES.md`](USER_TEST_CASES.md).

The order still matters: protect the working create → upload → study flow while
shipping outputs and validating them with real learners.

## Phase 0 — Foundation (this scaffold)

- Monorepo/workspace.
- Next.js PWA shell.
- Supabase schema + RLS + private storage.
- Supabase Auth chosen as the canonical identity layer.
- Document upload/download contracts.
- OpenAI provider package.
- Room-scoped pgvector retrieval RPC.
- Grounded chat route.
- Tauri shell placeholder.
- Product/architecture/handoff docs.

Exit: another engineer can start implementation without choosing architecture from scratch.

## Phase 1 — Make the core loop real (implemented)

### Auth + rooms
- Implement branded `/login` and `/auth/callback` surfaces using the Studigo design system.
- Configure Google OAuth first.
- Configure Apple OAuth.
- Configure Microsoft/Azure OAuth with required email scope.
- Add email fallback.
- Keep Facebook as a later optional provider rather than an MVP blocker.
- Use Supabase SSR/cookie sessions with PKCE for social OAuth.
- Add session refresh/protection for private app routes.
- Route first-time users through minimal onboarding, then into `/app`.
- Create/list/open/delete Study Rooms.
- Verify RLS with integration tests using at least two different users.
- Test login/logout, expired sessions, callback failures, and duplicate/account-linking cases.

### Document UI
- Upload dropzone.
- File type/source-type selector.
- Processing states.
- Open/download/delete.
- Retry failed processing.

### Ingestion worker
- Queue model with retries and idempotency.
- PDF text extraction preserving page numbers.
- DOCX extraction preserving headings/lists/tables where practical.
- PPTX extraction preserving slide numbers.
- TXT/Markdown support.
- OCR fallback for image-only PDFs/scans.
- Normalize and chunk.
- Generate embeddings.
- Persist chunks + metadata.
- Mark ready/failed.

### Grounded Ask mode
- Chat UI.
- Source chips/citations.
- Source preview / jump to page when possible.
- Persist conversations/messages.
- Streaming response.
- Clear insufficient-evidence behavior.

Exit: a student can sign in with a primary provider, create a Study Room, upload a real study guide + textbook chapter, and get reliable cited answers.

**Status: built.** Accounts, rooms, upload with processing state, the ingestion
worker (PDF/DOCX/PPTX/TXT/MD/image, OCR fallback, page-accurate chunks), and a
streaming grounded Ask mode with citations that open the original at the cited
page. Learn, Quiz, Flashcards, and derived Mastery — the Phase 2 pieces the core
loop needed to be a study product rather than a chat window — are built on the
same retrieval path.

Still open from the original Phase 1 list:

- Ingestion runs inside the request rather than on a durable queue. It claims
  work idempotently and retries by hand, which holds at current scale; a very
  large scanned PDF can still exceed the function timeout.
- Retry is learner-initiated, not automatic with backoff.
- RLS is enforced and exercised by the app, but there is no automated
  integration test asserting cross-account isolation yet.

## Phase 2 — Turn RAG into a study product

### Study-guide analyzer
- [x] Extract explicit objectives/questions/terms.
- [x] Map them to supporting source passages.
- [x] Produce editable topic map. Learners retitle, reword, re-prioritise, remove
  and add topics. Their wording wins: a re-ingested guide re-links evidence and
  ordering but never overwrites an edit, and never resurrects a removed topic.
- [ ] Mark inferred vs explicitly stated test scope.

### Learn mode
- [x] Topic-by-topic explanation.
- [x] Socratic checks. Studigo asks the learner to explain the idea back, responds
  to what they actually said, and follows up on the gap. Formative by design: it
  records no attempt and moves no mastery.
- [x] Age/grade-level adaptation without changing factual content. `simpler` /
  `standard` / `deeper` is set per room and changes only how an idea is pitched;
  the excerpts, the citation rule and the facts are identical at every level.
- [x] Examples grounded in source when possible.

### Flashcards
- [x] Generate per topic.
- [x] Student can edit/delete. Editing preserves the spaced-repetition schedule,
  so fixing a typo never costs the recall history behind the card.
- [x] Track recall performance.

### Quiz mode
- [x] MCQ, true/false, fill-in, short response. True/false and fill-in are graded
  deterministically server-side — no model call, so they are instant and free.
  Fill-in accepts every listed spelling and forgives a single typo on a long term.
- [x] Explain correct/incorrect answers from source.
- [x] Avoid leakage of answer in stem. Generation is instructed against it and a
  fill-in stem containing its own answer is discarded before a learner sees it.
- [x] Store attempts.

### Practice test
- [x] Build coverage-balanced assessments from study-guide scope. Formats now
  rotate across the four question types within one test.
- [x] Separate answer/review flow.

Exit: Studigo can teach and test against the same source-grounded topic map.
**Status: met.**

## Phase 3 — Real mastery and planning

- [x] Evidence-based topic mastery model.
- [x] Weak-area queue.
- [x] Spaced retrieval scheduling.
- [x] Cram mode based on available time.
- [x] Test-date study plan.
- [x] Confidence vs performance calibration. Rating an answer is the submit
  action, so every quiz answer carries a confidence with no extra step. Wrong
  while confident is surfaced as a *blind spot* and ranked above an ordinary gap
  in Weak Areas; Mastery reports whether the learner can trust their own sense
  of what they know.
- [x] Readiness score with transparent factors.

Exit: readiness is driven by demonstrated recall, not cosmetic activity metrics.

## Phase 3.5 — Export + real-user validation (current)

### Downloadable study guide
- [x] One-click PDF export from a Study Room.
- [x] Source-grounded topic notes/key facts from linked room material.
- [x] Current learner-edited topic wording/order.
- [x] Source/page references in the exported artifact.
- [x] Embedded retrieval/check-yourself prompts.
- [x] Honest empty/insufficient-evidence state.
- [ ] Mobile download/open validation.
- [ ] Printable layout validation.
- [x] Export PDF regression coverage; export path is read-only and does not mutate mastery/practice/source state.

### Next user-validation cycle
- [ ] Run the canonical cases in [`USER_TEST_CASES.md`](USER_TEST_CASES.md).
- [ ] Re-test the create-room mobile 404 regression on iPhone/Safari.
- [ ] Measure time-to-first-value and study-guide download success.
- [ ] Observe whether users understand teacher-study-guide scope vs supporting
      textbook/material scope.
- [ ] Run the downloaded-guide trust questions with real learners.
- [ ] Convert repeated user failures into focused regression tests before adding
      more surfaces.

### Teaching + coaching knowledge base
- [x] Inventory the live Coach taxonomy directly from
      `apps/web/components/room/coach-panel.tsx`.
- [x] Map every coaching style, learning tradition, and practice recipe to the
      closest documented real-world paradigm in
      [`../knowledge/teaching-coaching/README.md`](../knowledge/teaching-coaching/README.md).
- [x] Store each option as retrieval-friendly Markdown with stable YAML metadata,
      examples, use cases, cautions, and sources.
- [x] Mark Studigo composites and product policies explicitly instead of
      presenting them as named research traditions.
- [ ] Wire Coach directive construction to retrieve these records rather than
      keeping the research rationale only in documentation.
- [ ] Review the two country-labelled composites ("Japanese-inspired" and
      "Swedish-inspired") against the KB before changing their production prompt
      wording.

Exit: a learner can complete create → upload → study → **download**, and the
artifact is trusted enough to print/use without manual reconstruction.

## Phase 3.6 — Adaptive learning game engine (planned)

Connect the existing learning surfaces through one deterministic learner-state
and challenge system rather than adding another AI orchestration layer.

Core direction:

- **Low language floor, high skill ceiling.**
- Treat Learn, Coach, Quiz, Flashcards, Practice Test, Weak Areas, and Cram as
  mini-games that contribute evidence to one learner state.
- Let demonstrated performance determine challenge; let learner preference choose
  a teaching route/build.
- Add independent reasoning and scaffolding ladders so challenge can rise without
  making language harder.
- Use simple state, counters, thresholds, reducers, and persistent encounter
  history before considering learned recommendation models.
- Let prior struggles create future rematches, while successful transfer becomes
  strong mastery evidence.
- Keep learning traditions as coaching routes through the same mastery target.
- Keep generative AI as a core Coach capability for dialogue, semantic grading,
  grounded explanation, and feedback, while the learning control plane remains
  deterministic and owns progression, mastery, scaffolding, and encounter state.

Technical design, data contracts, infrastructure boundaries, delivery order, and
explicit anti-overengineering constraints live in
[`ADAPTIVE_LEARNING_ENGINE.md`](ADAPTIVE_LEARNING_ENGINE.md).

Exit: two learners using the same material can receive appropriately different
next challenges from observable performance, all mini-games contribute to one
concept-level learning state, and the learning control plane can determine the
next action independently of generation while Coach uses generative AI to deliver
that action naturally.
## Active investigation — Coach practice-set generation

Tracked in [`../PROBLEM_STATEMENT.md`](../PROBLEM_STATEMENT.md) and
[`../ATTEMPTED_FIXES.md`](../ATTEMPTED_FIXES.md).

A Coach request for *N* practice questions must return *N* distinct,
source-grounded questions rather than narrating the learner's selected
customization options.

- [x] Route "give me N questions" into a practice-generation intent instead of
      the grounded-answer/refusal path (`lib/recommendation-engine.ts`,
      `lib/engine.ts`).
- [x] Single orchestration layer: intent → topic selection → grounded
      generation → formatting → citations.
- [x] Near-duplicate collapse verified against genuinely distinct material;
      unit + end-to-end pipeline tests green 10× consecutively.
- [x] Model client falls back to Vercel AI Gateway when `OPENAI_API_KEY` is
      absent, keeping the direct OpenAI path unchanged when present.
- [ ] **Verify real generation on the deployed Vercel app** (the preview
      sandbox has env-injection + AI-Gateway-billing limits the deploy does not).
- [x] Revert the temporary testing surfaces before beta: `/app` requires
      authentication again and `/dev/study` + `/api/dev/coach` are
      development-only.

## Phase 4 — Reliability, safety, cost

- RAG evaluation dataset with known source answers.
- Retrieval precision/recall checks.
- Citation correctness checks.
- Hallucination/unsupported-answer tests.
- Prompt-injection tests using hostile uploaded documents.
- Parser fuzzing/file validation.
- Malware scanning.
- Auth abuse/rate-limit tests.
- OAuth redirect/open-redirect tests.
- Rate limits/quotas.
- Cost budgets per user/room.
- Caching/deduplication.
- Model fallback strategy.
- Observability dashboards.

Exit: beta behavior is measurable and failures are diagnosable.

## Phase 5 — Product polish

- Final Studigo visual system and mascot direction. *(Visual system V2, "Personal Learning Device", is implemented across marketing, auth and the Study Room — see `docs/DESIGN_SYSTEM.md`. New mascot poses remain future work.)*
- Authentication/onboarding polish.
- Empty/loading/error states.
- Mobile-first study interactions.
- Accessibility review.
- PWA icons/offline shell/install education.
- Notification/reminder strategy.
- Evaluate Google One Tap only after standard Google OAuth is stable.

Exit: feels like a cohesive study companion rather than a developer tool.

## Phase 6 — Native/executable distribution

- Decide whether desktop packaging is actually valuable.
- Finalize hosted API boundary.
- Reuse the same Supabase identity/account model in native shells.
- Enable Tauri bundling/signing/updating if justified.
- Evaluate mobile-store wrapper only if PWA limitations block product goals.
- If true native Apple clients are built, evaluate native Sign in with Apple while preserving the shared Supabase user model.

## Phase 7 — School/family expansion (post-validation)

Only after individual-student value is proven:

- Parent mode.
- Teacher-curated rooms.
- Shared class resources with licensing/permissions.
- School/org accounts.
- Administrative controls.
- District-specific Microsoft/Entra tenant restrictions when needed.
- Required privacy/compliance work.

## Immediate next 10 engineering tasks

1. **Production-validate Study Guide PDF download** on desktop/mobile and print.
2. Add remaining endpoint-level export tests for empty rooms, response headers,
   filenames, and learner-edited/removal cases.
3. Run the production user-test suite in
   [`USER_TEST_CASES.md`](USER_TEST_CASES.md), starting with mobile room creation
   and Study Guide download.
4. Validate downloaded-guide trust: source traceability, usefulness, printability,
   and whether a learner would use it instead of rebuilding a guide manually.
5. Wire the Coach's style/tradition/practice directives to the canonical
   [`../knowledge/teaching-coaching/README.md`](../knowledge/teaching-coaching/README.md)
   records so the current UI taxonomy and its research grounding cannot drift.
6. Add automated two-user RLS integration tests for rooms, documents, citations,
   downloads, and mutations.
7. Move ingestion off request-bound execution onto a durable retryable worker
   before large-document volume makes timeouts a common user failure.
8. Build the 25–50 item grounded RAG/citation eval set and run it before retrieval
   or model changes.
9. Finish deployed Coach "give me N questions" + tutor-scaffolding verification
   against the real production model.
10. Instrument production failure modes and user-critical funnel steps:
    create room → upload ready → first useful study action → Study Guide download.

Do not replace these with another foundation rewrite. The architecture has
crossed the threshold where user-value, regression prevention, and reliability
matter more than adding parallel infrastructure.
