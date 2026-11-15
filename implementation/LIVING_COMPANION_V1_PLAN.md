# Living Companion v1 plan (formerly "Studigo v2 Phase 4")

Status: **PLAN — NOT IMPLEMENTED, NOT TESTED, NOT DEPLOYED.** Baseline: `main` @ `056066fb2b13a0fe8a529bee74c630ea7c43e723` (2026-10-21, "Make guided Learn checks varied and proportional to reading (#266)").
Supersedes the Oct 16 draft on `research/phase4-coucou-rea-behavior-spec` (PR #164, head `7831ec1`), which shares no git history with `main` and cannot be merged as is.
Renamed because `docs/ROADMAP.md` already defines "Phase 4 — Reliability, safety, cost".

Companion docs: `design/living-companion/` — RECONCILIATION, STUDIGO_EXPRESSIVENESS_SPEC, MOOD_METER, SHARED_COMPANION_EVENTS, COUCOU_REA_BEHAVIOR_EXTRACTION, AGENT_RUNBOOK, assets/ASSET_MANIFEST.

## Goal (APPROVED-BY-OWNER)
Studigo becomes a fully expressive companion and friend — the dynamic range of Muse (Jolly), OpenAI dots, Coucou, the Pokemon GO buddy, and Grok companions' head turning and eye movement — with an original personality built from Sonic (speed), Ms. Frizzle (curiosity), Pikachu (emotive cues) and Krypto (loyalty). Two placements: floating repositionable dock and fixed strip between nav and colored rail (videos V2, V3). Per-session mood meter. School-subject outfits. Voice arrives later from the promo video narration (no engine assumed). No wings. Something kids enjoy beyond games and stars, without XP/gamification in v1.

## Invariants (every task)
Never write mastery, grades, progress or evidence; react only to committed events; no camera/mic/pointer logging; reduced-motion/Calm mode; existing WebP + `NEXT_PUBLIC_STUDIGO_COMPANION=off` keep working; one character and one RAF loop; motion failure never blocks the room; Coucou/Mochi art and sounds not copied.

## v1 definition of done
1. 14 expressions blend (≤200 ms crossfade, no popping) in both placements; eyes lead head; independent blinks in every gaze direction.
2. ≥10 beats from the spec, each returning to REST; interrupts return to REST ≤400 ms.
3. All `SHARED_COMPANION_EVENTS.md` reactions wired, including GL08 hit/miss/stall, from committed events only.
4. Mood meter per `MOOD_METER.md`, with tests; nothing persisted.
5. Floating dock: free normalized position persists across reload, legacy `dock` corners migrate; never covers composer/answers/citations/nav/modals. Strip: Phase 3 100%→60% tuck unchanged, rail unmoved.
6. Provider-agnostic `MouthDriver` plug-in (amplitude, timed visemes, word-boundary fallback) implemented and tested with fixtures; real voice wired in LC-10 (not required for v1 done if voice not yet delivered).
6b. Seven subject outfits selectable in settings/onboarding as layer swaps; cosmetic only, no unlocks/purchases; no measurable frame-time regression vs no outfit.
7. Calm/reduced-motion mode passes QA A02.
8. Performance targets (C17) confirmed by William after first measurement and met on named devices. Stall thresholds set from LC-0b data.
9. QA matrix (artifact `07_QA_RELEASE_ACCEPTANCE.md` rows V01–V08, UI01–UI10, L01–L07, A01–A09) passes on the release SHA with evidence.
10. William signs off identity and "feels alive" vs the V1–V3 videos.
11. `NEXT_PUBLIC_STUDIGO_COMPANION_MOTION` off restores legacy sprites; rollback rehearsed.

## Work breakdown (estimates are agent-days, ranges, ENGINEERING PROPOSAL)

| ID | Task | Owner | Depends | Acceptance | Est. |
|---|---|---|---|---|---|
| LC-0 | Baseline: record main SHA + Vercel prod SHA, screenshots 375/390/768/1024/1440, nav→strip→rail geometry, flags; download V1–V3 into repo/archive with sha256; refresh companion file inventory | Green Ranger | — | Evidence file in `design/living-companion/evidence/LC-0.md` | 0.5–1 |
| LC-0b | Measure stall: time-on-beat distribution on Guided Learn fixtures/preview (2nd-grade + college), propose `STALL_LEVEL1_MS` (placeholder 20–45 s) and level 2 (placeholder 2×) | Green Ranger + Blue Ranger | LC-0 | Data + proposal in evidence; William approves values | 0.5–1 |
| LC-1 | Feasibility bake-off: Rive vs layered Canvas rig; split art into ~20 parts, 6 expressions, 3 beats, gaze, lip-sync stub, Calm mode; throwaway page behind flag | Yellow Ranger (agent) | LC-0 | Spec §14 8 criteria measured; go/no-go note; William identity + feel sign-off | 3–5 (hard cap 7) |
| LC-2 | Pure TS motion director: state machine L0–L5, channels, named springs, beats, mood meter, injected clock/RNG; re-extract Coucou Swift numbers | Blue Ranger (agent) | LC-1 decision on channel set | Unit tests: 30/60/120 Hz equivalence, preemption, 10k-sequence mood bounds, import-boundary test | 3–5 |
| LC-3 | Renderer adapter behind `NEXT_PUBLIC_STUDIGO_COMPANION_MOTION` inside existing `engine.ts`/`CompanionHandle`; WebP fallback | Yellow Ranger | LC-1, LC-2 | Flag on/off parity screenshots same SHA; no per-frame React renders; no orphaned RAF | 2–4 |
| LC-4 | Full rig production: 14 expressions, 12 beats, idle ladder + vignettes, touch play, outfits slots (if C10 yes) | Yellow Ranger (agent) + William review | LC-3 | V01–V03, V07 evidence | 5–10 |
| LC-4b | Subject outfits: 7 original layers, slot pivots, settings/onboarding picker (read existing settings, cosmetic pref only) | Yellow Ranger (agent) + William art review | LC-4 | Layer swap ≤1 draw layer/slot; frame-time delta measured; no star/mastery reads | 2–4 |
| LC-5 | Floating dock free position: versioned normalized x/y in `companion-prefs.ts`, legacy migration, obstruction avoidance, keyboard move | Yellow Ranger | LC-3 | UI01–UI05 | 2–4 |
| LC-6 | Fixed strip host: contained motion, Phase 3 tuck preserved, mode switch | Yellow Ranger | LC-3 | UI06–UI10 | 2–3 |
| LC-7 | Shared events: extend `CompanionEvent` additively, `stall` from GL02, reactions + mood wiring | Blue Ranger (emit) + Yellow Ranger (react) | LC-2, GL02 | L01–L05; GL08 acceptance | 2–3 |
| LC-8 | `MouthDriver` plug-in interface + boundary fallback + fixtures; original chirp bank | Yellow Ranger | LC-4 | Fixture tests for all 3 driver kinds; mute respected | 1–2 |
| LC-10 | Voice integration (later): wire promo-video narration voice into `MouthDriver` | Yellow Ranger | **Gated on voice delivered by William**; LC-8 | ≤80 ms mouth lag (amplitude/viseme); William sign-off | 1–3 |
| LC-9 | QA, performance on devices, accessibility, canary, rollback rehearsal, release gate | Green Ranger + William | all | Release gate 1–8 in artifact file 07 | 3–5 |

Total (excl. LC-10): ~27–49 agent-days plus William review time. Red Ranger (lead) assigns and integrates; each task is its own PR.

## Rollback
Motion flag off → legacy WebP companion. Companion flag off → no companion. No DB changes in this track. Rollback anchor = LC-0 post-Phase-3 SHA, not the Oct 15 pre-redesign golden.

## Open questions (William)
None open; all resolved Oct 25 (RECONCILIATION C9, C10, C17, C19, C20).
