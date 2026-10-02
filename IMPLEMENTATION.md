# Studigo V3 Implementation Plan

**Target:** deterministic adaptive game director underneath a grounded GenAI study partner  
**Client:** universal iOS/iPadOS app using the repo's chosen Expo / React Native path  
**Backend:** existing Studigo/Supabase system, with a server-side OpenAI integration and a Python AI/ML service permitted where it materially improves quality or maintainability  
**Execution:** Phase 1 — GPT 6.1 Sol / low; Phase 2 — GPT 6.1 Sol / medium; Phase 3 — GPT 6.1 Sol / xhigh

The user approved the available effort labels `low -> medium -> xhigh` on October 2, 2026 UTC. The requested “Light” label is unavailable here and maps to `low` by that explicit approval; “Extra High” is `xhigh`. These are coding-agent assignments, separate from production provider models. Claude retains UI/UX ownership: complete backend/contracts/evaluation passes before returning the learner-facing Coach settings and native presentation handoff to Claude.

This file is the implementation handoff. It does not replace the product, architecture, adaptive-learning, design-system, or App Store contracts. Read them first and preserve the working product.

## Execution order and prerequisite gate

Track verified results, source-audit findings and outstanding prerequisite checks in [`docs/V3_EXECUTION_EVIDENCE.md`](docs/V3_EXECUTION_EVIDENCE.md). An unchecked acceptance case remains open even when CI passes.

Resolve the PR #59 handoff first, then complete or explicitly validate the existing downloadable study-guide P0 using `docs/USER_TEST_CASES.md`. Record evidence and remaining defects before starting V3 implementation. A local fixture PDF alone does not close hosted authorization, mobile open/share, print-layout, or learner-validation checks. After this gate, execute Phase 1, Phase 2, then Phase 3 in `IMPLEMENTATION.md`.

The shared ChatGPT conversation has not been independently verified and is not acceptance evidence. Model names and effort levels below are requested execution assignments; unavailable models must be reported rather than silently relabeled.

## Read first

1. `docs/PRODUCT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/ADAPTIVE_LEARNING_CORE.md`
4. `docs/ADAPTIVE_LEARNING_ENGINE.md`
5. `docs/ADAPTIVE_GAME_DIRECTOR_RESEARCH.md`
6. `docs/DESIGN_SYSTEM.md`
7. `docs/APP_STORE_RELEASE_PLAN.md`
8. `docs/ROADMAP.md`
9. `docs/COMPANION_PARITY_PLAN.md`
10. `docs/AI_HANDOFF.md`

## Product thesis

Studigo is not a generic AI tutor and it is not a generic gamified-learning app.

The user gives Studigo the material they are actually expected to learn. Studigo retrieves from that material, explains it clearly, practices it with the learner, adapts the next challenge from demonstrated performance, and records evidence of real mastery.

The convergence to protect is:

```text
user's own material
        |
        v
grounded retrieval / RAG
        |
        v
deterministic adaptive game director
        |
        v
ChallengeSpec
        |
        v
GenAI study partner renders the encounter naturally
        |
        v
learner response
        |
        v
semantic evidence + deterministic learning event
        |
        +--------------------> persistent concept state
                                   |
                                   +--> next challenge
```

The LLM is central to conversation, explanation, semantic interpretation, grounded generation and feedback. It is **not** the progression authority.

## Decisions that are already made

### 1. User material remains the knowledge boundary

Teacher study guides and teacher material have highest teaching/retrieval priority. Textbooks support and clarify. General model knowledge must not silently become course truth.

Every generated factual answer, explanation, question and feedback item must be traceable to the room's permitted source scope when the task is course-specific.

### 2. The global explanation level stays

`study_rooms.explain_level` remains a Study Room-wide setting:

- `simpler`
- `standard`
- `deeper`

It applies across Coach and Learn. It changes wording and explanation depth only. It must never change source facts, grading truth, mastery thresholds, or reasoning demand.

The critical invariant is:

> **language difficulty and thinking difficulty are separate variables.**

A learner can receive a hard transfer problem in simple language.

### 3. Coach settings are simplified

The current learning-tradition and practice-recipe controls are to leave the learner-facing UI. Their research remains useful as internal strategy references.

