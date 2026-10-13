# Permission-preserving RAG comparison

This is an offline benchmark gate, not a deployed retrieval service. The existing TypeScript implementation remains the provisional production path. No live quality, latency or cost result is inferred from unit-test fixtures.

Run `node evals/rag/run.mjs fixtures` to write 120 authored, non-personal candidate cases. Each remains `review.status = pending`. Both grade bands have 60 cases; math, science, reading/social studies include benign controls, scan transcripts, tables, unsupported questions, conflicting teacher sources, changed/deleted revisions, cross-user/room decoys, and malicious uploaded instructions. Scan transcripts test downstream grounding, not OCR extraction accuracy; actual scan/PDF ingestion fixtures are still required.

Before acceptance, independently review each expected answer/source scope and record the reviewer. Capture real TypeScript and Python/LangChain results using the same reviewed corpus, permitted Supabase chunks/embeddings, model, prompt and settings. Framework comparison comes first; retrieval/chunking improvements belong in a separately labelled run. Never use the prototype's independent FAISS index as the production source of truth.

Each run JSON has `schemaVersion: 1`, `adapter: typescript|python-langchain`, `corpusHash` (the scorer's SHA-256 of JSON cases), `config` (model, embeddingHash, promptHash, temperature, plus endpoint/retrieval settings), and `results`. Each result has `caseId`, `abstained`, `retrieved: [{id,revision}]`, `claims: [{id,text,sources:[{id,revision}]}]`, `toolCalls`, `latencyMs`, and `costUsd`. Measure end-to-end retrieval/render latency, and provider/embedding cost separately from ingestion/hosting; repeat a reproducible workload before using p95 as a release metric.

Review files are arrays of `{caseId,answerHash,reviewer,useful,correctAbstention,claims:[{claimId,textHash,supported}]}`. Hash the full `{abstained,claims}` answer and each claim's text using `hash` in `score.mjs`. Reviewers must judge whether the cited passage supports the actual claim. Models cannot self-certify these review fields. Changing output invalidates its reviews. Valid citation markers alone receive no support credit.

Run `node evals/rag/run.mjs compare CASES TS_RUN PYTHON_RUN TS_REVIEWS PYTHON_REVIEWS`. Missing reviews, fewer than 120 cases, unauthorized retrieval/revisions/tool calls, support below 95%, or unsupported-answer abstention below 95% block selection. Comparisons require matching corpus hashes as well as configuration and counts. Regressions over two points in aggregate grounding/usefulness or grade-band useful-answer quality reject Python; the authorized two-point tolerance is preserved. A five-point quality or 20% p95 latency/cost improvement yields a Python candidate, still subject to operational, deletion-propagation and maintainability review. Equivalent results retain TypeScript.

The existing Python prototype can supply chunking tests/adapters but has no authenticated production boundary. A production Python service is not authorized by a unit-test comparison. [Supabase's permission-preserving RAG guidance](https://supabase.com/docs/guides/ai/rag-with-permissions) and [LangChain's retrieval documentation](https://docs.langchain.com/oss/python/langchain/retrieval) describe the relevant data/retrieval boundaries.

`node --test evals/rag/*.test.mjs` verifies the scorer using explicitly artificial results. No child data or provider credentials are needed.

## Reviewing the first slice (E1)

`review/slice-50.jsonl` holds 50 of the 120 cases, one per line: 9 `plain`, 9 `table`, and 8 each of `unsupported`, `conflict`, `injection`, and `foreign-user`, spread across both grade bands and all twelve topics. `node evals/rag/run.mjs review-slice` writes it and refuses to regenerate once any row has been touched.

Status: 0 of 50 reviewed, 50 pending. The other 70 cases are not in a slice. Update this line from the output of `review-check` when it changes.

To review a case, read its `chunks`, `question`, `expected`, and `permitted`, then fill in the `review` block at the start of the line:

- `status`: `"reviewed"`.
- `reviewer`: your name. Fixture, template, and model names are rejected.
- `expectedCorrect`: `true` if `expected` (the answer, or that the tutor should abstain, or that a conflict must be disclosed) is what a correct tutor would do with only these chunks.
- `scopeCorrect`: `true` if `permitted` lists exactly the chunks this learner may be shown in this room.
- `notes`: required when either answer is `false`. Say what is wrong so the case can be fixed.

`node evals/rag/run.mjs review-check` validates the file and prints reviewed, accepted, needs-fix, and pending counts. A row whose case text changed after it was written fails the check and must be reviewed again. Only cases with both answers `true` become the corpus for a scored run (`reviewedCases` in `review.mjs`). Nothing in this repository fills these fields for you, and a model must not.
