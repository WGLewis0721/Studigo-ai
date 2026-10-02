# Adaptive Game Director Research and Reference Map

**Purpose:** research scaffold for Studigo's deterministic adaptive-learning game director and grounded GenAI study partner.

This document separates three kinds of reference:

1. game-system design patterns;
2. learning-science / intelligent-tutoring research;
3. production AI/RAG/mobile infrastructure references.

The goal is not to copy any one game, tutor or framework. The goal is to combine proven system ideas into Studigo's own architecture.

## Product constraint

Studigo teaches from the learner's own uploaded material.

Game design may shape pacing, challenge, rematches, support and feedback. It must never replace the source-grounded knowledge boundary or turn Studigo into a generic curriculum game.

## Game-system references

### Resident Evil 4 — hidden adaptive pressure

**Reference:** Adam Saltsman, "Game Changers: Dynamic Difficulty," Game Developer.  
https://www.gamedeveloper.com/design/game-changers-dynamic-difficulty

The useful pattern is a small hidden performance state that changes pressure after recent success/failure.

**Borrow for Studigo:**

- performance events update a compact state;
- difficulty changes gradually;
- the learner does not have to manually manage the challenge level every turn;
- repeated failure should make the next encounter more achievable without changing what counts as mastery.

**Do not borrow:**

- opaque changes that alter grading truth;
- a system that can be gamed by intentional failure;
- pressure based on unobservable psychological inference.

### Shadow of Mordor / Nemesis System — persistent encounter history

**Reference:** "Designing Shadow of Mordor's Nemesis system," Game Developer.  
https://www.gamedeveloper.com/design/designing-i-shadow-of-mordor-i-s-nemesis-system

The useful pattern is that previous encounters matter later.

**Borrow for Studigo:**

- a concept the learner struggled with can return as a rematch;
- the rematch can use a new context;
- prior recovery remains part of history;
- a concept can be reopened if later transfer fails;
- persistent history makes adaptation feel coherent rather than random.

**Do not borrow:**

- narrative humiliation or punishment around failure;
- permanent negative labels for learners.

### Super Mario 3D Land — introduce, develop, vary, combine

**Reference:** "The Structure of Fun: Learning from Super Mario 3D Land's Director," Game Developer.  
https://www.gamedeveloper.com/design/the-structure-of-fun-learning-from-i-super-mario-3d-land-i-s-director

The useful pattern is structured exposure to mechanics rather than dumping complexity on the player.

**Borrow for Studigo:**

- introduce one idea;
- let the learner use it;
- vary the surface/context;
- combine it with prior knowledge;
- test whether the learner recognizes when to apply it.

This maps naturally to recognition -> recall -> explanation -> application -> transfer.

### Celeste — assistance and challenge are different variables

**Reference:** Game Accessibility Guidelines, Celeste Assist Mode.  
https://gameaccessibilityguidelines.com/celeste-assist-mode/

The useful pattern is that assistance can change while the underlying objective remains recognizable.

**Borrow for Studigo:**

- reasoning level and scaffold level are independent;
- a difficult transfer task can still include a hint;
- reducing language complexity does not reduce reasoning demand;
- assistance should not erase the learner's sense of ownership.

### Hades — support can grow after repeated failure

**Reference:** Supergiant Games, Hades FAQ and God Mode material.  
https://www.supergiantgames.com/blog/hades-faq/  
https://www.supergiantgames.com/blog/delve-into-the-welcome-to-hell-update/

The useful pattern is progressive assistance that responds to repeated struggle.

**Borrow for Studigo:**

- repeated failure increases support;
- support is not punishment;
- a learner can keep engaging with the same underlying target;
- assistance can coexist with a high ceiling.

### Rocket League — low floor, high ceiling

**Reference:** "Game Design Deep Dive: Rocket jumping in Rocket League," Game Developer.  
https://www.gamedeveloper.com/design/game-design-deep-dive-rocket-jumping-in-i-rocket-league-i-

The useful pattern is a small set of understandable mechanics with enormous room for mastery.

**Borrow for Studigo:**

- plain language should not cap difficulty;
- keep interaction rules understandable;
- advanced performance should emerge from deeper use of the same system rather than from increasingly confusing UI.

### Super Smash Bros. Melee — accessible entry, long mastery curve

Used as a conceptual reference in the existing Studigo adaptive-learning docs.

**Borrow for Studigo:**

- immediate usability;
- depth that reveals itself through mastery;
- avoid making novice accessibility incompatible with expert-level challenge.

## Learning-science references

### Mastery learning

**Reference:** Benjamin S. Bloom, "Learning for Mastery" (1968), ERIC ED053419.  
https://eric.ed.gov/?id=ED053419

**Studigo use:**

- adapt time/support/path rather than lowering the target;
- define mastery with evidence;
- corrective experiences follow gaps.

### Formative assessment

**Reference:** Paul Black and Dylan Wiliam, "Inside the Black Box" (1998).  
https://kappanonline.org/inside-the-black-box-raising-standards-through-classroom-assessment/

**Studigo use:**

- use learner responses as evidence for the next action;
- feedback changes what happens next;
- assessment and instruction are part of one loop.

### Retrieval practice / testing effect

**Reference:** Roediger & Karpicke (2006), "Test-enhanced learning: taking memory tests improves long-term retention."  
https://pubmed.ncbi.nlm.nih.gov/16507066/

**Studigo use:**

- practice should require retrieval, not just re-reading;
- delayed retrieval is distinct evidence;
- confidence alone is not mastery.

### Worked examples

**Reference:** Atkinson, Derry, Renkl & Wortham (2000), "Learning from Examples: Instructional Principles from the Worked Examples Research."  
https://doi.org/10.3102/00346543070002181

**Studigo use:**