The six Coach styles collapse to three clear modes:

- **Show me** — brief explanation, one representative example, then an attempt.
- **Coach me** — default; ask, observe, scaffold, diagnose, retry, adapt.
- **Challenge me** — less initial help, stronger retrieval/application pressure, delayed hints and earlier transfer.

These modes bias delivery and initial support. They never change the mastery target.

**Challenge me** owns the persistent `coach_mode = challenge` preference. It biases initial support and delivery, but does not raise persisted reasoning or independently request a harder rung. **Try a harder question** is a separate, ungraded one-shot control sending `challengeRequest: "stretch"`; it does not save a mode. The stretch follows existing director precedence and caps, leaves normal scaffold/task-size rules intact, and cannot change mastery without assessed evidence. Mode changes affect subsequent encounters; they do not rewrite a pending ChallengeSpec. The room explanation level remains independent of both controls. Existing code uses “Challenge me” for stretch; the migration must rename that control and deterministically route the two intents without ambiguous aliases.

### 4. One learner state, many learning surfaces

Coach, Quiz, Flashcards, Practice Test, Weak Areas, Cram and any later native activities must contribute to one concept-level learner state.

Do not create independent mastery engines per screen.

### 5. The companion is presentation, not authority

Studigo may react to thinking, typing, success, struggle, source retrieval and completion. Companion code must not award mastery, change challenge level, or create learning evidence.

### 6. iOS/iPadOS uses one backend

The universal Apple client is an Expo / React Native client of the existing Studigo system. Do not fork Studigo into a separate native learning engine.

Supabase Auth remains identity. Postgres/RLS remains authorization. Learning state remains server-owned.

### 7. The OpenAI API key is server-side only

Never ship `OPENAI_API_KEY` in the iOS bundle, Expo config, JavaScript bundle, SecureStore, app binary or client-visible environment variables.

The iOS app calls Studigo's authenticated backend. The backend calls OpenAI.

Use a dedicated project/service key with the narrowest practical permissions, rotation, monitoring and spend limits.

## Architecture target

The implementation may evolve after the Phase 1 spike, but the boundary should look like this:

```text
                  Expo / React Native iOS + iPadOS
                              |
                    authenticated Studigo API
                              |
          +-------------------+-------------------+
          |                                       |
          v                                       v
 Supabase Auth/Postgres/RLS              learning orchestration
 documents / concepts / state                   |
          |                         +-------------+--------------+
          |                         |                            |
          v                         v                            v
   pgvector / hybrid         deterministic director      grounded GenAI
      retrieval              reducer + policy            renderer/evaluator
          |                         |                            |
          +-------------------------+----------------------------+
                                    |
                              OpenAI API
                          (server-side key only)
```

### Python / LangChain boundary

A Python service is explicitly allowed and encouraged **when it beats the current TypeScript path on measured quality, iteration speed, or maintainability**.

Preferred candidate: `services/learning-ai/` using Python + FastAPI, with LangChain for retrieval/composition where it adds value.

Do not add Python merely to check a box. Phase 1 must compare:

**A. Existing TypeScript RAG/provider path**  
vs.  
**B. Python + LangChain service over the same Supabase/pgvector data**

Evaluate citation quality, permission safety, latency, cost, testability and operational complexity.

The likely hybrid is:

- deterministic control plane stays in typed application code with replayable rules;
- Supabase/Postgres remains the canonical learner state and permission boundary;
- Python/LangChain handles RAG composition, model-facing pipelines, evaluation tooling and optional ML experiments;
- OpenAI Responses/embeddings are called only from trusted server infrastructure;
- Python must return typed structured outputs and must not directly mutate mastery unless the deterministic service validates the transition.

If LangChain obscures source metadata, RLS, page citations or debugging, use direct OpenAI/Supabase calls instead.

## Deterministic game director contract

The game director answers one question:

> Given what this learner has demonstrated about this concept, what encounter should happen next and how much support should it contain?

It must answer that without an LLM call.

### Inputs

Do not replace the current typed contracts with a parallel model. Start from
`apps/web/lib/learning/types.ts` and extend only when a demonstrated requirement
cannot fit the existing vocabulary.

