# Studigo V2 Phase 3 — UX Implementation Plan for the Artistic UI

**Status:** Proposed implementation plan. No Phase 3 interaction is claimed shipped.  
**Repository:** `WGLewis0721/Studigo-ai`  
**Goal:** Turn the approved Phase 3 visual language into a guided, source-trustworthy, low-friction learning journey. Every polished control must do the job its appearance promises.

This plan complements the [artistic UI outcome plan](STUDIGO_V2_PHASE3_UI_ART_DIRECTION_PLAN.md) and [learner outcome plan](STUDIGO_V2_PHASE3_UX_OUTCOME_PLAN.md). The former owns form, components, assets and compositions; this document owns interaction rules, states, data boundaries, implementation sequence and behavioral proof. The existing GL01–GL10 and UX01–UX10 plans remain detailed feature cards. Do not turn their proposed illustrations into claims about current code.

## 1. Start from the actual product

Before coding, read `AGENTS.md`, `ENGINEERING.md`, `docs/PRODUCT.md`, `docs/DESIGN_SYSTEM.md`, `docs/brand/README.md`, and the three Phase 3 plans in `docs/ux/`. Then inspect the relevant current implementation and tests only. Current repo entry points include `apps/web/components/room/workspace.tsx` (room navigation), `coach-panel.tsx` (Coach/Learn, Chat/Topics), `apps/web/components/mode-glyph.tsx`, `apps/web/components/companion/`, `apps/web/lib/contextual-retrieval.ts`, `packages/learning/`, and `apps/web/lib/learning/`. Verify that these paths still own the behavior on the implementation branch. `apps/web/app/dev/study/page.tsx` is a fixture surface, not production evidence.

The current room has five pages, with Coach and Learn behind a visible switch. Preserve old Learn access and room/topic preferences during the transition. Treat the proposed guided mission as a **flagged new presentation and orchestration path**, using existing authorization, retrieval, grading and persistence authorities. Do not create a second mastery engine, source corpus, mascot controller or parallel app navigation.

## 2. Behavior contract for each visual object

| UI object from the board | Interaction promise | Data/state owner | Edge state and behavioral proof |
| --- | --- | --- | --- |
| **Home Start/Resume key** | Starts one ready objective or returns to the exact saved step; no prompt composition required. | Server-authorized room/topic scope + revision-bound mission/session cursor. | No eligible document: show material readiness and next action. Reload/back returns to cursor once; double tap does not advance twice. |
| **Learn / Coach / Practice switch** | Makes the jobs distinct and keeps learner orientation. | Existing room navigation and Coach/Learn topic preferences; assessed Practice remains existing path. | Switching away saves/pauses mission; returning resumes it. Never copy Coach scope onto Learn or change mastery by switching. |
| **Objective rail** | Shows location in a lesson and which steps can be revisited. | Deterministic mission reducer, not generated prose or mastery score. | A skipped/repeated/re-taught step is labeled accurately; screen reader announces position and status. No fake percent-complete mastery. |
| **Lesson stage** | Presents one objective, one source-grounded teaching move and one meaningful action. | Validated mission view model derived from the current guide/source revision. | Loading, partial OCR, unavailable or replaced source, and paused states are honest and actionable. No blank AI chat as the default mission. |
| **Find it ticket** | Opens a verified passage with document/page or section, then returns to the same step. | Existing room-scoped source blocks and original-file authorization. | Missing/stale/OCR-uncertain evidence has no fabricated highlight. Phone sheet and wide pane use one evidence contract. |
| **Choice/evidence keys** | Enable a learner to respond by tap without typing; selected state and submit are clear. | Typed activity definition and deterministic attempt command. | Multi-select and single-select are explicit; Back/Cancel does not accidentally submit; duplicate taps create one response. |
| **Speak key** | Records only on deliberate tap, shows transcript for edit/retry, submits only on confirmation. | Permission/device capture in client; server admission and existing assessment route. | Denied permission, silence, poor transcript, network loss or timeout never silently grades or spends twice. Text/tap path remains. |
| **Hint / Read to me** | Helps in place without replacing the task. | Assistance metadata and scoped content; user-triggered audio lifecycle. | Stop/replay; text remains; help use persists for assessed Coach and never awards Learn mastery. |
| **Companion window** | Reacts briefly to real learning events without controlling progress. | Existing canonical companion state and placement rules. | Hidden/minimized/reduced-motion/sound-off still complete the flow; no duplicate mascot in panels or content occlusion. |
| **Success and handoff keys** | Acknowledge formative work, then offer Review, Coach or independent Practice. | Deterministic mission completion and current assessment authority. | Learn success is ungraded; handoff carries topic and eligible source revision but does not mint mastery. |

