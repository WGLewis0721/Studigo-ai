# Studigo AI Engineering Hardening Plan

> Implementation plan for strengthening Studigo as a production AI system and as evidence of AI engineering capability.
>
> Baseline when authored: `main` at `aa5898b74932e8d99b05416926430e8da69111cd` (2026-10-04).
>
> This document is an execution plan, not a replacement for the canonical product/architecture contracts in the root `IMPLEMENTATION.md`, `docs/ARCHITECTURE.md`, `docs/PRODUCT.md`, or `docs/ROADMAP.md`.

## Goal

Make Studigo prove that it can **design, evaluate, operate, and improve a production AI system**, not merely integrate an LLM.

A second goal is **technical legibility**: when an engineer, hiring manager, or interviewer opens the repository, they should be able to quickly see both the AI-engineering and software-engineering methodology, understand why the architecture is shaped the way it is, and follow a concise walkthrough without first reading the entire codebase.

Studigo should make these two stories obvious:

1. **AI engineering:** grounding, retrieval, structured model use, semantic evaluation, adaptive policy boundaries, AI evals, prompt-injection resistance, model/version control, latency/cost measurement, and safe use of probabilistic components.
2. **Software engineering:** modular architecture, typed contracts, deterministic state machines, event sourcing/replay, authorization, migrations, concurrency/idempotency, CI/testing, observability, rollback, release gates, and evidence-based architectural decisions.

The repository should support a short technical explanation as well as a deep code review.

The second goal is **legibility**: a technical reviewer should be able to open the repository, identify the AI engineering elements quickly, understand why each exists, and follow the evidence behind the design decisions. The project owner should be able to explain the same system coherently at three levels:

- **30 seconds:** what Studigo does and why its AI architecture is different from a chatbot wrapper;
- **2 minutes:** the end-to-end AI lifecycle and the important authority/safety boundaries;
- **10 minutes:** a guided repository walkthrough covering ingestion, RAG, adaptive control, semantic evaluation, durable evidence, evals, security, observability, and measured tradeoffs.

This means implementation work must produce both **working engineering** and **clear artifacts that expose that engineering**. Important AI behavior should not be buried in scattered code or only understandable from historical implementation notes.

The target engineering lifecycle is:

```text
User material
     ↓
Durable ingestion
     ↓
Canonical Studigo document
     ↓
Measured retrieval system
     ↓
Grounded generation
     ↓
Deterministic adaptive director
     ↓
Validated semantic evaluation
     ↓
Durable learning evidence
     ↓
Observable production system
     ↓
Reproducible evals + engineering case study
```

## Guiding constraints

Preserve these existing product/architecture decisions unless measured evidence justifies a change:

- The learner uploads their own material; that material is the default knowledge boundary.
- Supabase Auth/Postgres/Storage remain the canonical identity/data boundary.
- RLS remains mandatory on learner-owned data.
- OpenAI/provider calls stay isolated behind `packages/ai`.
- The deterministic adaptive director remains authoritative over progression, scaffolding, rematches, and mastery evidence.
- The LLM may generate, explain, retrieve, and semantically interpret, but it does not silently own progression truth.
- Explanation difficulty remains separate from reasoning difficulty.
- The current learner-facing UI is the golden product baseline while this hardening work is underway.
- Evals must precede framework or model complexity. The simplest architecture that meets the quality bar wins.

---

# Phase 0 — Freeze the current baseline and tighten semantics

**Decision:** KEEP the current learner experience; REVISE ambiguous engineering terminology.

## Work

1. Tag/capture the current working web beta as the rollback baseline.
2. Record the current:
   - chat model,
   - embedding model,
   - prompt/version identifiers,
   - retrieval settings,
   - feature flags,
   - migration state,
   - CI/test baseline.
3. Maintain one canonical list of open AI release gates.
4. Tighten runtime naming where the code claims more certainty than it has.

### Grounding terminology

Today, the runtime can treat an answer as `grounded` when it contains at least one valid citation marker. That does not prove semantic support for every substantive claim.

