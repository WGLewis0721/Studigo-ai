# Product-owner decisions and decision status

This page separates observed approvals from engineering proposals. For formal LC decision IDs, consult `design/living-companion/DECISIONS.md` in the repository.

## Explicitly approved or owner-established

| Subject | Decision |
|---|---|
| Identity | Keep the original orange-and-cream Studigo dragon: same face, eyes, ivory frills, teal vest and flame-tail; **no wings**. |
| Two Study Room placements | A repositionable whole-window floating dock and a fixed animated mascot in the strip between navigation and colored rail. Same character/behavior engine. |
| Visual standard | Use the three approved Higgsfield films as **motion direction**, not actual UI or performance evidence. |
| Personality | Energetic and fast, curious as a teacher, visibly expressive and loyal/friendly. Creative inspirations named in later LC decisions include Sonic, Ms. Frizzle, Pikachu and Krypto—**inspiration, never copied likeness, sounds or character art**. |
| Behavior range | The current Living Companion v1 direction aims for **14 expressions and 12 beats**, with six expressions used to prove feasibility first. |
| Mood | A per-session **in-memory, presentation-only** mood meter. Student mistakes never lower it; no XP or currency loop in v1. |
| Appearance | Seven lightweight, original, school-subject-themed outfits as selectable cosmetic layers; no unlocks/purchases in this release. |
| Animation tools | Rive as first candidate in a bounded bake-off against a lightweight layered Canvas rig; **the choice must be measured before commitment**. Higgsfield can generate missing approved-looking parts but is not a runtime rigging system. |
| Voice | A reusable `MouthDriver` animation interface in v1. Real voice comes later from owner-supplied promo narration; don't assume a live ElevenLabs/other provider. |
| Privacy | No recording of pointer paths, no camera/mic tracking and no animation authority over grades/mastery. |
| Branches | Living Companion implementation work should branch from **current main**, per LC-DEC-005. Avoid directly merging the stale, unrelated-history research branch. |

## Proposed engineering approach, not owner sign-off on code

- A pure TypeScript behavior director, deterministic state machine, elapsed-time motion updates, bounded springs and per-property animation priority.
- A renderer adapter behind an independent `NEXT_PUBLIC_STUDIGO_COMPANION_MOTION` flag (off by default), with the current WebP representation as fallback.
- A versioned, normalized floating-position preference that migrates existing four-corner `dock` preferences without losing them.
- A staged implementation sequence, small PRs, browser/device evidence and a reversible canary rollout.
- The local groundwork branch contains research documents, not evidence that the product is implemented.

## Details that must be measured or confirmed during work

- Final Rive-versus-Canvas choice is a test result, not a foregone conclusion.
- The thresholds for learner “stall” behavior must be based on measured study sessions, not a magic fixed delay. The preliminary 20–45 second interval is a placeholder.
- FPS, frame-time, animation size and device cost targets remain provisional until measured and agreed on the target hardware.
- Later optional sources such as Limora require a terms/ownership review; references to AGPL projects are clean-room educational references only.
- LC knowledge-base rows marked OPEN or PROPOSAL retain those statuses until evidence or owner decision changes them.

## What is deliberately excluded from v1

No new mastery/grade writes, coins, pet attachment scores or purchasable cosmetics; no replacement of Study Room; no full native app release; no importing Coucou's mascot art; no automatic voice-provider selection; no direct integration into games until learning-app behavior is stable.
