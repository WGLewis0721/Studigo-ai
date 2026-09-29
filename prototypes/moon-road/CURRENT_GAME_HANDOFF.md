# Studigo — Current Game Handoff

## Golden image: POC IX Moon Keep (2026-09-29)

**POC IX is the current golden image of the game.** William approved it as the reference build on 2026-09-29. It's tagged `golden/poc-ix-moon-keep` in git.

- Beta test URL (GitHub Pages, separate from the Studigo app): https://wglewis0721.github.io/Studigo-ai/prototypes/moon-road/dist/poc-ix/
- Local: `/poc-ix/` after `node prepare.mjs` and a static server on `dist/`.
- Not reachable from the Studigo main app. `apps/web` has no link to any prototype, and its old `/game` alpha returns 404 in deployed builds (dev only).
- Freeze rule: do not edit `dist/poc-ix/`. New work (art, ×5 Clock Tower, Clock Shield, trial mini-boss) goes in `dist/poc-x/`. The one post-approval addition is the beta-test restart button (↺ in the header and in Pause, with a confirm), which William asked for so testers can start over.

It's a first Metroidvania slice directed by William, using Metroid Fusion/Zero Mission, SotN, Mega Man and Grimvalor mechanics; the dragon stays a shooter. Its factor-locked world intentionally departs from POC VII's "no ability gates" rule, at William's direction. POC VII, POC VIII, `/journey/` and Core Clash below stay untouched as older controls. Rules, map, bosses, files, tests and known limits are in **POC-IX.md**. Spec and plan are under `docs/superpowers/`.

## Art transfer

Read **ART_HANDOFF.md** for the actual generation/preparation workflow, frame map, Claude continuation prompt and reconstructed generation prompts. Original sheets are in `art-source/`, the exact pipeline is `scripts/normalize-art.py`, and `downloads/Studigo-Art-Pack.zip` includes originals plus every game-ready PNG and `frames.json`. `node prepare.mjs` still restores the exact runtime assets. Reuse the accepted artwork before generating anything new.

## New additive stage: POC VIII (2026-09-29)

Connected experiment: https://studigo-core-clash.william-glewis17.chatgpt.site/journey/

This runs the original POC VII level, then offers **NEXT · GRAVEYARD 1·2·3**, then the original Core Clash boss. Direct stage test: https://studigo-core-clash.william-glewis17.chatgpt.site/poc-viii/

Read **POC-VIII.md** for the exact new contract, source map, reference-art provenance, ammo/reflection rules, QA and continuation prompt. This is an additive experiment. The canonical POC VII control URL below and all its original source files remain unchanged; Core Clash also remains unchanged. Do not silently replace these controls. `/adventure/` remains rejected.

Stage VIII starts fresh with unlimited ×1 and uses only limited-ammo ×2/×3, permanent run ownership, two visible enemy operands, operand-product HP, operand-only special hits, and reflected nonmatches. Orbs unlock/refill 12 rounds and respawn after 20 active-play seconds after either submitted answer. No weapon carryover into VIII or the original boss. The future boss mechanic is still undecided.

## Preserved POC VII golden handoff

**Use this handoff and the files on `feature/moon-road-core-clash` as the source of truth for the current game.** The definitive playable build is POC VII, a small side-scrolling action level that leads directly into the existing Core Clash boss fight.

## Play the definitive version

**Canonical play URL:** https://studigo-core-clash.william-glewis17.chatgpt.site/poc-vii/

Use that URL whenever William asks to play or share the current game. The level ends at the vault. **ENTER CORE CLASH** opens the original Core Clash encounter and starts it immediately. **KEEP EXPLORING** returns to the level so the player can revisit a missed drop. The standalone boss remains available at the site root for comparison.

## Repository and authoritative files

Repository: https://github.com/WGLewis0721/Studigo-ai  
Working branch: `feature/moon-road-core-clash`  
Game directory: `prototypes/moon-road/`  
POC VII browser route: `prototypes/moon-road/dist/poc-vii/`

