# PROJECT: Studigo Animation System V2

| Field | Current record |
| --- | --- |
| CURRENT PHASE | 7 — integrate the companion-first experience and existing room hosts |
| CURRENT STATUS | IN PROGRESS — browser runtime validated. |
| LAST VERIFIED PASSING GATE | Gate 6 — [shared browser component](06-component-api.md) |
| REMOTE BRANCH | `origin/feat/studigo-animation-v2` |
| LATEST VERIFIED COMMIT | `975b20f3b95293995de5f9ca5bb7d3457512f3fb` was verified at resumption. The next checkpoint is the commit containing the Gate 6 browser evidence. |
| LOCAL WORKTREE STATE | Dedicated branch in `studigo-living-companion-upgrade-ee0706`. Claude's source worktrees remain intact. |
| CURRENT IMPLEMENTATION | Study Room WebGL rig with sprite fallback. Full-body sprite stage is separate. V2 React component and typed controller are connected only in the local `/dev/studigo` fixture. |
| VALIDATED ARTIFACTS | Recovered Phase 0 sheets, SHA-256 checked against Claude's local originals. V1–V3 film checksums match LC-0. |
| APPROVED CHARACTER REFERENCES | [Mascot bible](../brand/mascot/README.md), [asset manifest](../../design/living-companion/assets/ASSET_MANIFEST.md). |
| RIVE PROJECT LOCATION | `design/living-companion/rive/studigo/` |
| RUNTIME ASSET LOCATION | `apps/web/public/mascot/rive/studigo.riv` (idle and 16 intent targets, no production consumer yet). |
| TEST COMMANDS | `rive design/living-companion/rive/studigo --verify`, `rive inspect design/living-companion/rive/studigo --summary`, Rive `--commands` pose captures and ImageMagick AE comparison. |
| LAST TEST RESULTS | Chromium 151 passed painted character idle, keyboard, pet, reduced motion, multiple instances, remount, and missing-asset fallback. |
| VISUAL EVIDENCE | [Baseline](evidence/phase0/), [character and V1](evidence/phase1/), [rig](evidence/phase2/), [idle](evidence/phase3/) and [transitions](evidence/phase4/). |
| DEVICE VALIDATION | Windows Chromium showroom passed. Physical Safari pending. |
| KNOWN FAILURES | Companion-first onboarding, continuous touch/gaze, and live cosmetic integration remain to be completed. |
| EXTERNAL BLOCKERS | Required Safari devices are not available on this Windows host. No blocker to local integration. |
| UNCOMMITTED WORK | Preexisting `design/living-companion/evidence/character-tech-research.md` is outside the phase commits. |
| REGRESSION RISKS | Identity and part seams, placement, growth and outfits, learning event semantics, input accessibility and fallback. |
| NEXT EXACT ACTION | Wire a close-up encounter into first-run Home using this component. Add continuous gaze and region-based touch on the same rig, then connect the existing room event and buddy systems. |
| NEXT GATE REQUIREMENTS | Companion-first entry through real study handoff, applicable surfaces migrated with rollback, touch and expression evidence, and growth and outfit compatibility. |
| DISNEY PRINCIPLES REVIEW | [Observable criteria and open checks](ANIMATION_PRINCIPLES.md). |
| FINAL DONE CRITERIA | All evidence-backed gates in [ASSIGNMENT.md](ASSIGNMENT.md), plus the takeover's visual recordings, physical Safari QA, clean-checkout reproduction, verified push and reviewable PR. |
