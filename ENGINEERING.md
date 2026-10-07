# Studigo Engineering Guide

> **Start here for technical work.** This file is the compact map of the live system for engineers, reviewers, and GenAI coding agents.
>
> Read this before opening the rest of the repository. Then load only the task-specific contract or code paths linked below.
>
> What to build next is `implementation/ENGINEERING_PLAN.md` (workstreams L, E, P, S, H, W). That file is the single execution plan. Do not add another plan, tour, or security checklist.

## System in one sentence

Studigo turns a learner's own course material into a source-grounded study companion where **probabilistic AI handles language and ambiguity while deterministic software owns authorization, source scope, progression, evidence, retries, and durable state**.

## Engineering thesis

Studigo is deliberately not a chatbot wrapper.

The core boundary is:

```text
PROBABILISTIC AI
- retrieve semantic relevance
- explain
- generate questions
- interpret free-form answers
- produce structured semantic evidence

DETERMINISTIC SOFTWARE
- authentication / authorization
- source ownership and scope
- challenge policy
- scaffold policy
- mastery/evidence transitions
- idempotency and retries
- transactions and replay
- release/security gates
```

The rule is simple:

> Use AI where ambiguity creates value. Keep deterministic authority where correctness must be reproducible.

## End-to-end path

```text
Learner upload
   ↓
private object storage
   ↓
extract / OCR / normalize
   ↓
chunks + page/slide provenance
   ↓
embeddings + pgvector
   ↓
room-scoped retrieval under RLS
   ↓
grounded model call
   ↓
structured explanation / question / semantic evaluation
   ↓
deterministic adaptive-learning decision
   ↓
durable learning event + transactional state
   ↓
progress / next challenge / rematch
```

The planned hardening path adds a durable ingestion worker and a Canonical Studigo Document between extraction and downstream retrieval/topic generation.

## Technology catalog

What is in the system today. This is a map of the tree, not a decision log.

| Piece | Where | Role now | Not this |
| --- | --- | --- | --- |
| **TypeScript, pnpm workspace** | repo root, `packages/*`, `apps/web` | Shared contracts for web, documents, AI, and learning | Untyped model payloads crossing those boundaries |
| **Next.js 16 / React** | `apps/web` | The web/PWA: UI, route handlers, streaming | The long-running job runner. Ingestion still runs inside the request |
| **Supabase Auth** | `apps/web/lib/auth.ts`, middleware | The session principal | The authorization check. RLS and scoped RPCs do that |
| **Postgres + RLS** | `supabase/migrations/` | Application data and the tenant boundary | A store service-role code may skip without its own scope check |
| **Supabase Storage** | document upload/download routes | Private originals, signed downloads | Public document hosting |
| **pgvector** | `match_study_chunks` in `supabase/migrations/002_core_loop.sql` | Room- and owner-scoped dense retrieval beside the rows RLS already protects | A second vector database. There is not one on the production path |
| **OpenAI-compatible client** | `packages/ai/src/client.ts` | Chat, OCR, structured generation, semantic grading, embeddings. Transports: direct, Vercel AI Gateway, Ollama for chat only. Embeddings stay 1536-d on direct or gateway | Progression, authorization, or mastery writes |
| **Deterministic director** | `packages/learning` | Challenge, scaffold, and progression from learner state. No model call | Prompt-owned progression |
| **Mastery math** | `packages/mastery` | BKT, Elo, and a scheduler as pure functions. Eval harness is `evals/ml`, synthetic data | The production mastery write. That stays with the director and learning events |
| **Postgres functions / learning events** | `supabase/migrations/`, `apps/web/lib/learning/` | Idempotent, transactional evidence | Best-effort chat state |
| **Python retrieval service** | `services/retrieval/` | Local FAISS prototype. Uses LangChain splitters, Hugging Face embeddings, and unauthenticated room-ID endpoints | Production retrieval. ADR 001 keeps the TypeScript path until a matched benchmark says otherwise |
| **Tauri shell** | `apps/desktop` | Scaffold. Bundling is disabled | A shipped desktop app |
| **Expo / React Native** | `docs/APP_STORE_RELEASE_PLAN.md` only | The documented App Store route. No Expo app is in the monorepo yet | A second backend |

