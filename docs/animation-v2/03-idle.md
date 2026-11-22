# Phase 3 — Continuous idle

**PASS · 2026-11-21.** One editable 540-tick loop at 60 fps on the existing Studigo rig. Recordings are kept locally outside git (no video files are committed). The committed evidence is stills and a short GIF, with the recordings identified by SHA-256 below.

The feet stay planted. Torso and belly reach their breath peaks on different frames. The eyes start moving 10–13 ticks before the head tips, and the neck eases independently in pitch. The two blinks close in about 67 ms then reopen more slowly. Tail mid follows its root by 15–21 ticks and the flame follows the tip with its own short scale and rotation changes. Every channel returns to its authored rest at the seam. This transfers V1's breathing, blink and overlap without adopting the source's wider camera-facing turns, changing frills or moving ground. Pet, thought and the hop remain distinct future reactions.

| Check | Result |
| --- | --- |
| CLI compilation and resolved rig | 0 errors, 0 warnings and 0 inspect problems on Rive 1.10.0. |
| One and five loops | At 540 × 540, frames 539, 540 and 541 differ from the bind frame by zero pixels at a 1% AE tolerance. At 360 × 360, the start image is byte-identical at 9, 18, 27, 36 and 45 s. |
| Continuous playback | One Rive instance advanced through 3,600 ticks without reload. Captured 1,441 lossless renders at 24 fps including the 60 s endpoint. No adjacent captures had identical SHA-256. FFprobe verified 1,440 encoded frames over 60.000 s and 720 over 30.000 s. |
| Visual continuity | Reviewed the [idle poses](evidence/phase3/idle-poses.jpg), [adjacent seam](evidence/phase3/loop-seam.jpg) and [sampled soak](evidence/phase3/idle-soak-samples.jpg). The face and limbs remain registered to the skin with no visible portrait exchanges, detached parts or seam jump at the reviewed frames. |
| Viewport | At 240 × 320 and 720 × 540, the contained render preserves proportions and fits the full tail and feet. [Viewport captures](evidence/phase3/viewport-and-calm.jpg). |
| Reduced motion | While in idle and again at a blink, switched `mode` to 2. The next frame returned to the static neutral with zero pixel difference and remained identical after more ticks. The app will map system preference in Phase 6. |

## Reproduce

```powershell
rive design/living-companion/rive/studigo --verify
rive design/living-companion/rive/studigo
rive design/living-companion/rive/studigo --data=mode=1
rive design/living-companion/rive/studigo --data=mode=2
./scripts/living-companion/record_animation_v2_idle.ps1 -OutputDirectory ./animation-evidence -Seconds 60
rive design/living-companion/rive/studigo --publish=local
```

`mode` is the numeric property on the default `Studigo Controls` view model. 0 is idle, 1 is the rig inspection, 2 is the reduced-motion still. The state machine runs on artboard `Studigo` and is named `Studigo Motion`.

The runtime candidate at Gate 3 was 66,958 bytes with SHA-256 `677fc15d70708f717b65c1136a98e6eeab2e841a98cde276b68633617490f2bb`. The [current export](../../apps/web/public/mascot/rive/studigo.riv) follows the latest passing gate. Rive reports the approved Free-tier splash on local export. Capture timing measures deterministic animation playback, not wall-clock browser performance.

## Stage A revision 1 (2026-11-21, superseded by rework 2 below): blink ghosting and varied loops

The owner takeover re-opened the idle. I re-rendered 30 s and 60 s and reviewed them against [the principles](ANIMATION_PRINCIPLES.md).

**Defect found: ghosting in the blink.** The first fix still faded the lid and was rejected in review; see rework 2 below. The earlier before and after stills were removed.

**Defect found: one 9 s loop repeated.** Blinks, glances and head tilts landed on the same beats every 9 s. The Character layer now chains three idle loops chosen at random with exit time at 100 percent: Idle (9.0 s), Idle B (10.0 s, mirrored glances, different blink beats) and Idle C (8.0 s, different blinks, no mirroring). Every loop starts and ends at the same rest pose, so any order is seamless. The 60 s render hits rest at exactly 9 s and 19 s (zero pixel difference from frame 0) and not at other multiples. Return from the reduced-motion and inspection modes restarts the idle at its first frame.

