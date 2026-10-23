# @studigo/documents

File policy, extraction, and chunking. No network and no model SDK. Details are in `README.md`.

- Bytes must match the declared type before parsing.
- ZIP archives are bounded by entry count, declared size, and expansion ratio.
- Embeddings, retrieval, learner state, and storage credentials do not belong here.

```bash
pnpm --filter @studigo/documents test
pnpm --filter @studigo/documents typecheck
```