Read these files first:

1. `CURRENT_GAME_HANDOFF.md` (this document)
2. `README.md`
3. `ASSETS.md`
4. `dist/poc-vii/index.html`
5. `dist/poc-vii/style.css`
6. `dist/poc-vii/game.js`
7. `dist/poc-vii/boss.html` and `dist/poc-vii/enter-boss.js`
8. `dist/index.html`, `dist/game.css`, `dist/game.js` (the original Core Clash boss)
9. `qa/poc-vii-playtest.cjs` and `qa/poc-vii-results.json`

The contents of `dist/poc-vii/` are the canonical POC VII implementation. The older `/adventure/` route is an abandoned experiment with a different, incorrect learning loop. Do not use it as the current design reference or silently replace the POC VII loop with it.

## Product intent: faithful POC VII

This game tests the original **Studigo: Respawning Knowledge Drops** loop using only ×3 and ×4 multiplication:

1. Play a normal, small action-platformer level.
2. Knowledge Drops are visible and optional.
3. The player chooses to open a nearby drop.
4. A short, conventional, three-choice multiplication question appears.
5. Correct answer permanently unlocks the associated weapon for that run.
6. Wrong answer gives no weapon, reveals no answer, and returns directly to play.
7. The failed drop goes dormant. Play continues without a forced retry or permanent lockout.
8. After 20 seconds of active gameplay, the drop returns with a different fact from the same family. There is no countdown.
9. The player may return and choose to retry.
10. The stronger shot makes the unlock feel useful during ordinary combat.

The challenge is deliberately a question. Do not disguise it as a puzzle or invent a new teaching mechanic. No arrays, group-building, special enemy formations, weapon weaknesses, ability gates, minibosses, skill trees, adaptive learning, additional subjects, or production learner architecture belong in this POC.

## Current level and combat

The stage is a 960×540 authored Phaser scene inside a 3300-unit horizontal route. It reuses the moonlit observatory, platforms, jade dragon, and guardian sprites from the existing game. The player runs, jumps, shoots, fights ordinary enemies, and reaches the vault. The whole level is finishable with the basic shot, without opening either drop.

There are two drops:

- Around world x=850: ×3 question → ×3 Shot.
- Around world x=1820: ×4 question → ×4 Shot.

The player walks near a ready drop and chooses **OPEN** (E); directly tapping the visible drop also opens it. Walking into, walking past, or shooting past a drop does not force a question. The compact challenge displays a fact such as `3 × 4 = ?`, three answer buttons, the reward weapon, and **NOT NOW**. Escape or the close button also leaves without an answer or penalty.

Facts cover 3×1–3×10 and 4×1–4×10. The retry sequence rotates to a different fact in that multiplication family. Wrong-answer choices are not marked; the correct answer is not shown. Wrong answers display only a short “Keep going!” message.

Basic Shot is immediately available and deals 1 damage per hit. ×3 Shot deals 3 and ×4 Shot deals 4, with brighter, wider projectile feedback and stronger impact effects. The weapons are run-persistent: health loss/checkpoint recovery does not revoke either unlock. A new run/reload resets unlocks. Ordinary enemies have no multiplication-specific resistance or weakness.

The player has five hearts, brief invulnerability after a hit, health pickups, and forgiving checkpoints. There are ordinary guardian-silhouette enemies and platforms; no separate boss or combat puzzle is inserted before the vault.

## Active-play cooldown details

The game advances its `active` clock only while `mode === 'play'`. Question, pause, and finish screens freeze it. Browser blur/hidden-tab handling clears held controls and pauses the game. A wrong answer sets `drop.readyAt = active + 20`; once active time reaches it, the drop returns with a quiet glow, particles, and sound. There is no visible timer.

Relevant read-only test hooks are `window.gameState()` and `window.pocEvents()`. Tests may read them; do not add teleport or state-mutation hooks. Actual input is used for acceptance checks.

