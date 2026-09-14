# Studigo Engineering Roadmap

The order matters. Do not spend a week polishing the dashboard before ingestion and grounded retrieval work.

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

- Final Studigo visual system and mascot direction.
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

1. Connect Supabase project and apply initial migration.
2. Implement Supabase SSR auth foundation plus `/login` and `/auth/callback`; start with Google OAuth, then Apple/Microsoft and email fallback.
3. Implement Study Room CRUD and verify two-user RLS isolation.
4. Build upload/file-manager UI against existing endpoints.
5. Choose and implement ingestion queue/worker.
6. Implement PDF/TXT parsing first; add DOCX/PPTX next.
7. Chunk and embed into `document_chunks`.
8. Test `/api/chat` against real uploaded material.
9. Add citations/source preview and persisted conversations.
10. Create a 25–50 question RAG eval set before tuning retrieval.
