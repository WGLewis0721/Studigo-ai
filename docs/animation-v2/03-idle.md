# Phase 3 — Continuous idle

**PASS · 2026-11-21.** One editable 540-tick loop at 60 fps on the existing Studigo rig. [30-second playback](evidence/phase3/idle-30s.mp4) · [60-second capture](evidence/phase3/idle-60s.mp4) · [Higgsfield comparison](evidence/phase3/higgsfield-v1-vs-rive-idle.mp4).

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

The exported [runtime candidate](../../apps/web/public/mascot/rive/studigo.riv) is 66,958 bytes with SHA-256 `677fc15d70708f717b65c1136a98e6eeab2e841a98cde276b68633617490f2bb`. Rive reports the approved Free-tier splash. This is a local export. Capture timing measures deterministic animation playback, not wall-clock browser performance.
