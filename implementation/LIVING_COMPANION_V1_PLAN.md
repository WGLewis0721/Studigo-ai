# Living Companion v1: execution list

Status: DRAFT, revised 2026-11-15. Replaces the table-based plan on the foundation branch. Nothing is built yet.

How to read this: do the steps in order. Each step has a **Done when** line. Steps marked **HUMAN** need the owner. Steps marked **STOP** end the run until the owner answers.

> **Update 2026-11-20:** steps 3 to 9, 14 to 16 and 18 to 19 have landed on `claude/studigo-living-companion-upgrade-ee0706`; see `design/living-companion/STATUS_2026-11-20.md` for the current state and `design/living-companion/LOCAL_CONTINUATION_PROMPT.md` for the next run. The notes below are the 2026-11-16 snapshot.

## Start here (laptop run, 2026-11-20)

Branch `claude/studigo-living-companion-upgrade-ee0706`, PR #268 (open, unmerged). Baseline at `261496a` is in `design/living-companion/evidence/LC-1.md`. `main` has not moved (`056066f`). QA row IDs resolve to `design/living-companion/QA_RELEASE_ACCEPTANCE.md`.

**Step state**

| Step | State | Evidence |
|---|---|---|
| 1-2 | Done except OPEN H3, H5, H6 | `evidence/LC-0.md` |
| 3 event contract | Done | `7e1db4d` |
| 4 mood meter | Done | `59f8371` |
| 5 motion director | Done | `f21a20d` |
| 6 prefs v2 | Done | `8a554cc` |
| 7 MouthDriver | Done, no voice | `8a554cc` |
| 8 sprite renderer extracted | Done | `51cb6ec` |
| 9 motion flag | Done, defaults ON at owner request | `51cb6ec` |
| 10 wait for H4, H5 | Superseded by owner delegation (LC-DEC-030); H5 still OPEN (needs owner accounts) | `evidence/LC-1.md` |
| 11 LC-1 spike | Mesh rig measured by H-A (running); Rive deferred (LC-DEC-031) | `evidence/LC-1.md` |
| 12 renderer decision | Decided under delegation: hybrid mesh rig (LC-DEC-031) | `DECISIONS.md` |
| 13 rig | Built (mesh rig + original drawings for gestures and far head turns) | `51cb6ec`, `e55bc2d` |
| 14 adapter + fallback | Done | `51cb6ec` |
| 15 floating dock | Done; free spot honoured in Phase 3 too (LC-DEC-041); UI01-UI05 PASS | `417fce4`, `evidence/LC-21.md` |
| 16 fixed strip | Done; fuller phone strip; UI06-UI10 PASS | `5518cbc`, `evidence/LC-21.md` |
| 17 events | Done except `correctFast` (off by decision) and `sessionReturn` (no emitter); `stall` timer in Guided Learn | `1c62bc1`, `evidence/LC-17.md` |
| 18 outfits | On-model dressed art committed (`339e29c`); texture swap wiring running (H-K); unlocked by growth | `evidence/LC-18.md` |
| 19 Calm mode | Done, gentle not frozen (LC-DEC-040); calm checks PASS | `5518cbc`, `417fce4`, `evidence/LC-19.md` |
| 20 stall thresholds | STOP, owner data | - |
| 21 QA matrix | Automated rows: 39 PASS, 0 FAIL, 30 OPEN (person, device or measurement) | `1e999f6`, `evidence/LC-21.md` |
| 22 sign-off | STOP, owner | - |
| 23 rollback rehearsal | Local rehearsal PASS (motion, sprites, off); production OPEN | `b89eee6`, `evidence/LC-9.md` |
| 24 release PR | PR #268 exists; owner merges | - |
| 25 voice | Blocked on owner narration | - |

| growth (new) | Done: points from every committed event, 7 stages, unlocks for outfits, tricks, flame; menu "Growing" section (LC-DEC-033, 039) | `4bd5774`, `e0dde5f`, `evidence/LC-growth.md` |

**Progress at 2026-11-20 evening:** branch head `339e29c`; LC tests 169 pass; typecheck, lint, build pass; PR #268 open, not merged. Running: H-K (dressed outfit texture swap, `lc/dressed-outfits`) and H-A (measurements, `lc/11-measurements`).

