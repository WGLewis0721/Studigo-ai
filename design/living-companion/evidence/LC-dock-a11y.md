# LC-dock-a11y: fixes for the remaining QA failures (task H-J)

Branch `lc/dock-a11y-fixes`, from `origin/claude/studigo-living-companion-upgrade-ee0706` at `5518cbc`. The product changes are committed on that branch; the commit SHA is in the task report. Not pushed, merged or deployed.

Method: `next dev` on `127.0.0.1:3308` with `NEXT_PUBLIC_STUDIGO_PHASE3_FOUNDATION_UI=1`. Headless Chromium 151.0.7922.34 from Playwright 1.62.1. Synthetic fixture only; the scripts write no learner state. Raw results are in this folder as JSON. Before = the branch base, after = the branch with the changes.

## Results

| Check | Command | Before (5518cbc) | After |
| --- | --- | --- | --- |
| LC unit tests | `node --import tsx --test lib/companion-*.test.ts lib/quiet-feedback.test.ts lib/mobile-lessons.test.ts` (apps/web) | not run on the base | 169 pass, 0 fail, exit 0 (3 new tests) |
| Typecheck | `npx tsc --noEmit -p .` (apps/web) | not run on the base | exit 0 |
| Lint | `pnpm --filter @studigo/web lint` | not run on the base | exit 0 |
| Companion matrix | `node scripts/lc-companion-qa.mjs` | exit 1: 33 PASS, 8 FAIL, 28 OPEN | exit 1: 38 PASS, 3 FAIL, 28 OPEN |
| Calm matrix | `node scripts/lc-calm-qa.mjs` | exit 1: 22 control PASS, 36 PASS, 16 OBSERVED, 4 FAIL (literal A02 FAIL, spec section 12 PASS) | exit 0: 22 control PASS, 54 PASS, 22 OBSERVED, 0 FAIL (literal A02 PASS, spec section 12 PASS) |
| Rollback, motion | `node scripts/lc-rollback-qa.mjs --expect=motion` | exit 1: 46 of 48 checks | exit 0: 48 of 48 checks |

Row by row, the companion matrix changed on exactly five rows, all FAIL to PASS (`before-companion.json` vs `after-companion.json`). No row went from PASS to FAIL.

## Rows that failed before

| Row | Where | Before | After | Fix |
| --- | --- | --- | --- | --- |
| UI01 | desktop and phone, Phase 3 | FAIL: arrow keys moved him 0 px; stopped at 170 px (want 250) and 26 px (want 106) | PASS: 80 px in five presses; stops at 250 px and 106 px | 1 |
| UI02 | desktop and phone, Phase 3 | FAIL: a dropped spot was ignored and he sat in a corner | PASS: stays where it was dropped; saved as a non-corner spot | 1 |
| A01 | phone, Phase 3 | FAIL: Tab reached none of cmpHit, cmpSill, cmpMin; the bring-back tab did not restore him after a minimize on a dense page | PASS: all four reached; minimize then bring-back works | 2, 3 |
| A02 | desktop and phone, reduced motion | OPEN (automated checks pass: 0 px translate, no sparks) | OPEN, same. The rig is drawn in WebGL, so only an owner visual check remains | 5 (see below) |
| Calm, idle "no continuous physics" | desktop and phone, Calm and OS reduced | FAIL: breath moved the head 1.09 to 1.25 px | PASS under the amended LC-DEC-040 checks (breath 2 px or less, tail x 0, roll 0, no slide, no particles) | 6b |
| Rollback, "menu shows the default choices" | 1440x900 and 390x844, malformed prefs | FAIL: the script read `select[data-set="outfit"]`, which is now radio inputs | PASS | 6a |
| UI09 | phone, strip | FAIL: figure box top 192 px, strip top 224 px | FAIL, unchanged (see Still failing) | not changed |
| A03 | desktop and phone, strip at 200% | FAIL: the same box clause as UI09 | FAIL, unchanged (see Still failing) | not changed |

Scratch checks (Playwright, not committed; values in `before-scratch-checks.json` and `after-scratch-checks.json`):

| Check | Before | After |
| --- | --- | --- |
| Room Settings Calm box, OS reduced motion | unchecked, enabled, no note | checked, disabled, "Your device asks for less motion." |
| Sprite lean in Calm (no WebGL) | translate -21 px | scale 0.96, no translation |
| Sprite poke in Calm (no WebGL) | translate -4 px | scale 1.04, no translation |
| Phone, dense Phase 3 page: minimize at the top, scroll to 865 px, press bring-back | still seated (hidden) after the tab | out (state window) |

## Fixes

1. Phase 3 honours the saved spot (LC-DEC-041).
   - `apps/web/lib/companion-logic.ts:91` `clearOf`: zero overlap with every control, padded by the 8 px margin that `controlSafeDock` (`:101`) already used.
   - `apps/web/components/companion/engine.ts:379-383`: the saved spot (or the anchored resize spot) holds in Phase 3 while `clearOf` is true. Legacy rooms keep their old rule. Chat rows are unchanged.
   - `engine.ts:394-396`: when the spot covers a control, docking falls back to `controlSafeDock` from `dockForPos(pos)`, then to the keyboard rule, then seats.
   - Arrow keys and drops use the same path (`moveFromKeys`, `endDrag`), so no change there.
