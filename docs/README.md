# Studigo documentation

The current `main` learning app is the golden integrated V3 web/PWA beta.
The [Moon Keep POC XI](../prototypes/moon-road/README.md) is a separate
playable golden prototype. Do not treat either golden build as an unstarted
project. Proposed changes build in feature branches; the current product
behavior stays the baseline until a future PR is accepted.

## Read first

| File | Read it when |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Any task. Short rules. |
| [ENGINEERING.md](../ENGINEERING.md) | You need the live map or the technology catalog. |
| [ENGINEERING_PLAN.md](../implementation/ENGINEERING_PLAN.md) | You are doing planned hardening, not a local bugfix. |
| [PRODUCT.md](PRODUCT.md) | The change can affect what the product is allowed to do. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | The change crosses a runtime or data boundary. |

Read the rest of this page only when the task names that document. [SOL review files](SOL_PHASE3_REVIEW.md), [ATTEMPTED_FIXES.md](../ATTEMPTED_FIXES.md), and [PROBLEM_STATEMENT.md](../PROBLEM_STATEMENT.md) are history. They are not the idempotency tutorial. Idempotency lives in `apps/web/lib/learning/` and `claim_document`.

Moon Keep is a separate game prototype under `prototypes/moon-road/`. It is not the learning app.

`services/retrieval/` is a local Python FAISS prototype. It is not production retrieval and it is not authenticated.

## Learning app

| Need | Owner |
| --- | --- |
| Engineering overview, technology rationale, repo navigation, and implementation plan | [ENGINEERING_PLAN.md](../implementation/ENGINEERING_PLAN.md) |
| Product and grounding rules | [PRODUCT.md](PRODUCT.md) |
| System and privacy boundaries | [ARCHITECTURE.md](ARCHITECTURE.md), [AUTH.md](AUTH.md) |
| Current status and ordered gates | [ROADMAP.md](ROADMAP.md) |
| Web beta evidence and open limitations | [ADAPTIVE_BETA_EVIDENCE.md](ADAPTIVE_BETA_EVIDENCE.md) |
| Native iOS/iPadOS release path | [APP_STORE_RELEASE_PLAN.md](APP_STORE_RELEASE_PLAN.md) |
| Visual behavior | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) |
| SteadyGo animation, video, and reusable character-generation rules | [STEADYGO_ANIMATION_VIDEO_GUIDE.md](STEADYGO_ANIMATION_VIDEO_GUIDE.md) |
| Coding handoff | Start with [ENGINEERING_PLAN.md](../implementation/ENGINEERING_PLAN.md), then use [AGENTS.md](../AGENTS.md) and task-specific specialist docs |
| Deployment and user acceptance | [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md), [USER_TEST_CASES.md](USER_TEST_CASES.md) |

The root [IMPLEMENTATION.md](../IMPLEMENTATION.md), V3 finish plans,
SOL review files, and the companion parity plan preserve executed design
and verification history. Adaptive technical contracts and the
[teaching/coaching knowledge base](../knowledge/teaching-coaching/README.md)
remain specialist references; they do not independently declare a feature
production-accepted. [WAITLIST_API.md](WAITLIST_API.md) covers the public
beta form without changing the private Study Room contract.

## Separate game track

Start with [the game README](../prototypes/moon-road/README.md) and
[CURRENT_GAME_HANDOFF.md](../prototypes/moon-road/CURRENT_GAME_HANDOFF.md).
POC XI is the golden route; POC X/IX and the earlier POC VII/VIII briefs are
historical controls. [TOOLCHAIN.md](../prototypes/moon-road/TOOLCHAIN.md)
owns art/build tooling. The learning-app App Store plan does not double as
the game's release plan.
