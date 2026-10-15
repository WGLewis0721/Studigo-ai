# Studigo V2 Phase 2 — First Learning Victory

**Status:** Proposed delivery contract, not evidence of shipped functionality  
**Prepared:** 2026-10-14 America/Chicago  
**Product outcome:** A new account goes from opening Studigo to one real learning result without typing a room name or picking a color first.

This is the first implementation slice of the October 2026 product proposal (Discover, Personalize, Learn, Earn, Return). It does not replace the document-learning queue, and it does not start Phase 3 Guided Learning. Phase 3 stays behind this gate.

## What is already on main

Grounded Coach and Learn, the learning director, uploads, topics, a study-guide download, companion animation, and the daily AI spend cap. First run is still name, color, companion, then an empty room (`apps/web/components/app-home.tsx`). None of the proposal's new systems are built: no onboarding state machine, no Study Concierge, no free 5-and-5 allowance, no cosmetic inventory, no purchase path.

## Done when all of these are true

| Check | Pass |
| --- | --- |
| Required blank fields before the first lesson | 0 |
| Path | Upload their file, or a sample that is labeled as a sample |
| Studigo's guess | Subject and starting topic are shown and can be corrected |
| Goal | One of: understand this, prepare for a test, practice what I know. No invented test date |
| Lesson | One concept from that material, one question, one response |
| Room they land in | Already has the source, the topic, and a guide they can open |
| Sample path | Does not write fake mastery or claim it knows the learner |
| Leave and come back | Resumes. It does not restart |
| Untouched | Citations, room isolation, the learning director, and spend limits |

## Build order

Keep the companion animation in `FirstRoomSetup`. Replace the order.

1. **Material.** Upload, or start the labeled sample. No required title.
2. **Correction.** Show the inferred subject and starting topic. The learner can change them.
3. **One lesson.** Teach one concept from that material and ask one question.
4. **The room.** Open a room that already holds the source, the topic, and a guide they can open.
5. **Optional.** Name and color only after the guide is visible. Each choice persists. Skipping them still finishes.

A small server-side resume record is enough. Do not ship a product-facing state machine, a concierge, or a second learning engine. Reuse upload, topic extraction, the existing lesson check, and guide download.

## Not in phase 2

Study Concierge, next-action proposals, companion cosmetics, rewards, the 5 free sessions and 5 free guides, Stripe, and APEX.

## Later phases, one outcome at a time

| Phase | Outcome | Starts only when |
| --- | --- | --- |
| 3. Next action | Opening a room offers one next step — coach, practice, or the guide — from real topics and evidence. A weak guess asks instead of choosing. The server rejects any action for a room or topic the learner does not have. | Phase 2 is in production |
| 4. Companion | A saved name and earned look show up next visit. Equipping anything does not change mastery. No streak loss, no sad companion, no disappearing rewards. | The owner approves reversing the current no-reward rule |
| 5. Purchase | 5 coaching sessions and 5 new guide generations are free. A retry does not count twice. A session already started is never cut off. Downloading the same guide again is free. Existing files are never deleted for nonpayment. The pay screen is not shown to a child. | The owner defines what one session is, who pays, and whether $19.99 is real |

Phase 5 stays blocked until those three decisions are written down. The daily spend cap stays in place either way. The Guided Learning outcome gates in [STUDIGO_V2_PHASE3_UX_OUTCOME_PLAN.md](./STUDIGO_V2_PHASE3_UX_OUTCOME_PLAN.md) are a separate contract and do not start until this first-run gate passes.
