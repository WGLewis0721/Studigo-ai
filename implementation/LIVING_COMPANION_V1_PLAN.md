# Living Companion v1: execution list

Status: DRAFT, revised 2026-11-15. Replaces the table-based plan on the foundation branch. Nothing is built yet.

How to read this: do the steps in order. Each step has a **Done when** line. Steps marked **HUMAN** need the owner. Steps marked **STOP** end the run until the owner answers.

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