| Check | Result |
| --- | --- |
| Compile | `rive design/living-companion/rive/studigo --verify`: 0 errors, 0 warnings. |
| 60 s continuous render (24 fps, 360 px) | 1,441 frames. Mean adjacent-frame difference 0.17, maximum 0.80 (a blink). No adjacent-frame spike above 8x the median. Longest near-still stretch 0.21 s. |
| Identity | See rework 2. |
| Reduced motion | `--data=mode=2`: the frame at tick 0, 30 and 630 is identical. |
| Browser (Chrome 151, shipped component) | The showroom suite passes with the new `studigo.riv` (idle, keyboard, touch, 7 outfits, flame, calm, instances, remount, asset 404, context loss). A 32 s real-time browser recording ran with no console errors. |

Recordings (local, not in git): `C:/Users/Willi/Dev/Learning/av2-evidence-videos/`

| File | SHA-256 |
| --- | --- |
| stageA-rive-idle-60s-cli-360.mp4 | `3b8e84069821eb0b82994bd8aed8ff4f09027586025bd9fb3bf29926a3af1d61` |
| stageA-browser-idle-32s.mp4 | `ae4be4e8db58241300a94ad946ac8cc58e6b2d99601ce97a9d352bd77d655ecd` |
| idle-30s.mp4 (original phase 3, removed from git) | `f1532f753c1a61c3a0835a6f1a5683113a9417c58c81cb0221cd577c8299f9f2` |
| idle-60s.mp4 (original phase 3, removed from git) | `b4678a0c037db88db468fceb4fc7b6dce56b353802789d2367490c69089769c0` |
| higgsfield-v1-vs-rive-idle.mp4 (original, removed from git) | `9d209706a3cdcfc6e825372c323e377d5b5b5735c1ac1c9bce6ce91a3b28967d` |

Browser recording command: `STUDIGO_QA_BASE=http://127.0.0.1:3328 node scripts/living-companion/studigo-idle-browser-record.mjs <outDir> 30`. The dev server must start from `apps/web` (the Rive runtime route reads `process.cwd()/node_modules`); started from the repo root the wasm route returns 500 and the character never leaves its still.

**Open for a live human review:** whether the restrained idle reads as alive at real speed, and whether the 8 to 10 s random chaining feels natural. Frame statistics cannot settle that. The idle is still conservative (breath, blink, glances, small tilts, tail and flame overlap) by design.

## Stage A rework 2 (2026-11-21): physical lids and more amplitude

The orchestrator's review failed the first Stage A pass on two points: the blink was still a crossfade, and the idle read as a still next to V1.

**Blink rebuilt as a physical lid.** The closed-eye overlay is no longer faded. Each eye has a skin-colored lid shape (38 by 36, gradient matched to the face, thin dark lower-edge line) whose origin is the top of the eye socket. Its scale-Y slides it down over an unchanged eye and it is always opaque. The eye bone squashes 14 percent under it as follow-through. Closing takes 3 ticks, the hold 3, the opening 8 with ease-out (60 fps ticks). The right lid trails the left by one tick. [One tick per frame, 21 frames](evidence/stageA/blink-1tick-strip.jpg): every frame shows either the open eye or an opaque lid, with no pupil or crease showing through. Sleepy and petting use the same lid (their keys were remapped, and their lid fades removed); both render closed eyes correctly.

