# Living Companion — asset and approved-concept manifest

Status labels: **APPROVED-BY-OWNER** (William approved in the Oct 15–16 ChatGPT session, per the handoff artifact), **CANONICAL** (in repo, brand authority).

## Owner-approved concept videos (design references only, not product screenshots or performance evidence)

| ID | What | URL | Owner response | Status |
|---|---|---|---|---|
| V1 | Living Studigo, character only, 12 s, Kling 3.0 Pro, anchor `apps/web/public/mascot/companion/full/center.webp` | https://d8j0ntlcm91z4.cloudfront.net/user_3IkKBBXHZvEZQt2d8pBaRYd083T/hf_20261015_163130_6647ad5b-1046-436d-85a2-f420df05c498.mp4 | "looks good." | APPROVED-BY-OWNER |
| V2 | Floating repositionable dock (final edited version, asset `868d115b-…`; NOT raw job `32a4c8db-…`) | https://d2ol7oe51mr4n9.cloudfront.net/user_3IkKBBXHZvEZQt2d8pBaRYd083T/868d115b-2c32-43ec-b409-3bca35fd1c8d.mp4 | "yep I like it. thats exactly it" | APPROVED-BY-OWNER |
| V3 | Fixed strip between top nav and colored rail | https://d8j0ntlcm91z4.cloudfront.net/user_3IkKBBXHZvEZQt2d8pBaRYd083T/hf_20261015_174105_32b24696-7b5c-4407-bcd0-3f8d622575ce.mp4 | approved together with V2 | APPROVED-BY-OWNER |

V1 beat timings: 0–2.5 s breathing/blink/tail flame; 2.5–4.7 s cursor attention, eyes lead head; 4.7–6.8 s petting, happy eye close, frill/tail delayed settle; 6.8–9 s thoughtful head tilt; 9–12 s quiet success celebration, crouch, hop, elastic landing.

**Risk:** these are external CloudFront links with no availability guarantee. Task LC-0 downloads them into `design/living-companion/assets/video/` (or Git LFS / Drive if repo size policy forbids MP4s — OPEN) and records sha256 here.

## Canonical character art (in repo on `main` 056066f)

- Bible: `docs/brand/mascot/README.md`, `docs/brand/mascot/reference/` (character bible, 2D brand, pose sheet, profile, crayon tail, icon).
- Waist-up sprites: `apps/web/public/mascot/companion/*.webp` (center, celebrate, support, pet, poke, lean, sleep, up/down/left/right, diagonals).
- Full-body sprites: `apps/web/public/mascot/companion/full/*.webp` (center, wave, leap, celebrate, read, gaze directions).
- Generation inputs: `design/companion-demo/assets/`, `design/companion-demo/build_public_demo.py`.

Identity (CANONICAL): orange/cream dragon, glossy brown eyes, ivory pointed frills, teal gold-embroidered scholar vest, crayon-shaped tail with flame. **No wings.** Existing WebPs stay as the fallback renderer.

## Outfit layers (LC-4b, not yet existing)
Original kid-safe art, one layer per item, matched to the rig's slot pivots: science goggles, history explorer hat, math visor, reading glasses + book cape, art beret, music headphones, civics sash. Record provenance and William's approval per item. No copied character costumes.

## To be added by LC-1 (not yet existing)
- Layered rig source (`.riv` and/or layered SVG/PNG parts) with pivot map and provenance.
- Neutral-pose side-by-side vs `center.webp`.

## Dressed rig textures (2026-11-20, LC-DEC-037)

`apps/web/public/mascot/companion/dressed/{goggles,explorer,visor,reader,beret,headphones,sash}.webp`: 400 x 400, same framing as `center.webp` (silhouette and vest within 1 to 2 px), so the WebGL rig deforms them with the existing landmarks and the outfit moves with his head. Generated with Higgsfield `gpt_image_2_6` from `center.webp` as the only reference (one image per outfit, prompts recorded in the session), background removed by edge flood-fill, and the tail flame region restored from `center.webp` to remove a white glow halo. Original kid-safe accessories; no third-party character art. Replace the flat placeholder SVG overlays. Owner may still swap any of them.

## Dressed gesture and head-turn drawings (2026-11-20)

`apps/web/public/mascot/companion/dressed/<outfit>/<pose>.webp` for all 7 outfits x 12 poses (celebrate, left, right, up, down, up-right, down-right, support, pet, poke, lean, sleep); `up-left` and `down-left` are the mirrored right-facing art, as for the originals. Generated with Higgsfield `gpt_image_2_6` using each original pose drawing as the only reference (84 images, 63 credits), cut out by edge flood-fill, 22 to 36 KB each, with the tail flame restored from the original drawing on the six poses that show it. Every sheet was reviewed by the orchestrator: poses and face unchanged, outfit placed and turned correctly. Original kid-safe accessories; no third-party character art.

## Puppet parts (2026-11-21, LC-DEC-043)

`apps/web/public/mascot/companion/puppet/`: `body.webp` (400 x 400, same framing as `center.webp`, both arms removed and the vest and body painted in behind them; tail flame restored from `center.webp`), `arm-left.webp` and `arm-right.webp` (bare arms, shoulder at the top, paw at the bottom, 200 px tall, transparent; "left" and "right" are the viewer's sides). Generated with Higgsfield `gpt_image_2_6` from `center.webp`; arms thresholded from the model's own alpha. Reviewed by the orchestrator: on-model colour and render style. Outfit (dressed) armless plates are not made yet.

## Rive face layers (2026-11-21)

`design/living-companion/rive/studigo/parts/*.webp` (eyes-closed, mouth-laugh, mouth-oh, face-joy, mouth-neutral, face-worried, mouth-ah). Source: Higgsfield `gpt_image_2_6` edits of `apps/web/public/mascot/companion/full/center.webp` (upscaled to 1024, white background), one prompt per expression of the form "Edit this exact image. Keep the character, pose, framing, size, position, proportions, colors, lighting and plain white background pixel-identical. Change ONLY his <eyes|mouth|face>: <expression>." Body and frills register with the source at 0 px offset and the head within about 1 px. Each layer is the expression's eye or mouth region (fixed ellipses), feathered, clipped to the source silhouette and away from the white background, then scaled to the 540 artboard. Built into the rig by `scripts/living-companion/build-studigo-face.mjs`. An arms-raised edit was also generated for a later arm layer and is not yet used.

## 3D reference model (2026-11-21)

Kept outside the repo in `C:/Users/Willi/Dev/Learning/av2-3d/` (binaries). Higgsfield `meshy_v7_image_to_3d` from the approved neutral (1024 px on white): `studigo.glb` (standing pose, about 31k faces, 38 credits; source of the head-turn deformations in `rive/studigo/turns/turn-deltas.json`) and `studigo-apose.glb` (A-pose with Meshy's humanoid rig, 44 credits; pose guides for arm layers). `studigo-rig.blend` holds both with a hand-weighted rig on the standing model. Pose renders: a-cheer, a-wave, a-point, a-chin, pose-yaw, pose-up, pose-down. SHA-256:

- `studigo.glb` 2165170e343e8effdd553b6ee0bbb27f1680427523bef06c576582ca187469b6
- `studigo-apose.glb` d65d8c4979516b8e59317722402b7f44a994d9ab4c56796ae1e1f818c2a34df9
- `studigo-rig.blend` 12d04cfa2b9a7014934aee882f60f53507db0f13202428c78b41174acbac6c40