## Controls

Keyboard:

- Left/Right or A/D: move
- Up, W, or Space: jump
- F: fire (hold to repeat)
- E: open a nearby drop
- 1/3/4: select Basic/×3/×4 when unlocked
- Q: toggle autoshoot
- Escape: pause, or leave the active question

Touch controls provide left, right, jump, fire, weapon selection, autoshoot, pause, and a contextual OPEN button near a ready drop. Simultaneous movement/jump/fire is supported. The stage observes safe-area insets and preserves aspect ratio for landscape phone play.

## Core Clash connection

At the vault finish, **ENTER CORE CLASH** navigates to `poc-vii/boss.html`. That page reuses the original root `dist/index.html` markup, CSS, Phaser runtime, sprites, and `dist/game.js` through a `<base href="../">`; `enter-boss.js` starts the existing intro automatically. No Core Clash boss implementation files are modified by this connection.

The connected boss therefore retains the original 50 HP shield/orb encounter, zero boss damage from normal shots, autoshoot, the existing power challenge, five powered shots at two damage each, touch controls, and original animations. POC VII ×3/×4 run unlocks are not carried into or substituted for the boss's separate original orb rule. This preserves Core Clash itself while making it the level's final fight.

## Run locally

From `prototypes/moon-road/`:

```sh
node prepare.mjs
python -m http.server 8000 --directory dist
```

Open `http://localhost:8000/poc-vii/`. The standalone boss control is `http://localhost:8000/`.

`prepare.mjs` reconstructs the pinned Phaser 3.90.0 runtime and exact game assets from the repository's encoded `runtime/part-*.txt` chunks. No CDN is needed. Phaser is MIT-licensed; generated art provenance and the full license reference are in `ASSETS.md` and `dist/vendor/PHASER-LICENSE.md` after preparation.

## Browser playtest

The checked-in QA script plays with keyboard and simultaneous CDP multitouch, fails both drops, pauses the question/cooldown clock, checks different retry facts, earns both weapons, tests checkpoint persistence, and completes the level while also verifying an entire run can ignore both drops. It uses no game-state injection.

Install Playwright and a compatible Chromium for the QA script. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if Chromium is not at Playwright's default path, then run:

```sh
node qa/poc-vii-playtest.cjs
```

Recorded acceptance: passed at an 844×390 mobile viewport; both cooldowns measured 20.015 active seconds; ignored-drop run reached the finish; wrong answers returned to play without displaying the answer; pause and challenge time did not count; weapons survived checkpoint recovery; simultaneous touch move/jump/fire passed; no browser page errors. This was Chromium phone emulation, not a physical iPhone Safari test.

## Visual/art direction and implementation guardrails

- Keep the original generated pixel-art observatory, dragon and Guardian sheets. Their provenance is recorded in `ASSETS.md`.
- Phaser 3.90.0 is bundled locally; game drawing uses pixel-art/round-pixel settings.
- Preserve the 960×540 authored stage, landscape-safe responsive scale, large touch targets, multi-pointer held input, blur/visibility pause, and no page scrolling.
- Preserve concise game UI and the current room composition; keep the equation visible and ordinary rather than burying it in environmental interactions.
- Keep the original boss files intact. Add or edit POC VII in its own directory.
- Do not claim that game completion proves multiplication mastery. This prototype has no save system, backend, longitudinal retention measure, or validated learning model.
- Before changing the learning loop, get direction from William. For implementation changes, state the intended behavior, test it in a real browser, and update this handoff/QA when behavior changes.

## Golden-state record

The connected-level/site source snapshot containing the current handoff and boss exit was published from Sites source commit `d3841bf7a562b29e290ef854808858017b1f1de7`. The canonical URL above is the live endpoint. GitHub's source branch is the ongoing developer handoff. If live behavior and a future branch diverge, compare the browser build to this documented POC VII behavior and explicitly record which artifact is being changed.
