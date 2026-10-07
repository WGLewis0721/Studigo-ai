# Studigo AI Engineering Walkthrough

> A concise technical guide for explaining Studigo to an AI engineer, technical interviewer, hiring manager, or reviewer.
>
> This is a **repository navigation and explanation guide**, not a marketing page and not a substitute for measured evidence.
>
> Current hardening plan: [AI_ENGINEERING_HARDENING_PLAN.md](AI_ENGINEERING_HARDENING_PLAN.md)

## What Studigo is

Studigo is an AI study companion that turns a learner's own class material into a source-grounded tutor and adaptive learning system.

The important engineering distinction is that **the LLM is not the application state machine**.

Studigo separates:

```text
source truth
retrieval
generation / semantic interpretation
adaptive policy
learning evidence
persistent state
```

so the model can handle language and ambiguity without silently becoming the authority over permissions, source truth, or learner progression.

---

# 30-second explanation

> Studigo takes a student's own study material, extracts and indexes it, retrieves only permitted evidence from that Study Room, and uses an LLM to explain or evaluate responses against that evidence. The LLM does not decide mastery or progression. A deterministic adaptive director controls challenge level, scaffolding, rematches, and evidence transitions, and those learning events are persisted so state can be replayed. I also built adversarial RAG and knowledge-tracing evaluation infrastructure so retrieval, grounding, grading, latency, cost, and future ML changes can be measured instead of tuned by anecdote.

If the reviewer asks one question, move to the two-minute explanation.

---

# 2-minute architecture explanation

## 1. User material is the knowledge boundary

A learner creates a Study Room and uploads study guides, notes, worksheets, textbook pages, presentations, or images.

The system:

```text
upload
→ extract / OCR
→ normalize
→ chunk
→ embed
→ pgvector
→ topic/source projections
```

Original files stay private. Page/slide provenance is preserved so answers can point back to the source.

**Current implementation:** `apps/web/lib/ingest.ts`, `packages/documents/`, Supabase storage/migrations.

## 2. Retrieval is permission-preserving and source-grounded

Studigo retrieves chunks scoped to the authenticated learner and Study Room. Teacher material has explicit source priority. The model is instructed to answer from supplied excerpts and abstain when the material does not support an answer.

**Current implementation:** `packages/ai/src/grounding.ts`, Supabase retrieval RPCs, RLS/security tests.

## 3. The model handles language, not progression authority

The model is useful for:

- explanations,
- question generation,
- semantic grading,
- Socratic feedback,
- interpreting free-form learner answers.

But it does not silently determine the learner's progression state.

**Current implementation:** `packages/ai/src/coach.ts`, `packages/ai/src/study.ts`.

## 4. A deterministic adaptive director controls learning policy

Studigo separates:

- reasoning difficulty,
- scaffold/support level,
- language/explanation level.

The director can increase reasoning, add support, schedule rematches, require transfer, and account for retention without asking an LLM to improvise the policy.

**Current implementation:** `packages/learning/`, `apps/web/lib/learning/`, `docs/ADAPTIVE_LEARNING_CORE.md`.

## 5. Learning state comes from durable evidence

Attempts, assistance, retries, skips, transfer, and retention become explicit learning events. Replay reconstructs deterministic state. Idempotency and transactional paths are used so transport retries do not create fake evidence.

**Current implementation:** learning-event code, Coach transaction migrations, durable session migrations, database/security tests.

## 6. AI changes are supposed to be evaluated

The repository already contains:

- a 120-case adversarial RAG benchmark design,
- isolation/prompt-injection/conflict/deletion cases,
- citation-support and abstention gates,
- latency/cost fields,
- an offline BKT baseline with calibration metrics.

The main hardening gap is completing the independent live measurements and publishing the scorecards.

**Current implementation:** `evals/rag/`, `evals/ml/`.

---

# 10-minute guided repository tour

Use this order. It follows one learner action through the system instead of jumping randomly through the repository.

## Stop 1 — Product contract

Open:

