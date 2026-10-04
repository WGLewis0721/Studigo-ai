# Studigo Moon Road → Core Clash

## Current build

**POC XI Moon Keep (golden image):** https://wglewis0721.github.io/Studigo-ai/prototypes/moon-road/dist/poc-xi/. A multiplication Metroidvania: ×1 fights, power beams ×2-×5 open numbered seals and stone blocks, bosses hand out the beams, and four runes open the Core Clash portal. Read [CURRENT_GAME_HANDOFF.md](CURRENT_GAME_HANDOFF.md) and [POC-XI.md](POC-XI.md). Earlier goldens ([POC X](https://wglewis0721.github.io/Studigo-ai/prototypes/moon-road/dist/poc-x/), [POC IX](https://wglewis0721.github.io/Studigo-ai/prototypes/moon-road/dist/poc-ix/)) are frozen. The POC VII/VIII material further down is the older ancestry of the game.

## Source of truth

Work happens on `main` through feature branches and PRs. Golden routes in `dist/` are frozen; start the next experiment in a new sibling route by copying the latest golden. Tooling, art pipeline and scripts: [TOOLCHAIN.md](TOOLCHAIN.md). Art provenance and licenses: [ASSETS.md](ASSETS.md).

The previous `dist/adventure/` equal-group-mechanism experiment is legacy work, not the current game design.

## Run locally

`dist/assets/` and `dist/vendor/` are committed so GitHub Pages can serve every build. `node prepare.mjs` regenerates them from the pinned chunks. From this directory run `node prepare.mjs`, then `python -m http.server 8000 --directory dist`. Open `http://localhost:8000/poc-vii/`; open `/` for the original boss control. Runtime and art are reconstructed from local pinned chunks, with no CDN dependency. Asset provenance and licensing are in `ASSETS.md`.

## Tests

From the repo root: `node --test "prototypes/moon-road/test/**/*.test.mjs"` (CI runs it on every PR).

## QA (older routes)

`qa/poc-vii-playtest.cjs` runs the mobile browser acceptance path. See `CURRENT_GAME_HANDOFF.md` for prerequisites and the results recorded in `qa/poc-vii-results.json`.


## POC VIII — additive Graveyard stage

[Play the connected stages](https://studigo-core-clash.william-glewis17.chatgpt.site/journey/): POC VII → Graveyard 1·2·3 → original Core Clash. [Test Graveyard directly](https://studigo-core-clash.william-glewis17.chatgpt.site/poc-viii/). Both original control routes stay unchanged.

Read [POC-VIII.md](POC-VIII.md) for exact rules, source files, art provenance and browser QA. Unlimited ×1; limited ×2/×3; skeleton HP equals its two operands; special shots must match an operand or reflect. Optional orbs refill 12 rounds through a challenge and return after 20 active-play seconds. No new boss mechanic.

## Full level: `dist/poc-vii-level/`

A longer sibling of POC VII (`dist/poc-vii/` untouched) with the same optional ×3/×4 question drops, 20 s active-play respawn, shots and ENTER CORE CLASH exit. Route: Moon Road → Whisper Grove (×3 drop) → Four Winds (×4 drop) → Echo Court → Vault. Adds lantern checkpoints, floor vents, hovering and heavy enemies, high-ledge hearts. Whole level is finishable with the basic shot. Open `/poc-vii-level/`.

## POC IX — Moon Keep, first slice (previous golden image)

Previous golden image (tag `golden/poc-ix-moon-keep`). Beta test: https://wglewis0721.github.io/Studigo-ai/prototypes/moon-road/dist/poc-ix/ — or `/poc-ix/` locally. Frozen. A 12-room connected keep where multiplication gates the world: seals open only with a matching ×N beam (×1 never opens them), stone blocks skip-count to their product, and two plate bosses (Twin Warden, Trine Guardian) drop ×2 and ×3 Mega Man-style. Moon Boots, energy tanks, ammo expansions, a hidden ×4 vault, a minimap and a % map. The POC VII orb loop is unchanged. Ends at the original Core Clash. Read [POC-IX.md](POC-IX.md). Tests: `node --test test/*.test.mjs` and `node qa/moon-keep-playtest.cjs`.

## POC X — Moon Keep (previous golden image)

Previous golden image (tag `golden/poc-x-moon-keep-ii`). Frozen. Beta test: https://wglewis0721.github.io/Studigo-ai/prototypes/moon-road/dist/poc-x/ — or `/poc-x/` locally. It's the golden POC IX with new generated art (sprites, backdrops, wall textures), the ×5 Clock Tower, the Clock Shield, the Training Hall, match rewards, and the Rune Gate/Sanctum portal to Core Clash. Read [POC-X.md](POC-X.md). Tests: `node --test "test/**/*.test.mjs"` and `node qa/clock-tower-playtest.cjs`.