The visual plan's keys, rails, tickets, sheets and panes must have the above behavior before they are called complete. A static mockup may demonstrate art direction, but it does not satisfy this plan.

## 3. Journey and navigation model

**Entry:** The Study Room presents one recommended ready objective, a Start/Resume action, a visible alternative to choose another topic, and material readiness. The selection is derived from the teacher guide and current learner edits. If the guide is missing or processing, explain what is available rather than inventing a lesson.

**Mission:** Briefing → Foundation → Demonstration → Learner action → Formative checkpoint → Advance/reteach. The visual rail can compress this to **Brief · Show · Try · Check**. Software decides actual transitions. Back allows review without creating new graded evidence; Pause preserves the cursor. “I know some of this” is reversible and leads to a diagnostic or alternative path, not a blind skip to earned mastery.

**Evidence:** Find it is available at the claim/example it supports. Open a phone bottom sheet or wide-screen side pane without replacing the mission. Escape/close/back restores focus to the invoking citation and retains unsent answer state. A source revision change invalidates stale passage precision and prompts refresh/recovery; the learner is not told a quotation still exists when it does not.

**Response:** Render only modalities appropriate to the activity. A simple choice can be tapped; a passage can be selected; a spoken or typed explanation can be reviewed. Answer selection, submission, feedback and Next are separate state transitions. Keep one primary action at a time, with a way to correct before final submission. Speech is optional and never auto-starts.

**Transfer:** Finish with “You practiced…” and a truthful summary of assistance and sources. Offer another concept, Coach, and independent Practice. The first unassisted Coach/Practice attempt is measured separately from mission completion. Preserve the topic, room and current eligible revision through the handoff.

**Recovery:** Materials always keeps Open/Download/Print Original distinct from the generated Studigo guide. A broken generated guide, denied microphone, offline event or missing source must leave the user with a safe next action and a route back to the room.

## 4. Implementation architecture

Use a thin client view-model boundary instead of putting learning policy into JSX:

```text
authorized room + guide/source revision
    -> typed LearningMissionPlan (bounded generated teaching content + provenance)
    -> deterministic mission reducer and durable cursor
    -> validated step view model (text, actions, evidence status, assistance)
    -> reusable visual components from the art plan
    -> explicit commands (start, answer, hint, source, back, pause, resume, handoff)
    -> authorized server transition / idempotent receipt
```

Define these contracts in the existing learning/application layer, with stable IDs and a schema/version. The suggested names are illustrative; inspect existing types first and extend them rather than duplicate them:

| Contract | Minimum fields and invariant |
| --- | --- |
| `MissionIdentity` | `roomId`, selected topic IDs, guide/source revision fingerprint, plan schema version. A changed source cannot silently reuse a stale citation. |
| `MissionStepView` | stable step ID, objective, stage, display text, allowed action types, progress label, source references, state. Text is data; React never parses arbitrary model prose for control instructions. |
| `EvidenceRef` | authorized document/block ID, page or section if supported, exact excerpt only when verified, eligibility/status and original-file action. Missing evidence is a typed state. |
| `ResponseDraft` | activity ID, modality, selected choices or transcript/text, edit status. Draft stays local/unsent until explicit submit. |
| `AssistanceRecord` | hint/example/read-aloud/source-used flags as applicable. Assistance travels with assessed attempts so existing grading policy can account for it. |
| `TransitionReceipt` | idempotency key, prior/new cursor, event kind and committed timestamp. A retry/reload cannot produce duplicate advancement or mastery. |

AI may write bounded explanations/examples supported by eligible source material; software validates source references and owns the next allowed action. Keep authorization in the current room/RLS/server path. No private document text or child audio in UI analytics. Use the existing admission/spend guard for provider calls. Learn formative responses never invoke the graded mastery write path. Coach and Practice keep their existing assessment contract.

Do not introduce a new API route/database table merely to match a mockup. If persistence requires a migration, make it additive, RLS-scoped and idempotent; document replay and rollback. Reuse `packages/learning` for deterministic progression where its existing contracts fit, and place mission-specific reducer state there or in the current application learning layer after inspection.

## 5. Component integration with the visual system

