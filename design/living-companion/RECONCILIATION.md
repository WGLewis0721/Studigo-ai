# Reconciliation: Oct 15–16 handoff artifact vs Oct 25 expressiveness spec

Labels: **APPROVED-BY-OWNER** (William said so), **ENGINEERING PROPOSAL** (agent recommendation, changeable without owner), **OPEN** (needs William).
Sources: handoff `Studigo_v2_Phase4_Grok_Handoff/` (files 00–08), PR #164 branch docs, Oct 25 spec, William's Oct 25 answers.

| # | Topic | Artifact (Oct 15–16) | Oct 25 spec | Resolution | Label |
|---|---|---|---|---|---|
| C1 | Track name | "Studigo v2 Phase 4" | same | Renamed **Living Companion track (LC)**; `docs/ROADMAP.md` "## Phase 4 — Reliability, safety, cost" already uses Phase 4. Tasks LC-0..LC-9. | ENGINEERING PROPOSAL |
| C2 | Expression range | 6 targets (neutral, curious, focused, joyful, supportive, sleepy); marked "recommended, not user-locked" | 14 faces | **Range at reference level is owner-wanted** (Muse/Dots/Coucou/PoGO/Grok). v1 ships 14 faces; feasibility test proves 6 first. Artifact's 6 map in: neutral→Cozy/Sunny, curious→Curious, focused→Focused, joyful→Sunny/Proud, supportive→Oopsie/Hmm, sleepy→Sleepy. | Range APPROVED-BY-OWNER; list ENGINEERING PROPOSAL |
| C3 | Renderer | 2D layered rig; CSS/SVG vs Canvas vs small rig; "no final renderer until prototype" | Rive | **Rive is the first candidate in a bounded LC-1 bake-off against a layered Canvas rig**; decision by measured pass/fail. Both agree no renderer is chosen before evidence. | ENGINEERING PROPOSAL |
| C4 | Motion contract | 13 scalar channels + 1 expression, pure director | layered state machine L0–L5, blend 120–200 ms | **Both**: the pure TS director owns state machine + channels (renderer-neutral), and drives Rive inputs or Canvas parts. Channels extend with mouthOpen, frillL/R, tailWag, flameSize, brow, cheekGlow (artifact allowed "optional extensions after baseline"). | ENGINEERING PROPOSAL |
| C5 | Feature flags | keep `NEXT_PUBLIC_STUDIGO_COMPANION=off` (exists, `companion.tsx:60`); add `NEXT_PUBLIC_STUDIGO_COMPANION_MOTION` OFF by default | not addressed | Adopt artifact. Note `NEXT_PUBLIC_` is build-time. | ENGINEERING PROPOSAL |
| C6 | Position prefs | prefs have `dock: br/bl/tr/tl` (verified on main: speech, seated, tuck, dock, scale); add versioned normalized x/y, legacy-compatible | spec said "edge snap / dash between corners" | **Artifact wins**: free normalized position (owner approved V2 "moves as one" to a non-corner spot). Spec text corrected. | Free reposition APPROVED-BY-OWNER; storage ENGINEERING PROPOSAL |
| C7 | Two placements | floating dock + fixed strip (nav→strip→rail) | floating + strip | Same. Preserve Phase 3 100%→60% tuck. | APPROVED-BY-OWNER |
| C8 | Mood | "Bond/XP/streak economy" out of scope; no mood meter | session "Spark" 0–4 | **Mood meter in** (William, Oct 25), per-session, presentation only, never negative from mistakes; no economy. | APPROVED-BY-OWNER (meter); model ENGINEERING PROPOSAL |
| C9 | Speech / lip-sync | speech pref off by default; `mouthOpen` optional | TTS amplitude lip-sync (said ElevenLabs) | William: "Studigo already has a voice." On main the only speech found is browser `speechSynthesis` (read-aloud) and companion text bubbles. Spec's ElevenLabs claim removed. Amplitude needs an audio source; else boundary-event mouth pulses. | RESOLVED (William, Oct 25): voice comes later from the promo video narration; no engine assumed. Mouth = provider-agnostic plug-in (amplitude or timed visemes, fallback word-boundary pulse); task LC-10 gated on voice delivery. APPROVED-BY-OWNER |
| C10 | Outfits/particles | out of scope by default; "no cosmetics copied" | outfits + 24 particles, unlock from star data | Outfits/props in v1 as learner/subject choice, **no unlocks**; particles pooled ≤24, ≤4 in Calm. | RESOLVED: outfits IN v1 — light school-subject options, cosmetic only, chosen in settings/onboarding, no unlocks/purchases, original kid-safe art, layer swaps. APPROVED-BY-OWNER |
| C11 | Personality | supportive, nonjudgmental | Sonic+Frizzle+Pikachu+Krypto rules | Adopt spec rules; no copied likeness/sounds. | APPROVED-BY-OWNER |
| C12 | Wings | NO wings | spec had "hover (wings/flame)" | Removed; flame-hop instead. | APPROVED-BY-OWNER |
| C13 | Gamification | Learn/Earn/Play vision, no XP | none | No XP/coins/unlocks in v1. | APPROVED-BY-OWNER |
| C14 | Events | `CompanionEvent` authoritative, committed only | shared enum incl. stall with GL08 | Merged list in `SHARED_COMPANION_EVENTS.md`; stall emitted by GL02 only. | ENGINEERING PROPOSAL |
| C15 | Greeting by name | not in artifact | greet by onboarding name | Read-only from onboarding settings; no new storage. | APPROVED-BY-OWNER (no memory settings) |
| C16 | Gaze source | pointer, transient | pointer/tap + question card; no camera | Same; no camera/mic. | APPROVED-BY-OWNER |
| C17 | Performance gates | "no made-up budgets; profile" | fixed numbers (60 fps iPhone 12, ≤300 KB) | Numbers kept as **LC-1 provisional targets**, confirmed by William after first measurement. | RESOLVED: targets are provisional, confirmed after first measurement (LC-1). APPROVED-BY-OWNER |
| C18 | Who builds rig | Agent A + optional Higgsfield parts | — | William: a GenAI agent drives design and build to v1; William signs off identity/feel. | APPROVED-BY-OWNER |
| C19 | Branch base | — | — | RESOLVED: branch `docs/living-companion-v1` and all `lc/*` task branches off `main`, PRs target `main`. | APPROVED-BY-OWNER |
| C20 | Stall thresholds | — | `N` s placeholder | RESOLVED: measured-then-tuned parameter. Placeholder level 1 = 20–45 s, level 2 = 2× level 1; final values set from LC-0b measurements. | APPROVED-BY-OWNER (process); values ENGINEERING PROPOSAL |

No OPEN items remain as of 2026-10-25.