2. Phone bring-back: `engine.ts:852` the bring-back tab sets `userSummoned = true` whatever `autoSeated` is. He then stays out at the least-covering spot until the page or tone changes, as the existing path does.
3. Phone Tab order.
   - `engine.ts:423` `keyboardDock`: while keyboard focus is in the room (inside his window, or a `:focus-visible` control in the room), a placement that finds no clear corner keeps him out. It takes the corner that keeps the focused control clear (`companion-logic.ts:115` `dockKeepingFocus`), then the corner under the fewest controls.
   - `engine.ts:988-989`: focus moving in or out of the room re-runs placement.
   - Mouse-only placement is unchanged: a control clicked with the mouse is not `:focus-visible`, so the seat still applies.
4. Room Settings Calm box: `apps/web/components/companion/companion.tsx:120` `useDeviceReducedMotion`; `:159-160` checked and disabled under OS reduced motion, with the same note the menu shows.
5. Calm lean and poke: `apps/web/components/companion/companion.css:97-98`. In Calm the two poses keep their drawing and ease the scale over 300 ms, with no translation.
6. Script drift (the two scripts the card allows).
   - 6a `scripts/lc-rollback-qa.mjs:282`: reads the checked outfit radio, or "none".
   - 6b `scripts/lc-calm-qa.mjs`: the strict "no continuous physics" check is replaced by the LC-DEC-040 reading: tail x and head roll under 0.2 (sway gone), head top and tail y under 2 px (breath allowed), no hop, no window slide (transform spread under 1 px), no sparks or hearts (only zzz), and the existing no-glance and no-spin checks. Flame flicker is not in the rig probe; it is covered by the unit test `calm mode: no flame flicker, no saccade jitter and no tail sway`, and is reported as OBSERVED.
   - 6c `scripts/lc-calm-qa.mjs:427`: the menu Calm box is a real check (checked and disabled under OS reduced motion), not an observation.
   - Tests: `apps/web/lib/companion-logic.test.ts`, three new tests: the 8 px rule, `dockKeepingFocus`, and the calm lean and poke rule.

## Why the Tab sweep failed on the phone (A01)

`.cmpHost` is the last child of `.roomWorkspace` (`apps/web/components/room/workspace.tsx:317`), after the whole mode surface. The Tab sweep reaches the page's controls first. On the 390 px quiz no corner is clear of them, so Tab 15 scrolled the page to y 406. That scroll re-ran placement, which seated him (`inert`, hidden). His controls then left the tab order and only the bring-back tab remained (press 25).

The card's rule ("focus inside his window") cannot apply to this path, because focus has not reached him yet. Fix 3 applies the same no-seat rule to keyboard focus on the room's page controls, and keeps the focused control clear.

## Deviations from the card

- The keyboard rule is wider than "focus inside his window": keyboard focus anywhere in the room counts (`:focus-visible`), for the reason above. Mouse behaviour is unchanged.
- The helper is named `clearOf`. The card's example name was `safeFreeSpot`, marked "e.g.".
- The calm check was changed twice in this task. The first after-run of the amended check failed on `window spread 78.4 px` (desktop, Calm on and OS reduced). The desktop header drawer folds about three seconds into an idle page (`.modeFrame[data-collapsed]` goes true), and the room's layout moves the window with it; a probe (`scratchpad`, not committed) showed the window moving from top 290 to 220 px as the drawer folded. That is page layout, not his motion. The check now measures his window's own transform (his slide) and records the layout move as info. The first run is kept as `after-calm-run1.json`.
- The two scripts write into tracked evidence folders (`LC-21`, `LC-19`, `LC-9`). I did not change their output paths. I copied the new JSON into this folder and restored the tracked files from HEAD, so only this folder changed.

## Still failing

- UI09 (phone, strip) and A03 (desktop and phone, strip at 200%). Both assert that the `.cmpStage` box top is at or below the strip top. LC-polish Fix 5 (in this branch) moved that box above the strip (192 px against a strip top of 224 px), so the drawn head sits about 5 px under the strip top (LC-polish's crop measurement; not re-measured here). The check measures the box, so it fails on the intended placement. Owner decision: change the check to measure the drawn head (`scripts/lc-companion-qa.mjs` is outside this card's file list), or move the art back down. Not changed here.
- A02 stays OPEN. Rig motion is drawn in WebGL, so DOM checks cannot see it; the owner's visual check is still needed. The automated part passes.
- Still OPEN, unchanged: UI03 (keyboard open and close, real rotation), UI05 phone (pinch), L02 to L06, V01 to V08 and A06 to A09.

## Not verified

- Real iPhone and iPad Safari, Firefox and Edge (A06, A07). Focus-visible behaviour in those browsers may differ.
- Performance (A08) and the 30, 60 and 120 Hz checks (V08).
- Flame flicker in the rig (covered by the unit test only).

## Files

- `before-companion.json`, `after-companion.json` (`lc-companion-qa.mjs`)
- `before-calm.json`, `after-calm-run1.json` (first after-run, superseded), `after-calm.json` (`lc-calm-qa.mjs`)
- `before-rollback-motion.json`, `after-rollback-motion.json` (`lc-rollback-qa.mjs --expect=motion`)
- `before-scratch-checks.json`, `after-scratch-checks.json` (scratch Playwright checks for the Calm box, lean and poke, and the phone bring-back)
