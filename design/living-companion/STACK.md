# LC production stack (LC-DEC-011)

## Roles
- **Higgsfield — art.** Base layers, expression sheets, outfit art, concept video. Video is look-dev only; it cannot be the in-app character.
- **Rive — live character.** Rig, expressions, state machine, blending; ships in app. Head yaw/pitch and gaze exposed as numeric inputs code can drive.
- **Claude Code — engineering.** Motion director, mood meter, event wiring, tests; may drive the Rive editor via computer use. A human reviews motion (AI misses edge cases).
- **GitHub — source of truth.** This KB, `lc/*` branches off `main`, draft PRs, CI.

## Biggest risk: layer separation
Higgsfield outputs are flat. Someone must cut them into clean, consistent layers (head, eyes, lids, mouth shapes, ears, tail, body, outfit slots) matching the approved dragon before Rive can rig them. The LC-1 feasibility spike must prove this first.

## Pipeline
1. Higgsfield concept → owner approval.  2. Layer separation + cleanup → assets/ (see ASSET_MANIFEST).  3. Rive rig + state machine with inputs named per SHARED_COMPANION_EVENTS.  4. `RiveRenderer` behind flag; `SpriteRenderer` fallback.  5. Spike metrics (60 fps iPhone 12 and ~$150 Android, blends ≤200 ms, zero mastery writes).
