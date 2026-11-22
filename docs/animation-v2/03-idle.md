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

## Stage A revision (2026-11-21): blink ghosting and varied loops

The owner takeover re-opened the idle. I re-rendered 30 s and 60 s and reviewed them against [the principles](ANIMATION_PRINCIPLES.md).

**Defect found: ghosting in the blink.** At the closed-eye ticks the eyeball showed through a half-faded lid, and the lid crease crossed the pupil on the way back open. Cause: the lid opacity and the eye-bone squash reached their extremes on different ticks and the closure was a single-tick V. [Before and after, one tick per frame](evidence/stageA/blink-before-after.jpg). Fix: the eyes squash to 6 percent (not 23), the lid is fully opaque by the time the eye is half shut, the lid stays closed for 3 ticks (about 50 ms) and fades out while the eye is still about 40 percent open. The remaining overlap is 1 tick closing and about 2 ticks opening (under 35 ms each).

**Defect found: one 9 s loop repeated.** Blinks, glances and head tilts landed on the same beats every 9 s. The Character layer now chains three idle loops chosen at random with exit time at 100 percent: Idle (9.0 s), Idle B (10.0 s, mirrored glances, different blink beats) and Idle C (8.0 s, different blinks, no mirroring). Every loop starts and ends at the same rest pose, so any order is seamless. The 60 s render hits rest at exactly 9 s and 19 s (zero pixel difference from frame 0) and not at other multiples. Return from the reduced-motion and inspection modes restarts the idle at its first frame.

| Check | Result |
| --- | --- |
| Compile | `rive design/living-companion/rive/studigo --verify`: 0 errors, 0 warnings. |
| 60 s continuous render (24 fps, 360 px) | 1,441 frames. Mean adjacent-frame difference 0.17, maximum 0.80 (a blink). No adjacent-frame spike above 8x the median. Longest near-still stretch 0.21 s. |
| Identity | [30 s contact sheet](evidence/stageA/idle-30s-sheet.jpg) and [12 s GIF](evidence/stageA/idle-12s.gif): head, snout, frills, spike, vest, tail and flame stay registered. |
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
