# Studigo AI + Software Engineering Plan

> **Canonical implementation plan for the Studigo learning app.**
>
> This is the single engineering plan for AI engineering, software engineering, hardening, evaluation, security, operational maturity, and repository legibility.
>
> For normal coding work, start with the compact root `ENGINEERING.md`; use this plan when the task changes architecture, engineering methodology, hardening priorities, or release evidence.
>
> Current baseline when consolidated: `main`, 2026-10-07.

## Why this file exists

Studigo needs to be understandable at two levels:

1. **As a production system** — an engineer or GenAI coding agent should know the boundaries, invariants, code ownership, current state, and next work without reading every file.
2. **As an engineering case study** — a technical interviewer, hiring manager, client, or collaborator should be able to see the AI-engineering and software-engineering principles, why technologies were chosen, what the code does, and what is still unproven.

The target outcome is a repository where:

- the architecture is legible,
- technology choices have explicit reasons,
- AI behavior is separated from deterministic software authority,
- important claims have evidence,
- current implementation is distinguished from planned work,
- task-specific code can be located quickly,
- security and evaluation are release gates rather than afterthoughts,
- documentation does not duplicate or contradict itself.

---

# 1. The core story

## 30-second explanation

Studigo turns a learner's own class material into a grounded study companion.

The important engineering decision is that the LLM is **not the application state machine**. Uploaded material defines the knowledge boundary. Retrieval selects permitted evidence. Models handle explanation, generation, OCR, and semantic interpretation. Deterministic software retains authority over authorization, source scope, progression, scaffolding, retries, learning evidence, and durable state.

> **Probabilistic intelligence is deliberately surrounded by deterministic software contracts.**

That boundary is the central engineering idea of the project.

## 2-minute explanation

A learner creates a Study Room and uploads study guides, notes, worksheets, textbook pages, slides, or images.

```text
upload
  ↓
extract / OCR
  ↓
normalize + preserve provenance
  ↓
chunk + embed
  ↓
permission-scoped retrieval
  ↓
grounded generation / semantic evaluation
  ↓
deterministic adaptive director
  ↓
durable learning evidence
  ↓
replayable learner state
```

The model is useful where language and ambiguity matter:

- explanations,
- question generation,
- OCR,
- semantic grading,
- Socratic feedback,
- interpreting free-form answers.

Software remains authoritative where correctness and reproducibility matter:

- identity and authorization,
- source scope,
- progression,
- mastery/evidence state,
- challenge/scaffold policy,
- transactions,
- retries/idempotency,
- event replay,
- security gates,
- release decisions.

Studigo is therefore not a generic chatbot wrapper. It is a source-grounded AI subsystem embedded inside a deterministic learning application.

---

# 2. How a GenAI coding agent should use this repository

## Read order

For most learning-app tasks:

1. Read root **`ENGINEERING.md`** first.
2. Read this plan only when the task touches planned hardening, architecture changes, evaluation, security, or engineering methodology.
3. Read only the task-specific files listed in the routing table below.
4. Inspect the implementation you are changing.
5. Read specialist documents only when the task touches their contract.
6. Do not scan the whole repository unless a cross-cutting audit explicitly requires it.

For game work, use `prototypes/moon-road/` instead. The game is a separate release track.

## Task routing

