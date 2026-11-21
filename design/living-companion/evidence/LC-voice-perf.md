# LC voice and performance (H-L)

Status: built and checked on the dev server (port 3312) in Chromium. Still open before release: physical devices, a 10-minute heap soak, Safari and Firefox, and the owner's listen to the 14 lines.

- Branch `lc/voice-perf`, from `origin/claude/studigo-living-companion-upgrade-ee0706` at `79e226d`, which already includes the dressed art (fast-forward, no other base change).
- Raw results: [LC-voice-perf/](LC-voice-perf/) (browser JSON, two screenshots, heap samples, copies of the QA output in `qa/`).

## Results at a glance

| Check | Result |
|---|---|
| Voice plays on `correct` ("Nice."), cooldown and routine cap hold | Met in the browser |
| Voice switch silences him | Met: 0 plays while off |
| Lip sync: first non-silent analyser frame to mouth above 0.2 | 0 to 53 ms over 5 summons (target 80 ms); from the first loud frame, 0 to 36 ms |
| Calm drawing fade (OS reduced motion) | 305 ms to 95% opacity (was about 30 ms, a cut); normal 134 ms |
| Calm render rate | 30 draws per second (normal 58) |
| Rig backing store at DPR 3 | 480 px measured (was 600 by the old formula) |
| Network at mount, undressed | `center.webp` only (see the note on `support.webp` below) |
| Dressed drawings | explorer celebrate and far-left drawings load from `dressed/explorer/`; screenshots show the hat |
| Heap, 180 s idle, forced GC | before +13 KB per minute, after +22 KB per minute; each trace swings about 0.2 MB, so neither is a measured change |
| LC unit tests | 181 pass, exit 0 |
| Typecheck and lint | exit 0 and exit 0 |
| `lc-rollback-qa.mjs --expect=motion` | exit 0, 48 of 48 checks pass |
| `lc-calm-qa.mjs` | exit 0, no failing check (22 control checks pass, 22 observed rows) |

## Voice (LC-DEC-042)

Clips: the 14 take-B files from `assets/voice/studigo-benji/take-B/`, copied to `apps/web/public/mascot/voice/` under the readable names. Each copy matches its source by md5. The lines are `VOICE_LINES` in [companion-voice.ts](../../../apps/web/lib/companion-voice.ts), each with its file, the text its bubble shows, and the 2.0 s cut for `whatever-your-teacher`.

Triggers and rules (`planVoice`: pure, tested with an injected clock):

| Moment | Line | Rank |
|---|---|---|
| First time he is out in his window on this device | I'm Studigo. | priority |
| Learner summons him from his seat | I'm coming with you! | priority |
| `correct` at streak 3, 5 or 10; `setDone`; `cardGood` at streak 3, 5 or 10 | You knew that one! | milestone |
| `correct` at other streaks | Nice. | routine, at most one per 45 s |
| `missionComplete` | Come on! | milestone |
| `sessionReturn` | Oh! You're here early! | milestone |
| `wrong`, `blindspot`, `cardMiss` | One step at a time. | routine |
| `stall` level 1, level 2; `hintOpened` | Stuck? Okay. / Your turn! / Your turn! | routine |
| Coach room opened (half of the opens) | Got a test? / Ask me something! | routine |
| Materials room opened (half of the opens) | I'll show you the page! / Whatever your teacher handed out. | routine |

Rules: 12 seconds between any two lines (priority lines skip this), never the same line twice in a row, and the routine Nice at most once per 45 seconds. `correctFast` stays silent, as LC-DEC-036 asks. `how-sure.mp3` is in the table but has no trigger yet, because the companion has no confidence-prompt event.

Judgement calls (for the owner to confirm):

1. "First time he comes out of his seat" is built as the first time he is out in his window on this device. Most learners never send him to his seat, so a seat-only trigger would almost never fire.
2. `whatever-your-teacher` is not in the spec's list. It sits in the materials pool with `ill-show-you-the-page`.
3. The 45 second cap applies to routine Nice, as the spec words it. The other routine lines use the 12 second cooldown only.
4. The first meeting is marked when its playback starts. If the browser blocks audio, the mark is removed and the line plays on the next pointer or key press.
5. The bubble shows the line's text when playback starts, and only when speech is on. A line he speaks replaces the reaction's own bubble text, so one answer never says two things.
6. The Voice switch is saved per room, like Speech, and is on by default. Only a saved `false` turns it off.

