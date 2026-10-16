# services/retrieval

Local Python FAISS experiment. It is not production retrieval and it is not authenticated. Run steps are in `README.md`.

- Embeddings are 384-dimensional (`all-MiniLM-L6-v2`). The production column is pgvector 1536. Do not write these vectors into `document_chunks`.
- Production search is `match_study_chunks` under RLS, called from `apps/web/lib/retrieval.ts`.
- ADR `docs/adr/001-adaptive-rag-benchmark.md` keeps the TypeScript path until a matched benchmark says otherwise.
- Coach, semantic grading, and mastery stay in `packages/ai` and `packages/learning`.