| Task | Read first | Primary implementation |
| --- | --- | --- |
| Product behavior / scope | `docs/PRODUCT.md` | UI + route being changed |
| Overall architecture | `docs/ARCHITECTURE.md` | `apps/web/`, `packages/`, `supabase/` |
| Current release status | `docs/ROADMAP.md`, `docs/ADAPTIVE_BETA_EVIDENCE.md` | affected feature |
| AI provider/model behavior | this file | `packages/ai/src/client.ts` |
| RAG / citations / abstention | this file, `evals/rag/README.md` | `packages/ai/src/grounding.ts`, `apps/web/lib/retrieval.ts`, retrieval migrations |
| Question generation / semantic grading | this file | `packages/ai/src/study.ts`, `packages/ai/src/coach.ts` |
| Coach protocol | this file | `packages/ai/src/coach.ts`, `apps/web/app/api/chat/route.ts` |
| Adaptive learning | `docs/ADAPTIVE_LEARNING_CORE.md` | `packages/learning/`, `apps/web/lib/learning/` |
| Learning evidence / retries / replay | this file, SOL review docs | learning-event code + adaptive migrations |
| Documents / OCR / ingestion | this file | `packages/documents/`, `apps/web/lib/ingest.ts` |
| Auth / identity | `docs/AUTH.md` | `apps/web/lib/auth.ts`, middleware, auth routes |
| Database / RLS / migrations | `docs/ARCHITECTURE.md` | `supabase/migrations/`, DB security tests |
| Security audit / public launch | `implementation/security-readiness/README.md` | generated control matrix + affected code |
| AI evaluation | `evals/rag/README.md`, `evals/ml/README.md` | `evals/` |
| Native iOS/iPadOS | `docs/APP_STORE_RELEASE_PLAN.md` | future Expo client |
| Visual system | `docs/DESIGN_SYSTEM.md` | web components/styles |

## GenAI change rule

Before proposing a new framework, service, database, model, agent loop, or architectural layer, answer:

1. What current failure does it solve?
2. Which existing component owns that responsibility today?
3. What benchmark or test reproduces the failure?
4. What measurable improvement would justify the added complexity?
5. What is the rollback path?

Do not add infrastructure merely because it is fashionable.

---

# 3. System architecture

## Current production path

```text
Learner
  ↓
Next.js / React Study Room
  ↓
Supabase Auth session
  ↓
Next.js route handlers
  ├───────────────┐
  ↓               ↓
Postgres / RLS    packages/ai
Storage           ├ model client
pgvector          ├ grounding
                  ├ structured generation
                  ├ semantic evaluation
                  └ OCR
  ↓
retrieved permitted source chunks
  ↓
LLM response / semantic evidence
  ↓
deterministic learning-control plane
  ↓
transactional learning events / state
```

## Target hardened path

```text
User material
     ↓
Durable ingestion worker
     ↓
Canonical Studigo Document
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
Reproducible evals + release gates
```

---

# 4. Engineering principles

## AI engineering principles

### 4.1 User material is the knowledge boundary

Studigo is centered on learner-uploaded course material, not unrestricted model knowledge.

Consequences:

- retrieval is room-scoped,
- teacher material can receive explicit priority,
- citations point back to owned sources,
- unsupported questions should abstain,
- deletion/revision must propagate to derived knowledge.

### 4.2 Uploaded content is untrusted data

Course material may contain direct or indirect prompt injection.

The system serializes and labels uploaded/retrieved content as untrusted. Source text is evidence, never system authority.

Canonical code:
- `packages/ai/src/client.ts`
- `packages/ai/src/grounding.ts`
- `packages/ai/src/ocr.ts`

### 4.3 Use the LLM where semantic ambiguity creates value

Use models for:

- explanation,
- generation,
- OCR,
- semantic interpretation,
- free-form feedback.

Do not use models for deterministic concerns that code can own safely.

### 4.4 Structured outputs for machine-affecting behavior

When a model result affects software state, use explicit schemas, validation, bounded enums/ranges, and normalization.

Canonical code:
- `packages/ai/src/study.ts`
- `packages/ai/src/coach.ts`

### 4.5 Retrieval quality must be measured

Embeddings are not the engineering accomplishment by themselves.

The important contract is:

- permission-preserving retrieval,
- source provenance,
- revision correctness,
- abstention,
- semantic citation support,
- latency,
- cost.

Canonical evidence:
- `evals/rag/`

### 4.6 A citation is not the same as semantic grounding

The current runtime historically used a `grounded` boolean based on citation use. A citation marker proves source membership, not semantic entailment.

Target terminology:

```ts
type GroundingStatus =
  | "no_evidence"
  | "citation_present"
  | "verified";
```

Only independently verified semantic support should justify `verified`.

### 4.7 AI changes must earn production authority

The change loop is:

```text
failure observed
→ baseline
→ hypothesis
→ candidate
→ offline eval
→ quality / latency / cost comparison
→ limited rollout
→ production measurement
→ keep or rollback
```

