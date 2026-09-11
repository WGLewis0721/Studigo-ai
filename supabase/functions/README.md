# Supabase Functions / Workers

The ingestion worker is intentionally not faked in the foundation scaffold.

## Target contract

A document upload should enqueue work containing only stable identifiers, for example:

```json
{
  "document_id": "uuid",
  "room_id": "uuid",
  "owner_id": "uuid"
}
```

The worker should then:

1. Load the document record using server credentials.
2. Mark it `processing`.
3. Download the original from private storage.
4. Select a parser by validated file type.
5. Extract structured text with page/slide/section metadata.
6. OCR only when extraction indicates it is required.
7. Normalize and chunk.
8. Generate embeddings using the same dimensionality as the database migration.
9. Insert chunks idempotently.
10. Mark the document `ready`.
11. On failure, store a safe error summary and mark `failed`.

## Requirements

- Idempotent retries.
- Bounded file size/time/memory.
- File-content validation rather than trusting filename extension.
- No user-provided text may become system instructions.
- Avoid logging full document content or secrets.
- Preserve enough structural metadata to produce useful citations.

## Queue choice

Do not choose a queue just to complete the diagram. Supabase/Postgres queue patterns, a hosted job runner, or a dedicated worker are all acceptable once deployment limits are known. Keep the worker contract independent from the queue implementation.
