# Studigo Adaptive Learning Engine — Technical & Infrastructure Companion

This document is the technical companion to `docs/ROADMAP.md` for the planned adaptive-learning game engine.

It exists to keep implementation disciplined.

The core premise is simple:

> **Studigo does not need machine learning, RAG, an LLM, or agent orchestration to decide how learning should progress.**
>
> Those tools can enhance the experience, but the learning loop itself should be implemented with proven software primitives: state, events, counters, thresholds, deterministic rules, feedback loops, and persistent history.

The game-design inspiration is deliberate:

- **Rocket League / Super Smash Bros. Melee:** low entry barrier, very high skill ceiling;
- **Resident Evil 4:** adaptive pressure driven by a hidden performance state;
- **Shadow of Mordor / Shadow of War:** persistent encounter history changes what comes back later;
- **Mario:** introduce, practice, vary, combine, test;
- **Celeste / Hades:** assistance can change without changing the underlying objective.

The engineering goal is not to recreate those games. It is to reuse the system-design principles that made adaptive experiences possible long before modern ML.

---

## 1. Non-negotiable development principles

### 1. Low language floor, high skill ceiling

Language complexity and reasoning difficulty are separate variables.

The learner should not have to decode academic prose before they can demonstrate difficult thinking.

The system may ask a high-level transfer question in plain language.

### 2. Performance determines challenge; preference determines route

Challenge progression should come from demonstrated learner performance.

A learning tradition or preferred coaching route may change how support is delivered, but it must not arbitrarily lower or cap the mastery target.

### 3. The game loop is the operating system

Every learning surface should participate in the same loop:

```text
attempt
  -> consequence
  -> feedback
  -> retry
  -> variation
  -> mastery evidence
  -> next challenge
```

Flashcards, Quiz, Coach, Learn, Practice Test, Weak Areas, and Cram are mini-games inside one system.

### 4. Adapt with simple state before adding intelligence

Use counters, state machines, thresholds, lookup tables, and deterministic transitions first.

If a state transition can solve the problem, do not add an agent, recommendation service, model, or orchestration framework.

### 5. Failure changes the next encounter

A wrong answer is not only a score decrement.

It is evidence that can affect what the learner sees next.

Repeated confusion, hint dependency, successful recovery, delayed recall, and transfer success should become persistent learning history.

### 6. One learner state, many mini-games

All learning modes contribute evidence to the same concept-level learner state.

Do not build separate mastery engines for Quiz, Coach, Flashcards, Practice Test, or Learn.

### 7. The LLM is the actor; the learning engine is the director

The deterministic system decides:

- what concept to practice;
- what reasoning demand to use;
- how much scaffolding is allowed;
- whether to repeat, vary, advance, or revisit;
- what past learning event matters now.

The LLM may phrase the question, explain feedback, provide a grounded example, or semantically grade free text.

It must not own the progression policy.

---

## 2. Target system shape

```text
Uploaded material
      |
      v
Concept / topic map
      |
      v
Learner state + encounter history
      |
      v
Deterministic Challenge Director
      |
      +--------------------+
      |                    |
      v                    v
Mini-game             Learning route
Coach / Quiz          Japanese-inspired
Cards / Learn         Montessori-inspired
Practice Test         Swedish-inspired
Cram / Weak Areas     Direct / Socratic / etc.
      |                    |
      +---------+----------+
                |
                v
        Scaffold policy
                |
                v
        Language renderer
                |
        +-------+-------+
        |               |
        v               v
 deterministic       optional AI
 templates           phrasing / grading
        |               |
        +-------+-------+
                |
                v
             learner
                |
                v
          learning event
                |
                +----------> repeat
```

The current Next.js + Supabase architecture is sufficient for the first implementation.

Do **not** create a new backend service for this phase.

---

## 3. Infrastructure strategy

### Keep the existing platform

Use the infrastructure Studigo already has:

- **Next.js 16 / React** for the product UI and server routes;
- **Supabase Auth** for learner identity;
- **Supabase Postgres** as the system of record;
- **Postgres RLS** for per-user ownership;
- **Supabase Storage** for source documents;
- **pgvector** only where semantic source retrieval is useful;
- **`packages/ai`** as the provider boundary for optional model calls;
- **Vercel** for the current web deployment.

No new infrastructure is required to prove the adaptive engine.

### Add logic as code, not as infrastructure

The first Challenge Director should live as a pure TypeScript domain module in the monorepo.

Preferred shape:

```text
packages/
  learning/
    src/
      types.ts
      challenge-director.ts
      scaffold-policy.ts
      mastery-reducer.ts
      encounter-policy.ts
      routes/
      index.ts
```

If creating a new package would be heavier than necessary for the first PR, start under `apps/web/lib/learning/` and extract only when multiple surfaces depend on it.

The important rule is not the folder name.

The important rule is that the learning policy is:

- pure;
- deterministic;
- testable without a browser;
- testable without a database;
- testable without an LLM;
- replayable from known inputs.

---

## 4. The shared learning event

The adaptive engine needs one canonical event format.

Existing quiz attempts and flashcard reviews already contain useful evidence. Do not discard them.

Introduce a normalized internal event contract that can be produced from current and future learning surfaces.

Example:

```ts
type LearningEvent = {
  id: string;
  userId: string;
  roomId: string;
  topicId: string;

  activity:
    | "learn"
    | "coach"
    | "flashcard"
    | "quiz"
    | "practice_test"
    | "weak_area"
    | "cram";

  challengeKind:
    | "recognize"
    | "recall"
    | "explain"
    | "compare"
    | "predict"
    | "apply"
    | "transfer"
    | "novel_problem"
    | "defend"
    | "teach_back";

  result:
    | "correct"
    | "partial"
    | "incorrect"
    | "skipped"
    | "revealed";

  scaffoldUsed:
    | "none"
    | "gentle_prompt"
    | "hint"
    | "concrete_example"
    | "choices"
    | "worked_example";

  confidence?: 1 | 2 | 3;
  latencyMs?: number;
  createdAt: string;
};
```

This event contract is not the final database schema.

It is the domain contract.

### Persistence rule

Prefer one append-only `learning_events` table **only if existing attempt tables cannot support the shared event stream cleanly**.

Do not duplicate all current attempt data just to satisfy a new abstraction.

A safe first implementation can:

1. keep current authoritative attempt tables;
2. add a normalized projection/view or helper that maps them into `LearningEvent`;
3. write only new event types that do not already have a canonical home.

Avoid event-sourcing the entire product.

We need an event history for learning decisions, not a new application architecture.

---

## 5. Concept-level learner state

The engine needs a compact current state per learner + room + topic.

Example:

```ts
type ConceptLearningState = {
  reasoningLevel: number;   // 0..9
  scaffoldLevel: number;    // 0..5

  correctStreak: number;
  partialStreak: number;
  incorrectStreak: number;

  lastResult?: LearningEvent["result"];
  lastChallengeKind?: LearningEvent["challengeKind"];

  successfulTransferCount: number;
  independentRecallCount: number;
  hintDependentSuccessCount: number;

  lastPracticedAt?: string;
};
```

This can be derived from recent events or persisted as a cached projection.

### Preferred implementation

Use Postgres as the source of truth.

For the first version:

- compute state from a bounded recent event window when practical;
- persist a compact projection only if repeated recomputation becomes expensive;
- use a pure reducer to build state from events.

Example:

```ts
const nextState = reduceLearningEvent(currentState, event);
```

That function should contain no network calls.

---

## 6. Reasoning ladder

The Challenge Director needs a stable progression vocabulary.

Start with:

```text
0  recognize
1  recall
2  explain
3  compare
4  predict
5  apply
6  transfer
7  solve novel problem
8  defend reasoning
9  teach / create
```

This is not a visible student score.

It is an internal planning vocabulary.

The ladder should be treated as ordered but not perfectly linear.

Examples:

- vocabulary may move quickly from recognition to recall;
- math may require repeated application before transfer;
- conceptual science may move from explanation to prediction and back;
- a learner may demonstrate transfer before perfect recall.

Do not turn the ladder into a rigid RPG level system.

Use it as a control variable.

---

## 7. Scaffold ladder

Scaffolding is independent from reasoning level.

Start with:

```text
0  independent
1  gentle prompt
2  hint
3  concrete example
4  constrained choices
5  worked example
```

This enables combinations such as:

```text
reasoning = transfer
scaffold = hint
```

That means:

> ask a transfer problem, but permit one small clue.

The system does not need to lower the concept to recall just because the learner requested help.

---

## 8. Challenge Director

The Challenge Director should be a deterministic function.

Example contract:

```ts
type ChallengeInput = {
  concept: Concept;
  state: ConceptLearningState;
  recentEvents: LearningEvent[];
  activity: LearningEvent["activity"];
  route: LearningRoute;
};

type ChallengeSpec = {
  challengeKind: LearningEvent["challengeKind"];
  scaffoldLevel: number;
  objective: string;
  constraints: {
    oneConceptAtATime: boolean;
    requireTransfer?: boolean;
    avoidRecentPromptIds?: string[];
  };
};
```

The first policy should be intentionally small.

Example:

```ts
if (state.correctStreak >= 2 && state.scaffoldLevel === 0) {
  raiseReasoningOneStep();
}

if (state.partialStreak >= 2) {
  keepReasoningLevel();
  increaseScaffoldOneStep();
}

if (state.incorrectStreak >= 2) {
  reduceTaskSize();
  increaseScaffoldOneStep();
}

if (successfulTransferWithoutHelp) {
  recordStrongMasteryEvidence();
}

if (previouslyMasteredConceptFailsInNewContext) {
  reopenConcept();
}
```

No prompt should contain the rules that determine these transitions.

The rules belong in code.

---

## 9. Resident Evil 4 pattern: adaptive pressure

The RE4 lesson is not "copy its exact difficulty system."

The lesson is:

> keep a small hidden state, update it from observable performance, and use it to alter pressure.

Studigo's equivalent can be:

```text
performance events
      |
      v
concept state
      |
      v
challenge band + scaffold band
      |
      v
next encounter
```

Observable inputs can include:

- correct / partial / incorrect;
- repeated success;
- repeated failure;
- hint use;
- answer reveal;
- confidence;
- delayed recall;
- successful transfer;
- repeated misconception;
- independent recovery.

Avoid speculative signals in V1.

Do not infer motivation, intelligence, attention disorder, frustration, or ability from chat style.

---

## 10. Nemesis pattern: persistent encounter memory

The Nemesis lesson is:

> a past encounter should be able to change a future encounter.

For Studigo, this means storing meaningful concept history such as:

```text
evaporation vs condensation
- confused twice
- corrected after concrete example
- recalled correctly next session
- transfer not yet demonstrated
```

The first version does not need an elaborate knowledge graph.

A concept can have a small set of recurring flags:

```ts
type EncounterSignal =
  | "recurring_misconception"
  | "hint_dependent"
  | "recovered"
  | "delayed_recall_pass"
  | "transfer_pass"
  | "transfer_fail";
```

The Challenge Director may use those flags to schedule a rematch.

Example:

```text
transfer_fail
  -> later encounter
  -> same concept
  -> new surface example
  -> no duplicate wording
```

### Do not build a permanent learner label

Avoid statements like:

- "visual learner";
- "bad at science";
- "Montessori learner";
- "slow reader".

Persist observed events, not personality conclusions.

---

## 11. Mini-games as adapters

Each learning surface should implement the same three boundaries:

```ts
interface LearningMiniGame {
  buildChallenge(spec: ChallengeSpec): Promise<RenderedChallenge>;
  evaluateResponse(response: LearnerResponse): Promise<LearningEvent>;
  presentFeedback(event: LearningEvent): Promise<RenderedFeedback>;
}
```

The implementation can differ by surface.

