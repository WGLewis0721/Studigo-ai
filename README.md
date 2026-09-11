# Studigo

Studigo is an AI study companion that turns a student's own class materials into a grounded, course-specific tutor.

Students create a **Study Room**, upload teacher study guides, textbook chapters, notes, worksheets, and presentations, then use one workspace to learn, ask questions, quiz themselves, generate flashcards, track mastery, and download their source files.

> Give Studigo what you are supposed to learn and the resources you are supposed to learn it from. Studigo turns them into a study companion.

## Scaffold status

This repository contains the general technology foundation for another engineering agent/team to continue:

- **Frontend:** Next.js + React, responsive PWA shell.
- **Backend:** Next.js route handlers + Supabase Auth/Postgres/Storage.
- **Authentication:** Supabase Auth with Google, Apple, and Microsoft social OAuth as the launch providers, plus email fallback. Facebook is a later optional provider.
- **AI layer:** provider-isolated OpenAI Responses + embeddings package.
- **RAG:** Supabase Postgres + pgvector with room-scoped similarity search.
- **Documents:** private uploads, metadata, processing states, and signed downloads.
- **Executable layer:** installable PWA now; Tauri desktop shell is reserved as a separate wrapper.
- **Handoff:** architecture, product constraints, implementation roadmap, and agent instructions in `docs/`.

This is intentionally a **foundation, not a fake finished MVP**. Upload/download, schema, retrieval contracts, and the chat path are scaffolded. Production document extraction, chunking, study-guide analysis, quizzes, mastery scoring, OCR, and native packaging remain implementation phases.

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
  documents/           file policy/path helpers
supabase/
  migrations/          database, pgvector, RLS, retrieval RPC
  functions/           async ingestion/embedding workers (next phase)
docs/
  PRODUCT.md           product behavior and UX principles
  ARCHITECTURE.md      system boundaries and data flow
  AUTH.md              social OAuth, sessions, callback, auth UX/security
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

Apply `supabase/migrations/001_initial.sql` to the Supabase project before using authenticated study rooms or RAG.

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
5. `docs/ROADMAP.md`
6. `docs/AI_HANDOFF.md`

The next engineer should preserve the shared Supabase identity/RLS model while making the upload → ingest → ask → cite loop real.
