# Phase 6 — Shared Rive component

**PASS for the shared browser surface · 2026-11-21.** Both instances in the [Chromium capture](evidence/phase6/showroom-chromium.png) use the same shipped Rive export.

```tsx
<StudigoCharacter state="listening" size="medium" interactive reducedMotion="system" />
```

A ref exposes `setState`, `react`, `lookAt`, `returnToIdle`, and `setReducedMotion`. The state and event policy is typed in `studigo-behaviors.ts`. Rive owns rendering and transition curves. The artwork is `/mascot/rive/studigo.riv`, artboard `Studigo`, state machine `Studigo Motion`, view model `Studigo Controls`. At this checkpoint `mode=0` animates and `mode=2` is static. `intent` selects the documented behavior. Production hosts still run the previous renderer at this checkpoint.

The component loads when visible, shares the network requests for the runtime and asset, binds each instance separately, and cleans up Rive, observers, subscriptions and input on unmount. The approved still remains while the runtime loads and after a failed load. Browser writes to growth, grades, and learning evidence remain with existing owners.

## First-frame diagnosis and verification

The 2.54.0 runtime declares a Draw event but the installed high-level render loop never fires it. Waiting for it caused the 12-second fallback even after the WebAssembly and Rive asset returned 200. The surface now calls `drawFrame()` after layout and data binding before removing the placeholder. The test waits for the orange character to appear after the Free-tier monochrome splash before it checks pixels. It allows small renderer-level differences in reduced motion.

```powershell
corepack pnpm --filter @studigo/web dev --hostname 127.0.0.1 --port 3328
node scripts/living-companion/studigo-v2-showroom-qa.mjs
```

Chromium 151 passed visible idle, keyboard activation, pet recognition, reduced motion, distinct simultaneous instances, unmount/remount, and injected asset 404. The check is on Windows Chromium. App placement, continuous gaze and stronger touch choreography, linked growth, and physical Apple-device evidence are later work.
