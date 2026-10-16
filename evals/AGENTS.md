# evals/

Offline checks. They do not authorize a production quality claim.

| Path | What it is |
| --- | --- |
| `evals/rag/` | Synthetic grounding, abstention, isolation, and prompt-injection cases. No committed live run. See `docs/adr/001-adaptive-rag-benchmark.md` and `docs/RETRIEVAL_BENCHMARK.md`. |
| `evals/grading/` | Scorer for semantic grades. `fixtures.json` is not a human label set. See `docs/SEMANTIC_GRADER_EVAL.md`. |
| `evals/ml/` | Advisory Python BKT harness on synthetic data. It does not write mastery. |

```bash
pnpm test:rag
node --test evals/grading/*.test.mjs
pnpm test:ml
```