Audio path (in [engine.ts](../../../apps/web/components/companion/engine.ts)): one `Audio` element per companion with `preload="none"`, and the source set on each line. The graph is built once: MediaElementSource, then an AnalyserNode (fftSize 512), then the destination. Each motion frame reads the loudness, clamp((rms - 0.01) * 6, 0, 1), into the amplitude driver of `createMouth`, and the result goes to `director.setMouth`. The AudioContext is created on the first line and woken on the first pointer or key press. Without Web Audio, the mouth pulses every 180 ms while the clip plays. A line stops on the next line, on destroy, when the page is hidden, when voice is switched off, when he goes to his seat, and at the 2.0 s cut. Nothing is recorded and the microphone is never used.

### Browser results (run 3: dev server, Chromium, autoplay allowed)

Five summons (priority lines, so the cooldown does not apply). Times in ms. "First non-silent frame" is the first analyser frame with rms above 0.005; "loud frame" is the first frame with rms at or above 0.043, which is the level that opens the mouth to 0.2.

| Sample | Play to playing | Playing to first non-silent frame | First non-silent frame to mouth above 0.2 | Loud frame to mouth above 0.2 | Mouth p50 / p90 |
|---|---|---|---|---|---|
| 1 | 138 | 76 | 34 | 34 | 0.41 / 0.99 |
| 2 | 73 | 186 | 1 | 1 | 0.49 / 0.98 |
| 3 | 55 | 78 | 53 | 36 | 0.33 / 0.96 |
| 4 | 32 | 138 | 0 | 0 | 0.45 / 0.98 |
| 5 | 38 | 136 | 0 | 0 | 0.47 / 0.99 |

The largest lag is 53 ms (target 80 ms). The sound's output latency is not in these numbers. The mouth leads the sound by the output buffer, and that is not compensated.

Cooldown and routing: a wrong answer, then four correct answers and a `setDone` within 13 seconds, produced one-step, then nice, then you-knew. Correct answers 1 to 3 and the `setDone` inside the cooldown stayed silent. With voice off, 0 lines played; with it back on, a milestone line played. With speech on, the bubble showed "Come on!" while that line played. No console or page errors.

First meeting on a fresh device: "I'm Studigo." played once at mount, and the met flag was set.

## Performance

### Drawings: lazy, dressed, and the rig standing in

- At mount, a companion with no outfit requests only `center.webp`. With an outfit worn, the mesh texture is `dressed/<outfit>.webp`.
- The director asks for a drawing when it first names its pose. The engine also asks for two sets: the gestures (celebrate, support, pet, poke, lean, sleep) on the first committed event, and the gaze drawings (left, right, up, down, up-right, down-right; up-left and down-left reuse the mirrored files) on the first pointer move in the room.
- A drawing shows only once it has loaded. Until then the rig stands in, so there is never a blank. A drawing that fails never shows, so he stays on the rig, which still wears the outfit.
- An outfit change re-points every drawing already requested to that outfit's files.
- Browser: the lazy check requested `center.webp` only at mount. The first committed event requested the six gestures; the first pointer move requested the six gaze files. On a fresh device the first meeting also requests `support.webp`, because the existing seat-to-window reaction names the support pose at mount, and the director asked for it then. The rule holds; that request is the director's own. In the dressed check, which seeds 30 points, the growth unlock celebration also asks for `celebrate.webp` at mount.
- Wearing the explorer hat: celebrate and far-left requested `dressed/explorer/celebrate.webp` and `dressed/explorer/left.webp`. Switching to goggles re-pointed the eight drawings already requested to `dressed/goggles/`. Screenshots at 2x: [celebrate-explorer.png](LC-voice-perf/celebrate-explorer.png) and [left-explorer.png](LC-voice-perf/left-explorer.png). The hat is visible in both.
- The sprite renderer (motion off) is unchanged and stays undressed.

### Calm