Course knowledge in production is retrieved from uploaded chunks. There is no fine-tuning job in the repo.

A new dependency or AI layer still has to beat the current path on a measured quality, cost, latency, safety, or maintainability gap. That rule is in `AGENTS.md`. It is not a request to write a rationale for the rows above.

## Repository map

| Concern | Start here | Purpose |
| --- | --- | --- |
| Product contract | `docs/PRODUCT.md` | What Studigo is allowed to be |
| Deep architecture | `docs/ARCHITECTURE.md` | Runtime/data boundaries and implementation details |
| Engineering plan | `implementation/ENGINEERING_PLAN.md` | What must be built/hardened next and why |
| Security readiness | `implementation/security-readiness/` | Reusable control matrix, audit, release gate |
| Web/PWA | `apps/web/` | UI, API routes, server orchestration |
| AI provider boundary | `packages/ai/src/client.ts` | Models, embeddings, provider transport, untrusted-input rules |
| Grounding/RAG | `packages/ai/src/grounding.ts`, `apps/web/lib/retrieval.ts` | Source-bound answers, citations, abstention, room-scoped retrieval |
| AI study generation/grading | `packages/ai/src/study.ts` | Structured questions, grading, Learn behavior |
| Coach protocol | `packages/ai/src/coach.ts` | Stateful Coach interaction protocol |
| Documents | `packages/documents/`, `apps/web/lib/ingest.ts` | Upload policy, parsing, OCR, chunking, ingestion |
| Adaptive learning | `packages/learning/`, `apps/web/lib/learning/` | Deterministic challenge/scaffold/progression |
| Database/security | `supabase/migrations/` | Schema, RLS, pgvector, RPCs, transaction boundaries |
| RAG evaluation | `evals/rag/` | Grounding, abstention, isolation, prompt-injection, latency/cost benchmark |
| ML experiments | `evals/ml/` | Advisory BKT/calibration work |
| Security tests | `tests/database-security.test.mjs` | Database/tenant boundary regression |
| Game prototype | `prototypes/moon-road/` | Separate game-first prototype |

## Where to make common changes

| Change | Primary code | Also verify |
| --- | --- | --- |
| Change model/provider | `packages/ai/src/client.ts` | AI evals, cost/latency, prompt/version trace |
| Change grounded-answer behavior | `packages/ai/src/grounding.ts` | `evals/rag/` |
| Change retrieval | `apps/web/lib/retrieval.ts`, SQL RPC | RLS, recall, citation support, latency |
| Change question/grading logic | `packages/ai/src/study.ts` | grader/question tests + semantic eval |
| Change Coach behavior | `packages/ai/src/coach.ts` | Coach state, interaction IDs, learning-event path |
| Change progression/scaffolding | `packages/learning/` | replay/determinism tests |
| Change file ingestion | `packages/documents/`, `apps/web/lib/ingest.ts` | upload security, provenance, stale-source tests |
| Change auth | `apps/web/lib/auth.ts`, middleware, Supabase config | RLS, OAuth/session tests |
| Change DB state | `supabase/migrations/` | migration rollback, RLS, concurrent/retry behavior |
| Change learner UI | `apps/web/components/` | product/design contracts; do not duplicate learning policy in UI |

## Core AI engineering principles

1. **Uploaded material is the default knowledge boundary.**
2. **RAG must preserve permissions, not just semantic relevance.**
3. **A citation marker is not proof of semantic support.**
4. **Unsupported questions should abstain instead of inventing course facts.**
5. **Uploaded/retrieved content is untrusted data and possible prompt-injection input.**
6. **Machine-affecting model output is structured and validated.**
7. **Semantic grading is used only where deterministic grading is insufficient.**
8. **The LLM does not own progression or mastery state.**
9. **Reasoning difficulty, support/scaffolding, and explanation language are separate axes.**
10. **AI changes must be evaluated for quality, safety, latency, cost, and rollback.**

## Core software engineering principles

1. **One canonical identity/data boundary.**
2. **Authorization is enforced at the database layer with RLS.**
3. **Service-role operations must independently prove user/room/object scope.**
4. **Retries must not create duplicate facts or learning evidence.**
5. **State transitions that matter are durable, idempotent, and replayable.**
6. **External providers are isolated behind internal contracts.**
7. **Typed schemas are preferred over implicit object shapes.**
8. **Database changes are migrations, not manual drift.**
9. **Failure/recovery paths are first-class behavior.**
10. **Architecture changes require a reason, evidence, and a rollback path.**

