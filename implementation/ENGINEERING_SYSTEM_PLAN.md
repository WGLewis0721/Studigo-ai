# Studigo AI + Software Engineering System Plan

> **Canonical engineering implementation plan.**
>
> This replaces the separate AI hardening and engineering walkthrough plans. The target is not just a stronger application. The target is a repository that is **self-describing, measurable, secure, easy for an engineer to explain, and cheap for a GenAI coding agent to understand without reading every line of code**.

## Outcome

At completion, Studigo should demonstrate both **AI engineering** and **software engineering** clearly enough that:

- a technical reviewer can understand the architecture in minutes,
- the project owner can explain what happens, why the technologies were chosen, and where the code lives,
- a GenAI coding agent can load a compact context map and then open only task-relevant files,
- engineering claims link to code/tests/evals rather than marketing language,
- architectural choices are intentional and measurable,
- unfinished work and risk are visible rather than hidden.

The core engineering story is:

> **Probabilistic intelligence is deliberately surrounded by deterministic software contracts.**

## Definition of done

The repository is considered technically legible when an unfamiliar engineer or capable coding model can answer, without scanning the whole codebase:

1. What problem does Studigo solve?
2. What is the source of truth?
3. Where does AI add value?
4. Where is AI deliberately not trusted?
5. How does data flow from upload to answer to learning evidence?
6. How are permissions enforced?
7. How are retries and concurrency kept correct?
8. How is AI behavior evaluated?
9. Why were the main technologies selected?
10. Which directories/files own each responsibility?
11. What is implemented versus planned?
12. What blocks public release?

## Canonical documentation system

Keep the documentation surface small and hierarchical.

### Level 0 — cold start

`ENGINEERING.md`

Purpose:
- one compact current-system map,
- architecture thesis,
- technology rationale,
- code ownership,
- engineering principles,
- current gaps,
- 30-second / 2-minute / 10-minute explanation,
- GenAI context-loading rules.

Target: an agent should usually understand the environment after this file plus **one task-specific contract**.

### Level 1 — authoritative contracts

- `docs/PRODUCT.md` — what the product is and is not.
- `docs/ARCHITECTURE.md` — deep runtime/data architecture.
- `docs/ROADMAP.md` — product/release sequence.
- `implementation/ENGINEERING_SYSTEM_PLAN.md` — this execution plan.
- `implementation/security-readiness/` — security controls and public-release gate.

### Level 2 — evidence/specialist documents

Evals, migrations, test evidence, release reports, dated audits, research and implementation notes.

Agents do **not** preload these. They follow links from Level 0/1 only when the task requires them.

### Decision records

For a material architectural choice whose rationale would otherwise be lost, add a short ADR under `docs/decisions/`.

An ADR answers only:
- context/problem,
- decision,
- alternatives considered,
- why this choice,
- consequences,
- what evidence would cause reconsideration.

`ENGINEERING.md` summarizes the current decision; ADRs preserve history.

---

# Engineering principles the final repo must make obvious

## AI engineering

- user-uploaded material is the default knowledge boundary,
- permission-preserving RAG,
- source provenance and source priority,
- explicit abstention,
- prompt-injection/untrusted-source defenses,
- structured outputs for machine-affecting behavior,
- deterministic grading where possible and semantic grading where necessary,
- deterministic adaptive policy around probabilistic generation,
- model/prompt/embedding/evaluator versioning,
- independent AI evaluation,
- calibration before probabilistic mastery claims,
- quality/latency/cost/security tradeoff measurement,
- rollback of AI changes.

## Software engineering

- separation of concerns,
- typed interfaces and schemas,
- one identity/data source of truth,
- database-enforced authorization,
- state machines,
- event/replay architecture,
- idempotency,
- transactions and concurrency control,
- migrations,
- immutable provenance,
- retry/recovery semantics,
- CI/regression testing,
- observability,
- feature/release gates,
- secure dependency/release practices,
- explicit rollback.

---

# Phase 0 — Establish the self-describing engineering baseline

**Purpose:** make the current system understandable before adding more complexity.

## Deliverables

1. Maintain `ENGINEERING.md` as the compact start-here guide.
2. Update `AGENTS.md` so coding agents read `ENGINEERING.md` first and load other docs only by task.
3. Remove duplicate engineering walkthrough/plan documents.
4. Capture the current golden commit/configuration:
   - model,
   - embeddings,
   - retrieval settings,
   - feature flags,
   - migration state,
   - test/CI baseline.
5. Create `docs/decisions/` only as decisions need preservation; do not dump ordinary notes there.
6. Tighten terms that overstate certainty.

### Grounding terminology

