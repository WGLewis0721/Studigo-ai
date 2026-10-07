# Round 2 — what changed and what's next

## Animation (character)
- **Rig v2** (`src/Studigo.tsx`): squash/stretch pivots at the feet with volume kept; **overlapping action** is spring-simulated from the track's own history, so the crest/frills lag the body and the tail + flame whip after it (two displacement-map filters, `scripts/make-maps.py`, inlined in `src/maps.ts`); a blink on the centre pose (eyelids sized to the measured eyes). No change to his shape, colour or face.
- **Acting beats** (`src/scenes/Opening.tsx`): landing squash with damped overshoot → wave → freeze → *clocks the camera* (hard pose cut + stretch-up, held beat, blink) → crouch anticipation → burst through the phone boundary (glass shards, 2-frame impact flash, camera punch-out and shake) → glance at the incoming study guide → catches it into the approved `read` pose.
- **Physical interactions (3)**: boundary break; shoulder-check that shoves the "wall of text" off the Coach panel (brace → lunge → contact squash → dust → recoil); leans on the result panel using the approved `lean` waist-up sprite aligned to the card edge (duck-behind-card, pop-up gag).
- **Front-to-back**: he crosses in front of the answer card, walks out of that scene and into the next across the cut; drop-shadow falls on surfaces behind him.
- **Camera/film**: slow dolly per scene, shutter motion blur on the leap-in and the break only (`@remotion/motion-blur`), iris transitions that open from where the previous action ended with a coloured leading ring.

## Type & copy
See `COPY_DECK.md`. Sentence case, human notes, student mark-up (highlighter, pen underline/circle/arrow), paper grain + notebook ruling, brand fonts/colors only. All app strings are lifted from the code.

## Render safety
Two real bugs found and fixed by scanning the output, not by eye: (1) SVG `feImage` maps raced the screenshot and dropped the dragon from alternate frames → inlined as data URIs; (2) `CameraMotionBlur` passes fractional frames, which turned an array-indexed flash into a solid-white frame → `Math.floor`. `scripts/blank-check.py` scans for dragon-less frames.

## Still open (Round 3, final cut)
1. **Resolution**: sprites are 540px (lean/support 400px) and are upscaled ~1.5–1.8×. Try an upscale pass on the approved sprites; reject any identity drift.
2. **Higgsfield**: only where it beats the rig: the panel push (real hand contact), a true toward-camera leap. Needs a locked reference sheet and a credit quote first. Nothing was generated or spent in Rounds 1–2.
3. **Mouth/voice**: no lip-sync yet; sprites have fixed mouths. Needs the locked VO read, then mouth-shape swaps from approved references.
4. **Audio**: none yet. Scratch captions only. Plan: licensed bed, a few pops/whooshes, quiet beat on "You knew that one", plus silent and music-only exports.
5. **9:16 recomposition**, then captions and the final claim sheet.
6. **Authenticated UI pass**: replace reconstructed panels with real captures once a test account is available. Strings are already code-accurate.
7. **Names**: repo guide says "SteadyGo", brief says "Studigo". Confirm the VO line.
