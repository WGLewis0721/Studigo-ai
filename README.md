# Studigo

Studigo is an AI study companion that turns a student's own class materials into a grounded, course-specific tutor.

Students create a **Study Room**, upload teacher study guides, textbook chapters, notes, worksheets, and presentations, then use one workspace to learn, ask questions, quiz themselves, generate flashcards, track mastery, and keep the work as a downloadable study guide.

> Give Studigo what you are supposed to learn and the resources you are supposed to learn it from. Studigo turns them into a study companion.

## Status

The core student loop — **sign up → create a Study Room → upload materials →
ingest → ask → cited answer** — is implemented and working end to end, along
with Learn, Quiz, Flashcards, and mastery derived from real practice.

- **Frontend:** Next.js + React, responsive PWA shell.
- **Backend:** Next.js route handlers + Supabase Auth/Postgres/Storage.
- **Authentication:** Supabase Auth with Google, Apple, and Microsoft social OAuth as the launch providers, plus email fallback. Facebook is a later optional provider.
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

### Downloadable study guide

A Study Room now exposes a one-click **Download study guide** action. The first
release generates a PDF from the current learner-edited topic map, grounded
source passages, source/page references, and check-yourself prompts. Empty or
insufficient rooms return an explicit error rather than a fabricated guide.

Mobile open/download and print-layout validation still belong in the real-user
beta pass. See [`docs/USER_TEST_CASES.md`](docs/USER_TEST_CASES.md).

The next product-validation cycle is defined in
[`docs/USER_TEST_CASES.md`](docs/USER_TEST_CASES.md). The Coach's existing
coaching styles, learning traditions, and practice recipes are mapped to real
teaching/coaching paradigms in
[`knowledge/teaching-coaching/README.md`](knowledge/teaching-coaching/README.md).
Each UI option has its own retrieval-friendly Markdown record with stable YAML
metadata, examples, use cases, cautions, and research sources.

Known limits: ingestion runs inside the request (idempotent and retryable, but a
very large scanned PDF can exceed the function timeout) rather than on a durable
queue, and native packaging is still the Tauri placeholder.

### Active investigation — Coach "give me N questions"

The Coach routes *"give me 10 questions"* into a dedicated practice-generation
path, spreads generic sets across enough high-priority room material to sustain
the requested count, avoids prior prompts during top-up generation, and treats
follow-up answers as tutoring interactions rather than literal text matching.

Short answers are graded for semantic understanding. Partial understanding gets
partial credit plus a targeted nudge; an unrelated answer is redirected with a
simpler rephrasing and source-grounded hint; *"I don't know"* enters scaffold
mode. Live-site verification against the production model is still required.

The temporary anonymous-app and production fixture bypasses used during earlier
Coach debugging have been removed. `/app` requires authentication again, and
`/dev/study` plus `/api/dev/coach` are development-only.

- Problem, scope, and root causes: [`PROBLEM_STATEMENT.md`](PROBLEM_STATEMENT.md)
- Chronological change log and reversion checklist: [`ATTEMPTED_FIXES.md`](ATTEMPTED_FIXES.md)

## Authentication direction

Studigo uses **Supabase Auth as the single identity layer** for the web/PWA product and future native shells.

Launch priority:

1. Google
2. Apple
3. Microsoft (Azure / Entra ID)
4. Email fallback
5. Facebook later if product demand justifies it

The Next.js implementation should use Supabase's SSR/cookie pattern with an `/auth/callback` route. Provider credentials belong in Supabase Auth provider configuration, never in browser source code.

The login experience should use the Studigo WebForge visual system around provider-recognizable sign-in controls. Keep Google/Apple/Microsoft buttons familiar and trustworthy rather than restyling them into generic product CTAs.

See [`docs/AUTH.md`](docs/AUTH.md) for the canonical provider, callback, session, security, and first-login architecture.

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
knowledge/
  teaching-coaching/   Coach-method KB derived from the live UI taxonomy
docs/
  PRODUCT.md           product behavior and UX principles
  ARCHITECTURE.md      system boundaries and data flow
  AUTH.md              social OAuth, sessions, callback, auth UX/security
  DESIGN_SYSTEM.md     WebForge visual language and UI guardrails
  VERCEL_DEPLOYMENT.md exact Vercel monorepo deployment settings
  ROADMAP.md           ordered engineering plan
  USER_TEST_CASES.md   next production user-test and release cases
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

For social auth, production and approved preview callback URLs must also be configured in Supabase Auth. See [`docs/AUTH.md`](docs/AUTH.md).

## Environment

See `.env.example`. Never commit real keys. `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are server-only.

Social provider secrets are configured in Supabase Auth and must not be committed to this repository.

## Core retrieval rule

Teacher-provided study guides and teacher materials should carry the highest retrieval/teaching priority. The textbook is supporting evidence. General model knowledge is not the default source of truth.

## Current handoff target

Read these files in order before making major changes:

1. `docs/PRODUCT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/AUTH.md`
4. `docs/DESIGN_SYSTEM.md`
5. `knowledge/teaching-coaching/README.md`
6. `docs/USER_TEST_CASES.md`
7. `docs/ROADMAP.md`
8. `docs/AI_HANDOFF.md`

The next engineer should treat the core loop as real and protect it while shipping the next learner-value loop: upload → understand/practice → **download a trustworthy study guide**.