A prompt/model change is not an improvement merely because a few examples look better.

### 4.8 ML remains advisory until calibrated

The BKT/knowledge-tracing path is an experiment, not automatic production authority.

A statistical mastery probability must not be conflated with:

- evidence stage,
- readiness index,
- learner-facing progress label.

---

## Software engineering principles

### 4.9 Separation of concerns

Primary boundaries:

- `apps/web` — product UI + web/API orchestration,
- `packages/ai` — provider/model/grounding/generation contracts,
- `packages/documents` — file policy/extraction/chunking,
- `packages/learning` — deterministic adaptive policy,
- `supabase` — canonical persistence, authorization, retrieval, transactional functions.

### 4.10 Typed contracts over implicit shapes

State that crosses boundaries should have explicit types or schemas.

This applies especially to:

- model outputs,
- Coach state,
- challenge specifications,
- learning evidence,
- API payloads,
- persisted snapshots.

### 4.11 State machines over prose inference

Coach is a protocol, not free-form chat state reconstructed from assistant prose.

Canonical code:
- `packages/ai/src/coach.ts`

### 4.12 Retries must not create new facts

Stable interaction/encounter IDs, receipts, revision checks, and transactional boundaries prevent network retries from creating duplicate learning evidence.

> A retry must never become a second learning event.

### 4.13 Durable state must be replayable

Learning evidence should be sufficient to reconstruct deterministic learner state.

Model responses are ephemeral. Learning state is not.

### 4.14 Authorization belongs at the data boundary

Authentication proves who the caller is. RLS / scoped RPCs prove what the caller may access.

Service-role clients are privileged bypasses and therefore require explicit user/room/object scope before every operation.

### 4.15 Migrations over database drift

Schema, policies, indexes, RPCs, and transactional behavior belong in versioned migrations.

### 4.16 Measured simplicity over fashionable complexity

Prefer the simplest architecture that passes the quality/security/operational gate.

No new vector database, agent framework, queue, reranker, or ML policy without evidence that it improves the existing baseline.

---

# 5. Technology decision register

| Technology / decision | Why Studigo uses it | Why not the obvious alternative | Revisit when |
| --- | --- | --- | --- |
| **Next.js + React** | Existing web/PWA product, server routes and responsive UI in one TypeScript codebase | A rewrite would add risk without improving the current learning loop | Web architecture becomes an actual scaling/product constraint |
| **Expo/React Native for future iOS/iPadOS** | Reuses JS/TS skills and hosted backend while supporting native distribution | SwiftUI would duplicate product logic and increase platform-specific work | Native-only capability becomes central |
| **Supabase Auth** | One identity system for web and future native clients | Avoid Clerk/Auth0/Firebase identity fragmentation | A requirement exceeds Supabase Auth capabilities |
| **Postgres as source of truth** | Transactions, RLS, relational evidence, migrations, analytics | Avoid multiple application truth stores | Measured scale/availability requirement justifies separation |
| **Supabase Storage** | Private user files integrated with auth/data model | Avoid a second storage identity/ACL system | Scale/compliance requirement demands another provider |
| **pgvector** | Keeps vector retrieval close to authorized relational data | Separate vector DB adds synchronization and deletion/isolation complexity | Benchmark shows material quality/scale advantage |
| **OpenAI-compatible provider layer** | Centralizes model config and keeps provider calls server-side | Avoid direct model calls scattered through routes/UI | Another provider materially improves measured quality/cost/reliability |
| **Responses API + structured schemas** | Supports generation plus constrained machine-readable output | Free-form parsing is brittle when state depends on output | Provider interface changes |
| **Deterministic adaptive director** | Progression must be reproducible/testable | Fully agentic policy would make high-authority learning state nondeterministic | A learned policy demonstrates validated benefit and safe constraints |
| **RAG instead of fine-tuning for course knowledge** | Source truth is per-room, mutable and deletable | Fine-tuning is poorly suited to private, frequently changing per-user material | A separate behavior/style adaptation problem justifies tuning |
| **Postgres-backed durable ingestion target** | Reuses canonical infrastructure; supports leases/retries/idempotency | External queue adds another operational system too early | Throughput/latency proves Postgres job queue inadequate |
| **Python/FAISS retrieval service** | Experimental comparison of local/open retrieval approaches | It is not the canonical authenticated production path | Only after matched eval + proper auth boundary proves value |
| **BKT / knowledge tracing** | Provides a statistical baseline for learner-state experiments | Do not replace deterministic evidence with unvalidated probabilities | Privacy-approved real data shows calibrated predictive benefit |

