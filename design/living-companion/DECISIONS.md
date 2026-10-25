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
