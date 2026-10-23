# @studigo/ai

Provider boundary for chat, embeddings, OCR, grounded answers, and structured study generation. Details and the public exports are in `README.md`.

- Import `openai` only in this package. `pnpm lint` fails if another package imports it.
- Embeddings stay 1536-dimensional. Ollama is chat-only.
- Wrap uploaded and retrieved text as untrusted data.
- `grounded` means a citation marker was used. Lexical support is `src/verify-claim.ts`.
- Room authorization, mastery writes, file parsing, and React UI do not belong here.

```bash
pnpm --filter @studigo/ai test
pnpm --filter @studigo/ai typecheck
```
