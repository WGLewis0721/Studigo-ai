# PROJECT: Studigo Animation System V2

| Field | Current record |
| --- | --- |
| CURRENT PHASE | 6 — build the shared React character |
| CURRENT STATUS | IN PROGRESS |
| LAST VERIFIED PASSING GATE | Gate 5 — [behavior library and tests](05-behaviors.md) |
| REMOTE BRANCH | `origin/feat/studigo-animation-v2` |
| LATEST VERIFIED COMMIT | `b5de0ce2001760ceaef78e8a63de45215f48cc2b` was verified on origin after Gate 4. This Phase 5 checkpoint is identified by its containing commit. |
| LOCAL WORKTREE STATE | Dedicated branch in `studigo-living-companion-upgrade-ee0706`. Claude's source worktrees remain intact. |
| CURRENT IMPLEMENTATION | Study Room WebGL rig with sprite fallback. Full-body sprite stage is separate. V2 has no active runtime integration. |
| VALIDATED ARTIFACTS | Recovered Phase 0 sheets, SHA-256 checked against Claude's local originals. V1–V3 film checksums match LC-0. |
| APPROVED CHARACTER REFERENCES | [Mascot bible](../brand/mascot/README.md), [asset manifest](../../design/living-companion/assets/ASSET_MANIFEST.md). |
| RIVE PROJECT LOCATION | `design/living-companion/rive/studigo/` |
| RUNTIME ASSET LOCATION | `apps/web/public/mascot/rive/studigo.riv` (idle and 16 intent targets, no production consumer yet). |
| TEST COMMANDS | `rive design/living-companion/rive/studigo --verify`, `rive inspect design/living-companion/rive/studigo --summary`, Rive `--commands` pose captures and ImageMagick AE comparison. |
| LAST TEST RESULTS | Gate 4 pushed and verified. Gate 5: five policy tests passed, new behaviors and interrupted sequence rendered, final reduced-motion frame matched neutral exactly. |
| VISUAL EVIDENCE | [Baseline](evidence/phase0/), [character and V1](evidence/phase1/), [rig](evidence/phase2/), [idle](evidence/phase3/) and [transitions](evidence/phase4/). |
| DEVICE VALIDATION | No new browser or physical-device validation. |
| KNOWN FAILURES | Legacy sprite paths can still change complete portraits. Baseline browser limits are recorded in Gate 0. |
| EXTERNAL BLOCKERS | Required Safari devices are not available on this Windows host. No blocker to Phase 6. |
| UNCOMMITTED WORK | Preexisting `design/living-companion/evidence/character-tech-research.md` is outside the phase commits. |
| REGRESSION RISKS | Identity and part seams, placement, growth and outfits, learning event semantics, input accessibility and fallback. |
| NEXT EXACT ACTION | Wire the Rive asset and typed behavior policy to one reusable React component and controller. Test actual browser playback, load failure and multiple instances before migration. |
| NEXT GATE REQUIREMENTS | Typed public API, accessible input, system reduced motion, static fallback, cleanup and compatibility with the existing room event contract. |
| FINAL DONE CRITERIA | All evidence-backed gates in [ASSIGNMENT.md](ASSIGNMENT.md), plus the takeover's visual recordings, physical Safari QA, clean-checkout reproduction, verified push and reviewable PR. |