---

# 6. Repository ownership map

| Area | Primary paths | Responsibility | Key invariant |
| --- | --- | --- | --- |
| Product shell | `apps/web/` | UI, route handlers, Study Room experience | UI does not become source of security truth |
| AI client | `packages/ai/src/client.ts` | Provider/configuration boundary | Secrets remain server-side |
| Grounding | `packages/ai/src/grounding.ts` | Evidence-bound answers/citations/abstention | No unsupported source claims |
| Coach AI protocol | `packages/ai/src/coach.ts` | Stateful model-mediated Coach interaction | Model does not own progression |
| Study generation/grading | `packages/ai/src/study.ts` | Questions, flashcards, semantic grading | Machine-affecting output validated |
| Documents | `packages/documents/` | File policy, extraction, chunking | Original provenance preserved |
| Ingestion orchestration | `apps/web/lib/ingest.ts` | Extract/OCR/embed/index lifecycle | Owner/source revision retained |
| Retrieval | `apps/web/lib/retrieval.ts` + Supabase RPCs | Room-scoped retrieval | Tenant isolation |
| Adaptive policy | `packages/learning/` | Reasoning/scaffold/rematch policy | Deterministic and replayable |
| Learning persistence | `apps/web/lib/learning/`, migrations | Events, receipts, projections | Idempotent/transactional |
| Auth | `apps/web/lib/auth.ts`, middleware | Session principal | No editable metadata authorization |
| Data security | `supabase/migrations/` | RLS, schema, RPCs | User ownership enforced at DB boundary |
| RAG evals | `evals/rag/` | Grounding/isolation/latency/cost evaluation | Model cannot self-certify support |
| ML evals | `evals/ml/` | BKT/calibration experiments | Advisory until validated |
| Security readiness | `implementation/security-readiness/` | Reusable public-release control matrix | Evidence required for pass |
| Game | `prototypes/moon-road/` | Separate game prototype | Separate release/golden baseline |

---

# 7. Current state: implemented vs. not yet proven

## Implemented / demonstrable

- authenticated Study Rooms,
- private uploads and signed downloads,
- extraction and OCR with source locations,
- embeddings and pgvector retrieval,
- room/user isolation through RLS/scoped retrieval,
- source-grounded answer generation,
- citation mapping and explicit insufficient-evidence behavior,
- prompt-injection defensive prompting,
- structured generation,
- semantic/free-text evaluation,
- deterministic adaptive director,
- separate reasoning/scaffold/explanation controls,
- durable/idempotent learning-event architecture,
- transactional Coach/session hardening,
- adversarial RAG evaluation framework,
- offline BKT evaluation harness,
- automated tests and CI.

## Implemented but requiring stronger evidence

- real-world RAG semantic support,
- live abstention accuracy,
- full cross-tenant RAG proof,
- semantic grader agreement with human teachers/reviewers,
- production p95 AI latency,
- production token/cost baselines,
- end-to-end source-deletion propagation through every derived index,
- complete service-role authorization audit,
- child/student-data release controls.

## Planned / hardening work

- durable out-of-request ingestion worker,
- Canonical Studigo Document,
- hybrid/reranked retrieval only if benchmarked better,
- human-labelled grading benchmark,
- precise evidence/readiness/mastery semantics,
- universal AI tracing/version/cost envelope,
- centralized rate/concurrency/spend controls,
- complete public security/privacy release gate,
- polished evidence-backed engineering case study.

Do not describe planned work as shipped.

---

# 8. Execution plan

The current learner experience is the golden baseline. Hardening work should improve engineering underneath it before adding major new product modes.

## Phase 0 — Repository legibility and baseline