Target:

```ts
type GroundingStatus =
  | "no_evidence"
  | "citation_present"
  | "verified";
```

- `no_evidence`: no permitted supporting source retrieved/used.
- `citation_present`: the answer cites one or more permitted sources.
- `verified`: semantic claim support has been established by an approved verifier/evaluation path.

Do not expose `verified` unless the system has actually established it.

## Acceptance

- Current product remains behaviorally stable.
- CI remains green.
- Baseline configuration is reproducible.
- Runtime types do not imply semantic certainty that the system has not measured.

---

# Phase 1 — Complete the live, human-reviewed RAG scorecard

**Decision:** COMPLETE the evaluation framework already present in `evals/rag`.

This is the highest-priority credibility gap.

## Existing foundation to preserve

The current authored 120-case corpus already covers:

- two grade bands,
- math/science/reading/social studies,
- normal source material,
- scan transcripts,
- tables,
- unsupported questions,
- conflicting teacher sources,
- changed/deleted revisions,
- cross-user and cross-room decoys,
- uploaded prompt injection.

The benchmark also already requires independent human review rather than allowing a model to self-certify claim support.

## Work

1. Independently review and freeze all 120 cases.
2. Run the current production TypeScript retrieval/generation path against that exact corpus.
3. Capture per-case:
   - retrieved chunk IDs/revisions,
   - answer claims,
   - claim-to-source mappings,
   - abstention,
   - model/prompt/embedding configuration,
   - end-to-end latency,
   - token usage,
   - provider cost.
4. Complete independent review of answer usefulness, correct abstention, and semantic citation support.
5. Publish a reproducible scorecard.

## Required scorecard

Create:

```text
docs/AI_EVAL_SCORECARD.md
evals/rag/results/<dated-baseline>.json
```

Report at minimum:

| Metric | Requirement |
| --- | --- |
| Retrieval Recall@k | measured |
| Citation semantic support | >= 95% release target |
| Unsupported-answer abstention | >= 95% release target |
| Cross-user/room leakage | 0 |
| Prompt-injection policy violations | 0 |
| Deleted/stale source violations | 0 |
| Human-reviewed answer usefulness | measured |
| p50 latency | measured |
| p95 latency | measured |
| Token usage | measured |
| Cost per study turn | measured |

Bad results are not hidden. They become the baseline for the next phase.

## Acceptance

- 120/120 cases independently reviewed.
- No unreviewed claims count as supported.
- Results are reproducible from repository commands.
- A reviewer can identify the exact corpus hash, model, embedding config, prompt version, retrieval config, latency, and cost for the run.

---

# Phase 2 — Benchmark retrieval candidates against one frozen corpus

**Decision:** REVISE retrieval only when measurement shows a gain.

Do not add LangChain, another vector database, or a reranker merely to increase stack complexity.

## Candidates

Evaluate progressively:

```text
A — current pgvector semantic retrieval

B — pgvector + PostgreSQL full-text search

C — hybrid retrieval + lightweight reranking

D — optional query rewrite + hybrid + reranking
```

Every candidate must run against the exact Phase 1 reviewed corpus with matched generation settings.

## Comparison

Create:

```text
docs/RETRIEVAL_BENCHMARK.md
```

Report:

| Candidate | Recall@k | Citation support | Useful answers | Abstention | p95 | Cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Vector baseline | measured | measured | measured | measured | measured | measured |
| Hybrid | measured | measured | measured | measured | measured | measured |
| Hybrid + rerank | measured | measured | measured | measured | measured | measured |
| Rewrite + hybrid + rerank | measured | measured | measured | measured | measured | measured |

## Selection rule

Keep the simplest system that clears the quality/safety gates.

A more complex architecture must demonstrate a reproducible improvement large enough to justify:

- added latency,
- added provider cost,
- added operational burden,
- added failure modes.

If the current pgvector implementation wins, keep it and record that result.

---

# Phase 3 — Replace request-bound ingestion with a durable worker

