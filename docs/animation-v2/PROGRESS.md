# PROJECT: Studigo Animation System V2

| Field | Current record |
| --- | --- |
| CURRENT PHASE | 6 — build the shared React character |
| CURRENT STATUS | IN PROGRESS — React checkpoint. Browser first-frame check timed out. |
| LAST VERIFIED PASSING GATE | Gate 5 — [behavior library and tests](05-behaviors.md) |
| REMOTE BRANCH | `origin/feat/studigo-animation-v2` |
| LATEST VERIFIED COMMIT | `02f6b67686d146d2f7f9bf57745eed265efb3b20` was verified on origin after Gate 5. The React checkpoint is the commit containing [the after-action report](AFTER_ACTION_2026-11-21.md). |
| LOCAL WORKTREE STATE | Dedicated branch in `studigo-living-companion-upgrade-ee0706`. Claude's source worktrees remain intact. |
| CURRENT IMPLEMENTATION | Study Room WebGL rig with sprite fallback. Full-body sprite stage is separate. V2 React component and typed controller are connected only in the local `/dev/studigo` fixture. |
| VALIDATED ARTIFACTS | Recovered Phase 0 sheets, SHA-256 checked against Claude's local originals. V1–V3 film checksums match LC-0. |
| APPROVED CHARACTER REFERENCES | [Mascot bible](../brand/mascot/README.md), [asset manifest](../../design/living-companion/assets/ASSET_MANIFEST.md). |
| RIVE PROJECT LOCATION | `design/living-companion/rive/studigo/` |
| RUNTIME ASSET LOCATION | `apps/web/public/mascot/rive/studigo.riv` (idle and 16 intent targets, no production consumer yet). |
| TEST COMMANDS | `rive design/living-companion/rive/studigo --verify`, `rive inspect design/living-companion/rive/studigo --summary`, Rive `--commands` pose captures and ImageMagick AE comparison. |
| LAST TEST RESULTS | Gate 5 pushed and verified. Web typecheck and five policy tests passed with the React checkpoint. The Chromium showroom test timed out waiting for `data-studigo=ready`. |
| VISUAL EVIDENCE | [Baseline](evidence/phase0/), [character and V1](evidence/phase1/), [rig](evidence/phase2/), [idle](evidence/phase3/) and [transitions](evidence/phase4/). |
| DEVICE VALIDATION | No new browser or physical-device validation. |
| KNOWN FAILURES | The showroom first-frame gate has not passed. Its route and primary WASM served HTTP 200 in local diagnostics. The first diagnostic snapshot was blank after the load callback. The revised readiness path waits for the runtime's draw event and the browser QA timed out. |
| EXTERNAL BLOCKERS | Required Safari devices are not available on this Windows host. No blocker to Phase 6. |
| UNCOMMITTED WORK | Preexisting `design/living-companion/evidence/character-tech-research.md` is outside the phase commits. |
| REGRESSION RISKS | Identity and part seams, placement, growth and outfits, learning event semantics, input accessibility and fallback. |
| NEXT EXACT ACTION | Trace the first canvas draw with `scripts/living-companion/studigo-v2-showroom-qa.mjs`. Check runtime onLoad/onLoadError, the bound model and render callbacks, and whether the shared offscreen renderer paints. Then rerun pixel, keyboard, pet, calm, remount and fallback assertions before migration. |
| NEXT GATE REQUIREMENTS | Typed public API, accessible input, system reduced motion, static fallback, cleanup and compatibility with the existing room event contract. |
| FINAL DONE CRITERIA | All evidence-backed gates in [ASSIGNMENT.md](ASSIGNMENT.md), plus the takeover's visual recordings, physical Safari QA, clean-checkout reproduction, verified push and reviewable PR. |