Today the director already accepts the concept, learner state, recent events,
activity, route and an optional one-shot `challengeRequest`. V3 should add the
three-mode preference as a **delivery/support bias** at the orchestration boundary
without making it a second progression ladder.

Do not put prose prompts in the control-plane layer.

### State

Preserve existing fields and extend only when evidence requires it. The model should be able to represent:

- recent correct / partial / incorrect outcomes;
- independent vs assisted success;
- hint/reveal dependence;
- current reasoning band;
- current scaffold band;
- recent misconception/error category when explicitly observed;
- successful recovery;
- delayed recall;
- successful transfer in a new context;
- failed transfer / reopened concept;
- due rematches;
- confidence calibration when the surface collects it;
- encounter history and prompt IDs needed to prevent accidental repetition.

Do **not** infer intelligence, motivation, ADHD, emotion, socioeconomic status or other hidden traits from chat behavior.

### Output

Preserve the current `ChallengeSpec` as the canonical issued-task contract. It
already carries:

- `policyVersion`;
- concept/objective;
- activity and route/routeRecord;
- `reasoningLevel` and `challengeKind`;
- `scaffoldLevel`;
- task size;
- action (`practice|retry|variation|rematch`);
- reasons;
- constraints including one-concept-at-a-time, plain language, new-context
  requirements and encounter/context avoidance.

If V3 needs new fields, version the policy/spec and add replay tests. Do not
silently reinterpret an old persisted spec.

The room-wide explanation level is deliberately **not** a reasoning field. It is
applied later by the renderer.

## Initial policy

Preserve and formalize the current research-backed rules before attempting sophisticated ML:

- two independent successes can raise reasoning one step;
- partial streaks keep reasoning stable and increase support;
- repeated incorrect attempts reduce task size and increase support;
- a hint/reveal can support recovery but cannot become independent mastery evidence;
- correct after help is recovery evidence, not independent mastery;
- independent transfer in a genuinely new context is strong mastery evidence;
- failed/partial transfer reopens uncertainty and schedules a rematch;
- delayed independent recall contributes retention evidence;
- skip is not failure;
- a single lucky answer must not jump several difficulty bands;
- repeated failure must not trigger punishment or harder language.

All thresholds must be constants with tests, not prompt text.

## Reasoning ladder and scaffold ladder

Keep them independent.

### Reasoning

Keep the existing 10-rung reasoning ladder in
`apps/web/lib/learning/types.ts`:

1. recognize
2. recall
3. explain
4. compare
5. predict
6. apply
7. transfer
8. novel problem
9. defend
10. teach back

Do not collapse it merely to make V3 documentation prettier. The learner-facing
UI does not need to expose these rungs.

### Scaffold

Use the existing ladder:

0. independent  
1. gentle prompt  
2. hint  
3. concrete example  
4. constrained choices  
5. worked example

This allows combinations such as:

```text
reasoning = transfer
scaffold = hint
explanation level = simpler
coach mode = challenge
```

That is a difficult task, in plain language, with one small clue.

## Grounded GenAI contract

The model receives an already-decided learning task. Its responsibilities are:

- retrieve relevant room evidence;
- render the ChallengeSpec naturally;
- obey the room explanation level;
- preserve one main task/question at a time where possible;
- understand free-form learner answers;
- produce structured semantic evidence;
- explain feedback using room sources;
- cite the source document/page/slide;
- say when the room does not support a factual claim.

It may not silently alter:

- concept target;
- challenge kind;
- mastery threshold;
- scaffold history;
- source scope;
- grading truth.

### Model API

Use the current OpenAI **Responses API** for new model-facing work unless a measured reason requires another supported endpoint.

Use structured outputs / validated schemas for model decisions that feed application logic.

### Retrieval

Keep Supabase/pgvector as the default canonical retrieval store because it is already tied to room ownership, source priority, page metadata and RLS.

Evaluate:

- semantic search;
- keyword/full-text search;
- hybrid search;
- metadata/source-priority filters;
- reranking;
- query rewriting;
- contextual compression.

Do not adopt OpenAI hosted file search if it weakens Studigo's current permission/citation/source-priority contract. It may be benchmarked as an alternative, not assumed to be superior.

### LangChain

Use LangChain where it reduces custom glue while preserving observability.

Good candidates:

