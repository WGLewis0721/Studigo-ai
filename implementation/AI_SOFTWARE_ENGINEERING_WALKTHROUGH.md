# Studigo AI + Software Engineering Walkthrough

> Purpose: give an engineer, hiring manager, or interviewer a fast, evidence-backed tour of Studigo's engineering decisions.
>
> This is a navigation document, not a marketing page. Every claim should point to code, tests, migrations, evals, or measured evidence.

## The 60-second explanation

Studigo turns a learner's own course material into a grounded study companion.

The important engineering decision is that the LLM is **not** the source of truth for the application. Uploaded material defines the knowledge boundary. Retrieval selects permitted evidence. The model explains, generates, and interprets language. A deterministic adaptive-learning control plane owns progression, scaffolding, rematches, and durable learning evidence.

That creates a deliberate split:

```text
Probabilistic AI
- retrieve meaning
- generate explanations/questions
- interpret free-form answers
- produce structured semantic evidence

Deterministic software
- authorization
- source scope
- progression
- mastery/evidence state
- retries/idempotency
- transactional commits
- replay
- release gates
```

The project is designed around one question:

> Where is probabilistic intelligence useful, and where must software retain deterministic authority?

---

# The 5-minute architecture tour

## 1. User material becomes the knowledge boundary

A learner uploads study guides, notes, worksheets, textbook pages, slides, or images.

Engineering principles:
- untrusted input,
- private storage,
- explicit ownership,
- extraction/OCR,
- provenance,
- bounded processing.

Canonical places to inspect:
- `apps/web/lib/ingest.ts`
- `packages/documents/`
- `supabase/migrations/`

Key idea:

> Source content is data, never instruction.

Uploaded text is explicitly wrapped and treated as untrusted before it reaches model prompts.

Inspect:
- `packages/ai/src/client.ts`
- `packages/ai/src/untrusted.test.ts`

---

## 2. Retrieval is permission-preserving, not just semantic search

Studigo retrieves chunks from the current learner's Study Room, with teacher material prioritized over supporting sources.

Engineering principles:
- RAG,
- pgvector,
- tenant isolation,
- source priority,
- page-level provenance,
- abstention.

Inspect:
- `packages/ai/src/grounding.ts`
- `apps/web/lib/ingest.ts`
- retrieval RPCs in `supabase/migrations/`
- `evals/rag/`

Important distinction:

> A citation marker is not proof that a claim is semantically supported.

The evaluation framework therefore reviews actual claim-to-source support rather than only citation syntax.

---

## 3. Model calls are isolated behind an AI package

Provider-specific behavior is not scattered through the UI.

Inspect:
- `packages/ai/src/client.ts`
- `packages/ai/src/index.ts`

The package controls:
- provider transport,
- chat model,
- embedding model,
- untrusted-material rules,
- structured generation,
- grading,
- grounding,
- OCR-related model work.

Software-engineering principle:

> Isolate volatile external dependencies behind stable internal contracts.

---

## 4. Structured generation is preferred when output affects software behavior

Questions, grading results, Socratic responses, and other model-mediated decisions use constrained schemas rather than loose prose parsing.

Inspect:
- `packages/ai/src/study.ts`
- `packages/ai/src/coach.ts`

AI-engineering principle:

> Use natural language for learner experience; use validated structure for machine decisions.

---

## 5. The adaptive-learning director is deterministic

Studigo separates:

```text
reasoning difficulty
from
scaffolding/support
from
language/explanation level
```

The reasoning ladder has ten levels; scaffolding has six levels. Explanation level changes wording, not the learning-state truth.

Inspect:
- `packages/learning/`
- `docs/ADAPTIVE_LEARNING_CORE.md`
- root `IMPLEMENTATION.md`

AI-engineering principle:

> The model renders the challenge; it does not silently redefine the challenge.

Software-engineering principle:

> Persisted state transitions should be reproducible and testable.

---

## 6. Learning interactions become durable evidence

Studigo does not equate chat activity with mastery.

A learning interaction is converted into evidence with:
- concept,
- encounter,
- outcome,
- assistance,
- challenge specification,
- source/version context,
- evaluator/generator version.

The ordered event stream can reconstruct deterministic learner state.