**Goal:** protect the current product and make the architecture easy to navigate.

Work:
- maintain this file as the single AI/software engineering entry point,
- remove duplicate engineering walkthrough/hardening documents,
- keep specialist docs scoped to their domain,
- record current model/embedding/prompt/retrieval/flag/migration/test baseline,
- tighten over-strong terms such as runtime `grounded`.

Acceptance:
- a new engineer or GenAI agent can identify the relevant code for a task from this file,
- no competing engineering-plan documents exist,
- current configuration is reproducible.

## Phase 1 — Publish the live human-reviewed RAG scorecard

**Goal:** convert evaluation design into evidence.

Use the existing 120-case corpus in `evals/rag/`.

Measure:
- retrieval Recall@k,
- semantic citation support,
- unsupported-answer abstention,
- cross-user/room leakage,
- prompt-injection violations,
- deleted/stale source violations,
- human usefulness,
- p50/p95 latency,
- tokens,
- cost.

Target release gates already defined by the benchmark include >=95% citation support, >=95% correct unsupported-answer abstention, and zero authorization violations.

Deliver:
- `docs/AI_EVAL_SCORECARD.md`,
- reproducible result JSON.

## Phase 2 — Benchmark retrieval architecture

Compare with matched generation settings:

```text
A current pgvector semantic retrieval
B pgvector + PostgreSQL full-text
C hybrid + lightweight reranking
D optional rewrite + hybrid + reranking
```

Select the simplest candidate that materially improves quality without unjustified latency/cost/operational burden.

Deliver:
- `docs/RETRIEVAL_BENCHMARK.md`,
- benchmark evidence and explicit keep/change decision.

## Phase 3 — Durable ingestion

Replace long request-bound processing with:

```text
upload
→ document record
→ ingestion job
→ claim / lease
→ extract
→ OCR
→ canonicalize
→ chunk
→ embed
→ derive
→ ready
```

Requirements:
- safe concurrent claim,
- lease/abandoned-job recovery,
- attempts,
- bounded exponential retry,
- idempotent stages,
- sanitized failure state,
- immutable original upload,
- explicit derived revision.

A Postgres/Supabase-backed worker is the default unless measured needs justify more infrastructure.

## Phase 4 — Canonical Studigo Document

Create one versioned intermediate representation:

```text
RAW SOURCE
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
├ figures/tables
└ source provenance
```

RAG, Topics, Learn, Coach, Quiz, Flashcards, Study Guide, and future interactive experiences should derive from it or an explicit versioned projection.

Acceptance:
- replacement/deletion of source material cannot leave stale concepts in another surface,
- every derived fact can map back to source/revision/location.

## Phase 5 — Validate semantic grading

Build an independently labelled 300–500 answer dataset covering:

- correct,
- equivalent wording,
- partial,
- misconception,
- incorrect,
- off-topic,
- not-sure,
- typos,
- concise/verbose,
- multiple subjects/grade bands.

Measure:
- macro F1,
- per-class precision/recall,
- false-positive correctness,
- false negatives,
- score deviation if numerical scoring remains,
- grade/subject/noise breakdowns.

Do not keep an `>=85` correctness threshold merely because it is intuitive. Validate or recalibrate it.

Deliver:
- `evals/grading/`,
- `docs/SEMANTIC_GRADER_EVAL.md`.

## Phase 6 — Make learner-state semantics precise

Separate:

```text
Evidence stage = observed learner behavior
Readiness index = deterministic product prioritization
Mastery probability = calibrated statistical estimate, only if actually calibrated
```

Canonical evidence stages may include:

```text
Unseen → Introduced → Assisted → Independent → Transfer → Retained
```

Learner-facing labels may stay simple, but internal claims must be precise.

## Phase 7 — Production AI observability and resource controls

Every model-mediated operation should be attributable to:

- trace ID,
- operation,
- model/version,
- prompt version,
- embedding/retrieval version,
- evaluator/challenge version where relevant,
- retrieved IDs/scores,
- input/output tokens,
- latency,
- estimated cost,
- abstention/error/retry state.

Do not log raw learner/source content by default.