**Final verification 2026-11-21 (orchestrator, merged branch `b7eda67`):** typecheck exit 0; lint exit 0; build exit 0; full web suite 637 pass, 1 fail (C19 `pymupdf` only, known); `lc-companion-qa.mjs` exit 0 (39 PASS, 0 FAIL, 30 OPEN); `lc-calm-qa.mjs` exit 0 (A02 PASS); `lc-rollback-qa.mjs --expect=motion` exit 0 (48/48). Since the progress note: dressed outfit textures and 84 dressed drawings (`f86c7b7`, `79e226d`), LC-1 measurements GO (`6e6caf7`), Benji voice with lip sync, lazy drawing loads, calm fades, DPR cap (`b7eda67`). OPEN: physical iPhone/Android, Safari/Firefox, 10-minute heap soak, owner listen and "feels alive" sign-off, merging PR #268.

**Run order.** Each Haiku task runs in its own worktree on branch `lc/<step>-<slug>` from `claude/studigo-living-companion-upgrade-ee0706`. The orchestrator reviews each diff, merges with `--no-ff`, re-runs the LC tests, and pushes. Dev servers use a private port per task so tasks can run in parallel.

| Task | Owner | Branch | Files allowed | Done when | Evidence |
|---|---|---|---|---|---|
| H-B events + stall | Haiku | `lc/17-events-stall` | `apps/web/components/companion/{companion.tsx,engine.ts}`, `apps/web/lib/companion-logic.ts`, `apps/web/lib/companion-stall.ts` (new), `apps/web/components/room/learn-mission.tsx`, new `lib/*.test.ts` | Every shared event has an emitter or a written reason; `stall` L1/L2 placeholder thresholds wired with tests; LC tests and typecheck pass | `evidence/LC-17.md` |
| H-C QA scripts | Haiku | `lc/21-qa-matrix` | new `scripts/lc-companion-qa.mjs`, `design/living-companion/evidence/LC-21.md`, `design/living-companion/evidence/LC-21/` screenshots | Script runs UI01-UI10, L01-L07, A01-A09 rows that are automatable on desktop + emulated phone; every row PASS, FAIL or OPEN with reason | `evidence/LC-21.md` |
| H-E outfits | Haiku | `lc/18-outfit-checks` | new `apps/web/lib/companion-outfits-*.test.ts`, scratch bench outside repo | Outfit tests pass; per-outfit CPU frame-time delta recorded; no art judgement | `evidence/LC-18.md` |
| H-A measurements | Haiku | `lc/11-measurements` | new `scripts/lc-companion-perf.mjs`, `evidence/LC-1.md` (Measurements and Recommendation sections only) | Frame time, blend time, bundle size, WebGL fallback measured in Chromium on this laptop; recommendation written | `evidence/LC-1.md` |
| H-D calm + reduced motion | Haiku | `lc/19-calm-checks` | new `scripts/lc-calm-qa.mjs`, `evidence/LC-19.md` | A02 and calm checks run with real results | `evidence/LC-19.md` |
| H-F rollback rehearsal | Haiku | `lc/23-rollback` | new `scripts/lc-rollback-qa.mjs`, `evidence/LC-9.md` | Motion-off and companion-off verified locally; production rehearsal OPEN | `evidence/LC-9.md` |
| H-G docs hygiene | Orchestrator | this branch | `DECISIONS.md`, `README.md`, this plan | PROPOSAL row for the mesh rig; README index updated; SHAs filled | this plan |

H-B, H-C and H-E run first in parallel; H-A, H-D and H-F follow. H-C does not edit code; if it finds a bug, it reports it.

**STOP (owner):** H1 expressions/beats; H5 signed-in screenshots; H6 production flag names; step 12 renderer (mesh rig vs Rive vs both); Rive `.riv` commercial terms; QA V02 vs restored drawn head turns; outfit art; stall thresholds from real data; identity and "feels alive" sign-off; merging PR #268 or deploying; voice narration.

## Start here (Fable handoff, 2026-11-16)

**Visual style is 2.5D** (LC-DEC-021): layered 2D art with depth cues such as perspective head yaw and pitch. Not full 3D. Coucou is 2D (LC-DEC-022). Ignore the "rigged 3D Studigo" line in `design/companion-demo/README.md` (LC-DEC-023).

**Branches already pushed to origin**
- `lc/lc-0-baseline`: baseline at `056066f`, main SHA. Docs only.
- `lc/03-event-contract` (`7e1db4d`): step 3 done. Event union in `companion-logic.ts`. Tests pass.
- `lc/04-mood-meter` (`59f8371`): step 4 done. `companion-mood.ts` and 9 tests. Tests pass. Built on `lc/03`.
- `docs/lc-fable-handoff`: this plan, `evidence/LC-0.md`, and the DECISIONS rows LC-DEC-021 to 023. Based on the feature branch `feat/studigo-v2-phase4-animation-foundation` (`a248848`). Another contributor (aws-dev-wgl) is also committing docs there. Rebase before pushing.

