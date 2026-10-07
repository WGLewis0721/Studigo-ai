# Retrieval benchmark

No live ablation has been run. Dense pgvector retrieval stays the production path.

| Arm | Flag | Result |
| --- | --- | --- |
| Baseline dense retrieval | default | Production. `match_study_chunks`. Cutoff `0.35`. Ranking adds `teacher_source_boost`, which is still `priority / 1000`. |
| Hybrid | `STUDIGO_HYBRID_RETRIEVAL=1` calls `match_study_chunks_hybrid` | Built, default off. No measured gain. |
| Rerank | `STUDIGO_RERANK=1` overlap-sorts the returned chunks | Built, default off. Not a provider call. No measured gain. |
| Claim verifier | `groundingStatus` in `packages/ai/src/verify-claim.ts` | Lexical check. Does not replace the `grounded` marker bit. No precision/recall against human labels yet. |

Do not flip a default until a human-reviewed slice has a committed run under `evals/rag/results/`. That run does not exist. ADR 001 still gates the decision: zero unauthorized retrievals, at least 95% claim support, at least 95% abstention, no regression over two points.