Add:
- per-user/IP rate limits,
- concurrency limits,
- token/work caps,
- timeout budgets,
- bounded retries,
- daily/user/global spend guards,
- circuit breaker/degradation behavior.

## Phase 8 — Security and privacy release gate

The operational security framework is:

`implementation/security-readiness/`

Treat its generated public-launch gate as authoritative for security readiness.

Close at minimum:
- object/tenant isolation,
- service-role scope audit,
- auxiliary-service auth,
- file signature/parser validation,
- archive/image/OCR resource bounds,
- malware/quarantine strategy,
- CSRF/provenance protections,
- CSP/security headers,
- output-handling tests,
- prompt-injection regression,
- secret/dependency scanning,
- branch protection,
- retention/deletion/export,
- minor/guardian/privacy requirements,
- external provider data flows.

## Phase 9 — Secure development and AI release discipline

For every material AI/architecture change document:

1. failure being solved,
2. reproducible case,
3. baseline metric,
4. success metric,
5. unacceptable regressions,
6. latency/cost impact,
7. changed model/prompt/retrieval/data versions,
8. rollout plan,
9. rollback plan,
10. acceptance evidence.

## Phase 10 — Engineering case study

Once measurements exist, create:

`AI_ENGINEERING_CASE_STUDY.md`

It should summarize, without duplicating this plan:

- problem,
- constraints,
- architecture,
- AI/software boundaries,
- grounding,
- adaptive control,
- event/replay design,
- security,
- evaluation methodology,
- measured results,
- failures discovered,
- changes made because of evidence,
- remaining limitations.

---

# 9. Ten-minute technical walkthrough

Use this order when showing the project to another engineer.

## Stop 1 — Product contract

Open:
- `README.md`
- `docs/PRODUCT.md`

Explain:

> The learner's uploaded material is the knowledge boundary. That product decision drives retrieval, authorization, citations and abstention.

## Stop 2 — Provider / untrusted-data boundary

Open:
- `packages/ai/src/client.ts`

Explain:
- provider abstraction,
- chat/embedding configuration,
- server-only credentials,
- untrusted-course-data envelope.

## Stop 3 — Grounded RAG

Open:
- `packages/ai/src/grounding.ts`
- `apps/web/lib/retrieval.ts`
- `evals/rag/`

Explain:
- permission scope,
- source metadata,
- citation mapping,
- abstention,
- why semantic support requires evaluation beyond citation syntax.

## Stop 4 — Structured generation and grading

Open:
- `packages/ai/src/study.ts`

Explain:
- structured question generation,
- validation,
- deterministic grading where possible,
- LLM semantic grading only where necessary.

## Stop 5 — Coach protocol

Open:
- `packages/ai/src/coach.ts`

Explain:
- persisted state machine,
- stable interaction identity,
- challenge/source metadata,
- distinction between model language and software authority.

## Stop 6 — Adaptive learning

Open:
- `packages/learning/`
- `docs/ADAPTIVE_LEARNING_CORE.md`

Explain three separate axes:

```text
reasoning difficulty
scaffold/support
explanation language
```

## Stop 7 — Durable evidence / concurrency

Open:
- learning-event code,
- adaptive migrations,
- `docs/SOL_PHASE2_INTEGRATION.md`,
- `docs/SOL_PHASE3_REVIEW.md`.

Explain:
- idempotency,
- retries,
- source revisions,
- atomic commits,
- event replay.

## Stop 8 — Evaluation

Open:
- `evals/rag/README.md`
- `evals/rag/score.mjs`
- `evals/ml/README.md`

Explain:
- human review,
- claim support,
- abstention,
- cross-tenant decoys,
- prompt injection,
- latency/cost,
- BKT as advisory.

## Stop 9 — Security

Open:
- `implementation/security-readiness/apps/studigo/generated/public-launch-gate.md`

Explain:
- security is tracked as a reusable evidence-backed control matrix,
- failing controls block public release.

## Stop 10 — What is next

Return to the execution plan in this file.

Be explicit about what is not finished. A strong engineering walkthrough includes limitations and the measurement that will close them.

---

