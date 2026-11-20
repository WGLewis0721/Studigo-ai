# LC decision log

Status: **APPROVED** (owner, William) · **PROPOSAL** (agent, needs no further approval unless contested) · **OPEN**. Dates are 2026 (America/Chicago).

| ID | Date | Status | Decision |
|---|---|---|---|
| LC-DEC-001 | Oct 25 | PROPOSAL | Track renamed "Living Companion (LC)"; ROADMAP "Phase 4" = reliability/safety/cost. |
| LC-DEC-002 | Oct 25 | APPROVED | Expressiveness range modeled on Muse (Meta), Dots (OpenAI), Pokémon GO buddy, Grok companions, Grok Bot. Muse/Dots identities confirmed by owner. |
| LC-DEC-003 | Oct 25 | APPROVED | Grok Bot reference = head turning and eye movements (gaze). |
| LC-DEC-004 | Oct 25 | APPROVED | Personality: Sonic (speed/energy) + Ms. Frizzle (curious teacher) + Pikachu (expressive ears/tail) + Krypto (loyal). Inspiration only, no likeness, names or sounds copied. |
| LC-DEC-005 | Oct 25 | APPROVED | Build branches from and target `main`. |
| LC-DEC-006 | Oct 25 | APPROVED | Mood meter in v1; per session, in memory; mistakes never lower it (see MOOD_METER.md). |
| LC-DEC-007 | Oct 25 | APPROVED | No companion memory settings; context comes from study room + onboarding. |
| LC-DEC-008 | Oct 25 | APPROVED | Voice comes later from the promo video. v1 ships a `MouthDriver` plug-in (amplitude / visemes / word-boundary fallback); LC-10 wires the voice once delivered. |
| LC-DEC-009 | Oct 25 | APPROVED | Outfits in v1: lightweight, school-subject themed, cosmetic only; no unlocks, no sales; original kid-safe art. |
| LC-DEC-010 | Oct 25 | APPROVED | Stall thresholds wait for measurement (LC-0b); placeholder L1 20–45 s, L2 = 2×. |
| LC-DEC-011 | Oct 25 | APPROVED | Stack: Rive (live rig/state machine) + Higgsfield (art) + Claude Code (engineering, can drive Rive editor) + GitHub (source of truth). See STACK.md. |
| LC-DEC-012 | Oct 25 | PROPOSAL | Renderer choice proven by a ≤7-day measured spike; fallback = layered canvas/sprite rig. |
| LC-DEC-013 | Oct 25 | PROPOSAL | Integration seam: `CompanionRenderer` interface, `SpriteRenderer` (current WebP) fallback, lazy `RiveRenderer`, flag `NEXT_PUBLIC_STUDIGO_COMPANION_MOTION`, prefs v2 that still writes legacy `dock`. |
| LC-DEC-014 | Oct 25 | APPROVED (handoff) | Orange wingless dragon; free repositioning; companion never writes mastery. |
| LC-DEC-015 | Oct 25 | PROPOSAL | Bible Strong Avatar Lab is AGPL-3.0: reference only, clean-room, no code or packages bundled. |
| LC-DEC-016 | Oct 25 | OPEN | Limora.ai for outfit art — only after ToS (ownership, kids' content) is reviewed. |
| LC-DEC-017 | Oct 25 | PROPOSAL | REA adds little for open-source Coucou; read code directly. Do not REA closed apps (ToS/asset risk). |
| LC-DEC-018 | Oct 25 | PROPOSAL | Adopt Avatar Lab ideas clean-room: character JSON + schema (LC-2), micro-saccades + slow drift idle, perspective head yaw/pitch in fallback rig. |
| LC-DEC-019 | Oct 25 | OPEN | Strip-host slot between nav and rail does not exist on `main`; build in LC-6. |
| LC-DEC-020 | Oct 25 | OPEN | Home full-body stage and header mascot are not upgraded in v1. |
| LC-DEC-021 | Nov 16 | APPROVED | Visual style is 2.5D: layered 2D art with depth cues (perspective head yaw/pitch, layered parts), not full 3D. Owner decision, William, Nov 16. Rive or layered Canvas rig is still decided by the LC-1 bake-off. |
| LC-DEC-022 | Nov 16 | FACT | Coucou is 2D: its renderer is Canvas 2D with no skeleton rig, lip-sync or 3D (per COUCOU_REA_BEHAVIOR_EXTRACTION.md). Its Swift sources are not yet checked for 3D. Rudi (Grok) is the 3D reference. |
| LC-DEC-023 | Nov 16 | OPEN | `design/companion-demo/README.md:74` plans a "rigged 3D Studigo". Superseded by LC-DEC-021 unless William says otherwise. |
| LC-DEC-024 | Nov 20 | PROPOSAL | De-facto renderer is the WebGL mesh rig over `center.webp` plus the original 15 drawings for gestures and far head turns (`rig-renderer.ts`, commits `51cb6ec`, `e55bc2d`). Rive is undecided: not built, CLI not logged in on 2026-11-20, `.riv` commercial terms unverified (`evidence/rive-licensing-notes.md`). Needs William's approval at step 12; supersedes nothing until then. |
| LC-DEC-025 | Nov 16 | APPROVED | `NEXT_PUBLIC_STUDIGO_COMPANION_MOTION` defaults ON (the plan said off). William asked to merge and see the upgrade. `off` restores the WebP drawings; WebGL failure falls back automatically. |
| LC-DEC-026 | Nov 17 | APPROVED | Keep his original behaviours in motion mode: drawn gestures and drawn head turns crossfade in over the rig (William, Nov 17). Conflicts with QA V02 "no discrete-image popping"; V02 wording needs William's decision. |
| LC-DEC-027 | Nov 17 | PROPOSAL | Strip vs floating is a per-room pref `host` (default float); size stays per device. |
| LC-DEC-028 | Nov 17 | OPEN | The seven outfit layers are placeholder SVG art; each needs William's approval or replacement. |
| LC-DEC-029 | Nov 20 | OPEN | `correctFast` stays unwired (speed pressure for young learners). `stall` thresholds are placeholders until LC-0b data. |
| LC-DEC-030 | Nov 20 | APPROVED | Owner delegated all open LC decisions to the orchestrator (William, Nov 20): "animate Studigo such that he feels alive to children and can be customized and grown as they complete study tasks. Make decisions that align with that goal." Rows 031-038 are made under this delegation. |
| LC-DEC-031 | Nov 20 | APPROVED (delegated) | Renderer for v1 is the hybrid mesh rig (LC-DEC-024). Rive is deferred: not needed for v1, Free-tier exports carry a splash, `.riv` commercial terms unverified. Revisit only if the rig cannot meet a feel goal. |
| LC-DEC-032 | Nov 20 | APPROVED (delegated) | QA V02 is amended: drawn head turns and gestures may crossfade in over the rig (<=200 ms, no hard pop), per LC-DEC-026. Continuous eye-leads-head motion is still required for near looks. |
| LC-DEC-033 | Nov 20 | APPROVED (delegated) | Supersedes the "no unlocks" part of LC-DEC-009. Studigo grows as the learner completes study tasks: growth points come only from committed completions (`setDone`, `missionComplete`, and similar committed events), never from mistakes or time. Growth never decreases, has no streaks, timers, loss states or purchases, and is never read by grading, mastery or progression. |
| LC-DEC-034 | Nov 20 | APPROVED (delegated) | Growth unlocks cosmetic outfits (first one after the first completed task), new idle tricks and a livelier flame. Same dragon identity at every stage; no body redesign. Locked items say how many more study tasks unlock them, never a price. |
| LC-DEC-035 | Nov 20 | APPROVED (delegated) | Growth is stored on the device (localStorage, per learner device, across rooms) for v1. Server sync is a later step and needs a migration and RLS review. |
| LC-DEC-036 | Nov 20 | APPROVED (delegated) | `stall` ships with the placeholder thresholds (level 1 at 30 s, level 2 at 60 s) and gentle reactions only; tune from real data later. `correctFast` stays off (no speed pressure for young learners). |
| LC-DEC-037 | Nov 20 | APPROVED (delegated) | Outfit art must match his glossy 2.5D look before release; the flat placeholder SVGs are replaced by on-model art in the same slots. |
| LC-DEC-038 | Nov 20 | APPROVED (delegated) | Not delegated and still not done by agents: merging PR #268 to `main`, deploying, or enabling production flags. H5 signed-in screenshots and H6 production flag names stay OPEN (they need the owner's accounts). |
| LC-DEC-039 | Nov 20 | APPROVED | Owner (William, Nov 20): no design guardrails during the build; realize the full product first, then prune. Supersedes the restrictive parts of LC-DEC-033 to 036: every committed learning event may earn growth, unlock pacing is open, more stages and tricks are welcome. Kept as hard rules: the companion never writes grades, mastery, progress or evidence; no camera, mic or pointer logging; no secrets in client code; no merge to `main`, deploy or production flag without the owner. A prune pass is due before release. |
| LC-DEC-040 | Nov 20 | APPROVED (delegated) | Calm mode and OS reduced motion mean gentle, not frozen (spec section 12): slow blinks, slow breathing and expression fades stay; idle head-turn glances, flame flicker, saccade jitter, tail sway, hops, spins, particles and the celebrate pop/slide go. QA A02 is amended to this. The menu Calm box reflects OS reduced motion. Findings in `evidence/LC-19.md`. |
