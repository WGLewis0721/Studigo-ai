# @studigo/learning

Deterministic challenge, scaffold, and session policy. No model calls. Details are in `README.md`.

- The same events produce the same decision.
- This package owns production progression. `packages/mastery` does not.
- Prompts, embeddings, SQL, and UI copy do not belong here.

```bash
pnpm --filter @studigo/learning test
pnpm --filter @studigo/learning typecheck
```
