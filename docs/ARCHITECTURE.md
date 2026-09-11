# Studigo Architecture

## Goal

Keep the product easy to evolve by separating five concerns:

1. UI/product experience.
2. Identity/data/storage.
3. Document ingestion.
4. Retrieval + AI generation.
5. Installable/native shells.

## System map

```text
Student
  |
  v
Next.js / React PWA
  |
  |------------------------------|
  |                              |
  v                              v
Next.js server routes          Supabase Auth
  |                              |
  |                              +--> Google OAuth
  |                              +--> Apple OAuth
  |                              +--> Microsoft / Azure OAuth
  |                              +--> Email fallback
  |                              +--> Facebook later
  |                              |
  |                              v
  |                        authenticated user
  |
  +--> Supabase Postgres + RLS
  |       |-- study_rooms
  |       |-- documents
  |       |-- document_chunks + pgvector
  |       |-- topics/mastery
  |       |-- conversations/messages
  |       |-- product profile/onboarding data
  |
  +--> Supabase private Storage
  |       |-- original uploaded documents
  |
  +--> @studigo/ai
          |-- embeddings
          |-- retrieval response contract
          |-- grounded answer generation
          v
        OpenAI

Async ingestion
  upload -> queue -> extract text/OCR -> normalize -> chunk -> embed -> ready
```

## Frontend

`apps/web` is the primary product surface.

- Next.js App Router.
- Responsive by default.
- PWA manifest + service worker scaffold.
- WebForge V1 visual system is the current design direction.
- Do not put provider SDK secrets or privileged credentials in browser code.
- UI should consume internal API routes or a future dedicated API service.

Studigo should feel like a **living study field guide with a companion inside it**, not a generic education SaaS dashboard. Authentication, onboarding, Study Rooms, document management, tutoring, and mastery surfaces should all evolve from the same design system in `docs/DESIGN_SYSTEM.md`.

## Authentication and identity

Supabase Auth is the canonical Studigo identity layer. Do not introduce a parallel identity vendor unless a future requirement cannot reasonably be met by Supabase Auth.

### Launch providers

1. Google
2. Apple
3. Microsoft (Supabase `azure` provider)
4. Email fallback
5. Facebook later if justified by usage

Google One Tap may be evaluated after standard Google OAuth is stable.

### Web / PWA auth flow

The Next.js app should use Supabase's supported SSR/cookie pattern with PKCE for OAuth.

```text
/login
  -> signInWithOAuth(provider)
  -> Supabase Auth
  -> external provider
  -> Supabase provider callback
  -> /auth/callback
  -> exchange code for session
  -> onboarding check
      -> /onboarding for new/incomplete profile
      -> /app for returning user
```

The authenticated Supabase user ID is the principal used by RLS-protected Studigo data.

Provider credentials belong in Supabase Auth provider configuration, not in browser source code. Social provider secrets, Apple signing material, service-role keys, and OpenAI keys must never be exposed to the client or committed to the repository.

### Auth UI direction

The surrounding login/onboarding experience should use the Studigo WebForge system: warm paper surfaces, strong editorial hierarchy, limited companion use, and clear study-oriented copy.

The provider buttons themselves should remain immediately recognizable and trustworthy. Do not turn Google/Apple/Microsoft sign-in controls into stylized generic product CTAs that obscure the provider identity.

### Authorization boundary

Authentication answers **who the user is**. Postgres RLS answers **what the user can access**.

Do not weaken ownership policies because requests pass through Next.js server routes. User-owned Study Rooms, documents, conversations, and mastery records must remain database-authorized.

Do not use editable Supabase `user_metadata` values for authorization decisions.

See `docs/AUTH.md` for the canonical auth/provider/session/security design.

## Backend

For the first production iteration, backend logic can remain in Next.js route handlers plus Supabase rather than adding another API framework.

Use a separate backend service only when one of these becomes real:

- Long-running processing exceeds serverless limits.
- Queues/workers become operationally significant.
- Multiple clients need a durable public API contract.
- Native apps need a separately deployed API.
- Compliance/network boundaries require separation.

## Supabase responsibilities

### Auth

Student identity, OAuth provider integration, JWT issuance/refresh, sessions, and the shared account model for web/PWA and future native shells.

