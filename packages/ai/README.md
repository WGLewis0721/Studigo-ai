# @studigo/ai

Provider boundary for chat, embeddings, OCR, grounded answers, and structured study generation.

Public exports are the package index, `packages/ai/src/index.ts`. Inputs are learner questions and retrieved chunks. Outputs are validated text, citations, and structured grades. Model credentials stay on the server.

Invariants:

- Import `openai` only from this package.
- Embeddings stay 1536-dimensional. Ollama is chat-only.
- Uploaded text is wrapped as untrusted data.
- `grounded` means a citation marker was used. Semantic support is `verify-claim.ts`, and it is not a model vote.

Test: `pnpm --filter @studigo/ai test`

Does not belong here: room authorization, mastery writes, file parsing, React UI.