- retriever composition;
- metadata-aware retrieval;
- runnable pipelines;
- structured parsers;
- evaluation harnesses;
- tracing during development.

Avoid agentic loops for deterministic progression.

## Python / machine-learning work

Python is useful here, but ML must earn authority.

### Phase 1/2 allowed work

Build an offline/sidecar experimentation harness capable of:

- exporting de-identified learning-event sequences;
- replaying deterministic policy;
- calculating calibration and transition metrics;
- fitting a simple Bayesian Knowledge Tracing baseline;
- optionally evaluating logistic/gradient-boosted ranking models;
- comparing deterministic mastery state against BKT;
- later benchmarking DKT or other sequence models only if enough real data exists.

### V3 rule

No learned model directly controls mastery or challenge progression in production during the initial V3 implementation.

A learned model may produce a **candidate score or recommendation** behind a feature flag. The deterministic director remains the authority until the learned system shows a meaningful, reproducible improvement on an agreed evaluation set and passes bias/privacy review.

Do not train on tiny synthetic data and call it personalization.

## Event model

Every learning interaction must become a durable, idempotent event.

Required properties should include:

- event ID;
- user ID;
- room ID;
- concept ID(s);
- activity;
- encounter ID;
- ChallengeSpec version/snapshot;
- outcome;
- assistance used;
- confidence when collected;
- prompt/source IDs;
- timestamp;
- evaluator version;
- generator/model version where relevant.

Replay of the same ordered event stream must reconstruct the same deterministic state.

## RAG quality contract

Before changing retrieval, establish baseline evals.

Measure at least:

- source recall: did retrieval include the supporting passage?
- citation precision: does the citation actually support the claim?
- room isolation: can no other user's chunk appear?
- teacher-study-guide priority;
- unsupported-answer abstention;
- duplicate/near-duplicate question rate;
- latency p50/p95;
- tokens/cost per study turn.

The simplest architecture that meets the quality bar wins.

## Coach mode migration

The implementation should migrate current preference storage without losing room settings.

Current:

```text
style + tradition + practice
```

Target:

```text
coach_mode = show | coach | challenge
```

Keep `explain_level` untouched and separate.

Suggested compatibility mapping:

- Studigo default -> coach
- Direct instruction -> show
- Concrete to abstract -> show
- Socratic coach -> coach
- Skill progression -> coach
- Deliberate practice -> challenge

Tradition/practice selections are not discarded from research. They become internal policy/strategy references and can remain in historical rows during migration if that is safer.

### Coach / Learn navigation invariant

The October 2 mobile screenshots exposed a regression: the primary **Coach / Learn**
switch is visible in Chat, but disappears when the learner opens **Topics**.
That is not the intended hierarchy.

Treat these as two independent navigation levels:

```text
PRIMARY MODE
Coach | Learn
(always visible anywhere inside the Coach surface)

SECONDARY VIEW
Chat | Topics
(always visible beneath/alongside the primary mode)
```

Requirements:

- **Coach / Learn must remain visible in both Chat and Topics.**
- Switching Chat <-> Topics must never hide, replace or repurpose the Coach / Learn control.
- The Topics page may have its own heading/content, but not at the cost of the primary mode switcher.
- The selected Coach/Learn state must survive switching between Chat and Topics.
- On phone layouts, keep the same top-of-surface location and tap target seen in the working Chat screenshot; do not collapse it into a menu.
- On iPad/wide layouts, preserve the same information hierarchy even if the controls reflow.
- The Studigo companion, topic selector and orange mode strip must not cover or displace the switcher.
- Add screenshot/UI regression coverage for:
  - Coach + Chat
  - Learn + Chat
  - Coach + Topics
  - Learn + Topics
  at a phone viewport, plus at least one wide/iPad viewport.
- Add an interaction test proving `chatMode` and `view` are independent state dimensions.

The current cause is structural in `coach-panel.tsx`: the header renders the
Coach/Learn segmented control only when `view === "chat"` and replaces it with
a Topics title when `view === "topics"`. The V3 learner-facing pass should
remove that conditional ownership of the primary switcher rather than patching
the symptom with CSS.

### Learner-facing V3 acceptance

The Coach experience is not finished until all of the following are true:

- the only learner-facing persistent Coach modes are **Show me / Coach me / Challenge me**;
- Learning Tradition and Practice Recipe are removed from learner settings;
- global room Explanation Level stays in Room Settings and still controls Coach + Learn;
- **Coach / Learn remains permanently visible across Chat and Topics**;
- **Chat / Topics remains the secondary navigation layer**;
- the one-shot **Try a harder question** control is distinct from persistent Challenge me;
- changing Coach mode does not rewrite a pending ChallengeSpec;
- mode preference reloads correctly after navigation/relaunch;
- the web/PWA and native iOS/iPadOS clients implement the same hierarchy and semantics.

## iOS/iPadOS implementation requirements

Build one universal Expo / React Native app.

### Core first-release surfaces

- auth;
- Study Room list/create/open/delete;
- Materials upload/manage/open;
- Coach + Learn;
- Practice: Quiz, Flashcards, Practice Test;
- Progress/mastery/weak areas;
- Plan/Cram;
- global room explanation level;
- simplified Coach mode;
- companion parity;
- native PDF open/share;
- background/resume and poor-network recovery.

### Native behavior

Use native/Expo primitives for:

- document picker;
- camera/photo import if shipped;
- secure auth-token storage;
- share sheet;
- deep links/auth callbacks;
- keyboard avoidance;
- safe areas;
- iPad multi-column layout where useful;
- accessibility and reduced motion;
- lifecycle/backgrounding.

### Secrets

The client may store user/session tokens using appropriate secure storage.

It may **not** store the OpenAI service API key.

## Phase 1 — GPT 6.1 Sol / low

**Goal:** establish the correct architecture and deterministic foundation without overbuilding.

The coding agent should explore the repo first. Do not assume this document knows every current implementation detail.

### Work

1. Run the full existing test suite and record the baseline.
2. Trace the current control plane end to end:
   `ChallengeSpec -> render -> response -> evidence -> LearningEvent -> reducer -> nextChallenge`.
3. Inventory duplicated difficulty/scaffolding logic outside `apps/web/lib/learning`.
4. Inventory current RAG/provider paths, citation assembly, source-priority logic, ingestion and any native-client work before creating alternatives.
5. Create an architecture spike comparing:
   - current TypeScript AI/RAG path;
   - Python/FastAPI + LangChain using the same Supabase/pgvector data.
6. Benchmark a representative room/task set for quality, p50/p95 latency, token cost and debuggability.
7. Choose the smallest architecture that clearly improves or preserves the product.
8. Formalize/version `ChallengeSpec`, `LearningEvent` and concept-state schemas.
9. Add replay/golden-sequence tests covering success, struggle, help, recovery, transfer, failed transfer, rematch and delayed recall.
10. Add a coach-mode abstraction (`show|coach|challenge`) without deleting the global explanation level.
11. Create migration/backward-compatibility code for existing preferences.
12. If Python wins the spike, scaffold `services/learning-ai` with health checks, typed request/response schemas and tests. If it does not win, document why and keep Python for eval/ML tooling only.
13. Add/refresh RAG eval fixtures.
14. Leave a decision log for Phase 2.

### Phase 1 exit

- existing production behavior remains usable;
- the same event stream always produces the same state/spec;
- explanation level is preserved room-wide;
- the three Coach modes exist behind a feature flag or migration-safe path;
- AI architecture choice is justified by measurements, not fashion;
- no OpenAI key is exposed client-side;
- tests are green.

## Reviewable implementation PRs

Each PR includes scope, acceptance criteria, validation evidence, migration/rollback notes where applicable, and a short next-PR handoff. Keep each independently reviewable and preserve the working product. Do not merge a later gate by asserting unrun checks passed.

Phase 1 is delivered as three sequential PRs: (1) baseline, complete learning-loop trace and competing-logic/RAG/native inventory; (2) shared permitted-source RAG fixtures, TypeScript versus Python/FastAPI + LangChain measurements and architecture decision; (3) versioned contracts, deterministic replay/duplicate/help/transfer/rematch/retention tests and feature-flagged, migration-safe Coach preferences. The benchmark decision records citation quality, permission safety, latency, cost, debuggability and maintenance.

Phase 2 is delivered in these five PRs; split an oversized workstream further while preserving its acceptance gate:

