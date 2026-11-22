# Reference motion study: the approved Higgsfield films

Status: measured on the V1 character film. The dock and strip films were reviewed at overview level only.

These films set Studigo's approved appearance, personality, expressions and movement. They are references for the 3D model, the rig and the animation timing. They are not animation frames and not a substitute for a real 3D character.

## Sources and where the files are

| File | Bytes | SHA-256 (matches the value recorded in [01-higgsfield-motion.md](01-higgsfield-motion.md)) |
| --- | ---: | --- |
| `studigo-character-concept.mp4` (V1, character) | 15755703 | `a34b444e…232a37` |
| `studigo-floating-dock-concept.mp4` (V2, dock) | 752554 | `7e301079…06d3` |
| `studigo-fixed-strip-concept.mp4` (V3, strip) | 8281714 | `6dc5a8fb…f84d` |

- Local copies: `design/living-companion/workspace/references/approved-concept-videos/`. The folder is git-ignored by `design/living-companion/.gitignore`, so the MP4s are never committed.
- The copies came from the foundation worktree, so `prepare_workspace.py --videos` was not needed. The original CloudFront URLs for recovery are in `design/living-companion/manifests/reference-sources.json`.
- V1 is 1440 × 1440, 24 fps, 289 frames, 12.04 s. V2 and V3 are 1912 × 1080, 24 fps, 12.04 s.

## Method (V1, analysed at 720 px)

- Silhouette: pixels with a maximum channel above 45 on the black background.
- Eyes: bright sclera count and dark pupil centroid in a box around each eye.
- Head x: centroid of bright silhouette pixels in the head band. Sparkles and the dark halo are partly excluded, so treat it as approximate.
- Body y: centroid of the silhouette over the torso and legs.
- Flame: the strict yellow core (R > 225, G > 185, B < 150). A looser threshold also picks up the orange body, so the first pass was discarded.
- Limits: a 2D silhouette cannot separate yaw from tilt. Pupil centroids are noisy when the lids are half closed. The feet line clips at the bottom of the frame, so jump timing uses the body centre only.

Data: `evidence/reference-study/v1_timeseries_strict.csv`. Chart: `evidence/reference-study/v1_motion_timeline_strict.png`.

## Findings (measured unless marked)

### Eyes and blinks
- Eyes closed 0.54–0.92 s (about 0.4 s) and again 10.2–10.5 s (0.3 s), during the reaction.
- Pupils sweep about ±20 px in the 2.5–5.25 s look-around, then look up during the 10 s reaction (dy about −13 to −20 px).
- Gaze direction and head x do not agree in direction between 2.5 and 5 s. I can't say from this data which leads. Check it by hand on the film before copying any eye-leads-head rule.

### Head
- Fast snap: x changes 25–50 px in 0.2–0.5 s (1.0–1.4 s: 355 → 380; 9.5–10.0 s: 330 → 375).
- Slow return: about 1 s to 1.3 s (2.5–3.6 s: 378 → 330; 10.2–11.5 s: 368 → 340).
- Idle: side drift of about ±3 px.

### Body and jump (from body-centre y)
- Idle: the torso stays in a band of about 513–528 px with slow drift.
- Crouch about 9.9–10.1 s, takeoff 10.2 s, highest point about 10.6 s (body y at its minimum, about 499), landing about 10.9–11.0 s (body y at its maximum, about 526, compressed), then settles to about 521 by 11.5 s.
- This agrees with the frame-by-frame beats already noted in [01-higgsfield-motion.md](01-higgsfield-motion.md).

### Anticipation
- 5.3–5.6 s: the flame pulls back about 30 px to the left (x about 150 → 118) for about 0.2 s, then sweeps to x about 200 by 5.9 s. That is roughly 20% of the travel in 0.15–0.25 s.

### Follow-through and settling
- After the 9.5–10.0 s head snap, the flame y swings about 450 → 320 → 460 → 300 → 400 → 320 → 455 px between 9.9 and 11.3 s. Each half-cycle is about 0.4–0.5 s and the swing decays over about 1.5 s. The flame x overshoots to about 233 at 10.9 s and settles near 140 by 11.5 s.
- The body settles over about 0.5 s after landing.

### Dock (V2) and strip (V3): overview only
- The companion appears small: in the floating dock card and as a small avatar in the coach strip. Sheets: `evidence/reference-study/dock-sheet.jpg` and `strip-sheet.jpg` (one frame per second).
- Visible at that size: a response to the pointer hovering, flame flicker and a few small pose changes. Eye detail is not visible at this scale. Not measured.

## Transfer to the 3D model, rig and animation

Measured items come from the timings above. Items marked *suggested* are design targets. Confirm each one on the film before it is locked.

1. **Blink (measured):** the eyes close for about 0.4 s in total, with a short hold. *Suggested:* close in 3–4 frames at 60 fps, hold 2–3 frames, open with an ease-out.
2. **Head turn (measured):** a snap of 0.2–0.5 s and a return of about 1 s. *Suggested:* the snout and eyes lead, and the frills lag a few frames.
3. **Anticipation (measured):** a pull-back of about 20% of the travel, about 0.2 s, before each tail or flame sweep and before a jump.
4. **Follow-through (measured):** the flame and tail tip swing about 0.45 s per half-cycle and decay over about 1.5 s after a head snap or a landing.
5. **Jump (measured, from body centre):** a crouch, a takeoff, about 0.6 s in the air, a landing squash, then about 0.5 s to settle.
6. **Breath and drift (measured):** about ±5 px over several seconds. He should never freeze.
7. **Gaze (suggested):** move the eyes within about 0.5 s. Move the head only when the 3D model can resolve the turn.

## Caveats

- Measured on a 720 px extraction and 2D silhouettes, not on the 3D model.
- These numbers are timing targets for the animation. The video and frame review remain the final check.