Current citation presence must not be described as semantic verification.

Target:

```ts
type GroundingStatus =
  | "no_evidence"
  | "citation_present"
  | "verified";
```

`verified` requires actual semantic-support evidence.

## Acceptance

- One canonical plan.
- One compact engineering start file.
- No duplicate walkthroughs.
- A coding agent can identify the correct code area without broad repository reading.
- A reviewer can distinguish implementation from planned work.

---

# Phase 1 — Publish the human-reviewed RAG scorecard

**Priority:** highest AI-engineering evidence gap.

Use the existing `evals/rag` framework rather than inventing another benchmark.

## Required work

- independently review/freeze all 120 cases,
- run the real production TypeScript path,
- capture retrieved IDs/revisions, claims, sources, abstention, configuration, latency, token usage and provider cost,
- independently review usefulness, abstention correctness and claim support.

Create:

```text
docs/AI_EVAL_SCORECARD.md
evals/rag/results/<dated-baseline>.json
```

Measure at minimum:

- retrieval Recall@k,
- semantic citation support,
- unsupported-answer abstention,
- cross-user/room leakage,
- prompt-injection policy violations,
- stale/deleted source violations,
- human-reviewed usefulness,
- p50/p95 latency,
- tokens,
- cost per turn.

Release targets already designed in the benchmark remain authoritative unless explicitly revised.

## Acceptance

The scorecard is reproducible and ties every result to corpus hash, model, prompt, embeddings and retrieval configuration.

---

# Phase 2 — Make retrieval architecture an experiment, not a preference

Compare on the exact Phase 1 corpus:

```text
A current pgvector semantic retrieval
B pgvector + Postgres full-text
C hybrid + lightweight reranking
D optional query rewrite + hybrid + rerank
```

Create `docs/RETRIEVAL_BENCHMARK.md`.

Compare:
- recall,
- semantic citation support,
- usefulness,
- abstention,
- p95,
- cost,
- operational complexity.

## Rule

Keep the simplest system that clears the quality/safety bar. Complexity must earn itself.

---

# Phase 3 — Replace request-bound ingestion with durable work

Target:

```text
upload
→ document record
→ ingestion job
→ safe claim/lease
→ extract
→ OCR
→ canonicalize
→ chunk
→ embed
→ derive topics
→ ready
```

Required:
- safe concurrent claiming,
- attempt count,
- lease/abandoned-work recovery,
- bounded exponential retry,
- idempotent stages,
- sanitized failure state,
- operator-action-needed state,
- immutable original upload,
- explicit derived revision,
- refresh/reindex through the same pipeline.

Use Postgres/Supabase-backed work unless measurement justifies heavier infrastructure.

## Acceptance

A worker can die and recover without duplicate chunks, duplicate topics, or permanent document loss.

---

# Phase 4 — Add one Canonical Studigo Document

Replace independent downstream interpretations with one versioned representation.

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
├ objectives
├ vocabulary
├ examples
├ figures/tables metadata
└ provenance
   ↓
RAG / Topics / Learn / Coach / Quiz / Cards / Study Guide / future interactions
```

Every derived element retains source document, source revision/hash, page/slide/stable locator, and transformation version.

## Acceptance

Replacing a source cannot leave stale concepts active in another downstream surface.

---

# Phase 5 — Validate semantic grading against humans

Build an independently labelled 300–500 response set covering:

- correct,
- equivalent wording,
- partial,
- misconception,
- incorrect,
- off-topic,
- not-sure,
- typo/noise,
- short/verbose,
- multiple subjects/grade bands.

Report:
- macro F1,
- per-class precision/recall,
- correct precision/recall,
- false-positive correctness,
- partial/off-topic detection,
- numerical score deviation if retained,
- subject/grade/noise breakdown.

Validate or revise the existing correctness threshold from evidence.

Create:
- `evals/grading/`
- `docs/SEMANTIC_GRADER_EVAL.md`

---

# Phase 6 — Make learning-state semantics precise

Separate:

```text
Evidence stage
= what was actually demonstrated

Readiness index
= deterministic product prioritization