| PR | Scope and acceptance |
| --- | --- |
| Shared learning state | Applicable surfaces emit durable events; remove competing progression; persist rematches and retention; verify cross-surface replay. |
| Grounded GenAI | Director-issued tasks, validated semantic evidence, source priority, citations, abstention and uploaded prompt-injection defenses. |
| Coach experience | Three persistent modes, distinct one-shot stretch, room-wide explanation level across Coach/Learn; move research controls out of learner settings; verify preference migration and rollback. |
| Evaluation and operations | Advisory offline BKT baseline, telemetry, rate/spend controls; authenticated Python service safeguards only if selected by the benchmark. |
| Universal native client | Auth, rooms, materials, Coach/Learn, practice, progress, Plan/Cram, companion parity, PDF sharing and lifecycle/network recovery; verify iPhone/iPad simulator and physical-device flows. |

Phase 3 audits the integrated system and uses separate repair PRs for structural defects before prompt tuning. Rerun replay/RAG suites, preference migrations, cross-surface/native scenarios and bundle secret scans; compare quality, latency and cost to Phase 1. Release requires documentation to match implementation and every blocker to be resolved or explicitly deferred outside release scope, with rationale and impact recorded.

## Phase 2 — GPT 6.1 Sol / medium

**Goal:** complete production-grade integration of the deterministic director, grounded GenAI layer and first native client path.

### Work

1. Finish wiring every applicable learning surface into the shared event/state model.
2. Remove/redirect competing difficulty logic.
3. Ensure all new Coach questions originate from the director.
4. Make hints/reveals/support mutate scaffold evidence only through explicit learning events.
5. Implement durable rematches and retention scheduling.
6. Implement three Coach modes in the learner-facing UI.
7. Remove Learning Tradition and Practice Recipe from learner-facing settings while preserving the research KB internally.
8. Keep room explanation level in Room Settings and prove Coach/Learn both use it.
9. Implement or harden the chosen RAG path:
   - hybrid/semantic retrieval as justified by evals;
   - room and owner filters;
   - source priority;
   - page/slide citation metadata;
   - abstention;
   - structured outputs.
10. If using LangChain/Python, add:
    - FastAPI service;
    - request authentication/service boundary;
    - timeout/retry/circuit-breaker behavior;
    - tracing/structured logs;
    - provider/model configuration;
    - Python unit/integration tests;
    - deployment docs.
11. Build the Python evaluation/ML harness and a BKT baseline; do not give it production authority.
12. Start/complete the Expo app's core Study Room shell and wire it to the hosted API, reusing server-owned state.
13. Port/reuse companion logic appropriately rather than rebuilding its behavior separately.
14. Add end-to-end flows on iPhone and iPad simulators/devices.
15. Add security checks, secret scanning, rate limiting and spend controls.
16. Add telemetry for:
    - retrieval failures;
    - unsupported answers;
    - director transitions;
    - model latency/cost;
    - state/replay mismatches;
    - native crashes/network failures.
17. Run evals and compare against the Phase 1 baseline.
18. Update docs to reflect what was actually built.

### Phase 2 exit

- deterministic director owns progression across the implemented learning surfaces;
- GenAI is grounded and cannot silently bypass that director;
- RAG quality is no worse than baseline and has measured citation/source behavior;
- iOS/iPadOS core loop works against the hosted backend;
- existing room explanation level works globally;
- Coach mode selection exposes only Show me / Coach me / Challenge me, with a distinct Try a harder question action;
- Python/LangChain/ML additions have clear measured purpose;
- no production learned model controls mastery;
- tests/evals/physical-device smoke pass.

## Phase 3 — GPT 6.1 Sol / xhigh

**Goal:** final architectural, learning-science, security and product-quality pass.

The review agent should assume the previous phases may have made locally reasonable decisions that do not form the cleanest whole. It is allowed to simplify.

### Review

1. Re-read the canonical docs and the Phase 1 decision log.
2. Audit whether the implementation still matches the product thesis.
3. Look specifically for:
   - duplicated sources of truth;
   - prompt-owned progression rules;
   - client-owned mastery;
   - Python introduced without payoff;
   - LangChain abstractions hiding citations/permissions;
   - RAG regressions;
   - explanation-level/coach-mode coupling;
   - event idempotency bugs;
   - rematch/retention edge cases;
   - companion effects leaking into mastery;
   - iOS key/security mistakes;
   - unnecessary latency or model calls.