- **Single component vocabulary:** `MissionHeader`, `ObjectiveRail`, `LessonStage`, `EvidenceTicket`, `SourceSpotlight`, `AnswerDock`, `VoiceReview`, `AssistActions`, and `HandoffPanel` are conceptual component boundaries. Map them to existing components where practical; do not implement names merely for symmetry. Each consumes validated view data and emits typed commands.
- **Tokens and assets:** exact colors, typography, materials, icon grammar and canonical companion come from `docs/DESIGN_SYSTEM.md` and approved assets. If the art plan produces a new SVG or font, integrate only its approved version with license and fallback. No UI logic depends on generated image pixels.
- **Responsive behavior:** one content/action column on compact phones; evidence in a modal sheet with focus trap and safe-area bottom; wide screens dock evidence beside the lesson without changing its state. Keyboard opening cannot cover Submit/Edit/Stop. A companion-safe zone is calculated from real viewport and action placement.
- **State/visual parity:** every loading, disabled, selected, pressed, recording, transcript review, stale source, partial OCR, failure, retry, resumed and completion state has a design specimen and a React state. A polished happy-path key with an unstyled error dialog fails acceptance.
- **Accessibility:** semantic headings and form controls, 44×44 targets, visible focus, Esc and focus return for sheet, status announcements without noisy full-page live regions, 200% zoom, readable contrast on composited fills, reduced motion and a text alternative for every audio path.

## 6. Delivery slices and exit gates

| Slice | Implement together | Evidence to close it |
| --- | --- | --- |
| **S0. Baseline and contract** | Inspect current Learn/Coach flows, asset/component inventory, design approval state; map commands and data ownership; create a realistic permission-safe government and college physics fixture. | A current-state capture, event/state table and component ownership map. No claim of shipped Phase 3 behavior. |
| **S1. First mission vertical slice** | Flagged Start/Resume, one revision-bound objective, brief/show/try/check, durable cursor, thin verified Find it, and approved core visual components. | On phone and wide screen a first-time learner starts without a prompt, acts, sees formative feedback, reloads and resumes at the same place; repeat submit advances once; Learn writes no mastery. This is the first implementation PR that matters. |
| **S2. Source and input completeness** | Full Source Spotlight states, authorized original, tap/evidence choices and reviewed voice answer in Coach; visual specimens for failures. | Verified passage/page or honest absence; a tap-only elementary path; speech permission/transcript/edit/retry/submit path without accidental grade or duplicate provider work. |
| **S3. Support and recovery** | Contextual hint, user-triggered read-aloud, canonical companion reactions, source revision recovery, original-file controls and explicit handoff. | Support never blocks completion; original is reachable; stale sources cannot masquerade as verified; Coach/Practice receives the intended topic, with Learn mastery unchanged. |
| **S4. Cross-device pilot and release** | Four-width visual comparison to approved art, keyboard/screen reader/reduced-motion audit, two-cohort usability and learning-transfer checks, limited flag rollout. | Both cohorts can start, find source, respond, recover and attempt independent work. Record completion and unassisted transfer separately. Preserve old Learn fallback until accepted. |

Keep each slice reviewable on its own branch/PR, with clear dependencies and no premature main/production merge. If art approval is still pending, use the existing approved brand tokens in a working slice and swap only approved production assets afterward. A UI-only PR cannot declare the UX slice done; a reducer-only PR cannot declare the learner journey done.

## 7. Verification that matches the experience

For every slice, provide a short **scenario → command/state → visible result → evidence** table, relevant focused tests, and phone/wide captures from the same commit. Use the existing fixture/dev surface for isolated previews but verify the authorized room path before release. Priority scenarios:

1. Start, double tap, pause, reload, resume, back, advance and retry without duplicate event.
2. Teacher-guide scope and learner edits remain intact; source replacement/deletion and partial OCR produce honest states.
3. Find it preserves answer draft/focus; cited text and original-file action are authorized to this room/user.
4. Tap-only response and speech permission denial, silence, wrong transcript, edit, retry, offline and submit.
5. Hint/read-aloud/companion off and reduced-motion paths; no accidental assessment or false mastery.
6. Phone keyboard and safe-area controls; tablet/desktop side pane; keyboard and screen-reader navigation.
7. Handoff preserves scope and yields an actual independent Coach/Practice attempt, measured separately.

Pilot targets from the learner outcome plan are **targets, not current metrics**: at least 80% in each beginner cohort complete a first concept unaided and find a cited passage; 100% of tested source claims resolve to eligible evidence or disclose absence; zero Learn events update official mastery. Report sample size, materials and failures alongside percentages. If students can navigate a beautiful interface but cannot independently apply the concept, Phase 3 has not achieved its goal.

## 8. Handoff to a GitHub-connected implementer

Begin with **S0**, then build **S1 as one complete flagged vertical slice**. Read the approved art deliverables before styling and the GL/UX feature cards before changing learning behavior. Open the exact current component/type/route/test owners before editing. Keep the design source, code and tests linked in the PR, with before/after captures and a list of proposed versus approved assets. Mark each slice **DONE / NOT DONE / BLOCKED** against its exit evidence. Do not interpret the generated brand board as an actual passage, an accepted logo, or a finished screen.
