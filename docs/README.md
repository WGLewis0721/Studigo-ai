# Studigo documentation

Coding agents start at the repo root [`AGENTS.md`](../AGENTS.md), then [`ENGINEERING.md`](../ENGINEERING.md). This page says which document is current. Historical plans live in [`archive/`](archive/README.md). Do not load that directory unless you need the evidence it stores.

The current `main` learning app is the golden integrated V3 web/PWA beta. [Moon Keep POC XI](../prototypes/moon-road/README.md) is a separate playable prototype. Do not treat either as an unstarted project.

## Read first

| File | Read it when |
| --- | --- |
| [`AGENTS.md`](../AGENTS.md) | Any task. Commands, live vs parked, guardrails. |
| [`ENGINEERING.md`](../ENGINEERING.md) | You need the live map or the technology catalog. |
| [`ENGINEERING_PLAN.md`](../implementation/ENGINEERING_PLAN.md) | You are doing planned hardening, not a local bugfix. |
| [`PRODUCT.md`](PRODUCT.md) | The change can affect what the product is allowed to do. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | The change crosses a runtime or data boundary. |
| [`archive/README.md`](archive/README.md) | You need a finished phase plan or an old investigation. |

Idempotency lives in `apps/web/lib/learning/` and `claim_document`. The archived Sol reviews and the Coach investigation log are not that tutorial.

## Current contracts

| Need | Owner |
| --- | --- |
| Product and grounding rules | [`PRODUCT.md`](PRODUCT.md) |
| System and privacy boundaries | [`ARCHITECTURE.md`](ARCHITECTURE.md), [`AUTH.md`](AUTH.md) |
| Release order and open gates | [`ROADMAP.md`](ROADMAP.md) |
| What the web beta has verified | [`ADAPTIVE_BETA_EVIDENCE.md`](ADAPTIVE_BETA_EVIDENCE.md) |
| Retrieval flags and the missing live ablation | [`RETRIEVAL_BENCHMARK.md`](RETRIEVAL_BENCHMARK.md), [`adr/001-adaptive-rag-benchmark.md`](adr/001-adaptive-rag-benchmark.md) |
| Semantic grader scorer limits | [`SEMANTIC_GRADER_EVAL.md`](SEMANTIC_GRADER_EVAL.md) |
| Visual behavior | [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) |
| Animation and character-generation rules | [`STUDIGO_ANIMATION_VIDEO_GUIDE.md`](STUDIGO_ANIMATION_VIDEO_GUIDE.md) |
| Deployment | [`VERCEL_DEPLOYMENT.md`](VERCEL_DEPLOYMENT.md) |
| User acceptance | [`USER_TEST_CASES.md`](USER_TEST_CASES.md) |
| Public beta waitlist form | [`WAITLIST_API.md`](WAITLIST_API.md) |
| Future iOS client (no Expo app in the repo yet) | [`APP_STORE_RELEASE_PLAN.md`](APP_STORE_RELEASE_PLAN.md) |
| Public-launch security gate | [`../implementation/security-readiness/`](../implementation/security-readiness/) |
| Cold-start check of the ten lookup facts | [`ORIENTATION_EVAL.md`](ORIENTATION_EVAL.md) |

## Current, but not the cold start

Open these only when the task names them.

| File | What it is |
| --- | --- |
| [`../STUDIGO_CODEX_EXECUTION_PLAN.md`](../STUDIGO_CODEX_EXECUTION_PLAN.md) | Document-learning track queue for `integration/document-learning-reliability`. One assigned card. Most cards are marked done. |
| [`../FUTURE_FEATURES.md`](../FUTURE_FEATURES.md) | Idea parking lot. Do not implement it automatically. Mockups are under [`future-features/`](future-features/README.md). |
| [`ADAPTIVE_LEARNING_ENGINE.md`](ADAPTIVE_LEARNING_ENGINE.md) | Long design companion. Production progression code is `packages/learning`. |
| [`ADAPTIVE_LEARNING_CORE.md`](ADAPTIVE_LEARNING_CORE.md) | Control-plane foundation notes. |
| [`ADAPTIVE_GAME_DIRECTOR_RESEARCH.md`](ADAPTIVE_GAME_DIRECTOR_RESEARCH.md) | Research bibliography, not an execution plan. |
| [`GUIDED_LEARN_ENGINEERING_PLAN.md`](GUIDED_LEARN_ENGINEERING_PLAN.md) | Guided Learn design direction. Room 2 is not accepted. |
| [`PHASE3_ROOM2_LEARN.md`](PHASE3_ROOM2_LEARN.md), [`ux/`](ux/) | Current Room 2 experiment and the 2026-10-15 UI notes. Not release acceptance. |
| [`PRODUCT_BUILD.md`](PRODUCT_BUILD.md) | Shipped weak-area, practice-test, cram, and study-plan heuristics. |
| [`COMPANION_PARITY_PLAN.md`](COMPANION_PARITY_PLAN.md) | Companion rollout notes. Stages 1–4 shipped; leftover audit items remain. |
| [`../knowledge/teaching-coaching/README.md`](../knowledge/teaching-coaching/README.md) | Internal strategy library. Not a learner-facing setting. |

## Separate tracks

Moon Keep is a game prototype under [`../prototypes/moon-road/`](../prototypes/moon-road/). Start at [`AGENTS.md`](../prototypes/moon-road/AGENTS.md). POC XI is the golden route. POC IX's build plan is archived under [`archive/superpowers/`](archive/superpowers/).

[`../services/retrieval/`](../services/retrieval/) is a local Python FAISS prototype. It is not production retrieval and it is not authenticated. See [`AGENTS.md`](../services/retrieval/AGENTS.md).