4. Run the full deterministic replay suite.
5. Run the full RAG/Coach eval suite.
6. Run native iPhone/iPad flows.
7. Compare cost/latency/quality to the baseline.
8. Simplify where possible.
9. Tune prompts only after structural defects are ruled out.
10. Ensure docs describe the code that actually exists.
11. Produce a release-blocker list, if any.

### Phase 3 exit

The review agent should be able to demonstrate this invariant:

```text
Given the same room state and the same ordered learning events,
Studigo chooses the same next learning objective, challenge band
and scaffold band without an LLM call.

The LLM then turns that deterministic decision and the learner's
own source material into a natural, grounded study interaction.
```

## Required tests

At minimum:

### Determinism

- same events -> same state;
- same state/input -> same ChallengeSpec;
- event retry is idempotent;
- out-of-order or duplicate writes fail safely;
- policy version is recorded.

### Adaptation

- repeated independent success raises reasoning gradually;
- repeated partial results increase support, not difficulty;
- repeated failure increases support/reduces task size;
- hints/reveals do not count as independent mastery;
- assisted recovery is distinguishable from independent success;
- transfer success records strong evidence;
- failed transfer reopens and rematches;
- delayed recall records retention;
- skip is neutral.

### Cross-surface

- Quiz evidence changes the next Coach encounter;
- Coach evidence changes Weak Areas;
- Flashcards contribute appropriate recall evidence;
- Practice Test uses the same concept state;
- no surface has a private mastery score that competes with the canonical state.

### Explanation level

For one identical ChallengeSpec:

- simpler uses plainer wording;
- standard tracks the material;
- deeper uses more precise language;
- expected answer, reasoning target and grading remain identical.

### Coach mode

For the same concept state:

- Show me begins with more explicit modeling;
- Coach me uses adaptive guided interaction;
- Challenge me begins with less assistance;
- all converge on the same mastery standard.

### Grounding

- room isolation;
- source priority;
- citation support;
- unsupported abstention;
- learner edits survive/restrict scope;
- no fabricated teacher requirement/test scope.

### Security

- OpenAI key absent from native bundle and browser bundle;
- API requires authenticated user;
- RLS protects source data;
- service-to-service credentials are server-only;
- logs do not dump source documents or secrets;
- uploaded/retrieved instructions remain untrusted data: adversarial fixtures must attempt to override trusted policy, request another room’s sources, forge grading/mastery evidence, and change tool permissions;
- run those fixtures through the actual renderer/evaluator boundaries, including instructions embedded in otherwise valid cited passages; assert permitted source IDs only, validated semantic evidence, unchanged director/spec authority, and no unauthorized tool invocation;
- include benign controls and unsupported-answer cases so passing requires useful grounded behavior, not unconditional rejection. Phase 1 establishes these fixtures, Phase 2 enforces the boundary, and Phase 3 reruns the regressions.

## Performance budgets

Establish real baselines before fixing numbers. Then set explicit budgets for:

- director decision: should be local/DB speed, no LLM;
- retrieval p50/p95;
- first streamed token;
- complete Coach turn;
- ingestion throughput;
- iOS resume;
- cost per Coach turn and per active study hour.

Avoid adding a model call for anything deterministic code can already decide.

## What not to build yet

Do not block V3 on:

- deep neural knowledge tracing in production;
- reinforcement learning;
- autonomous multi-agent tutoring;
- a new vector database if pgvector meets the eval bar;
- a new auth provider;
- a second mastery engine;
- a mascot reward economy;
- social leaderboards;
- generic curriculum content that replaces user-uploaded materials.

## Definition of done

The implementation is successful when a learner can upload their own material, study it on iPhone/iPad, receive clear source-grounded help, and experience challenge/support that quietly adapts from demonstrated performance.

The adaptive system should feel like a good game director: present in the pacing, rarely visible as machinery.

The GenAI study partner should feel flexible and human: able to understand what the learner meant and explain the same grounded idea many ways.

The two systems must remain separate enough that each can be tested, trusted and improved independently.
