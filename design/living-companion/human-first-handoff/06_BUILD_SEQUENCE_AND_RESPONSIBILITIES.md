# Work sequence: what needs to happen to ship it

This restates the **LC-0 to LC-10** plan in ordinary language. These are **planned packages**, not completed commitments. The repository plan contains test cases, estimates and exact ownership; use it as the engineering contract.

| Phase | Task | Goal | Gate before continuing |
|---|---|---|---|
| Foundation | **LC-0** | Confirm accepted post-Phase-3 code, deployment, screenshots, frame dimensions, current app behaviors and rollback anchor; preserve the three approved video files and hashes. | Exact SHA, real/current evidence, source/asset inventory. |
| Research | **LC-0b** | Measure actual learner stall durations and propose thresholds. | Data first, values reviewed. |
| Rig feasibility | **LC-1** | Compare Rive against layered Canvas using the *same* canonical art. Prototype six faces, three beats, gaze, basic mouth placeholder and Calm mode. | Identity, performance and feel must be approved. |
| Motion core | **LC-2** | Pure TypeScript director, deterministic priorities, springs, idle rules, mood state and time-normalized motion. | Unit tests, replay, cancel/interrupt, no authority cross-over. |
| Web adapter | **LC-3** | Integrate selected renderer behind feature flag while preserving current `CompanionHandle` and WebP fallback. | Same-code-commit flag-on/off checks. |
| Expressiveness | **LC-4** | Build full expressive rig, facial variety, scripted beats and contained interactions. | Look/feel review and measured iPhone behavior. |
| Outfits | **LC-4b** | Add seven cosmetic, original school-subject outfits. | Independent layers and performance evidence; owner art review. |
| Floating mode | **LC-5** | True free safe-area positioning and persistence, migration from corner-only preferences and accessible movement controls. | Reload, resize, obstruction and keyboard/touch tests. |
| Fixed mode | **LC-6** | Integrate the stationary companion above colored divider; preserve 100%/60% Phase 3 geometry. | Strip doesn't move, clip, steal input space or duplicate the dragon. |
| Study events | **LC-7** | Drive reactions only from confirmed Learn/Coach/Practice events, including agreed Guided Learn stall/hit/miss. | No false correct events; no grading/mastery mutations. |
| Mouth adapter | **LC-8** | Implement provider-neutral mouth animation interface with fixtures, no voice dependency. | Boundary cases, mute and fallback tests. |
| Future voice | **LC-10** | Use actual owner-provided voice source later. | Explicit asset/provenance/consent and audio synchronization review. |
| Release | **LC-9** | Mobile/desktop QA, safety/accessibility/performance, limited canary and rollback. | Signed-in actual-app recordings, device measurements, owner acceptance. |

## Practical ownership model

- **Product owner:** accepts visual fidelity, character identity, outfit art, final renderer choice after evidence, device performance budgets and release.
- **Implementation engineer or coding agent:** builds targeted code, with one branch/PR per approved task and exact test evidence. Should not ask for approval for every routine file edit.
- **Reviewer/test owner:** independently compares accepted videos to real rendering, checks accessibility, signed-in flows, generated assets, rollback and no unintended changes.
- **Optional collaborators:** Higgsfield for missing artwork, Rive tooling for rigging, REA/Coucou as reference-only research, QA hardware owners for physical-device checks. No single tool is mandatory except verified source control and working tests.

## Scope and risk discipline

No simultaneous whole-app redesign, no uncontrolled asset regeneration, no second companion runtime, no new student-data services, no merging stale PR #164. A plan or branch is not a release. If new visuals diverge from Studigo's identity, stop and obtain owner sign-off before propagating changes.
