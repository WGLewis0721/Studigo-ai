# @studigo/mastery

Pure functions for BKT, Elo, and a spaced-repetition scheduler.

Public exports are `packages/mastery/src/index.ts`. Input is a skill state and an observation. Output is the next state. Nothing here reads a database or calls a model.

This package is not the production progression authority. `packages/learning` is. The offline harness in `evals/ml` uses synthetic data. A probability from this package is not an evidence stage and is not written as mastery unless a later measured flag says so. That flag is not on.

Test: `pnpm --filter @studigo/mastery test`

Does not belong here: provider clients, RLS, Coach routing.
