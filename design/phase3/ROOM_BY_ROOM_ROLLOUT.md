# Studigo V2 Phase 3 — Room-by-room UI/UX rollout

**Status:** Implementation sequence, not a claim that the new UI is live.
**Branch context:** Phase 3 UI foundation in PR #149 is stacked on the Phase 3 plan PR #145. Rebase each implementation slice on the accepted Phase 2 baseline before touching production room code.
**Goal:** Make the house feel like one Studigo: a clear entrance, trustworthy materials, a guided Learn room, a distinct Coach and Practice path, and useful progress and planning. Each room opens only when its controls perform the job they visually promise.

This is the **placement plan** for the existing [art direction](../../docs/ux/STUDIGO_V2_PHASE3_UI_ART_DIRECTION_PLAN.md) and [UX implementation contract](../../docs/ux/STUDIGO_V2_PHASE3_UX_IMPLEMENTATION_PLAN.md). It does not create a second feature queue or redefine learning policy. The current route and component map below was inspected on `feature/phase3-ui-foundation` on 2026-10-15. Recheck ownership after Phase 2 lands.

## The house map

| Part of the house | Current owner | Phase 3 placement | Learner outcome |
| --- | --- | --- | --- |
| Front door / foyer | `/app`, `app-home`, `room-card-link`, `lib/home-next` | A truthful next action and room readiness; Start/Resume appears only when a real mission is available | Enter the right room without inventing a prompt |
| Hallway / shared frame | `room/workspace.tsx`, `mode-header.tsx`, `mode-glyph.tsx`, `globals.css`, companion owner | Consistent navigation, type, tokens, key states, room identity and safe companion placement | Always know where I am and how to get back |
| Library / Materials | `room/materials-panel.tsx`, `guide-preview.tsx`, document routes | Distinguish original file from Studigo guide; reveal processing, page evidence and recovery | Trust what the lesson is based on and retrieve my own file |
| Classroom / Learn | `room/coach-panel.tsx`, `learn-panel.tsx`, current learning layer | Flagged objective mission with Brief · Show · Try · Check, source ticket and durable cursor | Begin, understand, act, and resume without a prompt |
| Tutor / Coach | `room/coach-panel.tsx`, existing Coach protocol | Keep topic and mode preferences, source-aware help, reviewed voice, assistance accounting | Apply an idea with help and recover from mistakes |
| Practice studio | `quiz-panel.tsx`, `cards-panel.tsx`, `practice-test-panel.tsx` | Shared tactile answer language and explicit independent attempt; retain separate grading | Test understanding without mistaking Learn for mastery |
| Progress room | `mastery-panel.tsx`, `weak-areas-panel.tsx` | Explain earned evidence and next useful action; lesson position stays separate from mastery | See what I know and where to focus |
| Planning room | `study-plan-panel.tsx`, `cram-panel.tsx` | Carry room/topic context into a small daily action; no new planning engine | Know what to do next and return to the right work |
| Controls / settings | `room-settings.tsx`, `use-coach-preferences.ts`, companion controls | Preserve applied/draft settings and accessibility preferences across rooms | Change the environment without losing my work |

The five existing Study Room navigation groups stay intact while each interior is renovated. Learn remains accessible through the existing Coach/Learn switch until a validated product decision and migration change that navigation. The prototype's three-way mode switch is a **visual study**, not authority to replace the current route structure.

## Construction rules for every room

1. **Survey the occupied room.** Capture current phone and wide behavior, list state owner, commands, empty/error paths, and any Phase 2 changes. Mark keep/adapt/create/retire at exact paths. Do not lift synthetic preview text into a real lesson.
2. **Build one usable slice behind a flag.** Reuse approved `globals.css` tokens and fonts, existing mode glyphs and canonical companion. Adapt `components/phase3/` primitives only after reviewing semantics and the real component owner. Proposed icons and ambient art need approval and rights review before production use; the app must work without the ambient art.
3. **Wire real authority.** The room renders typed, authorized state. Existing server/RLS owns source eligibility; learning software owns progression and idempotency; Coach/Practice own grades. The browser cannot infer a verified citation or grant mastery from a styled card.
4. **Make every doorway reversible.** Preserve room, topic, source revision, draft and return focus across a supported handoff. Flag off restores the current path. A failed upload, missing source or denied microphone offers a safe next action.
5. **Inspect the same commit at compact phone, large phone, tablet and desktop.** Save before/after captures and keyboard, screen reader, 200% zoom, reduced-motion and high-contrast findings. Static token contrast calculations and a passing build are not rendered acceptance.

## Renovation sequence