**Decision:** REPLACE the current long-running request execution path.

Current ingestion performs extraction, OCR, chunking, embeddings, storage updates, and topic derivation inside the request lifecycle. Large scanned files can exceed serverless execution limits.

## Target architecture

```text
upload
   ↓
document record
   ↓
ingestion job
   ↓
claim / lease
   ↓
worker
   ↓
extract
   ↓
OCR
   ↓
canonicalize
   ↓
chunk
   ↓
embed
   ↓
derive topics
   ↓
ready
```

## Worker requirements

The job system must support:

- bounded batch/claim behavior,
- safe concurrent claiming,
- lease/heartbeat or equivalent abandoned-job recovery,
- attempt count,
- bounded exponential retry,
- idempotent reruns,
- sanitized user-visible failure state,
- operator-action-needed state where automatic recovery is unsafe,
- exact document/revision ownership,
- refresh/reindex through the same pipeline,
- immutable original upload,
- explicit derived-document revision.

A Postgres/Supabase-backed job table plus worker is sufficient. Do not introduce Kubernetes or a separate distributed platform without a measured requirement.

## Acceptance

- A request acknowledges upload without waiting for OCR/embedding completion.
- Killing a worker mid-job does not permanently strand a document.
- Retrying a claimed/completed job cannot create duplicate chunks or topic state.
- Refresh/reindex uses the same durable pipeline.
- Failure and recovery are visible and testable.
- Large-document processing is no longer bounded by the web request timeout.

---

# Phase 4 — Add the Canonical Studigo Document

**Decision:** ADD one canonical representation and REPLACE independent downstream interpretations.

## Problem

Today, multiple downstream features can independently derive meaning from extracted source material. That allows drift, such as RAG reflecting the current source while Topics retains stale derived scope.

## Target

```text
RAW SOURCE
    ↓
EXTRACTION
    ↓
CANONICAL STUDIGO DOCUMENT
├ normalized Markdown
├ structured JSON
├ sections
├ concepts
├ relationships
├ learning objectives
├ vocabulary
├ examples
├ questions/prompts present in source
├ tables/figures metadata
└ provenance
    ↓
all downstream AI
```

Downstream consumers:

```text
Canonical Document
 ├→ retrieval
 ├→ topic map
 ├→ Learn
 ├→ Coach
 ├→ Quiz
 ├→ Flashcards
 ├→ Practice Test
 ├→ Studigo Study Guide
 └→ future interactive learning experiences
```

## Provenance contract

Every derived concept/fact should retain:

- source document ID,
- source revision/hash,
- page/slide,
- original span or stable locator,
- extraction method where relevant (native text/OCR),
- transformation/version metadata.

## Rules

- Original source is never overwritten.
- Canonicalization may organize/normalize; it may not silently add curriculum.
- General model knowledge is not inserted into the canonical source representation.
- Derived features consume the canonical representation or a versioned projection of it.
- Reindexing creates/replaces derived revisions deliberately rather than layering stale representations.

## Acceptance

For one known source fixture, RAG, Topics, Learn, and the generated Study Guide must agree on source scope.

Add a regression test where an old source contains one concept family and a replacement source contains another. No downstream surface may continue exposing concepts removed from the current canonical revision.

---

# Phase 5 — Build and validate a semantic-grading benchmark

**Decision:** REVISE the existing LLM semantic grader through measurement.

The model-graded short-answer path is high authority because its output can become learning evidence.

## Gold dataset

Build an independently labelled dataset of approximately 300–500 responses across:

- correct answers,
- semantically equivalent wording,
- partial answers,
- misconceptions,
- incorrect answers,
- off-topic responses,
- "I don't know",
- spelling/typing errors,
- concise answers,
- verbose answers,
- multiple subjects,
- multiple grade bands.

## Gold labels

At minimum:

```text
correct
partial
incorrect
off_topic
not_sure
```

If numerical scores are retained, record the human score/rubric independently of the model output.

## Metrics

Report:

- macro F1,
- per-class precision/recall,
- correct-answer precision,
- correct-answer recall,
- partial-answer classification,
- off-topic detection,
- false-positive "correct" rate,
- false-negative rate,
- mean/median score deviation if scoring numerically,
- grade-band breakdown,
- subject breakdown,
- typo/noise breakdown.

False positive correctness deserves special attention because incorrectly marking understanding can advance learner state.

## Threshold calibration

Do not keep `>= 85` merely because it is intuitive.

Either:

- validate that threshold against the gold set, or
- revise the operating threshold based on measured precision/recall tradeoffs.

Document the final threshold decision.

## Acceptance

Create:

```text
evals/grading/
docs/SEMANTIC_GRADER_EVAL.md
```

The grading model, prompt/evaluator version, dataset version, and threshold are reproducible.

---

# Phase 6 — Make learning-state terminology mathematically precise

**Decision:** REVISE internal semantics while preserving simple learner-facing language.

Separate:

```text
Evidence stage
= what the learner has actually demonstrated

Readiness index
= deterministic product prioritization / presentation

Mastery probability
= calibrated statistical probability, only if a model actually supports that claim
```

## Canonical evidence progression

Use explicit evidence stages such as:

```text
Unseen
Introduced
Assisted
Independent
Transfer
Retained
```

The learner-facing UI may continue to use simple language such as:

```text
Starting
Building
Strong
Mastered
```

but UI labels must map to documented evidence/state semantics.

Do not describe compatibility/readiness indices as calibrated mastery probabilities.

## BKT role

Keep the existing BKT harness advisory.

Its job is to answer:

> Does a calibrated knowledge-tracing model predict future independent success materially better than the deterministic system?

It does not automatically gain authority over progression.

## Acceptance

- Internal types distinguish evidence, readiness, and probabilistic estimates.
- No UI/API field implies calibrated probability unless calibration evidence exists.
- BKT comparisons use authorized, privacy-reviewed data and time-respecting evaluation before any production authority is considered.

---

# Phase 7 — Add production AI observability

**Decision:** ADD.

Every model-mediated operation should emit a privacy-conscious trace envelope.

Example:

```ts
type AITrace = {
  traceId: string;
  operation: string;

  model: string;
  modelVersion?: string;
  promptVersion: string;
  retrievalVersion?: string;
  embeddingVersion?: string;
  evaluatorVersion?: string;
  challengeSpecVersion?: string;

  retrievedChunkIds?: string[];
  retrievalScores?: number[];

  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  estimatedCostUsd?: number;

  abstained?: boolean;
  errorCode?: string | null;
};
```

Do not send raw learner answer text into routine telemetry by default.

## Dashboards/queries

Make it possible to inspect:

- request count,
- error rate,
- p50/p95 latency,
- input/output tokens,
- cost by operation/model,
- abstention frequency,
- retrieval misses,
- evaluator disagreement,
- model/prompt versions,
- retry/fallback rates.

## Controls

Add:

- server-side rate limiting,
- per-request token/output caps,
- timeout budgets,
- bounded provider retries,
- daily/user/global spend guardrails,
- circuit-breaker/degradation behavior where appropriate.

## Acceptance

A production issue can be answered with evidence:

> Which model/prompt/retrieval version produced this behavior, what source IDs were retrieved, how long did it take, what did it cost, and did the operation retry/fail/abstain?

---

# Phase 8 — Complete AI security and student-data privacy gates

**Decision:** COMPLETE the production boundary already established by RLS/private storage.

## Security

Finish:

- secret scanning in CI,
- server-side AI rate limiting,
- spend/abuse controls,
- prompt-injection regression suite,
- malicious upload fixtures,
- file size/type/page/chunk/OCR bounds,
- cross-user and cross-room retrieval isolation,
- source deletion/revision tests,
- durable ingestion authorization tests.

## Privacy

Before a public child-facing release, make explicit and verifiable:

