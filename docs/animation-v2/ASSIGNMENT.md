# Studigo Animation System V2: assignment and owner decisions

Owner: William (2026-11-21). This file is the source of truth for the V2 run. Results go in the phase docs listed below.

## Mission

Transform Studigo from a collection of partially rigged animations and AI-generated poses into one fluid, consistent, interactive animated character that feels alive throughout the application. Reference: the owner's Nov 21, 2026 screen recording (`C:/Users/Willi/.claude/uploads/371f06e5-e960-4974-a964-eaa7b429933b/774d6143-ScreenRecording_11-21-2026_16-21-56_1.mp4`, HEVC; decode with `/c/Users/Willi/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe`). It shows the hybrid snapping between a front WebGL rig and separate drawn three-quarter poses with ghosted crossfades. This is an animation architecture overhaul, not a CSS tweak. Build sequentially; every phase depends on the validated output of the previous one. Do not stop at a proof of concept, a promising animation, or a successful build.

## Non-negotiable rules

1. Preserve Studigo's approved identity, proportions, colors, silhouette, personality and style. He is an orange, WINGLESS dragon (LC-DEC-014): ivory frills, a head spike, cream belly, teal gold-embroidered vest, crayon-shaped tail with a flame. The assignment's original rig list mentioned wings and horns; there are no wings, and his "horns" are the head spike and frills.
2. Rive becomes the primary runtime for continuous character animation.
3. Higgsfield may supply controlled visual references or exceptional assets, but independent generated poses must never be crossfaded to simulate skeletal animation.
4. One reusable animation architecture, not per-page implementations.
5. No generated frame may silently replace or alter the approved design.
6. Prioritize fluidity, continuity, performance and responsiveness over the number of states.
7. Preserve existing app behavior, educational workflows, interactions, accessibility and responsive layouts.
8. Work on the dedicated branch `feat/studigo-animation-v2`. Do not merge to `main` or deploy to production without authorization.
9. Paid services: see owner decisions below.
10. Finish every phase's validation before starting the next. Finish, verify, lock, build upon. A later phase must never conceal an unfinished earlier one.

## Owner decisions (2026-11-21)

- Rive: logged in on this laptop (`rive doctor`: signed in as williamg-6GC8R). Build on the Free tier now; the Free-tier export splash is accepted during the build and will be removed (paid plan) before shipping.
- Higgsfield image generation is APPROVED for this work (account topped up). Use it for reference views and rig art; review every image for identity drift.
- Rive CLI 1.9.2 supports agent authoring: `rive create` scaffolds `scene.rml` (Rive Markup) with AGENTS.md/CLAUDE.md; topics `rive docs rigging|easing|state-machines|assets`; `rive schema <Type>`; `rive <dir> --verify`, `rive inspect <dir> --summary`, `rive <dir> --screenshot --advance=1`, `rive <dir> --commands` (headless frames); `--publish` writes a signed `.riv` (web runtimes reject unsigned scripts). Do NOT use `rive push` (uploads to the account). RML supports bones, skinning, image meshes, constraints, blend states and state machines. Read `rive docs` instead of guessing.
- Build-time design limits are relaxed (LC-DEC-039); the product goal is that he feels alive to children and grows and can be customized as they study (growth and outfits already exist).

## Phases (strict order; each ends with a gate)