### Postgres

Product records and vector index. Row Level Security is mandatory on user-owned data.

### Storage

Original source files in private bucket `study-materials`.

### pgvector

Semantic retrieval of `document_chunks`. The first migration uses 1536-dimensional embeddings to match the default `text-embedding-3-small` scaffold setting.

If the embedding model/dimensionality changes, migrate the vector column and index deliberately. Do not silently swap embedding dimensions.

## AI package

`packages/ai` owns provider-specific calls and grounded-answer behavior.

The web application should not spread direct OpenAI calls across pages/routes. Keep model calls behind this package so future agents can:

- Change chat models.
- Change embedding models.
- Add reranking.
- Add hybrid lexical/vector retrieval.
- Add another provider.
- Add evaluation instrumentation.

without rewriting the product layer.

`OPENAI_CHAT_MODEL` has no source-code default on purpose. Model selection is a deployment decision.

## Retrieval

Current sequence:

```text
question
 -> embedding
 -> room-scoped match_study_chunks RPC
 -> semantic similarity + small source-priority boost
 -> grounded LLM response
 -> source citations
```

Retrieval must always be scoped to a Study Room and authenticated owner.

Future retrieval improvements should be measured with evals before adoption:

- Chunking strategy.
- Hybrid search.
- Metadata filters.
- Query rewriting.
- Reranking.
- Multi-query retrieval.
- Page-neighbor expansion.

## Document ingestion

The upload API intentionally stops at private storage + database metadata. Do not perform heavyweight OCR/parsing synchronously inside the upload request.

Target pipeline:

1. Upload original.
2. Create document record.
3. Enqueue ingestion job.
4. Mark `queued` / `processing`.
5. Extract text with page/slide/section structure.
6. OCR image-only pages if needed.
7. Normalize without destroying headings/tables/questions.
8. Chunk with document-aware metadata.
9. Generate embeddings.
10. Insert `document_chunks`.
11. Mark document `ready`.
12. Trigger Study Room topic analysis when appropriate.

Parsers should be adapters, not embedded in route handlers.

## Source priority

The database assigns source priority:

- Study guide: 100
- Teacher material: 95
- Worksheet: 90
- Presentation: 85
- Student notes: 75
- Textbook: 70
- Other: 50

This priority adds a modest ranking boost; it must not make irrelevant study-guide chunks outrank highly relevant supporting material.

## Documents and downloads

Original documents remain private. The download endpoint creates a short-lived signed URL after RLS verifies ownership.

Do not make the bucket public for convenience.

## Executable layer

### Phase 1: PWA

The web app is the canonical client and should be installable on desktop/mobile browsers.

### Phase 2: Tauri

`apps/desktop` reserves a Tauri v2 shell. Do not enable production bundling until the frontend/backend deployment boundary is finalized. A desktop shell should call the same hosted API rather than embedding secrets or duplicating AI logic.

Tauri or any future native shell should resolve authentication to the same Supabase users and RLS model. Do not create a separate native-only account system.

### Possible later mobile route

If native store distribution becomes important, evaluate Capacitor, React Native/Expo, or platform-native shells based on actual requirements. Do not build all three.

## Security rules

- Never expose `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, social-provider secrets, or Apple signing keys to the client.
- Use PKCE/state protections for OAuth and validate application redirect destinations.
- Avoid open redirects through callback query parameters.
- Do not use editable user metadata for authorization.
- Validate uploads server-side.
- Private storage only.
- RLS on all user-owned tables.
- Room-scoped retrieval.
- Signed download URLs with short TTL.
- Treat uploaded text as untrusted data, not executable instructions.
- Prompt injection inside source material must not override system/product policy.
- Add malware scanning and file-content validation before broad public launch.
- Test duplicate-email/account-linking behavior before public beta.
- Test session expiration, logout, and preview/production callback allowlists.

## Observability to add before beta

- Structured request IDs.
- Auth failure/callback diagnostics without logging provider secrets or tokens.
- Ingestion job status + retries.
- Model latency/token/cost metrics.
- Retrieval trace (chunk IDs, scores, source mix).
- User-visible document processing failures.
- Error reporting.
- RAG eval set and regression suite.