Mastery probability
= calibrated statistical estimate only if one exists
```

Canonical evidence progression should express facts such as:

```text
Unseen → Introduced → Assisted → Independent → Transfer → Retained
```

Learner-friendly labels may remain simpler, but must map to documented semantics.

BKT remains advisory until it predicts future independent success better than the deterministic baseline on privacy-approved, time-respecting evaluation.

---

# Phase 7 — Add production AI and system observability

Every model-mediated operation should be traceable by:

- trace ID,
- operation,
- model/version,
- prompt version,
- retrieval/embedding version,
- evaluator/challenge version where relevant,
- retrieved source IDs/scores where safe,
- input/output tokens,
- latency,
- estimated cost,
- abstention,
- retry/failure code.

Do not log raw learner/source content by default.

Add:
- per-request output/work bounds,
- server-side rate limiting,
- concurrency caps,
- daily/user/global spend guardrails,
- bounded retries/timeouts,
- circuit-breaker/degradation behavior.

## Acceptance

A production issue can be traced to the exact AI/software versions and source context without exposing unnecessary sensitive content.

---

# Phase 8 — Close the public security/privacy gate

Use `implementation/security-readiness/` as the operational control system.

Close P0/P1 blockers including:

- tenant/object authorization,
- complete service-role audit,
- auxiliary-service authentication/isolation,
- file signature/parser validation,
- archive/image/OCR resource bounds,
- malware/quarantine handling,
- CSRF/request provenance,
- CSP/security headers,
- AI rate/spend abuse controls,
- prompt-injection regression,
- vector/revision deletion propagation,
- secret/dependency scanning,
- branch protection,
- student/minor privacy requirements,
- provider data-flow/retention configuration,
- end-to-end deletion/export,
- security logging/incident response.

## Acceptance

Generated public-launch gate contains no unresolved release blocker unless an accountable owner has explicitly accepted and documented the risk.

---

# Phase 9 — Institutionalize engineering decision/release discipline

Every material AI or architecture change follows:

```text
problem
→ baseline
→ hypothesis
→ smallest candidate
→ unit/integration/security tests
→ offline eval where applicable
→ quality + safety + latency + cost
→ limited rollout
→ production evidence
→ keep / rollback
```

Add a short AI/architecture change template asking:

1. What failure/requirement is being addressed?
2. What reproduces it?
3. What is the baseline?
4. What must improve?
5. What may not regress?
6. What changes in latency/cost/security?
7. What versioned model/prompt/data/schema changes?
8. How is it rolled out?
9. How is it rolled back?
10. What evidence closes the work?

---

# Phase 10 — Package the proof without duplicating the docs

Do not create another architecture walkthrough.

Use:
- `ENGINEERING.md` for the current map/explanation,
- eval reports for measured evidence,
- security-readiness output for security evidence,
- ADRs for decision history,
- `AI_ENGINEERING_CASE_STUDY.md` only as a polished hiring artifact once measurements exist.

The case study should link to evidence rather than restating the entire repository.

Recommended sections:

1. problem and constraints,
2. architecture,
3. why the AI/software authority boundary exists,
4. ingestion/RAG,
5. adaptive control,
6. semantic evaluation,
7. event/replay/concurrency,
8. security/privacy,
9. eval methodology,
10. measured results,
11. failures found and changes caused by evidence,
12. limitations.

---

# Execution order

| Order | Work | Primary outcome |
| ---: | --- | --- |
| 0 | Self-describing baseline | Humans/agents understand the repo cheaply |
| 1 | Live reviewed RAG scorecard | AI quality/security evidence |
| 2 | Retrieval benchmark | Evidence-based retrieval choice |
| 3 | Durable ingestion | Reliable production document pipeline |
| 4 | Canonical document | One source-derived representation |
| 5 | Semantic grader eval | Calibrated model-mediated grading |
| 6 | Learning semantics | Honest evidence/readiness/mastery language |
| 7 | Observability + cost controls | Operable production AI |
| 8 | Security/privacy closure | Public-release risk gate |
| 9 | Decision/release discipline | Repeatable engineering methodology |
| 10 | Case-study packaging | Hiring/client explanation backed by evidence |

## Product discipline during hardening

Do not add complexity merely to create more technology keywords.

Until the high-priority evidence/reliability work is closed:
- no agent framework without a specific need,
- no vector database migration without benchmark evidence,
- no second mastery/progression system,
- no major learner-facing mode that bypasses the same evidence/control plane,
- no new provider without data-flow and eval impact review.

## Final success test

Give an unfamiliar engineer or coding agent only `ENGINEERING.md`.

They should be able to:

- summarize the architecture correctly,
- explain why the main technologies were selected,
- distinguish AI from deterministic authority,
- identify the files to change for a specific task,
- locate the tests/evals needed before changing behavior,
- state the current major risks and gaps,
- know which deeper document to load next.

Then give a reviewer ten minutes with the repository.

They should be able to follow one learner interaction from uploaded source → retrieval → model → deterministic policy → durable evidence and see the code/tests/evals behind each claim.

That is the desired end state: **a production-minded AI/software engineering project whose design is both technically sound and immediately legible.**
