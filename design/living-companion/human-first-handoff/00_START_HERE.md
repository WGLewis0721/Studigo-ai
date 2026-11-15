# Studigo — Living Companion: the human-first project handoff

**Prepared 14 November 2026.** This is a readable reference dossier for a person working on Studigo's animated orange dragon. It can also be shared with **any** AI assistant, coding agent, or design collaborator; no product-specific prompts or agent identities are required.

## What this is
Studigo is an AI learning companion. The product promise is **Learn. Earn. Play.** The companion should feel like a small, consistent friend, not a logo pasted into a homework app. The owner has approved concept demonstrations of a living character and two places for that character inside the Study Room.

The product team originally called the work **“Studigo v2 Phase 4.”** The repository subsequently adopted **Living Companion (LC)** as the track name because its main engineering roadmap also uses “Phase 4” for reliability, safety and cost. Both names refer to the same animated-companion initiative in this handoff. **The current LC plan, not the old Phase 4 draft, governs engineering.**

## Read this package in order

1. **01_AT_A_GLANCE.md** — product, status, scope, boundaries and terms.
2. **02_OWNER_DECISIONS.md** — what the owner approved, what is proposed, what remains open.
3. **03_THE_THREE_APPROVED_CONCEPTS.md** — three concept films, their exact URLs and what they show.
4. **04_BEHAVIOR_AND_ANIMATION.md** — the Coucou / REA learnings, Studigo motion and character rig.
5. **05_CURRENT_LIVING_COMPANION_SPEC.md** — current 14-expression/12-beat product requirements.
6. **06_BUILD_SEQUENCE_AND_RESPONSIBILITIES.md** — tasks, dependencies, tests and release gates.
7. **07_REPO_AND_LOCAL_WORKSPACE.md** — existing branches, local context staging, precise source links.
8. **08_ASSETS_LICENSE_AND_REFERENCES.md** — approved art, licensing, new artwork and third-party boundaries.
9. **09_VALIDATION_AND_RELEASE.md** — how to know whether the work really works.
10. **10_CONVERSATION_HISTORY.md** — chronological account of how the decisions were reached.
11. **11_WHAT_TO_DO_NEXT.md** — what is ready, what is blocked and a practical first session.

## Important honesty and provenance notes

This is a **carefully reconstructed project/context handoff**, not a native word-for-word ChatGPT conversation export. The historical context ZIP is preserved byte-for-byte as `historical/ORIGINAL_2026-10-25_HANDOFF.zip`, including original REA analysis evidence. Its Grok-specific prompts and older plan are **historical evidence**, not active instructions for a human or a new agent. This new package is deliberately tool-agnostic and human-led.

The final authority is **verified code, tests and actual production behavior**, then the current repository LC knowledge base and plan. A concept video is not a working renderer. A GitHub draft PR is not a merge. A successful static analysis is not animation-quality proof.

## Quick links

- Main project: https://github.com/WGLewis0721/Studigo-ai
- Production web app: https://studigo-ai.vercel.app
- Current LC knowledge base on groundwork branch: https://github.com/WGLewis0721/Studigo-ai/tree/feat/studigo-v2-phase4-animation-foundation/design/living-companion
- Current LC execution plan: https://github.com/WGLewis0721/Studigo-ai/blob/feat/studigo-v2-phase4-animation-foundation/implementation/LIVING_COMPANION_V1_PLAN.md
- Historical phase-4 research PR #164 (draft): https://github.com/WGLewis0721/Studigo-ai/pull/164

**Bottom line:** The owner has approved **what the companion should feel and look like in both UI locations**. The renderer and implementation have not been proven yet. Protect the existing app while establishing an authentic, reusable animation rig.