- Calm draws every other frame, so 30 Hz. The director steps from the clock, so the motion is the same: a unit test runs 600 frames at 60 Hz against 300 draws at 30 Hz and gets the same numbers and the same particles.
- A drawing swap fades over 300 ms in calm. The rule is in [companion.css](../../../apps/web/components/companion/companion.css): `.cmp[data-calm] .cmpPose, .cmp[data-calm] .cmpRig { transition-duration: 300ms !important }`. Its higher specificity outranks the `*` reduced-motion rule in `globals.css`, which was not edited.
- Browser, OS reduced motion emulated: the celebrate drawing reached 95% opacity in 305 ms (transition 0.3s) and the rig drew 30 times a second. Normal: 134 ms (0.13s) and 58 draws a second.

### Canvas backing store

The cap is now `min(2, max(1.5, dpr))` (it was 2.5), with the 640 px ceiling kept.

| Device pixel ratio | Before (old formula, computed) | After (measured in Chromium) |
|---|---|---|
| 1 | 360 | 360 |
| 2 | 480 | 480 |
| 3 | 600 | 480 (36% fewer pixels) |

### Heap and per-frame allocation

Method: headless Chromium on the dev server, route `/demo/room?mode=quiz`, idle for 180 seconds. Each sample forces a GC with `HeapProfiler.collectGarbage` and reads `Runtime.getHeapUsage`; samples are taken at 0 and every 30 seconds.

| Build | Start (bytes) | End (bytes) | Change (bytes) | Per minute (bytes) |
|---|---|---|---|---|
| Before (79e226d) | 13,287,620 | 13,327,760 | +40,140 | +13,380 |
| After | 13,021,188 | 13,086,144 | +64,956 | +21,652 |

Samples every 30 seconds (bytes): before 13.29, 13.24, 13.38, 13.45, 13.40, 13.41, 13.33 MB; after 13.02, 13.14, 13.11, 13.23, 13.24, 13.19, 13.09 MB. Each trace moves up and down by about 0.2 MB, so the difference between the two builds is not a measured change. Heap does not show a retained leak in either build over three minutes.

Finding. The motion loop made two new empty arrays on every frame, because the frame's effect and cue lists were replaced on each call. Beat substeps also made a new `[]` for each missing track while a beat played. That is garbage: it churns the young generation, but a forced GC removes it, so it cannot show as growth in this measure. Both are gone now. The lists are swapped and cleared, and shared empty lists replace the `[]`. No `getBoundingClientRect` call runs per frame in the motion loop; placement runs on events. The LC-1 figure (+0.49 MB per minute) did not reproduce in this 3-minute sample of either build. A 10-minute soak is still needed before calling it not growth.

### Removed

- Outfit-slot code from [rig.ts](../../../apps/web/lib/companion-motion/rig.ts): `RIG.slots` and `poseHeadPoint`. The head-depth test keeps its coverage with the same check written inline.

## QA

- `node --import tsx --test lib/companion-*.test.ts lib/quiet-feedback.test.ts lib/mobile-lessons.test.ts` in `apps/web`: 181 pass, exit 0. New tests: `companion-voice.test.ts` (table, planner, cooldown, caps, room rolls), the voice preference in `companion-logic.test.ts`, and the 30 Hz equivalence test in `companion-motion.test.ts`.
- `npx tsc --noEmit -p .` in `apps/web`: exit 0.
- `pnpm --filter @studigo/web lint`: exit 0.
- `STUDIGO_QA_BASE=http://127.0.0.1:3312 node scripts/lc-rollback-qa.mjs --expect=motion`: exit 0, "LC-9 motion: PASS (48/48 checks passed)". Output: `qa/lc-9-rollback-motion.json` and `.log`.
- `STUDIGO_QA_BASE=http://127.0.0.1:3312 node scripts/lc-calm-qa.mjs`: exit 0. Output: `qa/lc-19-calm-results.json` and `qa/lc-19-calm.log`. Both conditions on both viewports pass, including the menu Calm toggle and the OS reduced-motion checks.
- Both QA scripts write into `evidence/LC-9` and `evidence/LC-19`. Their output was copied into [LC-voice-perf/qa/](LC-voice-perf/qa/), and the tracked files in those folders were restored, so this branch does not change them.

## Open

- A physical iPhone 12 and a low-end Android: frame p95 and companion cost (LC-1 items 1 and 3 are still open).
- A 10-minute heap soak on desktop and phone.
- Safari and Firefox: the AudioContext routing, WebGL fallback, and the lip-sync path.
- The owner's listen to all 14 lines, and confirmation of judgement call 1. `how-sure.mp3` has no trigger yet.