- worked examples are a scaffold, especially early in acquisition;
- examples should be paired with learner attempts;
- support should fade as performance improves.

### Transfer / varied practice

Existing Studigo KB reference:

Rohrer, Dedrick, Hartwig & Cheung (2020), randomized study of interleaved mathematics practice.  
https://doi.org/10.1037/edu0000367

Barnett & Ceci (2002), transfer taxonomy.  
https://doi.org/10.1037/0033-2909.128.4.612

**Studigo use:**

- change surface features after base skill is available;
- require strategy selection;
- successful transfer is stronger evidence than pattern copying.

### Intelligent tutoring effectiveness

**Reference:** Kurt VanLehn (2011), "The Relative Effectiveness of Human Tutoring, Intelligent Tutoring Systems, and Other Tutoring Systems."  
https://doi.org/10.1080/00461520.2011.611369

**Studigo use:**

- step-based tutoring and responsive feedback are serious instructional mechanisms, not decoration;
- use this literature as a check against turning the system into pure chat.

### Bayesian Knowledge Tracing

**Reference:** Corbett & Anderson (1995), "Knowledge tracing: Modeling the acquisition of procedural knowledge."  
https://doi.org/10.1007/BF01099821

**Studigo use:**

- useful baseline for estimating latent knowledge from observed attempts;
- candidate ML/statistical comparison for the Python evaluation harness;
- not the initial production authority over progression.

### Deep Knowledge Tracing

**Reference:** Piech et al. (2015), "Deep Knowledge Tracing."  
https://arxiv.org/abs/1506.05908

**Studigo use:**

- research reference for sequence modeling after meaningful real event data exists;
- not a reason to deploy an RNN/transformer knowledge model before Studigo has enough representative data;
- benchmark only after a simpler deterministic/BKT baseline exists.

## AI / RAG infrastructure references

### OpenAI Responses API

**Reference:** OpenAI migration guide.  
https://developers.openai.com/api/docs/guides/migrate-to-responses

OpenAI recommends the Responses API for new model integrations.

**Studigo use:**

- model-facing generation/semantic evaluation;
- structured outputs and tool-capable workflows where useful;
- keep progression decisions outside the model.

### OpenAI embeddings

**Reference:** OpenAI vector embeddings guide.  
https://developers.openai.com/api/docs/guides/embeddings

**Studigo use:**

- semantic representations for retrieval;
- benchmark dimensions/model choice against cost and retrieval quality.

### OpenAI retrieval/file search

**References:**  
https://developers.openai.com/api/docs/guides/retrieval  
https://developers.openai.com/api/docs/guides/tools-file-search

These are useful comparison points, not automatic replacements for Studigo's existing Supabase retrieval.

**Studigo requirement:** any hosted retrieval alternative must preserve room isolation, teacher-source priority, page/slide citations, learner edits and deletion semantics.

### OpenAI API key security

**Reference:** OpenAI, Best Practices for API Key Safety.  
https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety

The key must never ship in a mobile app or browser bundle.

**Studigo use:**

- iOS calls Studigo's backend;
- trusted backend calls OpenAI;
- rotate/restrict/monitor keys;
- keep secrets out of the repository and client-visible environment.

### Supabase pgvector and RAG permissions

**References:**  
https://supabase.com/docs/guides/database/extensions/pgvector  
https://supabase.com/docs/guides/ai/rag-with-permissions  
https://supabase.com/docs/guides/ai

**Studigo use:**

- keep retrieval close to the existing RLS authorization model;
- store/query embeddings with source metadata;
- use semantic, keyword or hybrid search as evals justify.

### Supabase + LangChain

**Reference:** Supabase LangChain integration.  
https://supabase.com/docs/guides/ai/langchain

**Studigo use:**

- LangChain can compose retrieval and structured AI pipelines;
- it must run on trusted server infrastructure;
- framework convenience must not hide permission/citation behavior.

### Automated embeddings / durable jobs

**Reference:** Supabase automatic embeddings guide.  
https://supabase.com/docs/guides/ai/automatic-embeddings

**Studigo use:**

- async embedding work;
- retries and queues;
- do not tie heavy ingestion to a fragile request lifetime.

## iOS / Expo references

### Expo document picker

https://docs.expo.dev/versions/latest/sdk/document-picker/

Use system document-provider UI for learner uploads.

### Expo secure storage

https://docs.expo.dev/develop/user-interface/store-data/  
https://docs.expo.dev/versions/latest/sdk/securestore/

Use secure local storage for appropriate user/session tokens.

Do **not** interpret SecureStore as permission to store the OpenAI service API key in the app.

### Expo authentication guidance

https://docs.expo.dev/guides/authentication/

Preserve the existing Supabase identity model and use native-safe auth/session handling.

## Architecture synthesis

These references converge into a simple principle:

```text
VIDEO-GAME SYSTEMS
performance state
persistent encounter history
adaptive pressure
assistance independent from challenge
low floor / high ceiling

          +

LEARNING SCIENCE
formative assessment
mastery
retrieval
worked examples
transfer
knowledge tracing research

          +

GROUNDED GENAI
RAG over learner material
semantic answer understanding
natural explanation
structured evidence
citations

          =

STUDIGO
deterministic adaptive game director
under a grounded GenAI study partner
```

## Research guardrails

1. A reference is a mechanism source, not a mandate to copy the whole product.
2. No game reference overrides learning evidence.
3. No learning paper overrides the user's actual uploaded course scope.
4. No framework gets architectural authority because it is fashionable.
5. ML must beat a simpler baseline before it gets more responsibility.
6. The deterministic director must remain replayable and inspectable.
7. The learner's global explanation level affects delivery, not mastery.
8. The mascot may express the system state but may not create it.
