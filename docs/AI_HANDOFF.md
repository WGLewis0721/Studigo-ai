# AI Companion Handoff

This file exists so a new AI coding agent can enter the project cold and continue without re-litigating the product architecture.

## Read first

In order:

1. `README.md`
2. `docs/PRODUCT.md`
3. `docs/ARCHITECTURE.md`
4. `docs/ROADMAP.md`
5. `AGENTS.md`
6. `supabase/migrations/001_initial.sql`

Then inspect the current code before proposing changes.

## Current state

This repository is a foundation scaffold, not a completed MVP.

Already established:

- Next.js/React primary client.
- PWA installability scaffold.
- Supabase Auth/Postgres/Storage architecture.
- Private `study-materials` storage design.
- pgvector `document_chunks` schema.
- RLS ownership policies.
- Source-priority model.
- Room-scoped retrieval RPC.
- Server-side OpenAI package.
- Upload endpoint.
- Signed-download endpoint.
- Grounded chat endpoint.
- Tauri desktop shell placeholder.

Not yet implemented:

- Auth screens/session middleware.
- Study Room CRUD UI.
- Production ingestion worker.
- File parsers/OCR.
- Chunk generation.
- Topic extraction.
- Chat UI/streaming/history.
- Quizzes/flashcards/practice tests.
- Mastery algorithm.
- PWA icons/polish.
- Production desktop bundling.

## Do not break these decisions casually

### 1. One canonical product, not separate web/native products
The PWA is the primary client. Native shells should reuse the same backend/product contracts.

### 2. Uploaded material is the default knowledge boundary
Do not quietly add web search or unrestricted model knowledge to grounded course answers.

### 3. Study-guide scope drives learning
The teacher's study guide has highest source priority. Textbooks support/clarify it.

### 4. Source priority is data, not only prompting
Keep retrieval priority inspectable and testable in the database/retrieval layer.

### 5. AI provider calls stay isolated
Do not scatter direct OpenAI SDK calls through React components and random API routes. Extend `packages/ai`.

### 6. Original files remain private
Do not make the storage bucket public. Use authenticated access and signed downloads.

### 7. Heavy ingestion is asynchronous
Do not parse/OCR/embed a 50 MB document synchronously inside the upload request.

### 8. RLS remains mandatory
A server route is not a substitute for database authorization.

## Preferred implementation style

- Small composable modules.
- Typed boundaries.
- Boring infrastructure over unnecessary microservices.
- Schema migrations for data-model changes.
- Idempotent/retryable ingestion jobs.
- User-visible processing/error states.
- Evals before clever RAG tuning.
- Explicit TODOs rather than pretending placeholders are complete.

## Recommended takeover split

If multiple capable agents are being used:

### Agent A — backend/data
Own Supabase connection, migration validation, auth, room CRUD, ingestion queue, storage/RLS tests.

### Agent B — AI/RAG
Own parsers/chunking interfaces, embeddings, retrieval evaluation, citations, topic extraction, quiz generation contracts.

### Agent C — product/frontend
Own Study Room UX, upload manager, source viewer, chat, learning modes, responsive/mobile behavior, PWA experience.

### Agent D — polish/review
Own architecture review, accessibility, threat modeling, eval gaps, performance, copy/design coherence.

Agents should work through PRs and preserve contracts instead of independently redesigning the stack.

## First implementation target

The first end-to-end acceptance test should be:

1. Sign in.
2. Create a Science Study Room.
3. Upload a teacher study guide PDF and one textbook PDF.
4. Wait for both to become `ready`.
5. Ask a question listed on the study guide.
6. Receive a correct answer supported by the files.
7. See document/page citations.
8. Download/open the original source.
9. Ask an unsupported question and receive an explicit insufficient-source response.

Do not call the core loop done until that works reliably.

## Definition of a useful AI change

A change to prompts/models/retrieval should answer:

- What failure is it fixing?
- What eval demonstrates the failure?
- What metric improves?
- Does citation correctness regress?
- Does cost/latency materially increase?

If those questions have no answer, the change is experimentation, not production improvement.
