# PROJECT: Studigo Animation System V2

| Field | Current record |
| --- | --- |
| CURRENT PHASE | 8 — device verification after the [integration checkpoint](07-integration.md) |
| CURRENT STATUS | NOT DONE — local integration runs in Chrome. Physical Apple-device and signed-in voice checks are open. |
| LAST VERIFIED PASSING GATE | Gate 7 local integration — [shared product hosts](07-integration.md), [browser evidence](08-qa-evidence.md) |
| REMOTE BRANCH | `origin/feat/studigo-animation-v2` |
| LATEST VERIFIED COMMIT | `50eb557294aa9615c71d162a4b37d199d4076e38` is the source/runtime checkpoint in [draft PR 271](https://github.com/WGLewis0721/Studigo-ai/pull/271). |
| LOCAL WORKTREE STATE | Dedicated branch in `studigo-living-companion-upgrade-ee0706`. Claude's source worktrees remain intact. |
| CURRENT IMPLEMENTATION | Rive is the local default for the public guide, onboarding, Home and Study Room window and strip. A single renderer owns the art and state-machine bindings. The legacy renderer remains available as a rollback. |
| VALIDATED ARTIFACTS | Recovered Phase 0 sheets, SHA-256 checked against Claude's local originals. V1–V3 film checksums match LC-0. |
| APPROVED CHARACTER REFERENCES | [Mascot bible](../brand/mascot/README.md), [asset manifest](../../design/living-companion/assets/ASSET_MANIFEST.md). |
| RIVE PROJECT LOCATION | `design/living-companion/rive/studigo/` |
| RUNTIME ASSET LOCATION | `apps/web/public/mascot/rive/studigo.riv` (idle, 25 additional intent targets, 7 outfits, 3 emotes, existing flame levels). |
| TEST COMMANDS | `rive design/living-companion/rive/studigo --verify`, `rive inspect design/living-companion/rive/studigo --summary`, Rive `--commands` pose captures and ImageMagick AE comparison. |
| LAST TEST RESULTS | Chrome 157 passed the local and clean-checkout journeys and showroom. TypeScript, 33 focused tests, repository lint and a byte-identical clean Rive rebuild passed. See [QA evidence](08-qa-evidence.md) for the stress run and gaps. |
| VISUAL EVIDENCE | [Baseline](evidence/phase0/), [character and V1](evidence/phase1/), [rig](evidence/phase2/), [idle](evidence/phase3/), [transitions](evidence/phase4/) and [integrated preview](evidence/phase7/). |
| DEVICE VALIDATION | Windows desktop Chrome and a 390 px emulated touch viewport passed the local journey. Physical desktop, iPhone and iPad Safari are pending. |
| KNOWN FAILURES | The local export includes the Free-tier splash. Authenticated provider replies, browser speech on real devices, and GPU/WASM memory are unverified. |
| EXTERNAL BLOCKERS | The required physical Safari devices are unavailable on this Windows host. |
| UNCOMMITTED WORK | Preexisting `design/living-companion/evidence/character-tech-research.md` is outside the phase commits. |
| REGRESSION RISKS | Identity and part seams, placement, growth and outfits, learning event semantics, input accessibility and fallback. |
| NEXT EXACT ACTION | Run the published build in desktop, iPhone and iPad Safari, including the signed-in voice acceptance path on a configured development account. Record failures and CPU/GPU measurements before enabling the release flag. |
| NEXT GATE REQUIREMENTS | All required devices, live conversation and recorded performance, clean checkout and reviewable PR. |
| DISNEY PRINCIPLES REVIEW | [Observable criteria and open checks](ANIMATION_PRINCIPLES.md). |
| FINAL DONE CRITERIA | All evidence-backed gates in [ASSIGNMENT.md](ASSIGNMENT.md), plus the takeover's visual recordings, physical Safari QA, clean-checkout reproduction, verified push and reviewable PR. |