**Already done, so skip:** H2 and H7 (recorded), steps 1 to 4. Step 1 is a fetch of main, to be confirmed. Step 2 is done except the OPEN items (H3 films are in `assets/video/` uncommitted; MP4 storage policy is still open, so do not commit the MP4s without owner approval).

**Next up:** step 5 (motion director), on a new branch `lc/05-motion-director` from `lc/04-mood-meter` (or from main once `lc/03` and `lc/04` merge, which the owner decides). Then step 6 onward in order.

**Known environment issue:** the full web suite fails `C19 Word file matches the PDF edition` because `pymupdf` is not installed. This is unrelated. Do not fix it as part of LC work. Run the LC tests directly: `node --import tsx --test lib/companion-mood.test.ts lib/companion-logic.test.ts` from `apps/web`.

**Step 0 (before step 5): organize the docs for faster work.** Read `design/living-companion/README.md` and the human-first-handoff folder. Propose a short index and flag duplicates, such as the same content in `human-first-handoff/` and the top-level docs. Do not delete or move any doc without owner approval. Do not create a new overview document (AGENTS.md). Put the proposal in the README index on `docs/lc-fable-handoff` and report what you changed.

**Owner blockers still open:** H5 (signed-in screenshots at five widths), H6 (production flag names). Steps 10 and 12 wait on them.

**H4 update (2026-11-16):** Rive account is set up on the Free tier, signed in as `williamg-6GC8R`. Rive CLI 1.9.2 is installed on the owner's Windows PC and `rive doctor` passes (auth ok, live-link ok, project not yet created, Android tooling not installed and not needed for LC-1). Still needed before step 11: the `.riv` terms check for a commercial kids' app on the Free tier, recorded in `evidence/LC-1.md`. Do not assume the terms are cleared. Check whether the Free tier allows publishing or exporting `.riv` files that ship in a product. If it does not, record the paid-tier requirement as an owner decision.

## Invariants (every step)
- The companion never writes mastery, grades, progress, or evidence.
- It reacts only to committed events.
- No camera, mic, or pointer logging.
- Phase 3 header geometry (desktop 100% to 60% tuck) and the rail stay unchanged.
- The WebP renderer and `NEXT_PUBLIC_STUDIGO_COMPANION=off` keep working.
- One companion, one animation loop.
- One branch per step, branched from `main`. PRs open as drafts. No merge without the owner.

## Part A: clear the blockers (owner)

- **H1. Confirm the expression and beat lists.** Owner approves the 14 expressions and at least 10 of the 12 beats in `STUDIGO_EXPRESSIVENESS_SPEC.md`. Reconciliation C2 has an older six-expression list, which is superseded. **Done when:** approved list is in `DECISIONS.md` as a new LC-DEC.
- **H2. Decide where the LC docs live.** Recommended: a docs-only PR that moves the plan and knowledge base from the foundation branch to `main`. **Done when:** the decision is recorded in `DECISIONS.md`.
- **H3. Provide the three films.** Download V1, V2, and V3 from the links in `03_THE_THREE_APPROVED_CONCEPTS.md` and share the files. The sandbox cannot fetch them. **Done when:** the SHA-256 of each is recorded in `evidence/LC-0.md`.
- **H4. Provide Rive access.** Account and plan tier. Confirm the Rive terms for exported `.riv` files cover a commercial kids' app. **Done when:** the account is connected and the terms note is in `evidence/LC-1.md`.
- **H5. Provide screenshots.** From a signed-in session at 375, 390, 768, 1024, and 1440 wide, with the companion on and off. Save to `evidence/LC-0/`. **Done when:** all ten images are in the repo.
- **H6. Read the production flags.** Confirm the names and values of `NEXT_PUBLIC_STUDIGO_COMPANION` on Vercel. Names only, no secrets. **Done when:** the values are in `evidence/LC-0.md`.
- **H7. Confirm agent roles.** The old plan named Green, Blue, Yellow, and Red Ranger. Say whether these apply, or drop them. **Done when:** answered in `DECISIONS.md`.

## Part B: build (Fable runs straight through)

Work the steps in order. Skip a step only when its dependency is marked done.

