# Studigo

Studigo is an AI study companion that turns a student's own class materials into a grounded, course-specific tutor.

Students create a **Study Room**, upload teacher study guides, textbook chapters, notes, worksheets, and presentations, then use one workspace to learn, ask questions, quiz themselves, generate flashcards, track mastery, and download their source files.

> Give Studigo what you are supposed to learn and the resources you are supposed to learn it from. Studigo turns them into a study companion.

## Status

The core student loop — **sign up → create a Study Room → upload materials →
ingest → ask → cited answer** — is implemented and working end to end, along
with Learn, Quiz, Flashcards, and mastery derived from real practice.

- **Frontend:** Next.js + React, responsive PWA shell.
- **Backend:** Next.js route handlers + Supabase Auth/Postgres/Storage.
- **AI layer:** provider-isolated OpenAI Responses + embeddings package.
- **RAG:** Supabase Postgres + pgvector with room-scoped similarity search.
- **Documents:** private uploads, metadata, processing states, and signed downloads.
- **Executable layer:** installable PWA now; Tauri desktop shell is reserved as a separate wrapper.
- **Handoff:** architecture, product constraints, implementation roadmap, and agent instructions in `docs/`.

What works today:

- **Accounts.** Email/password sign up, sign in, sign out; sessions refreshed in
  middleware and persisted across visits.
- **Study Rooms.** Create, open, rename, retitle, set a test date, delete
  (originals removed from storage with the room). Scoped per user by RLS.
- **Uploads.** Drag-and-drop PDF, DOCX, PPTX, TXT, Markdown, and photos of
  handouts, tagged by source type, with live processing state, duplicate
  detection, retry, and the original always openable and downloadable.
- **Ingestion.** Text extraction preserving page and slide numbers, OCR for
  scanned pages and images, normalization, page-accurate chunking, batched
  embeddings into pgvector.
- **Ask Studigo.** Streaming answers retrieved from that room only, with
  citations that open the learner's own file at the cited page, and an explicit
  "not in your materials" response when the evidence is not there.
- **Study-guide intelligence.** A teacher study guide automatically produces the
  topic map, each topic linked to the passages supporting it.
- **Learn / Quiz / Flashcards.** Real modes over the same knowledge base:
  grounded topic explanations, generated multiple-choice and short-answer
  questions with model-graded free text, and spaced-repetition cards.
- **Mastery.** Calculated from actual quiz and review performance — unpracticed
  topics count as zero, and a room with no practice shows no number at all.

Known limits: ingestion runs inside the request (idempotent and retryable, but a
very large scanned PDF can exceed the function timeout) rather than on a durable
queue, and native packaging is still the Tauri placeholder.

## Repository layout

```text
apps/
  web/                 Next.js UI + server/API routes
  desktop/             Tauri executable-shell placeholder
packages/
  ai/                  model/provider + RAG prompt contracts
  documents/           file policy, extraction, OCR splitting, chunking
supabase/
  migrations/          database, pgvector, RLS, retrieval RPC
  functions/           reserved for future out-of-request workers
docs/
  PRODUCT.md           product behavior and UX principles
  ARCHITECTURE.md      system boundaries and data flow
  DESIGN_SYSTEM.md     WebForge visual language and UI guardrails
  VERCEL_DEPLOYMENT.md exact Vercel monorepo deployment settings
  ROADMAP.md           ordered engineering plan
  AI_HANDOFF.md        rules for Opus/SuperGrok/Astra/etc.
```

## Local development

Prerequisites: Node 22, pnpm, a Supabase project, and an OpenAI API key for backend/AI features. The current homepage can render without Supabase/OpenAI configuration.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Apply the migrations in order before using the app:

```bash
supabase db push   # or run 001_initial.sql then 002_core_loop.sql by hand
```

`002_core_loop.sql` adds ingestion bookkeeping, the topic map, quizzes,
flashcards, the derived-readiness function, and the owner-scoped retrieval RPC.

Run the test suite with `pnpm test` (extraction, chunking, citation grounding,
and the spaced-repetition schedule), and `pnpm typecheck` across the workspace.

## Vercel

Studigo is a monorepo. The deployable Next.js application is `apps/web`, not the repository root.

For Vercel, configure the project with:

- Root Directory: `apps/web`
- Framework: Next.js
- Node.js: 22.x
- Output Directory: framework default (`.next`)
- Include source files outside the Root Directory: enabled

See [`docs/VERCEL_DEPLOYMENT.md`](docs/VERCEL_DEPLOYMENT.md) for the authoritative deployment and environment-variable checklist.

## Environment

See `.env.example`. Never commit real keys. `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are server-only.

## Core retrieval rule

Teacher-provided study guides and teacher materials should carry the highest retrieval/teaching priority. The textbook is supporting evidence. General model knowledge is not the default source of truth.

## Current handoff target

Read these files in order before making major changes:

1. `docs/PRODUCT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/DESIGN_SYSTEM.md`
4. `docs/ROADMAP.md`
5. `docs/AI_HANDOFF.md`

The next engineer should implement the ingestion pipeline before expanding the UI surface area.