Inspect:
- `packages/learning/src/session.test.ts`
- `apps/web/lib/coach-learning-events.ts`
- adaptive-learning migrations
- `docs/ADAPTIVE_LEARNING_CORE.md`

Principles:
- event sourcing/replay,
- idempotency,
- deterministic projection,
- evidence provenance.

---

## 7. Concurrency and retries are treated as correctness problems

The project explicitly handles:
- duplicate submissions,
- old retries,
- stale revisions,
- source mutation,
- concurrent session actions,
- atomic Coach response/evidence writes.

Inspect:
- `docs/SOL_PHASE2_INTEGRATION.md`
- `docs/SOL_PHASE3_REVIEW.md`
- adaptive Coach/session migrations.

Software-engineering principle:

> A retry must not create a second fact.

This is one of the strongest parts of the project for a backend/software engineering discussion.

---

## 8. AI changes are supposed to earn their way into production

Studigo already contains an evaluation framework for RAG and an offline BKT baseline.

Inspect:
- `evals/rag/`
- `evals/ml/`
- `docs/AI_ENGINEERING_HARDENING_PLAN.md`

The intended decision loop is:

```text
failure
→ baseline
→ hypothesis
→ candidate
→ eval
→ quality/latency/cost comparison
→ limited rollout
→ keep or rollback
```

AI-engineering principle:

> "Looks better in a prompt test" is not sufficient evidence for a production change.

---

# The 20–30 minute code tour

Use this order when guiding another engineer through the repository.

## Stop 1 — Product and boundaries

