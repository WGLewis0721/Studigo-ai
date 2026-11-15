# Acceptance — how to distinguish an excellent demo from a finished app

## Visual and behavior checks

- The original wingless dragon remains recognizable from frontal, angled, joyful, supportive, sleepy and focused views.
- Blinks work when looking in every direction; eyes lead head; no snapping between full-face sprites.
- At least two soft parts (for example frills/tail) lag and settle naturally.
- Choreographed beats finish, return to REST, and yield to priority learning/touch events. No perpetual jiggling, gloomy failure reaction or false grades.
- One shared behavior core supports both placements and the same verified event semantics.

## Floating dock

- The whole framed panel—not only the dragon—moves smoothly and can settle in a learner-safe noncorner position.
- Location persists through reload and navigation. Old `dock` prefs remain compatible; screen resize, browser zoom and keyboard opening clamp safely.
- The dock never makes a Submit, Answer, Citation, Nav or chat composer unusable. Keyboard and touch alternatives work. There is a clear switch to the fixed strip.

## Fixed strip

- Character remains **below nav, above colored rail**. The rail stays stationary, and content scrolls beneath the header.
- The Phase 3 desktop 100%→60% header tuck/focus return still behaves as accepted. Phone remains legible with usable composer; no clipping or added duplicate dragon.
- Motions are restrained and contained; no layout shift as the dragon reacts.

## Learning, privacy, accessibility

- Only events committed by the appropriate Coach/Practice/Guided Learn owner can cause assessment-specific celebration.
- Companion doesn't write mastery, grade, durable evidence, currency or changes to uploaded documents, RLS or authentication.
- No camera, mic tracking or raw pointer logging. Reduced-motion and Calm options genuinely limit continuous motion. Animation loop pauses on hidden/idle surfaces and cleans up listeners.
- Test screen reader, keyboard-only, focus restore, 200% zoom, pointer/touch, low-bandwidth missing sprites and long study content.

## Performance and release protocol

Record actual device/browser and before/after frames: 375x667, 390x844, 768x1024, 1024x768 and 1440x900; physical iPhone Safari and iPad; desktop browser; signed-in course material and real learner flows. Compare CPU/frame-time, long tasks, memory and bundle size to legacy. Choose thresholds only after measuring representative devices and obtaining owner agreement.

Run targeted unit tests (timing normalized at 30/60/120Hz, priority/preemption, invalid prefs, touch/move distinction, no mastery writes), typecheck, build, same-SHA visual comparison, preview and staged canary. Preserve `NEXT_PUBLIC_STUDIGO_COMPANION=off` for full companion disable and add a separate motion flag so old WebP behavior can return. A feature flag may be compiled at build time; flipping a Vercel env var without a deployment might not change running code.

**Release claim requires:** exact tested commit, green CI, deployed SHA verified READY, signed-in production smoke, physical device proof, owner character sign-off, and a demonstrated rollback path. Do not classify the prior Higgsfield films as any of these deliverables.