1. **Check the baseline.** Fetch `origin/main`. Record its SHA. If it is not `056066fb`, update `evidence/LC-0.md` and continue. **Done when:** SHA is in the evidence file.
2. **Finish the LC-0 evidence file.** Fill in every item not blocked by H3, H5, or H6. Mark the rest `OPEN (H#)`. **Done when:** no empty fields remain.
3. **Write the event contract.** Add the new events from `SHARED_COMPANION_EVENTS.md` to the union in `companion-logic.ts`. Keep the existing six names. **Done when:** typecheck passes and the existing unit tests pass unchanged.
4. **Write the pure mood function.** `nextSpark(spark, event, dtMs)` as in `MOOD_METER.md`. No imports from learning, Supabase, or AI. **Done when:** tests cover 10 wrong answers in a row, bounds over 10,000 random sequences, and 30/60/120 Hz equivalence.
5. **Write the pure motion director.** State machine L0 to L5, named springs, beats, injected clock and random source. No React. **Done when:** tests cover preemption, return to REST within 400 ms, and the import boundary.
6. **Write the prefs v2 type and migration.** Add `pos` (normalized x, y), `outfit`, and `v: 2`. Keep writing `dock`. Old prefs must still parse. **Done when:** migration tests pass and rollback to the old parser is safe.
7. **Write the MouthDriver interface.** Three kinds: amplitude, visemes, and word-boundary fallback. Fixture tests for all three. Mute respected. **Done when:** fixtures pass. No voice engine is wired.
8. **Extract the sprite renderer.** Move the pose swap out of `engine.ts` behind the `CompanionRenderer` interface, unchanged in behavior. **Done when:** unit tests pass and the flag-off path is byte-identical in the DOM test.
9. **Add the motion flag.** `NEXT_PUBLIC_STUDIGO_COMPANION_MOTION`, default off. Wire the director only when the flag is on. **Done when:** flag-off build matches step 8's output.
10. **STOP: wait for H4 and H5.** The Rive spike needs the Rive account (H4) and the signed-in screenshots (H5). Do not start the spike without them.
11. **Run the LC-1 spike.** Rive and a layered Canvas rig, both with the same dragon art. Six expressions, three beats, gaze, mouth placeholder, Calm mode. Measure against spec §14 (blend time, file size, frame time on the named devices). Time cap: 7 days. **Done when:** `evidence/LC-1.md` has both results and a go or no-go recommendation.
12. **STOP: owner decides the renderer.** Needs H1 (expressions) and the step 11 result. Owner signs off on identity and feel.
13. **Build the rig for the chosen renderer.** Full set from H1. Rig stays in the repo with pivot map and provenance. **Done when:** V01 to V03 and V07 checks are recorded.
14. **Build the renderer adapter behind the motion flag.** Lazy-load the chosen renderer. Fall back to the sprite renderer on any error. **Done when:** flag-on and flag-off screenshots match at the same SHA.
15. **Build the floating dock with free position.** Whole-panel move, persisted in prefs v2, clamped on resize, keyboard move. **Done when:** UI01 to UI05 pass.
16. **Build the fixed strip.** Slot between nav and rail. Phase 3 tuck preserved. Rail does not move. **Done when:** UI06 to UI10 pass.
17. **Wire the events.** `stall` from Guided Learn (coordinate with the GL02 owner), and reactions for every event in the shared list. **Done when:** L01 to L05 pass and GL08 acceptance is recorded.
18. **Build the seven outfits.** Layer swaps only, cosmetic, no unlocks. Needs owner art review per outfit. **Done when:** each outfit is approved and frame-time delta is recorded.
19. **Build Calm mode.** Reduced motion turns off dashes, spins, shiver, and particles above 4. **Done when:** A02 passes.
20. **STOP: measure stall times (LC-0b).** Needs real study sessions or owner-provided data. Propose thresholds; owner approves. **Done when:** values are in `DECISIONS.md`.
21. **Run the QA matrix.** Rows V01 to V08, UI01 to UI10, L01 to L07, A01 to A09. Desktop and emulated phone in Playwright; physical iPhone is a human step. **Done when:** every row has evidence or an `OPEN` note.
22. **STOP: owner sign-off.** Identity, "feels alive" against V1 to V3, and performance on the named devices.
23. **Rollback rehearsal.** Turn the motion flag off, confirm the legacy WebP companion returns, and turn the companion off entirely. **Done when:** the rehearsal is recorded in `evidence/LC-9.md`.
24. **Release PR, draft.** Open against `main`. Do not merge. **Done when:** the PR is open with evidence links.
25. **Voice (later, LC-10).** Blocked until the owner supplies the narration. Then wire it into the MouthDriver from step 7 and check lip-sync lag at or below 80 ms. **Done when:** owner signs off.

## Rules for Fable
- Stop at every STOP line. Do not guess the owner's answer.
- If current code contradicts this list, current code wins. Stop and report.
- Record every number with the device or test that produced it.
- Never claim a check passed unless it ran.
