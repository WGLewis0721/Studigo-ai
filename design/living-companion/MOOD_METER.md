# Mood meter ("Spark") — per-session, presentation only

**APPROVED-BY-OWNER:** a mood meter exists and reacts to study events. **APPROVED-BY-OWNER:** no separate memory settings; personalization (name, age band, preferences) is read from existing study room + onboarding settings. Everything else here is ENGINEERING PROPOSAL.

## Model
- Value `spark ∈ [0, 4]` (float), displayed as 5 tiers: 0 Cozy, 1 Calm, 2 Sunny, 3 Bouncy, 4 Sparkling. (Shape follows Pokemon GO buddy's 5 moods; names original.)
- **Start** each session at 2 (Sunny). Never below 1 while the learner is active — a low tier means *calm/sleepy*, never sad, disappointed or upset.
- **Inputs:** only events from `SHARED_COMPANION_EVENTS.md`, plus pet/play (+0.25 each, capped at +1 per minute).
- **Decay:** toward 2 with half-life 90 s while active; toward 0 (sleepy) during idle per existing `idleStage` (lean 60 s, sleep 180 s).
- **Bounds:** per-event change capped at ±2; `wrong`/`blindspot`/`cardMiss`/`stall` contribute **0** — mistakes never lower mood.

## What mood changes
Only amplitude and choice among already-allowed behaviors: idle bounce/wag amplitude, idle vignette frequency, chirp frequency, tier-specific idle vignettes. Never: lines that judge the child, colors that signal failure, blocking UI, rewards.

## Hard rules
1. Stored in memory only (React/engine state). Not written to localStorage, Supabase, analytics, logs, or evidence. Gone on reload/room change.
2. Never written to or read by mastery, grading, progression, XP, coins, streak economy. No XP/gamification implementation in v1.
3. No visible numeric meter in v1 (OPEN: whether to show a small visual, see open questions). The mood shows through Studigo's behavior.
4. Pure function: `nextSpark(spark, event, dtMs) → spark`, injected clock, unit-tested (deterministic, 30/60/120 Hz equivalent).

## Calm mode / reduced motion
When `prefers-reduced-motion` or the companion's Calm toggle is on, the meter still runs but maps every tier to the same low-amplitude idle (blinks, small nods, 300 ms fades). No particles beyond 4, no dashes or spins.

## Tests (LC-2)
- Sequence fixtures: 10 wrong in a row → spark ≥ 1 and never decreases from wrong.
- Bounds hold for 10,000 random event sequences.
- Static check: mood module imports nothing from `lib/learning`, Supabase, or `packages/ai`.
