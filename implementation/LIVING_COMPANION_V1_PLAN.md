# Living Companion v1: execution list

Status: DRAFT, revised 2026-11-15, on PR #164. Replaces the table-based plan that was on this branch. Nothing is built yet.

Decisions from the owner on 2026-11-15 are recorded as LC-DEC-021 to LC-DEC-023 in `design/living-companion/DECISIONS.md`.

How to read this: do the steps in order. Each step has a **Done when** line. Steps marked **HUMAN** need the owner. Steps marked **STOP** end the run until the owner answers.

## Invariants (every step)
- The companion never writes mastery, grades, progress, or evidence.
- It reacts only to committed events.
- No camera, mic, or pointer logging.
- Phase 3 header geometry (desktop 100% to 60% tuck) and the rail stay unchanged.
- The WebP renderer and `NEXT_PUBLIC_STUDIGO_COMPANION=off` keep working.
- One companion, one animation loop.
- One branch per step, branched from `main`. PRs open as drafts. No merge without the owner.

## Part A: clear the blockers (owner)

- **H1. DONE (LC-DEC-021).** Expression and beat lists: the spec as written, with additions allowed. Original text: confirm the expression and beat lists. Owner approves the 14 expressions and at least 10 of the 12 beats in `STUDIGO_EXPRESSIVENESS_SPEC.md`. Reconciliation C2 has an older six-expression list, which is superseded. **Done when:** approved list is in `DECISIONS.md` as a new LC-DEC.
- **H2. DONE (LC-DEC-022).** The LC docs and plan stay on PR #164. Original text: decide where the LC docs live. Recommended: a docs-only PR that moves the plan and knowledge base from the foundation branch to `main`. **Done when:** the decision is recorded in `DECISIONS.md`.
- **H3. DONE.** All three films were supplied and checksummed in `evidence/LC-0.md`. Original text: provide the three films. Download V1, V2, and V3 from the links in `03_THE_THREE_APPROVED_CONCEPTS.md` and share the files. The sandbox cannot fetch them. **Done when:** the SHA-256 of each is recorded in `evidence/LC-0.md`.
- **H4. Provide Rive access.** Account and plan tier. Confirm the Rive terms for exported `.riv` files cover a commercial kids' app. **Done when:** the account is connected and the terms note is in `evidence/LC-1.md`.
- **H5. Provide screenshots.** From a signed-in session at 375, 390, 768, 1024, and 1440 wide, with the companion on and off. Save to `evidence/LC-0/`. **Done when:** all ten images are in the repo.
- **H6. Read the production flags.** Confirm the names and values of `NEXT_PUBLIC_STUDIGO_COMPANION` on Vercel. Names only, no secrets. **Done when:** the values are in `evidence/LC-0.md`.
- **H7. DONE (LC-DEC-023).** Agent role names are dropped. Original text: confirm agent roles. The old plan named Green, Blue, Yellow, and Red Ranger. Say whether these apply, or drop them. **Done when:** answered in `DECISIONS.md`.

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
