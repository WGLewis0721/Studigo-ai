# Studigo v2 Phase 4 — Living Companion: Coucou/REA behavior extraction

**Status:** research and source-backed technical reference. **Not implemented; not a Phase 4 release gate.**  
**Date:** October 15, 2026.  
**Scope:** behavior and animation architecture only. Coucou artwork, Mochi character design, sounds, name, branded sequences and styling are excluded.

## Evidence and reproducibility

- Target: [WGLewis0721/coucou](https://github.com/WGLewis0721/coucou), fork, base commit `a95d309a4752c23ae28453819245339800557609`.
- Tool: [REA: Reverse Engineer Anything](https://github.com/WGLewis0721/rea), applied via the official `rea-agents` CLI in a fork-only, read-only GitHub Actions research job.
- REA runner: [successful workflow run #38763880044](https://github.com/WGLewis0721/coucou/actions/runs/38763880044), commit `c157caf283362f02874abfec341a92d8a514f479` on `research/studigo-v2-p4-rea-coucou`.
- [REA evidence artifact](https://github.com/WGLewis0721/coucou/actions/runs/38763880044/artifacts/11986718097): 34,368,359-byte JSON (ZIP artifact retained 7 days), evidence ID `ev_7b16f8648b412dcbc46be74c9fbe995128bd33c12077b1f01b919c7cfceef845`.
- REA structural root SHA-256 `863cce26d086ed32a0391beff8e29b604da1dca7372f87e6cc9c706d7ffad9c5`; semantic graph `jsrg_30c5e3c3b6cba0985f65fdd6aeef1364f7cd87982dd4dc0bd3ed0655d8b0ff5d`.
- REA inventoried 119 relevant files, selected 10 files (the package manifest plus 9 TS modules), parsed 9 JavaScript/TypeScript sources, recorded 35,160 AST nodes visited, 20,477 semantic nodes, 16,403 semantic relationships, 330 function fingerprints, 0 parse failures. The 109 unselected files and 7,696 retained semantic unknowns make *whole-application* coverage **partial**. Static relationships are evidence of source structure, **not** proof of executed runtime behavior.
- Analyzed Coucou sources: `windows/{package.json,src/core/{anim,layout}.ts,src/mochi/{engine,greeting,minibots,outfits,wardrobe}.ts,src/island/{fsm,island}.ts}`. No native binary decompilation or runtime capture.
- Source license: [Coucou LICENSE-ASSETS.md](https://github.com/WGLewis0721/coucou/blob/main/LICENSE-ASSETS.md) explicitly reserves the Mochi character, art, animations as character assets, icons, sounds and media. Learn from the open-source techniques; do **not** ship their protected creative assets.

## What REA and direct source review establish

| System | Source-backed mechanism | Trace anchor |
|---|---|---|
| State/presentation boundary | Named `BotStateName` + `BOT_STATES` choose parameters/eye shape; `setState` triggers transient effects | [layout.ts lines 18–43](https://github.com/WGLewis0721/coucou/blob/main/windows/src/core/layout.ts#L18-L43), [engine.ts lines 94–111](https://github.com/WGLewis0721/coucou/blob/main/windows/src/mochi/engine.ts#L94-L111), [engine.ts lines 275–311](https://github.com/WGLewis0721/coucou/blob/main/windows/src/mochi/engine.ts#L275-L311) |
| Scalar animation channels | `yaw,pitch,roll,tilt,open,sx,sy,ox,oy` and ancillary fields; targets are separate from actual values | [engine.ts lines 197–270](https://github.com/WGLewis0721/coucou/blob/main/windows/src/mochi/engine.ts#L197-L270) |
| Animation scheduler | Per-property tween maps, locks, easing curves and completion callbacks; state and emotes animate selected channels | [engine.ts lines 275–315](https://github.com/WGLewis0721/coucou/blob/main/windows/src/mochi/engine.ts#L275-L315), [engine.ts lines 573–592](https://github.com/WGLewis0721/coucou/blob/main/windows/src/mochi/engine.ts#L573-L592), [core/anim.ts](https://github.com/WGLewis0721/coucou/blob/main/windows/src/core/anim.ts) |
| Gaze and ambient | Look targets filtered with frame-rate-independent easing; randomized look and blink intervals; optional double blink | [engine.ts lines 593–675](https://github.com/WGLewis0721/coucou/blob/main/windows/src/mochi/engine.ts#L593-L675) |
| Secondary physics | A damped spring tracks velocity-derived soft-part lag on head movement and bouncing | [engine.ts lines 690–706](https://github.com/WGLewis0721/coucou/blob/main/windows/src/mochi/engine.ts#L690-L706) |
| Procedural renderer | Canvas 2D draws layered hands, body, eyes, facial effects, and outfits using current channel values | [engine.ts lines 773–824](https://github.com/WGLewis0721/coucou/blob/main/windows/src/mochi/engine.ts#L773-L824), [outfits.ts](https://github.com/WGLewis0721/coucou/blob/main/windows/src/mochi/outfits.ts) |
| Lifecycle | UI state machine handles open/close/hidden and interruptible greeting, separately from `BotEngine` | [island/fsm.ts](https://github.com/WGLewis0721/coucou/blob/main/windows/src/island/fsm.ts), [island/island.ts](https://github.com/WGLewis0721/coucou/blob/main/windows/src/island/island.ts) |
| Surface adaptations | Compact mini characters reuse the engine with different size/behavior, and are pruned when disconnected | [minibots.ts](https://github.com/WGLewis0721/coucou/blob/main/windows/src/mochi/minibots.ts) |

These are two complementary sources of evidence: REA's static graph identifies nodes such as `BotEngine`, `setState`, `update`, `blink`, `triggerEmote`, `Spring`, `makeHead` and `drawOutfitFront/Behind`, with source ranges; direct source inspection verifies their actual algorithms. **No claim of REA-proven runtime performance, implementation correctness, or animation equivalence.**

## Minimum Studigo behavior contract — design proposal, NOT extracted code

Keep only the following **13 core scalar channels** plus one categorical expression. These are an *adaptation* of Coucou properties, not a copy of the renderer. The approved Studigo dragon has no wings: the gesture channel means a forearm/paw movement:

| Studigo channel | Coucou conceptual origin | Intended role |
|---|---|---|
| `gazeX, gazeY` | `lookX,lookY` | Normalized attention input, clamped to [-1,1] |
| `headYaw, headPitch, headRoll` | `yaw,pitch,tilt` | Smooth head orientation independent of abrupt sprite switches |
| `eyeOpen` | `open`, `eyeOverride` | Blink/alertness, while `expression` chooses eyes/mouth style |
| `bodyScaleX, bodyScaleY` | `sx,sy` | Squash/stretch and calm idle breathing |
| `rootX, rootY` | `ox,oy` | Anticipation, bounce, recoil and recovery |
| `pawGesture` | `hands` | Studigo forearm/paw gestures, including greeting and celebration; do not add wings |
| `softLagX, softLagY` | `physDx,physDy` | Spring lag applied to Studigo's frills, tail and clothing |

Categorical output: `expression = neutral | curious | focused | joyful | supportive | sleepy`. Optional future channels: `mouthOpen` for speech, `tailPose` for a more detailed rig, `outfitBlend` for Earn/Play customization, and bounded particle effects. Do not port Coucou's hard-coded body colors, badge colors, upload `morph`, music dancing, notch geometry, or dizzy/slap motif.

### Input signals

```ts
type CompanionSignal =
  | { type: "attention"; source: "pointer" | "typing" | "citation" | "question"; x: number; y: number }
  | { type: "study"; state: "ready" | "reading" | "thinking" | "explaining" | "waiting" }
  | { type: "assessment"; result: "correct" | "needs-help" | "set-complete" }
  | { type: "touch"; action: "tap" | "pet" | "drag-end" }
  | { type: "surface"; state: "visible" | "hidden" | "minimized" | "reduced-motion" };
```

Adapt these from **existing** Studigo events and page activity; do not let animation infer academic success or write academic data.

### Scheduler and motion

- One pure framework-independent behavior controller receives events and `dt`, resolves output, and owns transitions. Existing `useCompanion`/event bridge stays the integration boundary.
- Precedence: critical learner-context feedback and direct touch > active learning activity > user attention > ambient. Do not allow a long idle animation to suppress a real answer response. Timed reactions expire, recover and can be interrupted.
- The rendering engine reads a pose snapshot; it must not independently choose new learning behavior. Use monotonic time and deterministic injected random input for tests.
- Use time-based easing/springs that behave consistently at 30/60/120Hz; cap/sub-step `dt` to avoid physics explosions on resumption. Respect reduced-motion and visibility pause. Do not set React state per animation frame.
- Animation and rig identities are independent: `stage` full-body, `window` waist-up, `seat` avatar, later Expo/React Native. Preserve chosen skin/outfits in Learn, Earn and Play.

### Character rig and aesthetics

The target is **Studigo the approved orange dragon**, not a Mochi derivative. Only use canonical Studigo references in `docs/brand/mascot/reference/`. Rig and pivot studies must preserve head/frill silhouette, cream/orange proportions, vest, crayon tail and flame. The current WebP poses can remain as fallback and as a feature-flagged roll-back path. A piecewise 2D rig or Canvas/WebGL renderer should be selected after a visual prototype; do not assume Coucou's procedurally rendered squircle geometry transfers to a dragon.

## Current Studigo integration points (source reviewed, not changed)

- `apps/web/components/companion/engine.ts`: pose switcher, 320ms behavior heartbeat, drag/dock/resize/attention/typing, accessibility, reduced-motion, and existing `CompanionHandle` API. Reuse or adapt; do **not** replace the room shell.
- `apps/web/components/companion/companion.tsx`: `useCompanion` and `useCompanionWindow` already isolate presentation from assessment authority.
- `apps/web/components/companion/stage.tsx`: full-body counterpart with state and pointer/typing reactions.
- `apps/web/lib/companion-logic.ts`: existing `reactionFor`, `idleStage`, and event types are the migration seam.
- `apps/web/components/companion/companion.css`: WebP opacity crossfades and whole-body transforms; current blink eyelids only display on front-facing pose.
- `docs/brand/mascot/README.md`: current canonical art and asset pipeline.
- Phase 3 baseline and existing rollback remain authoritative. Phase 4 is independent and **must not be merged into the ongoing Phase 3 redesign**.

## Phase 4 deliverables, deliberately small

1. **P4-A — Character rig feasibility specimen:** a canonical Studigo layered rig showing smooth gaze, blink in all directions, head turning, single paw gesture and two secondary-motion parts. Compare sprite/CSS, Canvas 2D and a lightweight rig renderer with device performance measurements. Demonstrate 375px phone and desktop.
2. **P4-B — Pure behavior core:** typed signals, deterministic scheduler/state machine, spring/tween helpers, per-frame snapshot and test fixtures. Verify preemption, cooldowns, rest, frame-rate consistency, visibility/power pause and reduced motion.
3. **P4-C — One renderer integration:** feature flag behind current companion host; preserve docking, seat, settings, keyboard hit targets and preference persistence. Device checks, focused screenshots and equivalent events on stage/window/seat.
4. **P4-D — Learning-context polish:** listen/read/thinking/explain/encourage/celebrate gestures, using existing verified events. No changes to mastery, currency or study scoring. Real iPhone Safari acceptance and rollback proof.

### Exit criteria

- Same approved Studigo silhouette/identity in every expression and existing approved art fallback.
- Gaze moves continuously toward real screen targets without direction-image popping; blink works for each direction.
- At least two independent soft parts visibly exhibit delayed secondary motion and settle without snapping.
- All high-priority learning events interrupt ambient motion, return naturally to idle, and never fabricate assessment state.
- Animation does not block clicking, reading, citation focus, input, scroll, VoiceOver/keyboard, or 200% zoom.
- Pauses while not visible, has an accessible reduced-motion alternative, and is measured on actual iPhone Safari and desktop. Capture frame-time, battery/CPU proxies and memory evidence before accepting thresholds.
- Tests prove frame-rate-normalized output and no assessment/mastery writes. Feature flag OFF restores existing companion behavior. Production shipping requires separate verified release gates.

## Decision

**Use Coucou/REA as a motion-engine and evidence-method reference. Do not fork/port Coucou's character renderer wholesale.** Build the smallest Studigo-specific behavior core first and prove the rig visually before expanding animations, accessories, voice syncing or game integration.

REA's output is a *static, partially scoped* investigation. The Phase 4 implementation still needs render prototypes, measured performance, actual device tests and visual judgment.
