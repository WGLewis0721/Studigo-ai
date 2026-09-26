# AI Companion Handoff

This file exists so a new AI coding agent can enter the project cold and continue without re-litigating the product architecture.

## Read first

In order:

1. `README.md`
2. `docs/PRODUCT.md`
3. `docs/ARCHITECTURE.md`
4. `docs/AUTH.md`
5. `docs/DESIGN_SYSTEM.md`
6. `docs/ROADMAP.md`
7. `AGENTS.md`
8. `supabase/migrations/001_initial.sql`

Then inspect the current code before proposing changes.

## Current state

This repository is a foundation scaffold moving into MVP implementation.

Already established:

- Next.js/React primary client.
- PWA installability scaffold.
- Studigo "Personal Learning Device" visual system (V2; replaced WebForge V1).
- Supabase Auth/Postgres/Storage architecture.
- Social auth decision: Google, Apple, Microsoft first; email fallback; Facebook later.
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

Not yet guaranteed complete until verified in current code:

- Production-ready auth screens/session middleware.
- Google/Apple/Microsoft provider configuration.
- First-login onboarding flow.
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

### 2. One canonical identity layer
Supabase Auth owns Studigo identity across web/PWA and future native shells. Do not add Clerk/Auth0/Firebase Auth alongside it without a concrete unmet requirement.

Launch auth priority is Google -> Apple -> Microsoft -> email fallback. Facebook is later/optional. See `docs/AUTH.md`.

### 3. Auth UX is Studigo-branded, provider controls remain recognizable
Use the Studigo design system around login/onboarding, but keep Google/Apple/Microsoft buttons familiar, accessible, and compliant with provider branding expectations.

### 4. Uploaded material is the default knowledge boundary
Do not quietly add web search or unrestricted model knowledge to grounded course answers.

### 5. Study-guide scope drives learning
The teacher's study guide has highest source priority. Textbooks support/clarify it.

### 6. Source priority is data, not only prompting
Keep retrieval priority inspectable and testable in the database/retrieval layer.

### 7. AI provider calls stay isolated
Do not scatter direct OpenAI SDK calls through React components and random API routes. Extend `packages/ai`.

### 8. Original files remain private
Do not make the storage bucket public. Use authenticated access and signed downloads.

### 9. Heavy ingestion is asynchronous
Do not parse/OCR/embed a 50 MB document synchronously inside the upload request.

### 10. RLS remains mandatory
A server route or successful OAuth login is not a substitute for database authorization.

## Preferred implementation style

- Small composable modules.
- Typed boundaries.
- Boring infrastructure over unnecessary microservices.
- Schema migrations for data-model changes.
- Idempotent/retryable ingestion jobs.
- User-visible processing/error states.
- Evals before clever RAG tuning.
- Explicit TODOs rather than pretending placeholders are complete.
- Current Supabase docs checked before auth implementation because provider/SSR guidance changes.

## Recommended takeover split

If multiple capable agents are being used:

### Agent A — backend/data
Own Supabase connection, migration validation, social auth/session foundation, room CRUD, ingestion queue, storage/RLS tests.

### Agent B — AI/RAG
Own parsers/chunking interfaces, embeddings, retrieval evaluation, citations, topic extraction, quiz generation contracts.

### Agent C — product/frontend
Own branded login/onboarding UX, Study Room UX, upload manager, source viewer, chat, learning modes, responsive/mobile behavior, PWA experience.

### Agent D — polish/review
Own architecture review, accessibility, OAuth threat modeling, auth edge cases, eval gaps, performance, copy/design coherence.

Agents should work through PRs and preserve contracts instead of independently redesigning the stack.

## First implementation target

The first end-to-end acceptance test should be:

1. Sign in with Google (then verify Apple/Microsoft separately).
2. Land in minimal onboarding or the app with a persistent Supabase session.
3. Create a Science Study Room.
4. Upload a teacher study guide PDF and one textbook PDF.
5. Wait for both to become `ready`.
6. Ask a question listed on the study guide.
7. Receive a correct answer supported by the files.
8. See document/page citations.
9. Download/open the original source.
10. Ask an unsupported question and receive an explicit insufficient-source response.
11. Sign out and verify private routes/data are no longer accessible.

Do not call the core loop done until that works reliably.

## Definition of a useful AI change

A change to prompts/models/retrieval should answer:

- What failure is it fixing?
- What eval demonstrates the failure?
- What metric improves?
- Does citation correctness regress?
- Does cost/latency materially increase?

If those questions have no answer, the change is experimentation, not production improvement.
