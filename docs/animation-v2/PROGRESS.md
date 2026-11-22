# PROJECT: Studigo Animation System V2

| Field | Current record |
| --- | --- |
| CURRENT PHASE | 3 — author and validate the continuous idle |
| CURRENT STATUS | IN PROGRESS |
| LAST VERIFIED PASSING GATE | Gate 2 — [connected rig and inspection](02-rig.md) |
| REMOTE BRANCH | `origin/feat/studigo-animation-v2` |
| LATEST VERIFIED COMMIT | `69a9a18b2bf3057a70929a0b0ca08c6520164144` was verified on origin after Gate 1. This Phase 2 checkpoint is identified by its containing commit. |
| LOCAL WORKTREE STATE | Dedicated branch in `studigo-living-companion-upgrade-ee0706`. Claude's source worktrees remain intact. |
| CURRENT IMPLEMENTATION | Study Room WebGL rig with sprite fallback. Full-body sprite stage is separate. V2 has no active runtime integration. |
| VALIDATED ARTIFACTS | Recovered Phase 0 sheets, SHA-256 checked against Claude's local originals. V1–V3 film checksums match LC-0. |
| APPROVED CHARACTER REFERENCES | [Mascot bible](../brand/mascot/README.md), [asset manifest](../../design/living-companion/assets/ASSET_MANIFEST.md). |
| RIVE PROJECT LOCATION | `design/living-companion/rive/studigo/` |
| RUNTIME ASSET LOCATION | Pending rig and idle validation. |
| TEST COMMANDS | `rive design/living-companion/rive/studigo --verify`, `rive inspect design/living-companion/rive/studigo --summary`, Rive `--commands` pose captures and ImageMagick AE comparison. |
| LAST TEST RESULTS | Gate 1 pushed and verified. Gate 2 zero errors, zero warnings, 12 pose captures and an exact rest-frame round trip. No new app regression run. |
| VISUAL EVIDENCE | [Baseline](evidence/phase0/), [character and V1](evidence/phase1/), [rig bind and pose sheet](evidence/phase2/). Idle playback has not been captured. |
| DEVICE VALIDATION | No new browser or physical-device validation. |
| KNOWN FAILURES | Legacy sprite paths can still change complete portraits. Baseline browser limits are recorded in Gate 0. |
| EXTERNAL BLOCKERS | Required Safari devices are not available on this Windows host. No blocker to Phase 3. |
| UNCOMMITTED WORK | Preexisting `design/living-companion/evidence/character-tech-research.md` is outside the phase commits. |
| REGRESSION RISKS | Identity and part seams, placement, growth and outfits, learning event semantics, input accessibility and fallback. |
| NEXT EXACT ACTION | Add the 9-second Rive idle on the same artboard. Retain the inspection timeline and add a reduced-motion option. Render repeated loops before adding further states. |
| NEXT GATE REQUIREMENTS | Reviewable 30-second recording, one and five loops, adjacent seam frames, 60-second stability, viewport coverage, reduced motion and a side-by-side V1 comparison. |
| FINAL DONE CRITERIA | All evidence-backed gates in [ASSIGNMENT.md](ASSIGNMENT.md), plus the takeover's visual recordings, physical Safari QA, clean-checkout reproduction, verified push and reviewable PR. |
