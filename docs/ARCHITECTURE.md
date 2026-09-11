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
  |--------------------------|
  |                          |
  v                          v
Next.js server routes      Supabase Auth
  |                          |
  |                          v
  |                    authenticated user
  |
  +--> Supabase Postgres + RLS
  |       |-- study_rooms
  |       |-- documents
  |       |-- document_chunks + pgvector
  |       |-- topics/mastery
  |       |-- conversations/messages
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

Async ingestion (next implementation phase)
  upload -> queue -> extract text/OCR -> normalize -> chunk -> embed -> ready
```

## Frontend

`apps/web` is the primary product surface.

- Next.js App Router.
- Responsive by default.
- PWA manifest + service worker scaffold.
- Do not put provider SDK credentials in browser code.
- UI should consume internal API routes or a future dedicated API service.

The current home screen is only a product-shell reference. It is not the final visual design.

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
Student identity and sessions.

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

### Possible later mobile route
If native store distribution becomes important, evaluate Capacitor, React Native/Expo, or platform-native shells based on actual requirements. Do not build all three.

## Security rules

- Never expose `OPENAI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to the client.
- Validate uploads server-side.
- Private storage only.
- RLS on all user-owned tables.
- Room-scoped retrieval.
- Signed download URLs with short TTL.
- Treat uploaded text as untrusted data, not executable instructions.
- Prompt injection inside source material must not override system/product policy.
- Add malware scanning and file-content validation before broad public launch.

## Observability to add before beta

- Structured request IDs.
- Ingestion job status + retries.
- Model latency/token/cost metrics.
- Retrieval trace (chunk IDs, scores, source mix).
- User-visible document processing failures.
- Error reporting.
- RAG eval set and regression suite.