**Amplitude.** Within what the art holds, measured on the rig (head roll is capped at 0.12 rad by the rig's constraint, so tilt stays under about 6 degrees on glances; the snout, eyes and head translate for parallax):

- Glances: anticipation dip opposite the look, eyes lead by 5 to 8 ticks, then snout, head (about 8 px and 0.105 rad) and frills (lagging, 0.15 rad), with a brow lift.
- Weight shift hip to hip (pelvis about 8 px), the torso and shoulders counter, the legs counter-translate so the feet stay planted.
- Arms drift with the breath (shoulders 0.075 rad, forearms 0.11 rad, lagging); breath reads in chest, belly and a hair of head lift.
- One personality beat per loop: tail flick with flame overshoot (Idle), shrug plus arm scratch (Idle B), squint-smile with a half-closed lid, head tilt and belly bounce (Idle C).
- Continuous micro-drift between beats (head, eyes, snout, brows, frills, arms; integer cycles so the loop closes).

The source is generated, so every number above is one line: `node scripts/living-companion/build-studigo-idle.mjs` rewrites the three idle animations and the lids in `scene.rml`. The generator samples curves, so `rive --verify` reports about 65 sampled-curve style warnings and 0 errors.

| Check | Result |
| --- | --- |
| [Side by side with V1](evidence/stageA/v1-vs-rive-2fps.jpg) | V1 left, Rive right, 2 fps, same crop height. V1 still moves more: it turns three-quarter, opens its mouth and hugs the vest, which the front-facing art cannot do without breaking identity. The Rive idle now shifts weight, leans, glances with parallax, drifts the arms and flicks the tail. |
| [Rive 2 fps tile, 10 s](evidence/stageA/idle-2fps-10s.jpg) | Mean absolute pixel difference between adjacent half-second frames is 2.8 to 14.8 (was 1.5 to 14.1 before the micro-drift), so every adjacent pair changes. |
| 60 s continuous (24 fps, 360 px) | Frame at 9 s and 19 s differs from frame 0 by 0.01 (the loop closes exactly). Adjacent-frame difference: median 1.0, maximum 4.3, no spike above 6x the median, no still stretch. |
| Feet | Right foot's rightmost orange pixel is fixed at x 329 and toe row 455 through the 9 s loop. |
| Reduced motion | Unchanged: `mode=2` still returns the static neutral. |
| Browser (Chrome 151) | `studigo-v2-showroom-qa.mjs`: idle, keyboard, touch, 7 outfits, flame, calm, instances, remount, asset 404 and context loss all pass with the republished `studigo.riv` (209,212 bytes, Free-tier splash). A 30 s browser recording shows no console errors. |

Local recordings (not in git), `C:/Users/Willi/Dev/Learning/av2-evidence-videos/`:

| File | SHA-256 |
| --- | --- |
| higgsfield-v1-vs-rive-idle-stageA2.mp4 | `3a7f6387eefe5ecd4c7cf6face23a1eb112a64f674039a9cbe88aaa8a2eb31fe` |
| stageA2-rive-idle-60s-cli-360.mp4 | `4f445b1a015b007775cad27ed570794b4d9e0f97bce2c8f9e4eb985b25687bc3` |
| stageA2-browser-idle-30s.mp4 | `f935e876b50dd0fa8c9be55a3b9b2cc3f71736de2c6d9386519328b80ea96f1a` |

**Still open:** a human viewing at real speed. The amplitude is bounded by the front-facing art: head turns come from parallax and translation, not a rotated head, so large three-quarter turns need new art (a separate Higgsfield reference and a second skin) and are not attempted here.

### Loop seam and pop check (headless capture tool)

`node scripts/living-companion/rive-idle-capture.mjs --seconds 30 --fps 30 --out <scratch dir> --evidence docs/animation-v2/evidence/idle-capture` ([summary, CSV and contact sheets](evidence/idle-capture/)). It found a real defect in the first pass of this rework: the breath curves did not start at rest, so the generator's forced rest value at tick 0 and at the loop end made a step (frame 1 flagged at 3.8x the median, plus a seam jump). Each breath component now starts and ends at zero. After the fix the frame at tick 0 and the frame one loop later differ by 0.001 (mean absolute difference), frame 1 is no longer flagged, and first-versus-last-frame difference is 1.3, one ordinary step.

Remaining pop candidates (step above 3x the median) are frames 83 to 90 (ticks 166 to 180, the middle of the weight shift) and 153 to 155 (the tail flick). Both are bell-shaped speed curves that rise and fall over 8 to 10 frames, not discontinuities, and the large pixel area of a whole-body shift is what raises the number. The old-rig candidates at frames 24 to 26, 67 to 73 and 151 to 154 were the single-tick blink closure and the full-opacity lid pops; the first two no longer appear. The "N versus N+loop" columns differ by design because the state machine chains three different loops at random. The tool treats `rive inspect` warnings as non-fatal (only errors stop it).