### Flashcards

Best for:

- recognition;
- recall;
- spaced retrieval.

Mostly deterministic.

No LLM needed for review scheduling or difficulty transitions.

### Quiz

Best for:

- recall;
- discrimination;
- application.

MCQ, true/false, and fill-in can remain deterministic.

Short answers may use semantic grading.

### Coach

Best for:

- explanation;
- comparison;
- prediction;
- application;
- transfer;
- defending reasoning;
- teaching back.

This is where an LLM adds the most value because natural language interaction matters.

### Practice Test

Best for:

- independent coverage;
- mixed difficulty;
- readiness evidence.

The director should reduce scaffolding here by design.

### Learn

Best for:

- tutorial encounter;
- model building;
- guided practice;
- first examples.

### Weak Areas

This is the rematch queue.

Use persistent encounter history to choose what returns.

### Cram

This is a time-constrained scheduler over the same state.

Do not create a separate cram mastery model.

---

## 12. Learning traditions as builds/routes

A route modifies **how support is delivered**, not what mastery means.

Represent the route as a small policy object.

Example:

```ts
type LearningRoute =
  | "studigo_default"
  | "direct_instruction"
  | "socratic"
  | "deliberate_practice"
  | "concrete_to_abstract"
  | "japanese_inspired"
  | "montessori_inspired"
  | "swedish_inspired"
  | "singapore_math_inspired";
```

A route may alter:

- whether the learner attempts before explanation;
- whether examples come before rules;
- whether comparison of solutions is emphasized;
- how quickly the system intervenes;
- whether self-correction is prompted first;
- whether concrete representation precedes symbols;
- whether reflection is explicitly requested.

A route must **not** silently alter:

- source truth;
- grading correctness;
- factual requirements;
- mastery thresholds;
- concept scope.

Routes should come from the existing teaching/coaching knowledge base rather than duplicating educational claims in prompt strings.

---

## 13. Low-language renderer

The language renderer receives a `ChallengeSpec`.

Its job is to reduce unnecessary linguistic burden without lowering the reasoning target.

Example input:

```json
{
  "concept": "melting",
  "challengeKind": "transfer",
  "objective": "apply physical-change knowledge to a new material",
  "scaffoldLevel": 1
}
```

Possible output:

> Candle wax turns liquid when it gets hot. Is that like melting ice? Why?

The renderer should prefer:

- one main question per turn;
- short sentences;
- familiar words first;
- necessary technical vocabulary only;
- immediate plain definitions;
- concrete examples;
- no compound academic prompt when the same task can be split across turns.

### Deterministic first

Use templates where templates are sufficient.

Example:

```ts
renderRecall(concept)
renderBinaryContrast(a, b)
renderTransferPrompt(sourceExample, newExample)
```

Use an LLM when natural variation or open-ended context is genuinely useful.

---

## 14. Role of LLMs

LLMs are an enhancer, not the engine.

Good uses:

- phrase a deterministic challenge naturally;
- rephrase at a lower language floor;
- generate an analogy from allowed source context;
- evaluate open-ended semantic answers;
- explain why an answer is partial;
- produce conversational feedback;
- generate varied transfer scenarios;
- convert route policy into natural coaching behavior.

Bad uses:

- decide mastery with no deterministic evidence model;
- decide progression entirely from freeform chat;
- invent a learner personality;
- own challenge-state transitions;
- silently expand test scope;
- replace persisted learning history with chat context.

If the model is unavailable, the adaptive engine should still be able to:

- update learner state;
- select the next reasoning level;
- select the next scaffold level;
- schedule a rematch;
- render at least basic deterministic prompts for supported mini-games.

---

## 15. Role of RAG

RAG solves a different problem.

RAG answers:

> **What source material is relevant and what facts are allowed?**

The learning engine answers:

> **What should the learner be asked to do next?**

These concerns must stay separate.

Use existing room-scoped retrieval when a challenge requires source-grounded context.

Do not query vector search merely to calculate challenge level.

Example:

```text
Challenge Director:
"ask a transfer question about evaporation"

Retrieval:
"find the room excerpts that define/explain evaporation"

Renderer:
"turn those grounded facts into one simple transfer question"
```

RAG provides evidence.

It does not provide pedagogy policy.

---

## 16. No LangChain / agent graph requirement

This phase should not introduce LangChain, LangGraph, or an agent framework by default.

The required orchestration is small enough to express directly:

```text
load state
 -> select challenge
 -> retrieve source if needed
 -> render
 -> evaluate
 -> write event
 -> reduce state
```

A normal function pipeline is easier to:

- understand;
- test;
- debug;
- replay;
- secure;
- measure.

Only introduce an orchestration framework if a concrete future requirement cannot reasonably be handled by ordinary application code.

---

## 17. Database design guidance

Prefer the smallest additive schema.

Likely needs:

### A. Shared learning event or event projection

Possible table:

```text
learning_events
- id
- user_id
- room_id
- topic_id
- activity
- challenge_kind
- result
- scaffold_used
- confidence
- metadata jsonb
- created_at
```

### B. Concept learning state

Optional cached projection:

```text
concept_learning_state
- user_id
- room_id
- topic_id
- reasoning_level
- scaffold_level
- correct_streak
- partial_streak
- incorrect_streak
- successful_transfer_count
- independent_recall_count
- hint_dependent_success_count
- updated_at
```

### C. Encounter signals

Start inside event metadata or the state projection.

Do not create a separate `nemesis` subsystem or relationship graph in V1.

### RLS

All learner state remains user-owned.

The same ownership principles already used for rooms, attempts, conversations, and mastery apply here.

---

## 18. Transaction boundary

When a learner completes an assessed encounter:

```text
response graded
      |
      v
write learning event
      |
      v
reduce concept state
      |
      v
persist state projection
```

Where possible, the event write and state update should occur in one transaction or one database function so state cannot drift from evidence.

If state is fully derived at read time, no projection update is required.

---

## 19. Idempotency

Every completed learning interaction should have a stable attempt/interaction identifier.

Retries must not create duplicate mastery evidence.

Example:

```text
interaction_id UNIQUE
```

A network retry should be able to safely submit the same result again.

This matters more than sophisticated adaptation.

---

## 20. Testing strategy

The deterministic engine should have stronger tests than the language layer.

### Transition tests

Examples:

```text
two independent correct recalls
-> reasoning may advance

two partial answers
-> reasoning stays
-> scaffolding increases

two incorrect transfer attempts
-> task size reduces
-> scaffolding increases

successful transfer with no help
-> strong mastery evidence

answer revealed
-> never count as independent mastery
```

### Replay tests

Given the same event sequence, the same learner state must result every time.

```ts
events -> reduce -> expected state
```

### Cross-mini-game tests

A Quiz event followed by a Coach event must update the same concept state.

### Language tests

The language layer should be checked for:

- one main question at a time;
- no unnecessary compound phrasing;
- no change to the expected concept;
- no change to grading truth;
- challenge level preserved when wording is simplified.

### AI contract tests

Where LLMs are used, validate structured outputs and reject malformed responses.

Do not make tests depend on exact prose.

---

## 21. Observability

The system should expose enough internal state to debug adaptation without exposing it all to the learner.

Log or trace:

- selected concept;
- prior reasoning level;
- prior scaffold level;
- event that caused transition;
- next reasoning level;
- next scaffold level;
- selected mini-game;
- selected route;
- whether source retrieval was used;
- whether LLM rendering was used.

Avoid logging raw private study content unless necessary and protected.

A production bug should be explainable as:

> "The learner received a transfer question because they had two independent application successes."

not:

> "The model decided they were ready."

---

## 22. Performance and cost

The deterministic layer should be effectively free.

A normal turn should require:

1. one state read;
2. optional source retrieval;
3. zero or one model generation call;
4. zero or one semantic grading call;
5. one event/state write.

Do not add a model call merely to classify a transition that can be represented as deterministic result data.

