# LC-polish: Calm, WebGL recovery, the stall look, strip size, stage-5 ghosting

Task card H-I. Branch `lc/polish-fixes`, from `origin/claude/studigo-living-companion-upgrade-ee0706` at `542ae8c`. The product changes are not pushed, merged or deployed. Browser checks ran against `next dev` on `127.0.0.1:3307` with this working tree.

## Fixes

### 1. Calm is gentle, not frozen (LC-DEC-040)

Kept in calm (Calm pref or OS reduced motion): slow blinks, breathing at about 14 a minute with 0.4 of the lift, expression fades over 300 ms, small nods, slow eye drift, and the idle ladder (lean, sleep).

Removed in calm:

- Idle head-turn glances: [engine.ts](../../../../apps/web/components/companion/engine.ts) `glance()` and the sprite `tick()` glance return early when `calm`.
- Flame flicker: [director.ts](../../../../apps/web/lib/companion-motion/director.ts) `flicker` is 1.
- Saccade jitter: [director.ts](../../../../apps/web/lib/companion-motion/director.ts) draws the same random numbers as the normal run and drops the jitter, so the wander does not change.
- Tail sway, tail lag and tail wag: [director.ts](../../../../apps/web/lib/companion-motion/director.ts) `tailTarget` is 0; `wag` joins `CALM_DROPS` in [beats.ts](../../../../apps/web/lib/companion-motion/beats.ts).
- Hops, spins, dashes, shivers and landings: `CALM_DROPS` (unchanged apart from `wag`).
- Sparks and hearts: `CALM_PARTICLES` is `zzz` only. The engine already dropped them.
- The celebrate drawing pop (1.14x, 9 px up) and the window slide: [companion.css](../../../../apps/web/components/companion/companion.css) scopes both with `:not([data-calm])`.
- Sprite fallback only (motion off, or no WebGL): the body breath stops and a slower, smaller stage breath (5.6 s, 0.8 px) takes over, so OS reduced motion still breathes.

Tests: [companion-motion.test.ts](../../../../apps/web/lib/companion-motion.test.ts) adds "no flame flicker, no saccade jitter and no tail sway", "a tail wag from a beat does not move the tail", and "calm mode breathes slower and smaller, and keeps his blinks". The old calm test now asserts no tail motion and no sparks or hearts.

### 2. Menu Calm box under OS reduced motion

[engine.ts](../../../../apps/web/components/companion/engine.ts) `openCard()`: the box is checked when `calm` (OS or pref). Under OS reduced motion it is disabled and carries the note "Your device asks for less motion." With the OS setting off, toggling works as before. Checked in the browser: normal, toggled on (saved, `data-calm` set), toggled off again; OS reduced: checked, disabled, note shown.

### 3. WebGL context restored

- [rig-renderer.ts](../../../../apps/web/components/companion/rig-renderer.ts): the GL program, buffers and texture are built by `setUp()` and `upload()`, so they can run again. `webglcontextrestored` on the rig's canvas calls `restore()`, which rebuilds on the same context and then calls `onRestored`. `park()` detaches the rig's markup and keeps it alive; `resume(body)` puts it back. If a restore fails, he stays on his drawings and the next restore event tries again.
- [engine.ts](../../../../apps/web/components/companion/engine.ts): `fallBack()` keeps the director in `parked` and parks the rig (automatic sprite fallback on loss is unchanged). `restoreRig()` brings the rig back with the same director, so mood, streak and tricks carry on. The rig's canvas is detached while parked, so a lost context leaves no `.cmpRig` in the page (this is the state `lc-rollback-qa.mjs` checks).

Verified in the browser (Playwright, scratch scripts outside the repo): `loseContext()` gives 15 drawings, 2 eyelids and no `data-motion`; a correct answer celebrates on the drawings. `restoreContext()` brings back `.cmpRig[data-ready]` and `data-motion`; a correct answer then celebrates on the rig, with no page errors.

### 4. Stall level 2 looks at the hint

[engine.ts](../../../../apps/web/components/companion/engine.ts) `lookAtHint()`, called from `answer()` for `stall` with level 2 in motion mode: it finds a visible `.learnDockHint` (or `button[aria-label='Give me a hint']`) and calls `lookAt(centre, 2500)`. The stall2 beat still plays. With no visible hint only the beat plays. Nothing is clicked or focused.

Verified on `/dev/study?learn=mission` after "Start learning" and "Start question": the hint is visible, and the pose trace goes from centre to `up-left` (the hint is up and to the left of his window) for about 2.5 s and then back to centre. The click and focus counters stay at 0.

Pre-existing, not changed: [learn-mission.css](../../../../apps/web/app/learn-mission.css) line 60 hides his window while a `.learnReading` panel is in the DOM (`body:has(.learnReading) .cmp { display: none }`). On that route he is hidden while the reading panel is open.

### 5. Phone and desktop strip size

