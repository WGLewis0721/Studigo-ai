# PROJECT: Studigo Animation System V2

| Field | Current record |
| --- | --- |
| CURRENT PHASE | 4 — implement fluid transitions |
| CURRENT STATUS | IN PROGRESS |
| LAST VERIFIED PASSING GATE | Gate 3 — [continuous idle and recordings](03-idle.md) |
| REMOTE BRANCH | `origin/feat/studigo-animation-v2` |
| LATEST VERIFIED COMMIT | `561cc26cbe0704882d2b177732b1c5da509f6db7` was verified on origin after Gate 2. This Phase 3 checkpoint is identified by its containing commit. |
| LOCAL WORKTREE STATE | Dedicated branch in `studigo-living-companion-upgrade-ee0706`. Claude's source worktrees remain intact. |
| CURRENT IMPLEMENTATION | Study Room WebGL rig with sprite fallback. Full-body sprite stage is separate. V2 has no active runtime integration. |
| VALIDATED ARTIFACTS | Recovered Phase 0 sheets, SHA-256 checked against Claude's local originals. V1–V3 film checksums match LC-0. |
| APPROVED CHARACTER REFERENCES | [Mascot bible](../brand/mascot/README.md), [asset manifest](../../design/living-companion/assets/ASSET_MANIFEST.md). |
| RIVE PROJECT LOCATION | `design/living-companion/rive/studigo/` |
| RUNTIME ASSET LOCATION | `apps/web/public/mascot/rive/studigo.riv` (idle-only export, no product consumer yet). |
| TEST COMMANDS | `rive design/living-companion/rive/studigo --verify`, `rive inspect design/living-companion/rive/studigo --summary`, Rive `--commands` pose captures and ImageMagick AE comparison. |
| LAST TEST RESULTS | Gate 2 pushed and verified. Gate 3: verified one and five loops, 1,441 frames in one 60 s session, exact loop boundaries and static reduced motion, plus two viewport sizes. No new app regression run. |
| VISUAL EVIDENCE | [Baseline](evidence/phase0/), [character and V1](evidence/phase1/), [rig](evidence/phase2/), [idle captures](evidence/phase3/). |
| DEVICE VALIDATION | No new browser or physical-device validation. |
| KNOWN FAILURES | Legacy sprite paths can still change complete portraits. Baseline browser limits are recorded in Gate 0. |
| EXTERNAL BLOCKERS | Required Safari devices are not available on this Windows host. No blocker to Phase 4. |
| UNCOMMITTED WORK | Preexisting `design/living-companion/evidence/character-tech-research.md` is outside the phase commits. |
| REGRESSION RISKS | Identity and part seams, placement, growth and outfits, learning event semantics, input accessibility and fallback. |
| NEXT EXACT ACTION | Add runtime steering for eyes and neck and Rive transition mixing while keeping the tested idle channels alive. Render onset, interruption and return for the specified transition set. |
| NEXT GATE REQUIREMENTS | Fluid look directions, listening, thinking, reading, happy and celebration transitions. Return and interruption start from the rendered pose without resets or full-image fades. |
| FINAL DONE CRITERIA | All evidence-backed gates in [ASSIGNMENT.md](ASSIGNMENT.md), plus the takeover's visual recordings, physical Safari QA, clean-checkout reproduction, verified push and reviewable PR. |
