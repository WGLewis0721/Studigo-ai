# How the living companion can work

## Why Coucou was studied

The owner forked **Coucou** (https://github.com/WGLewis0721/coucou) and **REA / Reverse Engineer Anything** (https://github.com/WGLewis0721/rea) as technical references. Coucou's Mochi feels alive not because every emotion is a separate movie or full character image, but because it has independent movement channels, small timed states, smoothing and reactive behavior.

### Source-backed mechanisms

- **Behavioral states** (idle, thinking, finished, etc.) select a general emotional/attention context.
- **Tweens and timelines** interpolate specific values such as head rotation, eye shape, body scaling and position. They can overlap with clear priority.
- **Eye/head tracking** moves eyes first and head after, rather than snapping between a few directions.
- **Springs and inertia** make frills, tail and clothing lag, overshoot slightly and settle with weight.
- **Autonomous life** adds sparse blinking, glances, breathing, micro-expressions and occasional idles without learner interaction.
- **Context reactions** pair a verified answer, waiting, petting or completion event with a brief coordinated gesture, then return to a resting state.
- **Presentation adapters** decide whether motion is shown in the floating dock, fixed strip, home stage or a later native surface.

Relevant Coucou modules (see the full path list in `08_LIVE_SOURCES_AND_LINKS.md`): `windows/src/mochi/engine.ts`, `windows/src/core/anim.ts`, `windows/src/mochi/greeting.ts`, `windows/src/island/fsm.ts`, `NotchBuddy/Sources/CoucouKit/BotEngine.swift` and `NotchBuddy/Sources/App/BotCanvasView.swift`.

### What the REA run did — and didn't do

An isolated GitHub Actions run analyzed a selected part of Coucou's TypeScript source on the owner's fork:

https://github.com/WGLewis0721/coucou/actions/runs/38763880044

Its reported figures included 9 parsed TS/JS modules, 20,477 semantic nodes, 16,403 semantic relations and 330 function fingerprints. It was intentionally a **partial** scope. REA analysis and direct source reading helped identify implementation relationships. They do **not** prove runtime animation quality, device performance, licensing permission to use art, or feature equivalence.

The original analysis ZIP remains intact inside the pinned archive at `historical/ORIGINAL_2026-10-25_HANDOFF.zip` under `rea_evidence/rea-evidence-original.zip`; it is large, so avoid extracting both until investigation needs it.

## Minimal reusable motion concept

A first sketch identified 13 numeric channels plus an expression state:

| Channel(s) | Role |
|---|---|
| gazeX, gazeY | normalized attention target |
| headYaw, headPitch, headRoll | soft, continuous head orientation |
| eyeOpen | blinking/alertness |
| bodyScaleX, bodyScaleY | breathing and squash/stretch |
| rootX, rootY | local anticipation/bounce offsets |
| pawGesture | small wave, celebration, welcome, reassurance |
| softLagX, softLagY | spring lag for frills, vest and flame-tail |

This is **an architectural starting point**, not a mandate to use exactly these 13 channels. The later LC specification adds brow, cheeks, mouth, tail and frill controls to support 14 expressions/12 beats and eventual lip sync.

### Suggested flow

    committed learning events + local pointer/touch/visibility signals
                            ↓
    existing CompanionContext / CompanionHandle adapter
                            ↓
    deterministic motion director (priority + timing + seeded idle)
                            ↓
    pose snapshot (head, eyes, face, body, paws, soft parts)
                            ↓
    a measured Rive or layered Canvas renderer
                            ↓
    floating window OR fixed strip; old WebP renderer stays fallback

The animation system must not interpret whether an answer is correct, invent a score or write mastery. The rendering loop must be suspended while hidden, honor reduced-motion/Calm mode, avoid per-frame React component re-renders, and release listeners/timers when unmounted.

## What Studigo has today

The existing source contains gaze/pose selection, window docking, resizing/pinch, pet/tap, minimized seat behavior, a per-room speech preference, idle CSS animation and a typed event API. It currently uses pre-rendered WebP poses and CSS animation rather than an articulated, continuous rig. The motion upgrade should preserve these working features.

## Art implication

Generating 30 more full-character emotion images is not the first move. Prove a layered rig whose eyes/lids/head/paws/frills/tail can move independently while maintaining the **same approved wingless dragon**. Use Higgsfield only when canonical source layers are truly missing and can be inspected at production sizes. Do not use Coucou's Mochi art, name, sounds or protected character animations.
