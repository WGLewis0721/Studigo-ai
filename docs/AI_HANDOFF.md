# AI Companion Handoff

This file exists so a new AI coding agent can enter the project cold and continue without re-litigating the product architecture.

## Integrated adaptive beta status

Read [ADAPTIVE_BETA_EVIDENCE.md](ADAPTIVE_BETA_EVIDENCE.md) for the implemented web beta, validation, additive migration, preview flags, rollback and outstanding TestFlight gates. Claude owns UI/UX; preserve the current interface. The local synthetic adapter is development-only and must never authorize hosted requests.

Read [SOL_PHASE3_REVIEW.md](SOL_PHASE3_REVIEW.md) for the sequential Sol xhigh
backend repairs and acceptance limits. Migration `20261002030000` adds exact
transactional Coach replies and locked source checks; `20261002020000` remains
required by the shared source-aware readers. Durable session/Coach lifecycle
linkage, measured RAG, trusted Quiz/Test provenance and native acceptance remain open.

## Read first

In order:

1. `README.md`
2. `docs/PRODUCT.md`
3. `docs/ARCHITECTURE.md`
4. `docs/ADAPTIVE_LEARNING_CORE.md`
5. `docs/ADAPTIVE_LEARNING_ENGINE.md`
6. `docs/ADAPTIVE_GAME_DIRECTOR_RESEARCH.md`
7. `IMPLEMENTATION.md`
8. `docs/APP_STORE_RELEASE_PLAN.md`
9. `docs/AUTH.md`
10. `docs/DESIGN_SYSTEM.md`
11. `docs/COMPANION_PARITY_PLAN.md`
12. `docs/ROADMAP.md`
13. `AGENTS.md`
14. `supabase/migrations/001_initial.sql`

Then inspect the current code before proposing changes.

## Game prototype (Moon Keep / Core Clash)

The multiplication Metroidvania lives in `prototypes/moon-road/` and is unrelated to the Next.js app at runtime. Before touching it read `prototypes/moon-road/CURRENT_GAME_HANDOFF.md` and `POC-XI.md`; the authoring pipeline is in `TOOLCHAIN.md`. The current golden route is `dist/poc-xi/` (tag `golden/poc-xi-moon-keep`); golden routes are frozen, so new experiments go in a new sibling route. Never link the game from `apps/web`.

## Latest state (October 1, 2026)

The core loop and the study modes are built and deployed from `main`. Read
`docs/ROADMAP.md`, "Latest shipped", first; it lists what changed most recently
and what is still unverified.


The companion window is now implemented in the web Study Room with shared
sprites, gaze/touch/idle behavior, dragging/resizing and real-state reactions.
The native iOS/iPadOS app is still unstarted.

Resolve the PR #59 handoff first, then complete or explicitly validate the existing downloadable study-guide P0 using `docs/USER_TEST_CASES.md`. Record evidence and remaining defects before starting V3 implementation. A local fixture PDF alone does not close hosted authorization, mobile open/share, print-layout, or learner-validation checks. After this gate, execute Phase 1, Phase 2, then Phase 3 in `IMPLEMENTATION.md`.

The approved V3 direction is documented in the root `IMPLEMENTATION.md`:
deterministic adaptive game director underneath a grounded GenAI study partner,
global room explanation level preserved, learner-facing Coach modes simplified
to Show me / Coach me / Challenge me, and one Expo / React Native Apple client
over the existing backend.

The OpenAI API key is a server-side secret. Never place it in an Expo config,
mobile bundle, browser-visible environment variable or client storage. Python,
LangChain and ML are allowed where Phase 1 measurements justify them; none gets
automatic authority over mastery/progression.

- The Study Room is five pages: Coach (holding Ask and Learn), Practice, Progress,
  Plan, Materials.
- Learn answers are a cited outline from the study guide, replies need no
  specific format, and typed text is read through one shared module,
  `packages/ai/src/typos.ts`. Keep new typed-text matching in that module and
  pick the right strictness level (loose, strict, command repair) rather than
  writing another edit-distance check. See `docs/ARCHITECTURE.md`, "Reading typed
  text".
- Model output and app copy avoid em dashes (`PLAIN_PUNCTUATION_RULE`).
- Not verified against the real model: the new Learn prompts, outline
  compliance, off-topic redirects and typo grading. Track these in the ordered
  validation plan above, and add an eval before tuning prompts further.
- The game in `prototypes/moon-road/` is separate and frozen at its golden image
  (currently POC XI). Do not edit a golden build; start the next experiment in a
  new sibling route.

## Original state (kept for context)

This repository began as a foundation scaffold moving into MVP implementation.
The lists below predate most of the build, so check the code and the roadmap
before trusting a "not yet" item.

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
