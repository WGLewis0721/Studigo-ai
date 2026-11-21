# Shared companion events (Living Companion LC-6 + Guided Learn GL08)

**One event list, one reaction system.** Guided Learn GL08 ("The existing character reacts to a miss, a hit, and a stall. Reactions never block the button." — `docs/GUIDED_LEARN_ENGINEERING_PLAN.md:98` on `main`) and Living Companion LC-6 both consume this list. Yellow Ranger (UX08) and the LC renderer must not build separate reaction paths.

## Current seam on `main` (056066f)
`apps/web/lib/companion-logic.ts:128`:
```ts
export type CompanionEvent = "correct" | "wrong" | "blindspot" | "setDone" | "cardGood" | "cardMiss";
```
`CompanionHandle` (`apps/web/components/companion/engine.ts:18`) exposes `event(name)`, `thinking(on)`, `setTone`, `setPrefs`, `destroy`. Rooms send events through `CompanionContext` (`companion.tsx:19`, provided in `room/workspace.tsx:253`). There is no `stall` event today.

## Rules (APPROVED-BY-OWNER unless marked)
1. Events are emitted **only after** deterministic software has committed the result (grade recorded, card rating saved, mission step persisted). Never from answer selection, peek, typing, or model output.
2. The companion never writes mastery, grades, progress, evidence, coins, XP or streak records, and never calls Supabase or a model provider.
3. Reactions never block or delay any control (GL08).
4. Room-scoped: events carry `roomId`; stale events from a previous room are dropped (QA L05).

## v1 event list — ENGINEERING PROPOSAL (additive; existing names kept)

| Event | Emitted by (owner) | Existing? | Default reaction (see spec §6) | Mood delta (MOOD_METER.md) |
|---|---|---|---|---|
| `correct` | grader commit (Quiz/Test/Coach practice) | yes | Sunny hop + small sparks | +1 |
| `correctFast` | grader commit with deterministic `fast` flag | new | dash/zoom beat | +1 (not stacked with `correct`) |
| `wrong` | grader commit | yes | Oopsie → Curious, "mistakes are clues" | 0 (never negative) |
| `blindspot` | grader commit | yes | Curious lean, "worth a second look" | 0 |
| `cardGood` / `cardMiss` | flashcard rating saved | yes | small hop / supportive nod | +0.5 / 0 |
| `setDone` | set completion commit | yes | spin-and-jump celebration | +2 |
| `stall` | **Guided Learn mission director (GL02) only**, deterministic timer on an open beat, payload `{level: 1|2}` | new (GL08) | level 1: thinking lean + peek at question; level 2: point to hint if one is offered | 0 |
| `hintOpened` | hint UI after hint is shown | new | curious nod | 0 |
| `streak` | derived **in companion logic** from consecutive `correct` events this session (as `reactionFor` does today at 3); never stored | derived | tail-wag escalation at 3/5, hero landing at 10 | included in `correct` |
| `missionComplete` | GL02 mission commit | new | celebration beat | +2 |
| `sessionReturn` | room mount after a gap (client-only, no persistence) | new | bound-in + hello | resets meter to start value |
| `thinking(on)` | existing handle call | yes | Thinking base state | none |

Presentation-only inputs (not learning events, never logged): pointer/tap position, drag, pet, poke, long-press, visibility hidden, idle time (existing `idleStage`: lean 60 s, sleep 180 s).

## Open
- RESOLVED: stall thresholds are a measured-then-tuned parameter `STALL_LEVEL1_MS` (placeholder 20,000–45,000) and `STALL_LEVEL2_MS` (placeholder 2× level 1), finalized from LC-0b measurements; GL02 owns the timer.
- OPEN: whether `correctFast` should exist at all for 2nd graders (speed pressure).
