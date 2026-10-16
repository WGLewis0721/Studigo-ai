# @studigo/mastery

Pure functions for BKT, Elo, and a spaced-repetition scheduler. Details are in `README.md`.

- Nothing here reads a database or calls a model.
- This package is not the production progression authority. `packages/learning` is.
- `evals/ml` uses synthetic data. A probability from this package is not an evidence stage.

```bash
pnpm --filter @studigo/mastery test
pnpm --filter @studigo/mastery typecheck
```
