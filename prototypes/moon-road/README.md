# Studigo Moon Road → Core Clash

## Definitive playtest build

**POC VII (canonical):** https://studigo-core-clash.william-glewis17.chatgpt.site/poc-vii/

This is the version to play and continue developing. It faithfully tests optional, respawning ×3/×4 multiple-choice Knowledge Drops inside a small action-platformer. At the vault, **ENTER CORE CLASH** starts the existing standalone 50 HP boss fight. The boss's original rules and source are preserved.

## Source of truth

Work on `feature/moon-road-core-clash`. The game lives at `dist/poc-vii/`; its complete design, rules, asset references, controls, boss connection, and QA instructions are in `CURRENT_GAME_HANDOFF.md`. Read that before editing. `dist/index.html`, `dist/game.css`, and `dist/game.js` are the original Core Clash boss control. Keep them intact.

The previous `dist/adventure/` equal-group-mechanism experiment is legacy work, not the current game design. Do not use it as the behavioral or handoff baseline.

## Run locally

`dist/assets/` and `dist/vendor/` are committed so GitHub Pages can serve every build. `node prepare.mjs` regenerates them from the pinned chunks. From this directory run `node prepare.mjs`, then `python -m http.server 8000 --directory dist`. Open `http://localhost:8000/poc-vii/`; open `/` for the original boss control. Runtime and art are reconstructed from local pinned chunks, with no CDN dependency. Asset provenance and licensing are in `ASSETS.md`.

## QA

`qa/poc-vii-playtest.cjs` runs the mobile browser acceptance path. See `CURRENT_GAME_HANDOFF.md` for prerequisites and the results recorded in `qa/poc-vii-results.json`.


## POC VIII — additive Graveyard stage

[Play the connected stages](https://studigo-core-clash.william-glewis17.chatgpt.site/journey/): POC VII → Graveyard 1·2·3 → original Core Clash. [Test Graveyard directly](https://studigo-core-clash.william-glewis17.chatgpt.site/poc-viii/). Both original control routes stay unchanged.

Read [POC-VIII.md](POC-VIII.md) for exact rules, source files, art provenance and browser QA. Unlimited ×1; limited ×2/×3; skeleton HP equals its two operands; special shots must match an operand or reflect. Optional orbs refill 12 rounds through a challenge and return after 20 active-play seconds. No new boss mechanic.

## Full level: `dist/poc-vii-level/`

A longer sibling of POC VII (`dist/poc-vii/` untouched) with the same optional ×3/×4 question drops, 20 s active-play respawn, shots and ENTER CORE CLASH exit. Route: Moon Road → Whisper Grove (×3 drop) → Four Winds (×4 drop) → Echo Court → Vault. Adds lantern checkpoints, floor vents, hovering and heavy enemies, high-ledge hearts. Whole level is finishable with the basic shot. Open `/poc-vii-level/`.

## POC IX — Moon Keep (golden image)

**Current golden image** (tag `golden/poc-ix-moon-keep`). Beta test: https://wglewis0721.github.io/Studigo-ai/prototypes/moon-road/dist/poc-ix/ — or `/poc-ix/` locally. Don't edit it; new work goes in `dist/poc-x/`. A 12-room connected keep where multiplication gates the world: seals open only with a matching ×N beam (×1 never opens them), stone blocks skip-count to their product, and two plate bosses (Twin Warden, Trine Guardian) drop ×2 and ×3 Mega Man-style. Moon Boots, energy tanks, ammo expansions, a hidden ×4 vault, a minimap and a % map. The POC VII orb loop is unchanged. Ends at the original Core Clash. Read [POC-IX.md](POC-IX.md). Tests: `node --test test/*.test.mjs` and `node qa/moon-keep-playtest.cjs`.

## Art generation

Accepted original source art is documented in `ART_HANDOFF.md` and `ASSETS.md`. To create new candidate source sheets with image generation, use `ART_GENERATION.md`, `scripts/art-prompts.json`, and `scripts/generate-art.mjs`, then repack accepted sources with `scripts/normalize-art.py`.
