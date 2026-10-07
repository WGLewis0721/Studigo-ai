# Measured-evidence plan

Status: proposed. Nothing here changes production behavior until a PR for the relevant step is accepted.

## Why this plan exists

Studigo has strong grounding and privacy design, and an unusually careful offline evaluation harness (`evals/rag`, `evals/ml`, [ADR 001](../docs/adr/001-adaptive-rag-benchmark.md)). What it does not yet have is measured results. The 120 RAG candidate cases are all `review.status = pending`, no run output is committed, and CI only exercises the scorer with artificial data. The architecture gate in the ADR is still open.

This plan closes that gap in about three weeks. It follows the non-negotiables in [AGENTS.md](../AGENTS.md): grounded by default, RLS preserved, provider calls inside `packages/ai`, heavy ingestion out of synchronous requests, uploaded content treated as untrusted, and tests or evals around every behavior change.

The goal is a repo where every quality claim has a number next to it, and where each improvement is shown by an ablation on the same reviewed corpus.

A second goal is legibility. Someone who opens the repo, or hears it described in a conversation, should see both the AI engineering and the software engineering methodology within a couple of minutes, and be able to follow a short, honest walkthrough: what the model does, what deterministic code does, how quality is measured, which engineering rules govern changes, and what is still open. [AI_ENGINEERING_TOUR.md](AI_ENGINEERING_TOUR.md) is that walkthrough. It is written now against the current state, and its status column and limits section get updated as each step below lands, so it never claims more than the committed results support.

## Findings this plan responds to

| Area | Finding | Where |
| --- | --- | --- |
| Evidence | Eval cases are synthetic and unreviewed; no committed run results; no live adapter | `evals/rag/` |
| Retrieval | Dense top-k only, fixed 0.35 similarity cutoff, `priority/1000` score bonus, no hybrid search, no reranker, chat history not used in the query | `apps/web/lib/retrieval.ts`, `supabase/migrations/002_core_loop.sql` |
| Citations | `grounded` means only that a `[n]` marker appears in the answer text; no check that the cited passage supports the claim | `packages/ai/src/grounding.ts` (`citationsUsedIn`) |
| Abstention | The "not in your materials" path fires only when zero chunks pass the cutoff | `packages/ai/src/grounding.ts` |
| Grading | LLM short-answer grader has fixed score bands and no calibration against human labels | `packages/ai/src/study.ts` (`gradeShortAnswer`) |
| Operations | No tracing, token or cost logging, or rate limiting on `/api/chat` and uploads; prompts are not versioned | `apps/web/app/api/chat/route.ts` |
| Ingestion | Runs inside the request; large scanned PDFs can exceed the function timeout | `apps/web/lib/ingest.ts` |
| CI hygiene | `next lint \|\| true`, echo-stub package lints, `--no-frozen-lockfile` | `package.json`, `.github/workflows/ci.yml` |
| Repo focus | Moon Keep prototype and a side Python retrieval service sit beside the learning app | `prototypes/moon-road/`, `services/retrieval/` |

## Week 1: Measure what exists

1. **Review a first set.** Hand-review about 50 of the 120 cases. Balance across `plain`, `table`, `unsupported`, `conflict`, `injection`, and `foreign-user` scenarios. Record the reviewer and flip `review.status` only for cases that were actually reviewed.
2. **Build the live TypeScript adapter** for `evals/rag/run.mjs`. It calls the real `match_study_chunks` path and logs retrieved ids with revisions, claims with sources, tool calls, latency, and cost. Pin model, embedding model hash, prompt hash, and temperature in `config`.
3. **Run the baseline** and commit the JSON to `evals/rag/results/`. Add a results table to the README: retrieval hit rate at k, claim-level support, correct abstention, unauthorized retrievals (must be zero), p95 latency, and dollars per answer.

Exit: published baseline numbers, including any that miss the 95% gates in the ADR.

## Week 2: Improve and prove it

4. **Hybrid retrieval.** Add a migration with a `tsvector` column and index. Merge full-text and vector rankings with reciprocal rank fusion, behind a flag. Keep the owner and room predicates identical to the current function.
5. **Reranker.** Rerank the top 20 candidates, behind a flag, with the provider call inside `packages/ai`.
6. **Tune the cutoff.** Choose the similarity threshold from the eval set, and replace the `priority/1000` bonus with an explicit, documented source boost that keeps teacher study-guide priority.
7. **Claim verifier.** After generation, check each cited claim against its cited chunk, and flag or remove unsupported claims. Measure verifier precision and recall against the human labels from step 1.
8. **Ablation.** Report baseline, +hybrid, +rerank, +verifier on the same corpus hash, each with its latency and cost change. Follow the ADR gates: no regression over two points, and an improvement is stated with its tradeoff.

Exit: at least one measured gain, with its cost stated.

## Week 3: Harden and package

9. **Observability.** Add tracing (Langfuse or OpenTelemetry), per-turn token and cost logging, and a prompt version id recorded with every model call.
10. **Rate limits and ingestion.** Rate-limit `/api/chat` and uploads. Move ingestion onto a durable worker or queue; if that does not fit the window, document the limit and its failure mode in the README.
11. **CI and boundaries.** Add a small eval smoke subset (about 10 cases) that fails on regression. Remove `|| true` from lint, give each package a real lint, and use a frozen lockfile. Enforce the provider boundary with a lint rule that forbids importing the model SDK outside `packages/ai`. Run the Playwright beta verification in CI, and add a coverage report so the test suite's reach is visible.
12. **Repo focus.** Relocate rather than delete, per AGENTS.md. Move Moon Keep and the Python retrieval service behind clear pointers in `docs/README.md`, and archive executed-phase files such as `SOL_PHASE*` and `ATTEMPTED_FIXES.md` under `docs/archive/` with redirects. Rewrite the README top as: problem, architecture diagram, results table, tradeoffs, known limits.
13. **Walkthrough and write-up.** Update `AI_ENGINEERING_TOUR.md` so every status cell and the limits section match the committed results. Add a two-page summary of method, results, and tradeoffs, a three-minute demo, and an architecture diagram in the README that mirrors the tour. Check that someone unfamiliar can follow the ten-minute demo path without help.

## If time is short

Keep steps 1 to 3, 7 and 8, and 12. Skip the queue (document the limit) and the reranker.

## Risks

- The LLM judge can drift. Human review stays the source of truth, and model self-certification is never used for review fields.
- A 50-case set is small. Report confidence intervals and say so in the README.
- Fixture cases test grounding, not OCR accuracy. Real scan and PDF fixtures remain a separate gate.
- Eval spend should be small at this size; confirm after the first run and record it.

## Definition of done

- A reviewed corpus with named reviewers and a corpus hash.
- Committed run JSON for baseline and every ablation arm.
- A README results table that matches the committed JSON.
- CI that fails on an eval regression.
- Zero unauthorized retrievals across all runs.