| Order / room | Concrete placement and dependency | Exit proof before opening the next room | Rollback |
| --- | --- | --- | --- |
| **0. Foundation and hallway** | After Phase 2 baseline: reconcile `workspace.tsx` navigation, current `globals.css` and `mode-header.tsx` with the Phase 3 specimen. Define one typed view/command adapter for keys, rail, ticket and dialogs. Add a per-room flag, not a global restyle. No learning policy in JSX. | Current five groups, deep links and Coach/Learn topic scope still work; old and flagged layouts share real room data; 4-width shell and focus audit; flag off is visually and behaviorally current. | Turn off flag; leave original components mounted on old route. |
| **1. Library / Materials** | Adapt original-file and generated-guide actions in `materials-panel.tsx`; bind source tickets to authorized page/block/revision data. Show ready, processing, partial OCR, missing, stale and denied states. Reuse current download route and guide preview rather than a duplicate storage path. | A learner can open/download the original in at most two actions, distinguish it from the Studigo guide, and inspect one eligible cited passage. Replacement/deletion invalidates stale precision; cross-account file access is denied. | Restore old Materials rendering; existing originals and URLs remain. |
| **2. Classroom / Learn** | Integrate one flagged government objective into `coach-panel.tsx`/`learn-panel.tsx` through the current application learning layer. Start/Resume, Brief → Show → Try → Check, tap answer, hint, Find it, Back and Pause use a revision-bound durable cursor. Add the college physics fixture before claiming age flexibility. | Elementary and college beginners complete one concept on phone and wide without a prompt; reload resumes exact step; double submit creates one transition; ticket resolves to current eligible source; Learn completion makes **zero mastery writes**. | Disable mission flag and return to current Learn chat/lesson with selected topics intact. |
| **3. Front door / Home** | Only after room 2 has a real ready mission, adapt `app-home` and `lib/home-next` to surface one truthful Start/Resume action. Empty and processing rooms lead to Materials; a room without an eligible mission never shows Start. | From `/app`, a novice enters the right room and acts within a minute; back returns to the room list; interrupted learner resumes the same objective once. No fabricated readiness from document count alone. | Current Home hero and room cards remain the fallback. |
| **4. Tutor / Coach** | Restyle the current `coach-panel.tsx` surfaces without replacing its protocol. Preserve separate Coach/Learn topic selections and apply buttons. Add task-appropriate answer dock, explicit source help, hint/read-aloud and voice capture → stop → transcript review/edit → submit when the real device/provider path is ready. | Coach keeps room/topic/source scope; permission denial, silence, bad transcript and network failure do not submit or double spend; assisted attempts are recorded under existing assessment rules. A text/tap path remains. | Current Coach chat and assessment flow behind flag. |
| **5. Practice studio** | Apply the key/choice language to Quiz, Cards and Practice Test separately. Reuse existing grading, card scheduling and test receipts. Carry the selected topic from Learn/Coach into the chosen independent attempt. | Selection and Submit are separate; one graded attempt per idempotent action; no answer leak through Find it; independent transfer result is recorded separately from lesson completion. | Existing three practice panels. |
| **6. Progress room** | Recompose Mastery and Weak Areas using real evidence and actionable next step. Explain what a readiness indicator means; do not paint the objective rail as mastery. | An ungraded Learn run changes no mastery/readiness; a real Coach/Practice result appears once; weak-area action returns to the correct topic. | Existing mastery and weak-area panels. |
| **7. Planning room and controls** | Apply the same system to Study Plan/Cram, room settings and companion boundaries. Keep current planning calculations and preference persistence. The canonical companion appears in one safe slot, never over an answer or citation. | Planned action opens the correct mode/topic; changing settings does not erase an answer; hidden companion, reduced motion and sound-off complete the same path. | Existing plan, cram, settings and companion presentation. |
| **8. Whole-house walkthrough** | Run the full path: Home → Materials → Learn → verified source → Coach → independent Practice → Progress → Plan. Pilot with elementary government and college mechanics fixtures, including recovery cases. | Record per-cohort unaided start/Find-it/transfer, source eligibility, duplicate-event checks, accessibility and four-width visual comparison on one accepted commit. Keep flag and old Learn fallback until the Phase 3 UX release gate passes. | Disable flagged UI; preserve learner data and original route. |

Rooms 0–2 establish the first complete vertical path. The library precedes the classroom because a beautiful citation ticket without verified material would undermine the central product promise. Home's new Start/Resume waits until the classroom can actually accept it. Rooms 4–7 can have separate PRs after the same foundation, but merge each only after its own interaction and visual proof. Avoid a giant app-wide CSS replacement.

## PR packet and handoff for each room

One room equals one reviewable PR (or a small stacked pair if server contract and UI are independently reviewable). Put this table in its PR description:

| Field | Required entry |
| --- | --- |
| Baseline | Phase 2 commit, current route/owner, before captures and flag state |
| Outcome | One learner task in plain language; which room it unlocks next |
| Change | Exact components/contracts/assets and their provenance/approval status |
| Scenario | Entry → action → state transition → visible result → source/grade owner |
| Recovery | Empty/loading/partial/stale/denied/offline and route back |
| Proof | Focused tests, source/RLS or grading checks as applicable, four-width captures, accessibility review |
| Decision | DONE / NOT DONE / BLOCKED against the exit proof; flag-off rollback demonstrated |

**First implementation PR:** room 0 plus the thin Materials source adapter required to prove one real ticket. Start by reconciling Phase 2 and inspecting current room/test owners. Do not roll the full prototype into `workspace.tsx` wholesale. The second PR completes Library recovery; the third is the one-objective Learn vertical slice. That sequence makes the UI visibly better while keeping the learning and evidence contracts honest.
