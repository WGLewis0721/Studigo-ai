# Studigo Engineering Roadmap

The order matters. Do not spend a week polishing the dashboard before ingestion and grounded retrieval work.

## Phase 0 — Foundation (this scaffold)

- Monorepo/workspace.
- Next.js PWA shell.
- Supabase schema + RLS + private storage.
- Document upload/download contracts.
- OpenAI provider package.
- Room-scoped pgvector retrieval RPC.
- Grounded chat route.
- Tauri shell placeholder.
- Product/architecture/handoff docs.

Exit: another engineer can start implementation without choosing architecture from scratch.

## Phase 1 — Make the core loop real (implemented)

### Auth + rooms
- Add sign-up/sign-in/sign-out.
- Create/list/open/delete Study Rooms.
- Verify RLS with integration tests.

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

Exit: upload a real study guide + textbook chapter and get reliable cited answers.

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
- Extract explicit objectives/questions/terms.
- Map them to supporting source passages.
- Produce editable topic map.
- Mark inferred vs explicitly stated test scope.

### Learn mode
- Topic-by-topic explanation.
- Socratic checks.
- Age/grade-level adaptation without changing factual content.
- Examples grounded in source when possible.

### Flashcards
- Generate per topic.
- Student can edit/delete.
- Track recall performance.

### Quiz mode
- MCQ, true/false, fill-in, short response.
- Explain correct/incorrect answers from source.
- Avoid leakage of answer in stem.
- Store attempts.

### Practice test
- Build coverage-balanced assessments from study-guide scope.
- Separate answer/review flow.

Exit: Studigo can teach and test against the same source-grounded topic map.

## Phase 3 — Real mastery and planning

- Evidence-based topic mastery model.
- Weak-area queue.
- Spaced retrieval scheduling.
- Cram mode based on available time.
- Test-date study plan.
- Confidence vs performance calibration.
- Readiness score with transparent factors.

Exit: readiness is driven by demonstrated recall, not cosmetic activity metrics.

## Phase 4 — Reliability, safety, cost

- RAG evaluation dataset with known source answers.
- Retrieval precision/recall checks.
- Citation correctness checks.
- Hallucination/unsupported-answer tests.
- Prompt-injection tests using hostile uploaded documents.
- Parser fuzzing/file validation.
- Malware scanning.
- Rate limits/quotas.
- Cost budgets per user/room.
- Caching/deduplication.
- Model fallback strategy.
- Observability dashboards.

Exit: beta behavior is measurable and failures are diagnosable.

## Phase 5 — Product polish

- Final Studigo visual system and mascot direction.
- Onboarding.
- Empty/loading/error states.
- Mobile-first study interactions.
- Accessibility review.
- PWA icons/offline shell/install education.
- Notification/reminder strategy.

Exit: feels like a cohesive study companion rather than a developer tool.

## Phase 6 — Native/executable distribution

- Decide whether desktop packaging is actually valuable.
- Finalize hosted API boundary.
- Enable Tauri bundling/signing/updating if justified.
- Evaluate mobile-store wrapper only if PWA limitations block product goals.

## Phase 7 — School/family expansion (post-validation)

Only after individual-student value is proven:

- Parent mode.
- Teacher-curated rooms.
- Shared class resources with licensing/permissions.
- School/org accounts.
- Administrative controls.
- Required privacy/compliance work.

## Immediate next 10 engineering tasks

1. Connect Supabase project and apply initial migration.
2. Add authentication UI + middleware/session refresh.
3. Implement Study Room CRUD.
4. Build upload/file-manager UI against existing endpoints.
5. Choose and implement ingestion queue/worker.
6. Implement PDF/TXT parsing first; add DOCX/PPTX next.
7. Chunk and embed into `document_chunks`.
8. Test `/api/chat` against real uploaded material.
9. Add citations/source preview and persisted conversations.
10. Create a 25–50 question RAG eval set before tuning retrieval.