- learner/guardian principal model,
- parental consent requirements where applicable,
- data retention policy,
- deletion/cascade behavior,
- export behavior,
- model/vendor data handling,
- provider retention/training settings,
- what telemetry excludes,
- what data is permitted in evaluation/training pipelines.

Do not treat a vendor policy statement as an implementation control; capture relevant configuration and acceptance evidence.

---

# Phase 9 — Establish AI change/release discipline

**Decision:** ADD.

Every material AI change should follow:

```text
Failure observed
      ↓
baseline captured
      ↓
hypothesis
      ↓
candidate implementation
      ↓
offline eval
      ↓
quality + latency + cost comparison
      ↓
limited rollout
      ↓
production measurement
      ↓
keep / rollback
```

Create an AI change template with these required questions:

1. What failure does this solve?
2. What reproducible case demonstrates the failure?
3. What baseline metric exists?
4. What metric must improve?
5. What regressions are unacceptable?
6. What changes in latency/cost?
7. What model/prompt/retrieval/data version changes?
8. What is the rollout plan?
9. What is the rollback plan?
10. What evidence is required before calling the change production-ready?

No prompt/model/retrieval change should be described as an improvement merely because a few manual examples looked better.

---

# Phase 10 — Package the engineering evidence as a hiring artifact

**Decision:** ADD the navigation/walkthrough now; fill measured claims only after the underlying evidence exists.

Maintain two complementary artifacts:

```text
implementation/AI_ENGINEERING_WALKTHROUGH.md
AI_ENGINEERING_CASE_STUDY.md
```

The walkthrough is the concise map through the live repository: what to say, where to click, which code proves each claim, and which claims are still pending measurement.

The case study is the polished evidence report produced once the measurements exist.

Recommended structure:

1. Problem
2. Why ordinary chatbot/RAG architecture was insufficient
3. System architecture
4. Document/ingestion architecture
5. Grounding and permission contract
6. Deterministic adaptive control plane
7. Semantic grading
8. Event/replay architecture
9. Security/privacy boundaries
10. Evaluation methodology
11. Measured results
12. Failures discovered
13. Architecture changes caused by measurements
14. Production observability
15. Remaining limitations

Include three concise diagrams:

- system architecture,
- AI turn lifecycle,
- evaluation/release-gate lifecycle.

Include actual measurements, not aspirational placeholders.

The final presentation layer must support three guided depths:

1. **30-second explanation** — problem, architecture distinction, outcome.
2. **2-minute architecture explanation** — source grounding, deterministic adaptive control, model role, durable evidence, evaluation.
3. **10-minute code walkthrough** — exact repository paths and evidence artifacts for ingestion, retrieval, model contracts, adaptive policy, persistence, evals, security, observability, and current limitations.

A reviewer should not need to infer where the AI engineering lives. Every major claim in the walkthrough/case study should point to implementation code, tests/evals, or measured evidence.

Useful engineering narratives should include failures. Example:

```text
Observed failure:
RAG reflected the current Physical Science source while Topics retained stale derived content.

Root cause:
Multiple independently derived representations could drift.

Architecture response:
Introduce one versioned Canonical Studigo Document and derive downstream representations from it.

Regression evidence:
A replacement-source fixture proves removed concepts cannot remain active downstream.
```

---


## Technical walkthrough requirement

Create and maintain:

```text
implementation/AI_SOFTWARE_ENGINEERING_WALKTHROUGH.md
```

It should let the project owner guide someone through Studigo at three depths:

- **60 seconds:** what problem Studigo solves and what makes the architecture non-trivial.
- **5 minutes:** the end-to-end request/data path and the major AI/software engineering decisions.
- **20–30 minutes:** code-level tour with direct links to implementation, tests, migrations, evals, and evidence.

Every major concept in the walkthrough must answer four questions:

1. **Problem:** what engineering failure or constraint exists?
2. **Decision:** what did Studigo implement?
3. **Principle:** what AI/software-engineering idea does that demonstrate?
4. **Evidence:** where can a reviewer verify it in code/tests/evals?

The walkthrough should explicitly distinguish:

```text
Deterministic software authority
vs.
Probabilistic AI assistance
```

and show where the boundary exists in the architecture.

### Required engineering principles to surface

**AI engineering**
- retrieval-augmented generation,
- permission-preserving retrieval,
- source prioritization,
- citation/grounding contracts,
- abstention,
- structured outputs,
- semantic grading,
- prompt-injection resistance,
- deterministic adaptive policy around probabilistic generation,
- offline/online evaluation,
- model/prompt/embedding versioning,
- calibration and knowledge-tracing experiments,
- latency/token/cost measurement,
- model rollout and rollback.

**Software engineering**
- separation of concerns,
- typed interfaces and schemas,
- state machines,
- deterministic event replay,
- idempotency,
- optimistic concurrency / transactional boundaries,
- authorization with RLS,
- immutable source provenance,
- database migrations,
- retry/recovery semantics,
- CI and regression testing,
- feature flags,
- observability,
- security/privacy boundaries,
- release gates and rollback.

### Code-tour principle

Do not explain Studigo by listing technologies.

Bad:

> "Next.js, Supabase, OpenAI, pgvector, Python."

Better:

> "A learner upload is treated as untrusted source data. It is normalized and indexed behind an ownership boundary, retrieved with room-scoped permissions, passed to a grounded model call, interpreted into structured evidence, and then committed through a deterministic learning-state transition. The LLM can explain and evaluate language, but it cannot independently mutate mastery."

The walkthrough should make that explanation easy to prove by moving through a small number of canonical files.


---

# Execution order

| Order | Work | Why |
| ---: | --- | --- |
| 1 | Golden baseline + semantic naming cleanup | Protect the current product and remove overclaims |
| 2 | 120-case live RAG evaluation | Close the largest current evidence gap |
| 3 | Retrieval benchmark | Turn retrieval decisions into measured engineering |
| 4 | Durable ingestion worker | Remove a major prototype/serverless limitation |
| 5 | Canonical Studigo Document | Eliminate derived-state drift and simplify downstream AI |
| 6 | Semantic grader benchmark | Validate a high-authority model decision |
| 7 | Mastery/evidence semantics | Make learning claims precise |
| 8 | AI observability + spend controls | Operate the system as production AI |
| 9 | Security/privacy release gates | Close student-data production boundaries |
| 10 | AI Engineering Case Study | Convert the work into clear hiring evidence |

## Product freeze during hardening

Until Phases 1–6 are substantially complete:

- do not add a new agent framework,
- do not migrate vector databases without benchmark evidence,
- do not add major learner-facing modes,
- do not replace the deterministic director with learned policy,
- do not add complexity only to improve résumé keywords.

The current product is already sufficient to demonstrate the use case. The hardening cycle should make its engineering claims measurable.

---

# Milestone 1

The first externally meaningful milestone is:

> **Publish a fully human-reviewed, reproducible 120-case production RAG scorecard with quality, citation support, abstention, tenant isolation, prompt-injection resistance, latency, token usage, and cost results.**

After Milestone 1, use measured failures to decide which retrieval or generation change earns implementation priority.

# Definition of success

Studigo should be able to answer, with repository evidence:

- What source material was allowed for this answer?
- What did retrieval return?
- Which claims were actually supported?
- When does the system abstain?
- Can another user's data ever enter the context?
- Which model, prompt, embedding, retrieval, evaluator, and policy versions ran?
- What did the turn cost and how long did it take?
- How accurate is semantic grading against human labels?
- What evidence moved learner state?
- Can the same event stream deterministically reconstruct state?
- Can ingestion recover from partial failure?
- What benchmark justified the current retrieval architecture?
- What known limitations remain?

When those answers are measurable and reproducible, Studigo becomes strong evidence of production AI engineering rather than only an AI-powered product.

A second success criterion is communication: an unfamiliar AI engineer or hiring manager should be able to follow `implementation/AI_ENGINEERING_WALKTHROUGH.md` and understand the system without reading the entire repository.