The cheapest valid implementation should be the default.

---

## 23. Failure modes and fallbacks

### LLM unavailable

Fallback to deterministic question/feedback templates where supported.

State progression still works.

### Embedding/RAG unavailable

Do not fabricate source-grounded content.

The director may select the learning objective, but the activity should stop or use previously verified material rather than inventing course facts.

### State write fails

Do not silently advance the learner.

Return the interaction result, but mark persistence failure for retry.

### Conflicting evidence

Do not collapse immediately into a single permanent mastery label.

Keep recent evidence and allow the next encounter to resolve uncertainty.

---

## 24. Delivery order

Implement in this order:

### Step 1 — Domain contracts

- `LearningEvent`
- `ConceptLearningState`
- `ChallengeSpec`
- reasoning ladder
- scaffold ladder

No UI change required.

### Step 2 — Pure reducer + Challenge Director

- deterministic transition rules;
- replay tests;
- fixture event sequences.

No LLM required.

### Step 3 — Coach integration

Coach is the best proving ground because it exposes the current language-floor problem and can exercise higher reasoning levels.

Add:

- challenge selection;
- scaffold selection;
- simpler language rendering;
- `Make it simpler`;
- `Give me a hint`;
- `Show me an example`;
- `Challenge me`.

### Step 4 — Persistent encounter history

Add rematch behavior for recurring misconceptions and transfer failures.

### Step 5 — Cross-mini-game events

Connect Quiz, Flashcards, Learn, Practice Test, Weak Areas, and Cram to the same event/state model.

### Step 6 — Learning routes/builds

Move current style/tradition/practice directives behind explicit route policy.

### Step 7 — Beta evaluation

Verify:

- repeated success actually raises challenge;
- repeated struggle increases useful support;
- simple language does not reduce reasoning difficulty;
- a misconception returns appropriately;
- successful transfer is recognized;
- different mini-games contribute to one learner state;
- route preferences change coaching behavior without changing truth or mastery criteria.

Only after those are proven should more sophisticated adaptation be considered.

---

## 25. Explicit non-goals for the first release

Do not add:

- learner clustering;
- collaborative filtering;
- reinforcement learning;
- neural difficulty prediction;
- agent swarms;
- agent memory frameworks;
- LangChain/LangGraph merely for orchestration;
- another vector database;
- a feature store;
- a recommendation microservice;
- a separate Python backend solely for adaptation;
- Kafka or an event bus;
- a graph database for misconception history;
- an "AI learning style detector";
- opaque model-generated mastery scores.

None are necessary to prove the learning loop.

---

## 26. Criteria for adding ML later

Machine learning becomes justified only if deterministic rules produce a measurable limitation.

Examples:

- the same event history consistently requires different optimal transitions across large groups;
- fixed thresholds produce poor challenge calibration at scale;
- enough high-quality event data exists to train and validate a model;
- a learned policy demonstrably outperforms a transparent baseline;
- the model's failure mode is acceptable for an education product.

The deterministic director remains the baseline and fallback.

A learned system should have to beat it.

---

## 27. Core distinction: engine vs enhancement

```text
ESTABLISHED SYSTEM DESIGN

state
events
counters
thresholds
state machines
lookup tables
feedback loops
persistent history
deterministic progression

        = learning engine

OPTIONAL ENHANCEMENTS

LLM
semantic grading
natural-language feedback
RAG
embeddings
grounded examples
generated variations

        = experience enhancers
```

This distinction protects the product from becoming dependent on whichever AI framework is fashionable next.

---

## 28. Final architecture principle

> **Build the learning system so that it still knows what should happen next when the model is turned off.**

If Studigo can determine:

- what the learner knows;
- what they have not demonstrated;
- what challenge should come next;
- how much support to provide;
- what previous struggle should return;

without an LLM call, then the learning engine is correctly separated.

The LLM can then do what it is unusually good at:

> make that established system feel like a patient, natural, responsive tutor.

That is the intended technical direction for Studigo's adaptive-learning roadmap.
