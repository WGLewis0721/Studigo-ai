# PROJECT: Studigo Animation System V2

| Field | Current record |
| --- | --- |
| CURRENT PHASE | 2 — build the connected Rive rig |
| CURRENT STATUS | IN PROGRESS |
| LAST VERIFIED PASSING GATE | Gate 1 — [character specification](01-character-spec.md) and [Higgsfield motion](01-higgsfield-motion.md) |
| REMOTE BRANCH | `origin/feat/studigo-animation-v2` |
| LATEST VERIFIED COMMIT | `8777234b36541587fa3036ca366e7aab0923fabf` was verified on origin after Gate 0. This Phase 1 checkpoint is identified by its containing commit. |
| LOCAL WORKTREE STATE | Dedicated branch in `studigo-living-companion-upgrade-ee0706`. Claude's source worktrees remain intact. |
| CURRENT IMPLEMENTATION | Study Room WebGL rig with sprite fallback. Full-body sprite stage is separate. V2 has no active runtime integration. |
| VALIDATED ARTIFACTS | Recovered Phase 0 sheets, SHA-256 checked against Claude's local originals. V1–V3 film checksums match LC-0. |
| APPROVED CHARACTER REFERENCES | [Mascot bible](../brand/mascot/README.md), [asset manifest](../../design/living-companion/assets/ASSET_MANIFEST.md). |
| RIVE PROJECT LOCATION | Planned at `design/living-companion/rive/studigo/`. Gate 2 authoring is next. |
| RUNTIME ASSET LOCATION | Pending rig and idle validation. |
| TEST COMMANDS | Baseline: `git fetch origin`, `git rev-list --left-right --count 'HEAD...@{u}'`, `git ls-remote origin refs/heads/feat/studigo-animation-v2`, `rive doctor`, SHA-256 for source evidence. |
| LAST TEST RESULTS | Gate 0 pushed and verified. V1–V3 hashes matched LC-0 and all 289 V1 frames were extracted and reviewed as contact sheets. No new app regression run. |
| VISUAL EVIDENCE | [Baseline defect sheets](evidence/phase0/) and [character and V1 reference sheets](evidence/phase1/). V2 playback has not been captured. |
| DEVICE VALIDATION | No new browser or physical-device validation. |
| KNOWN FAILURES | Legacy sprite paths can still change complete portraits. Baseline browser limits are recorded in Gate 0. |
| EXTERNAL BLOCKERS | Required Safari devices are not available on this Windows host. No blocker to Phase 2. |
| UNCOMMITTED WORK | Preexisting `design/living-companion/evidence/character-tech-research.md` is outside the phase commits. |
| REGRESSION RISKS | Identity and part seams, placement, growth and outfits, learning event semantics, input accessibility and fallback. |
| NEXT EXACT ACTION | Author the canonical full-body rig from the approved 540 px neutral. Establish the floor, neck, shoulder, eye and tail pivots. Validate isolated joint extremes in Rive against the Phase 1 sheet. |
| NEXT GATE REQUIREMENTS | Editable Rive source, recorded pivots and provenance, connected motion under isolated and combined poses, and visual evidence without detached or doubled features. |
| FINAL DONE CRITERIA | All evidence-backed gates in [ASSIGNMENT.md](ASSIGNMENT.md), plus the takeover's visual recordings, physical Safari QA, clean-checkout reproduction, verified push and reviewable PR. |
