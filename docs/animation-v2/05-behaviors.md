# Phase 5 — Behavior library

**PASS · 2026-11-21.** The same artboard and machine gained the remaining behavior targets. The [typed policy](../../apps/web/lib/studigo-behaviors.ts) covers every committed companion event and owns priority and expiry. The Rive timeline owns pose curves and blend timing.

| Intent | Trigger | Priority and duration | Movement |
| --- | --- | --- | --- |
| Idle | Base state and no gaze | Base, continuous | Nine-second planted idle |
| Listening | Host begins listening | Base until changed | Picks up the head and holds attention |
| Thinking | Host starts thinking | Base until changed | Upward lean and curious roll |
| Reading | Host starts reading | Base until changed | Dips the chin and scans the eyes in three steps |
| Sleepy | Idle threshold or host request | Base until changed | Drooping head, closed lids, slow head drift |
| Curious | Hint, blind spot, or explicit reaction | 1 · 1,000 ms | Small lean toward the subject |
| Happy | Host requests a smile | 2 · 900 ms | Quick tilt and light settling nod |
| Encouraging | Stall or explicit encouragement | 2 · 1,150 ms | Supportive slow nod |
| Wake | Return or new activity | 2 · 900 ms | Lifts the head and opens the eyes while blending out of sleepy |
| Correct | Correct grade, fast correct, positive card rating | 3 · 800 ms | Small, quick positive response |
| Incorrect | Wrong grade or negative card rating | 3 · 1,200 ms | Gentle dip, then reassurance |
| Petting | Pet or touch | 4 · 1,450 ms | Soft lid close, lean into the touch and tail follow-through |
| Celebrating | Committed set or mission completion | 5 · 1,200 ms | Anticipation, small hop and settle |

Gaze is available during idle and yields to a named base state or reaction. Equal or higher priority reactions replace the current one, including during a blend. A lower priority request is dropped. On expiry, the behavior resolves to the latest base or gaze. Wake or petting clears a sleepy base. All entries use the exact neutral pose under reduced motion. Text and sound feedback remain the existing host's responsibility.

## Validation

- `rive --verify` and `rive inspect --summary` completed with no errors, warnings or inspect problems.
- [Behavior captures](evidence/phase5/behavior-review.jpg) show IDs 10 through 16 individually, then sleepy → wake → petting → celebration → idle → reduced motion. The last image has zero differing pixels versus the bind. The [Phase 4 captures](evidence/phase4/intent-poses.jpg) cover IDs 1 through 9. The user interface has not been migrated.
- `node --import tsx --test lib/studigo-behaviors.test.ts` from `apps/web`: 5 passed. This covers all committed events, dropped and interrupted events, expiry, sleepy wake and gaze mapping.

The local export is 70,273 bytes, SHA-256 `95cc42b38d77a1c2b78fbccba1d3e9be39919dc803ad4bd567384bcffae65f1e` at this gate.
