# Phase 2 — Primary Rive rig

**PASS within the Phase 1 amplitude envelope · 2026-11-21.** The source is [scene.rml](../../design/living-companion/rive/studigo/scene.rml). Run `rive design/living-companion/rive/studigo --data=mode=1` from the repository root to see the diagnostic timeline.

The `Studigo` artboard carries one continuous skinned surface. The 307 vertices and 589 triangles share one texture, with up to four influences per vertex. The texture is the approved full-body neutral at `apps/web/public/mascot/companion/full/center.webp` (SHA-256 `4dc1a128970096d4ecfd5bacf282d279fba55bc414ee05c3753778ee22b05926`). The RML links the tracked original. No duplicate full-body art, cropping step or network asset is needed. The soft closed-lid patches are editable Rive shapes registered to the head. Their color and extent were tuned against the approved skin and eyelid outlines.

The three approved puppet files were inspected. The armless plate is a waist-up crop with a slightly different vest and flame edge, and its loose arms would require registering to a different camera crop and reconstructing the full body under both arms. The current rig uses the full-body source to preserve identity and retains the puppet parts for wider arm movement if that is needed.

## Pivot map

World coordinates are in a 540 × 540 neutral, in viewer directions. The bones are parented in RML, with relative transforms and world bind coordinates on the tendons.

| Joint | x, y |
| --- | --- |
| Root at floor, pelvis, torso, chest | 270,520 · 270,435 · 270,331 · 270,355 |
| Head, snout, jaw | 268,246 · 268,220 · 268,238 |
| Lid and eye L/R | 224,191 · 311,191 |
| Brows L/R | 222,166 · 314,166 |
| Frills L/R, spike | 200,170 · 337,170 · 268,134 |
| Shoulders L/R, forearms L/R | 211,305 · 329,305 · 187,363 · 353,363 |
| Legs L/R, feet L/R | 202,440 · 336,440 · 194,494 · 344,494 |
| Tail root, mid, tip, flame | 185,431 · 150,388 · 129,332 · 117,300 |

Head movement carries the face and frills. The neck connects through interpolated torso weights. Eye aim and snout translation supply shallow parallax. A local roll constraint caps head roll at 0.12 rad. The shoulders and tail use graded weights at their attachment points. Test shoulders to 0.12 rad and forearms to 0.08 rad before using them in idle. Wider shoulder rotation tugged adjacent skin in the first capture. The turnaround range stays inside the Phase 1 envelope. The effects container reserves the position for particles in the later behavior phase.

## Validation

- `rive design/living-companion/rive/studigo --verify` passed on CLI 1.10.0 with zero warnings and zero errors. `rive inspect design/living-companion/rive/studigo --summary` reported zero problems, one artboard, one skin and 28 bones.
- [Bind frame](evidence/phase2/rig-bind.png) preserves the approved pixels and silhouette. [Inspection sheet](evidence/phase2/rig-inspection.jpg) shows frames 0, 45, 90, 142, 164, 181, 235, 273, 352, 378, 465 and 540 at 60 fps. Check left/right head and gaze, independent lids, jaw, arms, tail/flame extremes and torso/leg blend. The contracted pose range keeps the features attached. Frames 0 and 540 had zero differing pixels under ImageMagick AE.
- The inspection is a rig diagnostic with one render path. The expressive idle, 30-second playback and app runtime export are separate gates. Test wider arm gestures with fresh evidence before expanding the range.