[companion.css](../../../../apps/web/components/companion/companion.css): the figure scale is `--strip-k` (0.952 on wide screens, 0.823 on phones), and the figure is positioned so the art's top (its frills, at 49 of 400 units) sits 5 px under the strip's top edge: `top: calc(5px - 50px * var(--strip-k))`. The stage's bottom edge is the rail, so the rail cuts him at the chest. The strip slot height (56 px and 64 px), the rail and the header are unchanged. The bubble, the unlock badge and the particle band use `--strip-fig`, so they clear the bigger figure.

[companion-logic.test.ts](../../../../apps/web/lib/companion-logic.test.ts) pins the phone `--strip-k` value; its expected value changed from `.5` to `.823` (this file was not on the card's list; the change follows from the scale change).

Measured (`evidence/LC-polish/strip-*.png`, DPR 2): see the table under "Verification".

### Gaze anchor corrected (found while checking Fix 4)

[engine.ts](../../../../apps/web/components/companion/engine.ts) `eyes()` set his gaze origin 46 px down the window, and the strip used 41 px down the stage. The rig draws the eyes at art y 156 of 400, under the body's scaled top (36.25 + 0.28125 × 156 = 80.1 px down the window), so the origin sat 34 px above the eyes. That error changed pointer-follow for every drawing, not only the hint look. It is now 80 px in the window and 75 px in the stage (`EYE_DOWN`, line 58; `eyes()`, line 495).

Probe (a scratch Playwright script outside the repo, not committed): the pointer at a point up and to the left of his window draws `up-left` with the corrected origin. The same point reads `left` at the old origin (computed from the same formula). A point level with his eyes, to the left of his window, draws `left`.

### 6. Stage-5 "doubled frills": a crossfade, not a rest-state bug

Reproduced with `grow(600)` on the Champion stage (`data-stage="5"`). At rest, two seconds after the beat, only the rig is visible: `.cmpRig` opacity 1, no `.cmpPose` with opacity above 0. The stage glow (`.cmpScreen::before` and `::after`) sits behind the figure and draws no frills.

The doubled look is the 130 ms crossfade of the celebrate (or support) drawing over the rig. A celebrate drawing is 14% larger and 9 px higher, so its frills do not line up with the rig's frills during the fade. At 50% each, both show (`evidence/LC-polish/stage5-crossfade-mid.png`, against `stage5-rest.png`). LC-DEC-026 and LC-DEC-032 allow a crossfade of 200 ms or less, so nothing was changed.

## Verification

Run against the working tree on top of `542ae8c`, with `next dev` on 127.0.0.1:3307. The final code is the state after the gaze anchor change; every result below was produced on that state.

### Tests, typecheck and lint

| Check | Command | Result |
| --- | --- | --- |
| Living companion tests | `node --import tsx --test lib/companion-*.test.ts lib/quiet-feedback.test.ts lib/mobile-lessons.test.ts` (apps/web) | 166 pass, 0 fail, exit 0 (163 before: three tests added, one calm test replaced) |
| Typecheck | `npx tsc --noEmit -p .` (apps/web) | exit 0 |
| Web lint | `pnpm --filter @studigo/web lint` | exit 0 (AI provider boundary ok) |
| Root lint parts | `check-engineering-paths.mjs`, `check-design-inventory.mjs` | both exit 0 |

### Calm and reduced-motion QA (`scripts/lc-calm-qa.mjs`)

Exit 1. Counts: 22 control PASS, 36 PASS, 16 OBSERVED, 4 FAIL, 0 control failures. The run was made twice, before and after the gaze anchor change, with the same verdicts. The final run is in [calm/](LC-polish/calm/) (`results.json`, one crop per condition). The historical LC-19 files are unchanged.

A02 under the amended LC-DEC-040 reading (slow breath and blinks kept, the drawn celebrate offset and idle glances gone):

| Clause | Result |
| --- | --- |
| No sparks or hearts after setDone, tickle or celebrate, in Calm and OS reduced | PASS (0 in all four runs) |
| No hops or spins (whole-body translate under 4 px, no scaleX flip) | PASS (0 px) |
| No autonomous head-turn drawings in 20 s idle | PASS (none; the normal run still draws glances) |
| No beat drawings in 20 s idle | PASS |
| No CSS animation on `.cmpBody` | PASS |
| Literal "no continuous physics" | FAIL in the four Calm and reduced rows (desktop B and C, phone B and C): top of head 1.09 to 1.18 px, tail x 0 px, tail y 0.38 px, roll 0 deg, hop 0 px over 20 s |

The four FAILs are the breath and the eye drift: the tail x is 0 (no tail sway), and the tail y is the lower body rising with the breath. The check encodes the strict reading that the amendment replaces, so it is expected to fail. The spec section 12 verdict is PASS.

Also seen: the menu Calm box under OS reduced motion reads checked. Normal control reactions still work: setDone draws 40 sparks, a hop of 17.96 rig px (23.94 drawn px), a scaleX flip, and idle glances.

### Rollback QA (`scripts/lc-rollback-qa.mjs --expect=motion`)

Exit 1: 46 of 48 checks pass ([motion.json](LC-polish/rollback/motion.json), [1440x900](LC-polish/rollback/motion-1440x900.png), [390x844](LC-polish/rollback/motion-390x844.png)). The two failures are the same check at both viewports, "his menu shows the default choices" under malformed prefs. The script reads `select[data-set="outfit"]`, but the outfit control has been radio inputs since the growth commit (`outfitsHtml`, [engine.ts](../../../../apps/web/components/companion/engine.ts), unchanged here), so the check throws before it reads the rest of the menu defaults. This is script drift, not a companion fault. The card forbids editing `scripts/*.mjs`, so the selector needs a one-line change by the LC-9 owner.

Checks that matter here, all PASS: the lost-context case (sprites replace the rig within 1 s; `.cmpRig` leaves the page; two eyelids; no `data-motion`; a correct answer still reacts); the WebGL-unavailable case (sprites, 15 drawings); the motion route (`data-motion`, rig `data-ready`, celebrate within 1 s); malformed prefs survive a reload; no page errors.

### Lost and restored WebGL, menu and celebrate (scratch Playwright, same server)

- `loseContext()`: 15 drawings, no `.cmpRig`, no `data-motion`. A correct answer celebrates on the drawings.
- `restoreContext()`: `.cmpRig[data-ready]` and `data-motion` return, with no eyelids. A correct answer celebrates on the rig. Then he rests with the rig at opacity 1 and no drawing shown. No page errors.
- Menu Calm box: unchecked by default. Toggled on: saved `calm: true`, `data-calm` set. Toggled off: saved `false`. Under OS reduced motion: checked, disabled, with "Your device asks for less motion."
- Celebrate, normal: window `matrix(1, 0, 0, 1, -21.8, 0)` and drawing `matrix(1.14, 0, 0, 1.14, 0, -9)`, 22 sparks. Calm: both `none`, 0 sparks.

### Stall level 2 on the learn mission

`/dev/study?learn=mission`, after "Start learning" and "Start question": the hint is visible at (359, 314), and his window is docked bottom right. The pose trace goes from centre to `up-left` for about 2.5 s, then back to centre. Clicks on the hint: 0. Focus: 0. The active element does not change. With no visible hint, only the stall2 beat plays, and its own gaze cue draws `down-left`.

Caveat, not changed: [learn-mission.css](../../../../apps/web/app/learn-mission.css) line 60 hides his window while a `.learnReading` panel is in the DOM (`body:has(.learnReading) .cmp { display: none }`). On that route the look cannot be seen while the reading panel is open.

### Strip size (crops: [strip-375.png](LC-polish/strip-375.png), [strip-390.png](LC-polish/strip-390.png), [strip-1440.png](LC-polish/strip-1440.png), DPR 2)

| Width | Strip height | Head top below strip top, before to after | Rail: stage bottom minus strip bottom | Visible figure | Eyes and mouth from strip top |
| --- | --- | --- | --- | --- | --- |
| 375 | 56 | 25.0 to 5.0 px | 0.7 px | 51 px | 29.8 and 41.8 px |
| 390 | 56 | 25.0 to 5.0 px | 0.7 px | 51 px | 29.8 and 41.8 px |
| 1440 | 64 | 28.6 to 5.0 px | 1.2 px | 59 px | 33.7 and 47.6 px |

The rail figures were read during the strip's 0.3 s height transition (55.4 and 62.8 px), so they are about a pixel off. The layout heights are 56 and 64. The header drawer also folds the strip away about three seconds after load (existing behaviour); the measurement waits for it to be open.

### Stage 5 (crossfade check)

- At rest (`grow(600)`, then the beat ends): stage 5, pose `center`, rig opacity 1, no drawing visible. Crop: [stage5-rest.png](LC-polish/stage5-rest.png).
- Halfway through a 130 ms crossfade (transitions paused at 65 ms): rig 0.5, celebrate drawing 0.5, both visible. Crop: [stage5-crossfade-mid.png](LC-polish/stage5-crossfade-mid.png). This is the doubled look, and it is a crossfade.

## Deviations and open items

- [companion-logic.test.ts](../../../../apps/web/lib/companion-logic.test.ts) was not on the card's list. One regex changed (`--strip-k: .5` to `.823`), because the test pins the phone scale that Fix 5 changes.
- The gaze anchor change (see above) was not on the card's list. It corrects an error that also affects the hint look. Revert the two lines if the owner prefers the old origin.
- The Room Settings Calm box ([companion.tsx](../../../../apps/web/components/companion/companion.tsx), `RoomCompanionSettings`) still reads `prefs.calm` only, so under OS reduced motion it shows off. companion.tsx was not on the card's list.
- The `lean` (-21 px) and `poke` (-4 px) drawing offsets still apply in calm. The card names only the celebrate offset, so these are unchanged.
- The learn-mission window hiding (above) and the outfit selector drift in `lc-rollback-qa.mjs` predate this work.
- Not verified: iPhone and iPadOS Safari, Firefox and Edge, a real GPU context loss (only the extension's simulated loss), and a production build.
