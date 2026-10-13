# @studigo/learning

Deterministic challenge, scaffold, and session policy. No model calls.

Public exports are `packages/learning/src/index.ts`. Input is learner events and preferences. Output is the next challenge and the reduced session state.

Invariants:

- The same events produce the same decision.
- This package owns production progression.
- `packages/mastery` does not.

Math practice lives in `src/math/`: problem families, exact answer checking, and picture specs as data. The answer is known before the question is asked, and a stored problem is re-validated before every use. The wording around a problem is in `apps/web/lib/math-copy.ts`, not here.

Three words that are not interchangeable:

- evidence stage: what the learner was observed doing
- readiness index: the product's deterministic priority
- mastery probability: a calibrated statistical estimate, and only when it is actually calibrated

Test: `pnpm --filter @studigo/learning test`

Does not belong here: prompts, embeddings, SQL, UI copy.
