# The current Living Companion v1 scope

This page is an approachable summary of the actual, later **Living Companion (LC)** knowledge base in the Studigo repository. **For exact definitions, IDs and acceptance criteria, read the original files on the foundation branch.**

## Character personality

Studigo is curious, perceptive, emotionally warm and energetic. The motion language combines friendly presence with expressive attention and occasional play. Reactions must never shame children for mistakes or drown out studying. Inspiration from well-known characters and products is for **qualities**, not copied appearances or copyrighted creative assets.

## Expressions and “beats”

The later spec sets **14 facial/emotional expressions** and **12 short choreographed motion beats** as the target library. Feasibility phase LC-1 demonstrates a small subset (6 expressions and 3 beats) before expanding; the v1 gate calls for at least **10 beats** performing cleanly, each returning to an idle REST state. An interrupted beat should recover promptly. Eye tracking should feel continuous; eyelids must blink in any direction.

This handoff intentionally does not invent names for all 14 expressions or all 12 beats. The definitive lists live in `design/living-companion/STUDIGO_EXPRESSIVENESS_SPEC.md`. Source terminology wins.

## Mood meter

The approved “Spark”/mood concept is **per-session, memory-only**, a presentation layer for warmth and liveliness—not a permanent bond score, XP system, reward currency or student grade. Mistakes do not lower mood. Read `MOOD_METER.md` for the rule table and tests before writing code.

## Seven lightweight school-subject outfits

Seven suggested slots are: science goggles, history explorer hat, math visor, reading glasses with book cape, art beret, music headphones and civics sash. They are original, age-appropriate, selectable cosmetic layers, with approved pivots and provenance. No buying or achievement-gated unlocking in v1. The rig must be able to display them without substantial extra performance cost. Final artwork requires owner review.

## Voice and mouth

An optional `MouthDriver` contract should be able to consume audio amplitude, timed visemes or word boundaries, with tested fallbacks. This **does not mean live voice has shipped**. Real voice integration is LC-10, dependent on owner-supplied promo narration. Respect mute and existing speech-off defaults.

## Stalling, waiting, attention

Study-room presence can respond gently when the learner appears stalled, using only the approved application event interface; do not log raw pointer paths or interpret private material through an unapproved model. Stall thresholds should be **measured** (LC-0b) on representative reading tasks; placeholder intervals are not fixed product facts. Guided Learn event contracts, including hit/miss/stall, require coordination with the actual GL module owner.

## Motion technology

Rive is the first candidate for a controlled prototype; layered Canvas is the comparator. Neither is chosen until an actual render, resource usage, identity fidelity and iPhone behavior have been evaluated. The animation logic should remain reasonably independent of the chosen renderer.

## The six non-negotiable product boundaries

1. Same wingless orange dragon, no design drift.
2. Floating dock and fixed strip are **two presentations, one companion**.
3. Actual learning/grade/mastery writes remain controlled by existing deterministic systems.
4. Reduced-motion/Calm mode, accessible controls, student privacy.
5. Legacy WebP rendering and whole-companion-off switch remain usable if the new renderer fails.
6. Measured code, device tests and owner sign-off are required; demo videos do not constitute implementation evidence.

## Exact documents

- `design/living-companion/README.md` (index)
- `design/living-companion/DECISIONS.md` (LC-DEC IDs)
- `design/living-companion/STUDIGO_EXPRESSIVENESS_SPEC.md`
- `design/living-companion/MOOD_METER.md`
- `design/living-companion/SHARED_COMPANION_EVENTS.md`
- `design/living-companion/RECONCILIATION.md`
- `design/living-companion/assets/ASSET_MANIFEST.md`
- `implementation/LIVING_COMPANION_V1_PLAN.md`

Exact direct URLs are in `08_LIVE_SOURCES_AND_LINKS.md`.
