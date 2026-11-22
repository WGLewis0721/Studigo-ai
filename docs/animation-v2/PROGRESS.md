# PROJECT: Studigo Animation System V2

| Field | Current record |
| --- | --- |
| CURRENT PHASE | 5 — complete the behavior library |
| CURRENT STATUS | IN PROGRESS |
| LAST VERIFIED PASSING GATE | Gate 4 — [transition and interruption evidence](04-transitions.md) |
| REMOTE BRANCH | `origin/feat/studigo-animation-v2` |
| LATEST VERIFIED COMMIT | `2927106730b6cd7e8c3fb4fb7d09812a1e5b0812` was verified on origin after Gate 3. This Phase 4 checkpoint is identified by its containing commit. |
| LOCAL WORKTREE STATE | Dedicated branch in `studigo-living-companion-upgrade-ee0706`. Claude's source worktrees remain intact. |
| CURRENT IMPLEMENTATION | Study Room WebGL rig with sprite fallback. Full-body sprite stage is separate. V2 has no active runtime integration. |
| VALIDATED ARTIFACTS | Recovered Phase 0 sheets, SHA-256 checked against Claude's local originals. V1–V3 film checksums match LC-0. |
| APPROVED CHARACTER REFERENCES | [Mascot bible](../brand/mascot/README.md), [asset manifest](../../design/living-companion/assets/ASSET_MANIFEST.md). |
| RIVE PROJECT LOCATION | `design/living-companion/rive/studigo/` |
| RUNTIME ASSET LOCATION | `apps/web/public/mascot/rive/studigo.riv` (idle and 9 intent targets, no production consumer yet). |
| TEST COMMANDS | `rive design/living-companion/rive/studigo --verify`, `rive inspect design/living-companion/rive/studigo --summary`, Rive `--commands` pose captures and ImageMagick AE comparison. |
| LAST TEST RESULTS | Gate 3 pushed and verified. Gate 4: nine target poses and interrupted reversals captured, exact neutral when reduced motion starts midair, zero compiler errors. No new app regression run. |
| VISUAL EVIDENCE | [Baseline](evidence/phase0/), [character and V1](evidence/phase1/), [rig](evidence/phase2/), [idle](evidence/phase3/) and [transitions](evidence/phase4/). |
| DEVICE VALIDATION | No new browser or physical-device validation. |
| KNOWN FAILURES | Legacy sprite paths can still change complete portraits. Baseline browser limits are recorded in Gate 0. |
| EXTERNAL BLOCKERS | Required Safari devices are not available on this Windows host. No blocker to Phase 5. |
| UNCOMMITTED WORK | Preexisting `design/living-companion/evidence/character-tech-research.md` is outside the phase commits. |
| REGRESSION RISKS | Identity and part seams, placement, growth and outfits, learning event semantics, input accessibility and fallback. |
| NEXT EXACT ACTION | Add distinct encouraging, correct, incorrect, curious, sleepy, wake and petting clips. Specify their trigger, priority, duration, interruption and reduced-motion equivalent. |
| NEXT GATE REQUIREMENTS | Every behavior has a rendered target and passes individual and combined QA. Its timing and return-to-base rules have deterministic coverage. |
| FINAL DONE CRITERIA | All evidence-backed gates in [ASSIGNMENT.md](ASSIGNMENT.md), plus the takeover's visual recordings, physical Safari QA, clean-checkout reproduction, verified push and reviewable PR. |