0. **Baseline audit** -> `docs/animation-v2/00-baseline-audit.md`: current architecture, art source of truth, all asset locations, existing states, known visual defects, active runtime paths, browser/device constraints, exact starting commit, regression risks. Note: there is NO `.riv` anywhere in the repo history; the "partial Rive rig" did not exist; what runs is a custom WebGL rig (`apps/web/components/companion/rig-renderer.ts`, `apps/web/lib/companion-motion/*`) driven by `engine.ts`, with a sprite fallback (`renderers.ts`). Since `15f7213` motion mode no longer swaps drawings. Gate 0: current system understood, reference implementation identified.
1. **Lock character identity** -> `01-character-spec.md`: head/snout/jaw geometry, eyes, frills and spike, tail and flame, body, limbs and feet, palette, shading, outline, scale and anchor points; standardized structural reference views (front, left, right, three-quarter, limited up/down) from the approved art, compared against it. Gate 1: identity stable from every supported orientation.
2. **Primary Rive rig** -> `02-rig.md`: Root, Torso (chest/belly, arms), Head (snout/jaw, eyes/pupils, lids, brows, mouth, spike/frills), Tail, Legs/Feet, Effects (flame, particles). Bones, meshes, constraints; one coordinate system; head turns move eyes, snout and frills coherently. If 2D art cannot support large turns, restrict range rather than faking with swaps. Isolated rig inspection scene. Gate 2: the rig behaves as one connected character.
3. **One perfect idle** (8 to 10 s loop) -> `03-idle.md`: breathing, believable blinks, subtle eye movement, occasional head tilt, tail follow-through, overlapping motion, seamless loop. Test 1 loop, 5 loops, 30 s, viewport sizes, reduced motion; record it. Gate 3: convincingly alive doing nothing. Do not proceed until passed.
4. **Fluid transitions** -> `04-transitions.md`: neutral to look left/right/up/down, listening, thinking, happy, celebrating, back to neutral, interruptions. Rive blend controls and state transitions, never full-image fades; start from current animated condition. Gate 4: smooth, reversible, interruption-safe.
5. **Behavior library** -> `05-behaviors.md`: idle, listening, thinking, reading, encouraging, correct, incorrect (gentle), celebrating, curious, sleepy, wake, pet/touch; each with trigger, parameters, priority, duration/exit, interruption policy, return to idle, reduced-motion equivalent. Rive state machine plus a thin controller. Gate 5.
6. **Reusable system** -> `06-component-api.md`: typed declarative component (e.g. `<StudigoCharacter state size interactive reducedMotion onInteraction />`) and a controller (`setState`, `react`, `lookAt`, `returnToIdle`), one canonical `.riv` and state-machine contract, lazy activation, cleanup, static fallback if Rive fails, an adapter preserving the existing companion event API (`useCompanion().event(...)`). Suggested files: `apps/web/components/companion/{StudigoCharacter.tsx,StudigoController.ts,studigo-states.ts,studigo-adapter.ts}`, `apps/web/public/mascot/rive/studigo.riv`, editable rig source and export procedure versioned. Gate 6: another developer can integrate Studigo via the API alone.
7. **Integrate across the app** -> `07-integration.md`: inventory every appearance, migrate animated ones (homepage, onboarding, Study Room companion window and strip, learning views, coach/chat, practice/quiz, flashcards, test, mastery/progress, celebrations, empty states). Small icons may stay static. Do not change educational logic, rewards, grading or progression. Gate 7: no competing legacy animation implementations.
8. **Performance and device QA** -> `08-qa-evidence.md`: desktop Chrome and Safari, iPhone and iPad Safari, small mobile viewport, reduced motion; Playwright where possible; frame pacing, main thread, memory over repeated mounts, Rive load/init, 60 s idle, 100 consecutive transitions; no duplicate canvases, leaks, missing assets, error spam. Never present emulation as a physical device; mark unavailable devices BLOCKED.
9. **Regression tests and replication** -> tests for states, priority, interruption, return to idle, reduced motion, missing `.riv`, unmount/remount, multiple instances, rapid navigation, adapter compatibility; an isolated showroom that uses the exact production component and `.riv` with a reproducible command; how-to docs (add to a page, trigger, add a behavior, update the rig safely, export and validate a `.riv`, roll back).
10. **Final acceptance** -> `09-final-handoff.md`, "STUDIGO ANIMATION SYSTEM V2 - FINAL HANDOFF": status DONE only if every functional, quality and delivery criterion has evidence; otherwise NOT DONE with each failing or blocked gate and the exact action to clear it.

## Reporting after each phase

PHASE / STATUS (PASS, FAIL, BLOCKED) / Completed / Changed files / Tests and results / Visual evidence / Known defects / Commit / Next dependency.

If something fails, diagnose and repair; never bypass with more generated frames, longer fades, arbitrary delays or CSS effects. Distinguish a genuine external blocker from unfinished work, and continue independent work without marking a blocked gate as passed.