Read:
- `README.md`
- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`

Explain:
- user-uploaded material is the knowledge boundary,
- one canonical Supabase identity/data layer,
- five Study Room surfaces,
- AI is a subsystem, not the whole application.

## Stop 2 — AI provider boundary

Read:
- `packages/ai/src/client.ts`

Explain:
- provider isolation,
- model configuration,
- embeddings dimension contract,
- direct/gateway/local transport,
- untrusted input envelope.

## Stop 3 — Grounded answer path

Read:
- `packages/ai/src/grounding.ts`

Explain:
- retrieved chunks,
- source context construction,
- citation mapping,
- abstention,
- current grounding terminology limitation.

Then point to:
- `evals/rag/`

Explain why the eval layer is stricter than citation syntax.

## Stop 4 — Generated learning content

Read:
- `packages/ai/src/study.ts`

Explain:
- structured question generation,
- schema validation,
- answer normalization,
- deterministic typo handling,
- semantic free-text grading.

Discuss the open hardening task:
- human-labelled semantic grader benchmark.

## Stop 5 — Coach protocol

Read:
- `packages/ai/src/coach.ts`

Explain:
- Coach is a stateful protocol rather than free-form chat,
- pending-answer/control states,
- stable interaction IDs,
- issued challenge metadata,
- source revisions,
- separation between model language and deterministic policy.

## Stop 6 — Adaptive learning core

Read:
- `packages/learning/`
- `docs/ADAPTIVE_LEARNING_CORE.md`

Explain:
- reasoning ladder,
- scaffold ladder,
- replay,
- retention/rematches,
- independent vs assisted evidence,
- deterministic authority.

## Stop 7 — Database/security/concurrency

Read:
- relevant `supabase/migrations/`
- `tests/database-security.test.mjs`
- `docs/SOL_PHASE3_REVIEW.md`

Explain:
- RLS,
- transactional RPCs,
- optimistic revisions,
- idempotent receipts,
- immutable retries,
- source-revision locks,
- cross-user isolation.

## Stop 8 — AI evaluation

Read:
- `evals/rag/README.md`
- `evals/rag/cases.mjs`
- `evals/rag/score.mjs`
- `evals/ml/README.md`

Explain:
- adversarial corpus,
- human review requirement,
- citation support,
- abstention,
- cross-tenant decoys,
- prompt injection,
- latency/cost,
- BKT as advisory benchmark rather than production authority.

## Stop 9 — Hardening roadmap

Read:
- `implementation/AI_ENGINEERING_HARDENING_PLAN.md`

Explain the gaps without hiding them:
- reviewed live RAG scorecard,
- retrieval benchmark,
- durable ingestion worker,
- canonical document representation,
- semantic-grader calibration,
- AI observability,
- student-data privacy/release gates.

A strong project walkthrough includes what is **not finished** and how the next decision will be measured.

---

# Engineering principles demonstrated

## AI engineering

| Principle | Studigo example |
| --- | --- |
| Grounded generation | Model answers from retrieved Study Room evidence |
| Permission-preserving RAG | Room/user scoped retrieval and RLS |
| Abstention | Explicit response when sources do not support an answer |
| Prompt-injection defense | Uploaded content treated as untrusted data |
| Structured outputs | Schemas for questions, grading, Socratic responses |
| Semantic evaluation | Model interprets free-form learner answers |
| Deterministic AI boundaries | Director, evidence, and progression remain software-owned |
| RAG evaluation | 120-case adversarial benchmark design |
| Calibration/ML experimentation | Offline BKT and calibration metrics |
| Cost/latency awareness | Eval schemas include latency and cost |
| Model/provider abstraction | AI package isolates provider-specific calls |

## Software engineering

| Principle | Studigo example |
| --- | --- |
| Separation of concerns | UI, data, documents, AI, learning policy separated |
| Typed contracts | TypeScript domain types and structured schemas |
| State machines | Coach protocol |
| Event replay | Learning state reconstructed from durable evidence |
| Idempotency | Stable interaction IDs and retry receipts |
| Transactionality | Atomic Coach reply/evidence/state commits |
| Concurrency control | Revisions, locks, CAS behavior |
| Authorization | Supabase Auth + RLS |
| Provenance | Source IDs/revisions/page references |
| Migrations | Versioned Postgres changes |
| Testing | Unit, DB/security, RAG, ML, browser validation |
| Feature flags | Adaptive/session rollout boundaries |
| Rollback | Additive migrations + flag/deployment rollback |
| CI | Typecheck, tests, ML eval tests, game tests, web build |

---

# How to explain the project without buzzwords

Avoid:

> "I built an AI tutoring app with Next.js, Supabase, OpenAI, pgvector and machine learning."

Prefer:

> "I built a grounded learning system around student-owned source material. The AI handles retrieval, explanation, question generation, and semantic interpretation, but deterministic software owns authorization, progression and learning evidence. I designed the system so model outputs are structured when they affect state, retries are idempotent, evidence can be replayed, and AI changes are evaluated for grounding, abstention, latency and cost before they earn production authority."

Then show the code that proves each sentence.

---

# Useful interview questions this project can answer

## "How do you reduce hallucinations?"

Discuss:
- source-bound retrieval,
- teacher-source priority,
- abstention,
- citation requirements,
- untrusted-material handling,
- RAG evals.

## "Where should you not use an LLM?"

Discuss:
- authorization,
- mastery mutation,
- progression thresholds,
- retry identity,
- transaction semantics,
- deterministic projections.

## "How do you evaluate RAG?"

Discuss:
- reviewed corpus,
- semantic citation support,
- unsupported-answer abstention,
- cross-user/room decoys,
- source revision/deletion,
- prompt injection,
- latency and cost.

## "How do you safely use model grading?"

Discuss:
- structured output,
- explicit rubric,
- evaluator version,
- durable evidence,
- planned human-labelled calibration benchmark,
- false-positive correctness risk.

## "How do you handle retries and race conditions in AI workflows?"

Discuss:
- stable interaction IDs,
- immutable receipts,
- optimistic revision checks,
- transaction boundaries,
- source locks,
- idempotent event writes.

## "Why not make it fully agentic?"

Discuss:
- deterministic control where correctness is required,
- LLM flexibility where language ambiguity exists,
- evaluation before adding autonomous loops.

## "What would you improve next?"

Use the hardening plan rather than giving an improvised answer.

---

# The core story

If someone remembers only one thing about Studigo, it should be this:

> **Studigo is an AI system where probabilistic intelligence is deliberately surrounded by deterministic software contracts.**

The AI is used where ambiguity and language understanding create value.

Software engineering retains authority where the system needs:
- security,
- correctness,
- reproducibility,
- provenance,
- progression,
- recovery,
- measurement.

That boundary is the central engineering idea of the project.