# 10. Interview-ready explanations

## Why not just use ChatGPT with a system prompt?

Because Studigo requires permissions, mutable user-owned source truth, citations, abstention, durable learner state, retries, replay and adaptive policy. Those are application responsibilities, not prompt responsibilities.

## Why RAG instead of fine-tuning?

Course knowledge is private, per-room, mutable and deletable. Retrieval preserves provenance and supports replacement/deletion. Fine-tuning is the wrong mechanism for per-user knowledge state.

## Why deterministic progression?

Progression changes learner state. It must be reproducible, auditable and testable. The LLM handles ambiguity; the director handles policy.

## Why pgvector instead of a dedicated vector database?

It keeps vectors close to authorized relational data and avoids a second synchronization/deletion/tenant-isolation system. A dedicated store must prove a measurable benefit before replacing it.

## Why not make it fully agentic?

Autonomous loops add nondeterminism where Studigo needs constrained, auditable state transitions. Models can propose/render/interpret; software authorizes and commits.

## How do you reduce hallucinations?

Permission-scoped retrieval, source priority, citations, explicit abstention, untrusted-source handling, revision/deletion checks and adversarial evaluation. The project reduces risk; it does not claim hallucinations are impossible.

## How do you evaluate RAG?

With a reviewed corpus measuring claim support, abstention, permission/revision violations, usefulness, latency and cost. The model cannot mark its own claims supported.

## What is the biggest technical debt?

The highest-value gaps are completing live evaluation evidence, durable ingestion, canonical document representation, semantic-grader calibration, AI observability/resource controls, and public security/privacy gates.

---

# 11. Documentation governance

This file owns:

- the AI/software engineering story,
- system map,
- technology rationale,
- repository navigation,
- hardening/execution order,
- technical walkthrough.

Specialist documents own details:

- `docs/PRODUCT.md` — product contract,
- `docs/ARCHITECTURE.md` — system/privacy architecture,
- `docs/ROADMAP.md` — current ordered release gates,
- `docs/AUTH.md` — identity/auth,
- `docs/ADAPTIVE_LEARNING_CORE.md` — adaptive technical contract,
- `docs/DESIGN_SYSTEM.md` — visual system,
- `docs/APP_STORE_RELEASE_PLAN.md` — native release,
- `evals/` — evaluation methodology/results,
- `implementation/security-readiness/` — security controls/gate.

Do not create another AI engineering walkthrough, hardening plan, repository guide, or technology rationale that duplicates this file.

If a specialist document changes a fact represented here, update this file in the same PR.

Historical implementation/review documents may remain as evidence, but they do not override current canonical contracts.

---

# 12. Definition of done

The engineering-plan work is successful when:

### Repository legibility
- a new engineer can explain the architecture after reading this file and a small number of linked files,
- a GenAI coding agent can locate the relevant implementation without whole-repo scanning,
- every major subsystem has one obvious owner/path,
- duplicate engineering overview documents are gone.

### Technology rationale
- major technology choices state why they were selected,
- alternatives/rejected complexity are explicit,
- criteria for revisiting decisions are explicit.

### AI engineering evidence
- RAG has a human-reviewed live scorecard,
- semantic grading has an independent benchmark,
- model/prompt/retrieval/evaluator versions are traceable,
- latency/tokens/cost are observable,
- probabilistic claims are not stronger than evidence supports.

### Software engineering evidence
- state transitions are typed and testable,
- retries are idempotent,
- learning state is replayable,
- high-authority writes are transactional,
- authorization is enforced at the data boundary,
- migrations and CI make changes reproducible.

### Security
- the reusable security control matrix has no unresolved public-release blockers,
- child/student-data requirements are explicitly resolved,
- external provider data flows are documented,
- expensive AI operations are bounded.

### Explanation quality
The project owner can explain Studigo coherently at:
- 30 seconds,
- 2 minutes,
- 10 minutes,
- and code-review depth,

without overstating what has actually been measured.

When those conditions hold, Studigo is not merely an AI-powered product. It is a repository that clearly demonstrates **AI engineering, software engineering, security engineering, evaluation discipline, and architectural decision-making**.