## Current strongest engineering elements

- room/user-scoped RAG with page/source provenance,
- explicit abstention and source-priority rules,
- prompt-injection/untrusted-source boundaries,
- structured question and grading contracts,
- deterministic adaptive-learning control plane,
- separate reasoning/scaffold/language axes,
- stable interaction/encounter IDs,
- idempotent and transactional learning-state paths,
- event/replay architecture,
- adversarial RAG benchmark design,
- advisory knowledge-tracing/calibration harness,
- RLS and private-source storage.

## Current important gaps

Do not overclaim these as finished:

- independently reviewed live RAG scorecard,
- calibrated semantic-grader agreement with humans,
- durable out-of-request ingestion worker,
- Canonical Studigo Document layer,
- full production AI cost/token/latency tracing,
- centralized AI abuse/spend limits,
- completed public-launch security gate,
- complete student/minor privacy release requirements,
- measured proof that more complex retrieval beats the current baseline.

`packages/mastery` (BKT, Elo, scheduler) is advisory. Production progression is `packages/learning`. A mastery probability is not an evidence stage.

See `implementation/ENGINEERING_PLAN.md` for the execution order.

## Change methodology

For any material AI or architecture change:

```text
failure / requirement
       ↓
current baseline
       ↓
hypothesis
       ↓
smallest candidate
       ↓
tests / offline eval
       ↓
quality + safety + latency + cost
       ↓
limited rollout
       ↓
production evidence
       ↓
keep or rollback
```

Do not call something better because a few prompts looked better.

## How to explain Studigo

### 30 seconds

> Studigo is a grounded learning system built around a student's own course material. The AI handles retrieval, explanation, question generation, and semantic interpretation, but deterministic software owns permissions, progression, and learning evidence. That makes the important state reproducible and testable instead of putting the entire product inside a prompt.

### 2 minutes

Walk through:

1. private learner upload,
2. extraction/OCR + provenance,
3. room-scoped pgvector retrieval,
4. grounded generation + abstention,
5. structured semantic evaluation,
6. deterministic challenge/scaffold policy,
7. durable/idempotent learning evidence,
8. RAG/security/evaluation gates.

### 10 minutes

Open, in this order:

1. `docs/PRODUCT.md`
2. `packages/ai/src/client.ts`
3. `packages/ai/src/grounding.ts`
4. `packages/ai/src/study.ts`
5. `packages/ai/src/coach.ts`
6. `packages/learning/`
7. relevant `supabase/migrations/`
8. `evals/rag/`
9. `implementation/security-readiness/`
10. `implementation/ENGINEERING_PLAN.md`

## GenAI context-loading contract

### Context-efficiency rules

- Keep this file focused on **current architecture and navigation**, not chronological history.
- Prefer a path/link over copying large implementation details.
- Keep each subsystem summary short enough to decide what file to open next.
- Put evidence in tests/evals/audits and link to it.
- Put planned work in `implementation/ENGINEERING_PLAN.md`, not here.
- Put historical rationale in ADRs only when the decision history matters.
- When this file grows, remove duplication before adding another overview document.


A coding agent should **not** read the entire repository before acting.

Default sequence:

1. Read this file.
2. Read `docs/PRODUCT.md` only when product behavior/scope is relevant.
3. Read `docs/ARCHITECTURE.md` only for deeper runtime/data questions.
4. Read `implementation/ENGINEERING_PLAN.md` only for planned hardening/roadmap work.
5. Open only the code paths from the repository/change maps above that match the task.
6. Read relevant tests/evals before changing behavior.
7. Search outward only when the targeted files reveal a dependency.

### Documentation authority

When docs conflict, use this order:

1. current code + executable tests for what is actually implemented,
2. `docs/PRODUCT.md` for product invariants,
3. `docs/ARCHITECTURE.md` for intended runtime architecture,
4. this file for the compact engineering map,
5. `implementation/ENGINEERING_PLAN.md` for planned work,
6. dated/audit/history documents for evidence and context.

A material architecture change must update this file if it changes the system map, technology rationale, authority boundary, or code ownership.
