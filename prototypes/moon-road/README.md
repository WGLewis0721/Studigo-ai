# Studigo Moon Road → Core Clash

## Definitive playtest build

**POC VII (canonical):** https://studigo-core-clash.william-glewis17.chatgpt.site/poc-vii/

This is the version to play and continue developing. It faithfully tests optional, respawning ×3/×4 multiple-choice Knowledge Drops inside a small action-platformer. At the vault, **ENTER CORE CLASH** starts the existing standalone 50 HP boss fight. The boss's original rules and source are preserved.

## Source of truth

Work on `feature/moon-road-core-clash`. The game lives at `dist/poc-vii/`; its complete design, rules, asset references, controls, boss connection, and QA instructions are in `CURRENT_GAME_HANDOFF.md`. Read that before editing. `dist/index.html`, `dist/game.css`, and `dist/game.js` are the original Core Clash boss control. Keep them intact.

The previous `dist/adventure/` equal-group-mechanism experiment is legacy work, not the current game design. Do not use it as the behavioral or handoff baseline.

## Run locally

From this directory run `node prepare.mjs`, then `python -m http.server 8000 --directory dist`. Open `http://localhost:8000/poc-vii/`; open `/` for the original boss control. Runtime and art are reconstructed from local pinned chunks, with no CDN dependency. Asset provenance and licensing are in `ASSETS.md`.

## QA

`qa/poc-vii-playtest.cjs` runs the mobile browser acceptance path. See `CURRENT_GAME_HANDOFF.md` for prerequisites and the results recorded in `qa/poc-vii-results.json`.


## POC VIII — additive Graveyard stage

[Play the connected stages](https://studigo-core-clash.william-glewis17.chatgpt.site/journey/): POC VII → Graveyard 1·2·3 → original Core Clash. [Test Graveyard directly](https://studigo-core-clash.william-glewis17.chatgpt.site/poc-viii/). Both original control routes stay unchanged.

Read [POC-VIII.md](POC-VIII.md) for exact rules, source files, art provenance and browser QA. Unlimited ×1; limited ×2/×3; skeleton HP equals its two operands; special shots must match an operand or reflect. Optional orbs refill 12 rounds through a challenge and return after 20 active-play seconds. No new boss mechanic.
