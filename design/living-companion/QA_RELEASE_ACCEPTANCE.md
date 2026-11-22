# QA and release acceptance matrix (LC)

> Source: copied verbatim from `07_QA_RELEASE_ACCEPTANCE.md` inside the historical archive `handoff/Studigo_Living_Companion_Human_First_Context_2026-11-14.zip` > `historical/ORIGINAL_2026-10-25_HANDOFF.zip`, so the plan's row IDs (V01-V08, UI01-UI10, L01-L07, A01-A09) resolve to a file on the branch. "Phase 4" below means Living Companion (LC-DEC-001). Results go in `evidence/`, not here.
>
> Known conflict (2026-11-20): V02 asks for no discrete-image popping, but on 2026-11-17 the owner asked to restore his original drawn head turns, which crossfade in as separate drawings. Owner decision needed.


**Verification rule:** Every row requires reproducible *actual app evidence* with the same commit SHA, device/viewport, mode, flag state, test command or manual steps, result and failure notes. Videos made in Higgsfield are reference expectations only.

## Visual fidelity and character motion

| ID | Scenario | Pass evidence |
| --- | --- | --- |
| V01 | Neutral front/3-quarter, six moods | Approved silhouette, eye color, ivory frills, orange/cream proportions, vest and crayon flame-tail are unchanged. No wings. |
| V02 | Pointer target sweep left/right/up/down and diagonal | Eyes track continuously first, head follows naturally; no discrete-image popping. |
| V03 | Random blinks during all head/gaze directions | Every eye orientation blinks correctly without face/eyelid artifacts. |
| V04 | Touch/pet vs drag | Tap/pet plays warm response; dragging moves dock only; no accidental submit or blocked reading. |
| V05 | Celebration | Correct grade triggers tiny anticipation, springy paw/bounce, lagging tail/frill, natural settling. |
| V06 | Missed answer | Supportive, calm, nonjudgmental pose; no crying/shaming or invented score. |
| V07 | Idle 5 minutes | Character alive but not distractingly fidgety; no stuck pose, no runaway resources. |
| V08 | Animation frame consistency | Deterministic fixture output qualitatively consistent at 30/60/120Hz, bounded dt on tab resume. |

## Two UI placements

| ID | Scenario | Pass evidence |
| --- | --- | --- |
| UI01 | Floating drag with mouse, touch, keyboard | ENTIRE rigid frame + dragon move together, inside safe region. |
| UI02 | Floating destination not a corner | Distinct arbitrary safe positions supported; old four-corner snap is not presented as full user-approved repositioning. |
| UI03 | Position persistence | Refresh, navigate sections/rooms, resize, keyboard open/close, rotate viewport; safe stored intent restored. |
| UI04 | Avoid obstruction | Never blocks active choices, citations, screen reader focus, navigation, chat composer/Send, modal. |
| UI05 | Resizing and minimizing | Existing pinch/handle/step sizes, restore, bubble, focus states retained. |
| UI06 | Fixed strip placement | Between nav and colored divider; stays at right, no second window; no rail motion. |
| UI07 | Phase 3 tuck behavior | 100%→60%→100% desktop expand/tuck preserved on page interaction/hover/focus/click; phone full-sized controls. |
| UI08 | Fixed strip with scrolling content | Content scrolls; anchored strip/rail/nav and dragon location don't shift. |
| UI09 | Strip on small phone | Safe face and frill bounds, no cropped forehead/eyes/vest; input and practice content remain usable. |
| UI10 | Switching modes | Exactly one character/RAF scheduler; mode switch retains prefs, emotion semantics and learner state. |

## Learning correctness and authorization

| ID | Scenario | Pass evidence |
| --- | --- | --- |
| L01 | Coach thinking, success/failure | Correct displayed status; failure stops thinking loop; no “success” guessed from a submitted prompt. |
| L02 | Quiz, Flashcards, Practice Test | Reactions from **committed results** only, not answer selection/peek; actual grading unchanged. |
| L03 | Learn guided reading | Lesson progress remains formative; no silent mastery/evidence mutation from animation. |
| L04 | Rapid repeated events | Stable preemption, finite emote duration, no duplicate persisted grade or progress. |
| L05 | Multiroom change, stale event | No cross-room reaction, no source leak, correct cleanup. |
| L06 | Source/citation material | RLS and source disclosure unchanged; cite/open/source navigation remains accessible. |
| L07 | Privacy | No camera/mic collection, client telemetry of pointer trails, sentiment profiling or student content upload. |

## Accessibility, resilience, performance

| ID | Scenario | Pass evidence |
| --- | --- | --- |
| A01 | Keyboard/screen reader | Dock repositioning alternative, focus ring, control names, Escape/cancel, restore focus after modal/minimize. |
| A02 | Reduced motion | Static safe fallback/no continuous physics, no unwanted particles/tail flicker or autonomously moving interface. |
| A03 | 200% browser zoom | Strip/dock still fit; no horizontal overflow or blocked controls. |
| A04 | Tab background/unmount | RAF/intervals/tweens/observers disposed, no background CPU spike or resumption teleport. |
| A05 | Missing rig/corrupt prefs | WebP fallback and safe preferences without crashing room. |
| A06 | Mobile Safari and iPad | Physical device recordings; check pointer coarse/touch/pinch/keyboard safe viewport and frame/long-task cost. |
| A07 | Desktop browsers | Real screenshots and motion capture at specified sizes; consistent input behavior. |
| A08 | Performance | Before/after CPU/frame time, memory, total JS/assets, scroll and text-input responsiveness; no made-up budgets. |
| A09 | Recovery | Existing companion emergency-off and new motion-off both tested; recovery returns legacy UI as promised. |

## Required viewports/conditions

375×667, 390×844, 768×1024, 1024×768, 1440×900; real iPhone Safari and iPadOS Safari, pointer and touch, virtual keyboard open, scroll, 200% zoom, reduced motion, low-end power/performance, slow network, auth-required room with real student files (appropriately sanitized in evidence), and no-data preview fixture clearly labeled synthetic.

## Release gate

1. Pre-Phase-4 post-Phase-3 golden SHA/rollback verified.
2. P4-1 rig choice proven and identity approved.
3. Pure-core tests and renderer tests pass on exact PR SHA.
4. Floating and strip behavior reproduced in **real browser-app videos**.
5. Accessibility and learner-data authority gates pass.
6. Performance across real hardware measured and acceptable; no long-task/scroll regression.
7. Phase 4 OFF returns legacy sprite/window, full companion OFF works, verified rollback procedure.
8. Merged commit and Vercel READY production deployment identified; signed-in smoke performed.

**Only after these gates may Phase 4 be called shipped.** None was established by the earlier concept-video generation or planning PR.
