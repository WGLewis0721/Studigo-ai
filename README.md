# Studigo

Studigo is an AI study companion that turns a student's own class materials into a grounded, course-specific tutor.

Students create a **Study Room**, upload teacher study guides, textbook chapters, notes, worksheets, and presentations, then use one workspace to learn, ask questions, quiz themselves, generate flashcards, track mastery, and download their source files.

> Give Studigo what you are supposed to learn and the resources you are supposed to learn it from. Studigo turns them into a study companion.

## Scaffold status

This repository contains the general technology foundation for another engineering agent/team to continue:

- **Frontend:** Next.js + React, responsive PWA shell.
- **Backend:** Next.js route handlers + Supabase Auth/Postgres/Storage.
- **AI layer:** provider-isolated OpenAI Responses + embeddings package.
- **RAG:** Supabase Postgres + pgvector with room-scoped similarity search.
- **Documents:** private uploads, metadata, processing states, and signed downloads.
- **Executable layer:** installable PWA now; Tauri desktop shell is reserved as a separate wrapper.
- **Handoff:** architecture, product constraints, implementation roadmap, and agent instructions in `docs/`.

This is intentionally a **foundation, not a fake finished MVP**. Upload/download, schema, retrieval contracts, and the chat path are scaffolded. Production document extraction, chunking, study-guide analysis, quizzes, mastery scoring, OCR, and native packaging remain implementation phases.

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
  ROADMAP.md           ordered engineering plan
  AI_HANDOFF.md        rules for Opus/SuperGrok/Astra/etc.
```

## Local development

Prerequisites: Node 20+, pnpm, a Supabase project, and an OpenAI API key.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Apply `supabase/migrations/001_initial.sql` to the Supabase project before using authenticated study rooms or RAG.

## Environment

See `.env.example`. Never commit real keys. `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are server-only.

## Core retrieval rule

Teacher-provided study guides and teacher materials should carry the highest retrieval/teaching priority. The textbook is supporting evidence. General model knowledge is not the default source of truth.

## Current handoff target

Read these files in order before making major changes:

1. `docs/PRODUCT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/ROADMAP.md`
4. `docs/AI_HANDOFF.md`

The next engineer should implement the ingestion pipeline before expanding the UI surface area.