- `README.md`
- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`

Explain:

> The product is constrained to the learner's uploaded material. This is not a generic ChatGPT tutor. That product constraint drives retrieval, permissions, citations, abstention, and the learning engine.

Do not spend more than one minute here.

---

## Stop 2 — Provider and trust boundary

Open:

- `packages/ai/src/client.ts`

Point out:

- provider access is isolated,
- chat and embeddings are explicit,
- uploaded material is serialized as untrusted data,
- prompt-injection instructions inside source files are not supposed to become system instructions.

Explain:

> I intentionally treat uploaded course content as untrusted input. The model sees it as data, not authority. Provider calls are centralized rather than scattered through React/API code.

Then move on.

---

## Stop 3 — Grounded RAG

Open:

- `packages/ai/src/grounding.ts`
- relevant retrieval RPC/migration
- `evals/rag/cases.mjs`

Show:

- room-scoped retrieved chunks,
- page/document provenance,
- source citation mapping,
- explicit insufficient-evidence behavior,
- adversarial cases for foreign users/rooms, deleted content, conflicting sources, and prompt injection.

Explain:

> The interesting part isn't that I used embeddings. It's the contract around retrieval: permission boundaries, source revisions, abstention, and proving that citations support claims.

### Important limitation to state accurately

The current runtime `grounded` boolean is stronger-sounding than its actual semantics because citation presence is not the same as semantic entailment. The hardening plan explicitly fixes that naming/verification boundary.

That is a good example of engineering self-review, not something to hide.

---

## Stop 4 — Question generation and semantic evaluation

Open:

- `packages/ai/src/study.ts`
- `packages/ai/src/coach.ts`

Show:

- structured schemas,
- normalized question validation,
- deterministic fill-in grading where possible,
- LLM semantic grading only where language understanding is necessary,
- free-form answer handling.

Explain:

> I don't use an LLM for logic that can be deterministic. Exact/typo-tolerant grading is code. Semantic grading is model-mediated and therefore needs its own evaluation set.

Then point to Phase 5 of the hardening plan for the human-labelled grader benchmark.

---

## Stop 5 — Adaptive learning control plane

Open:

- `docs/ADAPTIVE_LEARNING_CORE.md`
- `packages/learning/`
- `apps/web/lib/learning/`

Explain the three independent axes:

```text
reasoning difficulty
scaffold/support
explanation language
```

Give one concrete example:

```text
reasoning = transfer
scaffold = hint
explanation = simpler
```

Explain:

> A learner can get a hard thinking task in simple language with one hint. Those are independent controls. The LLM renders a task the policy already chose; it doesn't get to silently make the task easier or award mastery.

This is one of Studigo's strongest AI-system design points.

---

## Stop 6 — Durable evidence and replay

Open:

- learning event types/tests,
- Coach transaction migrations,
- `docs/SOL_PHASE2_INTEGRATION.md`,
- `docs/SOL_PHASE3_REVIEW.md`.

Show:

- stable encounter/interaction IDs,
- deterministic event IDs,
- idempotent writes,
- retries,
- source revision checks,
- replay,
- optimistic revisions / transaction boundaries.

Explain:

> Model responses are ephemeral; learning evidence cannot be. A retry, stale request, or deleted source should not accidentally advance a learner. So the evidence path is transactional and replayable.

---

## Stop 7 — Evaluation

Open:

- `evals/rag/README.md`
- `evals/rag/cases.mjs`
- `evals/rag/score.mjs`
- `evals/ml/README.md`

Explain:

> I designed the eval layer so a model cannot mark its own citations correct. Claim support requires independent review. The benchmark also refuses cross-tenant/revision violations and records latency/cost.

For ML:

> BKT is advisory. It is evaluated with learner-separated, time-respecting splits and calibration metrics. It does not get production authority merely because it exists.

### Current gap

Be explicit:

> The framework exists, but the complete independently reviewed live scorecard is still an open hardening milestone.

Never present synthetic/unit-test validation as proof of learning effectiveness.

---

## Stop 8 — Production limitations and next work

Open:

- `implementation/AI_ENGINEERING_HARDENING_PLAN.md`

Summarize the next major engineering work:

1. publish live human-reviewed RAG scorecard,
2. benchmark retrieval variants,
3. move ingestion to a durable worker,
4. introduce one canonical document representation,
5. validate semantic grading against human labels,
6. formalize evidence/readiness/mastery semantics,
7. add full AI observability and cost controls.

Explain:

> The roadmap is measurement-driven. I don't want to add an agent framework, a reranker, another vector database, or ML control just because it sounds more sophisticated. Each has to beat the baseline.

---

# AI engineering element map

| AI engineering element | Why it exists | Where to start |
| --- | --- | --- |
| Provider abstraction | Keep model/vendor calls isolated | `packages/ai/src/client.ts` |
| Prompt-injection boundary | Uploaded files are untrusted | `packages/ai/src/client.ts`, `evals/rag/cases.mjs` |
| Embeddings / vector retrieval | Find relevant room evidence | `packages/ai/src/embeddings.ts`, retrieval RPCs |
| Grounded generation | Answer only from learner material | `packages/ai/src/grounding.ts` |
| Citation provenance | Connect claims to source pages | grounding + document metadata |
| Abstention | Avoid unsupported answers | grounding + RAG evals |
| Structured outputs | Constrain model-mediated logic | `packages/ai/src/study.ts`, `coach.ts` |
| Semantic grading | Evaluate meaning, not exact wording | `packages/ai/src/study.ts`, `coach.ts` |
| Deterministic adaptive policy | Keep progression outside LLM authority | `packages/learning/`, `apps/web/lib/learning/` |
| Durable learning events | Make state replayable/auditable | learning event + migrations |
| Transaction/idempotency design | Prevent retries from fabricating evidence | adaptive Coach/session migrations |
| Adversarial RAG evals | Measure grounding/security failures | `evals/rag/` |
| Knowledge tracing baseline | Compare deterministic state to ML prediction | `evals/ml/` |
| AI observability | Measure latency/cost/version regressions | hardening Phase 7, not complete yet |
| Canonical document model | Prevent downstream source drift | hardening Phase 4, planned |
| Durable ingestion worker | Remove request-time processing limit | hardening Phase 3, planned |

---

# What is already implemented vs. what is still evidence work

A technical walkthrough must distinguish **code that exists** from **claims that still need measurement**.

## Implemented / demonstrable

- private source upload and extraction,
- OCR and page provenance,
- embeddings and pgvector retrieval,
- room/user isolation via RLS and retrieval scope,
- grounded answer generation and citation mapping,
- prompt-injection defensive prompting + adversarial fixtures,
- structured question generation,
- semantic/free-text evaluation,
- deterministic adaptive director,
- independent reasoning/scaffold/language concepts,
- durable/idempotent learning-event architecture,
- transactional Coach/session hardening,
- adversarial RAG evaluation framework,
- offline BKT evaluation harness,
- automated tests and CI.

## Not yet safe to overclaim

- complete human-reviewed live RAG quality,
- calibrated mastery probabilities,
- semantic grader agreement with teachers,
- live p95/cost targets across a representative workload,
- superiority of hybrid/reranked retrieval,
- production ML improvement over deterministic policy,
- learning effectiveness in real students,
- completed durable ingestion worker,
- completed canonical Studigo document layer,
- complete production AI observability,
- complete child privacy/release acceptance.

This list should shrink as the hardening plan is executed.

---

# Interview questions this project should answer

## "Why not just use ChatGPT with a system prompt?"

Because Studigo needs source permissions, citations, abstention, durable learner state, replay, adaptive progression, and evidence that survives model/provider changes. Those are application-system responsibilities, not prompt responsibilities.

## "Why deterministic progression?"

Because progression affects learner state. It should be reproducible, testable, and auditable. The LLM handles semantic ambiguity; the deterministic director handles policy.

## "Why RAG instead of fine-tuning?"

The source of truth changes per Study Room and comes from user uploads. Retrieval preserves source provenance and allows deletion/revision. Fine-tuning would be the wrong mechanism for per-room mutable knowledge.

## "How do you prevent hallucinations?"

Studigo constrains generation to retrieved room sources, cites them, abstains when evidence is insufficient, tests adversarial source conditions, and is adding independent semantic support verification. It reduces hallucination risk; it does not claim hallucinations are mathematically impossible.

## "How do you know the RAG system is good?"

The repository has a 120-case adversarial benchmark with independent review gates for citation support, abstention, permission violations, latency, and cost. The framework exists; the complete live reviewed scorecard is the current highest-priority hardening milestone.

## "Why not let an agent choose what the learner does next?"

Because that creates unnecessary nondeterminism in a high-authority state transition. The adaptive director is a policy engine. An LLM can propose/render/interpret, but evidence and progression remain constrained.

## "Where would you use ML?"

Only where measured predictive benefit exists. The BKT harness is intentionally advisory until real, privacy-approved data shows a reproducible advantage.

## "What's the biggest technical debt?"

Request-bound document ingestion, incomplete live eval evidence, semantic-grader calibration, and incomplete AI observability. The hardening plan prioritizes those before adding more AI complexity.

---

# Suggested live demo narrative

Do not demo every feature. Demo one learning lifecycle.

1. Open a Study Room.
2. Show the uploaded source.
3. Ask a question that the source supports.
4. Open the citation back to the source page.
5. Ask something unsupported and show abstention.
6. Enter Coach.
7. Answer once incorrectly or request a hint.
8. Show the next adaptive behavior.
9. Open Progress and explain that evidence, not chat sentiment, drives state.
10. Open the repository and show:
   - grounding,
   - adaptive policy,
   - event/replay logic,
   - RAG evals.

That connects the visible product to the engineering underneath it.

---

# One-sentence architecture principles

These are useful during interviews:

- **The learner's uploaded material is the knowledge boundary.**
- **Retrieval decides what evidence is available; the model does not get unrestricted course knowledge.**
- **The LLM handles language and ambiguity; deterministic code owns progression and state.**
- **Assistance and reasoning difficulty are separate variables.**
- **A citation is not automatically proof of semantic grounding.**
- **A retry must never become a second learning event.**
- **No ML model earns authority without beating a measured baseline.**
- **Source deletion and revision must propagate into what the AI is allowed to claim.**
- **Production AI changes need quality, latency, cost, and rollback evidence.**

---

# Definition of walkthrough success

A reviewer unfamiliar with Studigo should be able to use this file and, within ten minutes, answer:

- What problem does Studigo solve?
- Where does the LLM add value?
- Where is the LLM deliberately not trusted?
- How are user sources ingested and retrieved?
- How are citations and abstention handled?
- How does adaptive learning work?
- What becomes durable evidence?
- How are retries/concurrency handled?
- What AI evaluations exist?
- What has actually been measured?
- What remains unfinished?
- Why were the major architecture decisions made?

If those questions are clear, the repository is not only engineered well; it is also **legible as an AI engineering project**.
