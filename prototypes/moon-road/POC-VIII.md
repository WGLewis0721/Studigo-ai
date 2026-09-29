# POC VIII — Graveyard 1·2·3

## Play and preservation

- Connected stages: `/journey/` → original POC VII level → `/poc-viii/` → original Core Clash.
- Direct experiment: `/poc-viii/`.
- Golden controls remain byte-for-byte unchanged: `/poc-vii/` and the standalone boss `/`.
- `/journey/` reuses POC VII's original JS, CSS and assets through a base URL. Its small continuation script changes only the finish navigation/copy.
- The archived brief names `/adventure/` as the prior control; that path is stale. CURRENT_GAME_HANDOFF.md correctly identifies `/poc-vii/`.
- Do not use the abandoned `/adventure/` grouping/pull-lever experiment as a reference.

## Locked combat contract

The player starts with ×1, unlimited, exactly 1 damage. Only ×2 and ×3 are available as special weapons. They always deal 2 and 3 respectively and each holds at most 12 rounds. One round is consumed per fired projectile, including misses and reflected shots. Empty weapons stay owned and selectable but cannot fire; the player switches to ×1 explicitly.

Every skeleton has a `level` and `marker`, each 1–3. Its starting/max HP is `level * marker`. The visible badge reads `L2 · 3`, for example; the level is also on the skeleton's belt. Its health bar is segmented by HP.

A shot damages only if `weapon === 1 || weapon === level || weapon === marker`. This compares the original operands, never remaining HP or general divisibility. A nonmatching special deals zero, visibly bounces upward/backward with a violet shield flash and REFLECTED cue, and cannot hit other enemies after reflecting. Reflections do not injure the player. ×2 against a 3×3 skeleton reflects; ×3 against 2×2 reflects. No critical damage, alternate special guns, puzzles, learning backend, or mastery claim.

Canonical 2×3 enemy: six ×1 hits, three ×2 hits, two ×3 hits.

## Orbs and persistence

Two voluntary Power Boost Orbs: ×2 at x690, ×3 at x1720. Stand within 145 units and press OPEN/E or tap the orb. Movement/shooting past an orb never forces a question. NOT NOW, close, and Escape return without reward or cooldown.

Correct: permanently own the family weapon for this run, select it, fill that family's ammunition to 12 (not +12), glow/particles/audio, return to action. Other ammo is untouched. Wrong: no ammo awarded, no life penalty, no answer reveal, immediate return to action. Existing ownership/ammo is preserved.

After either submitted answer, the orb goes dormant until `active + 20`. `active` advances only in play; questions, pause, finish, hidden-tab pause do not count. There is no countdown. Respawn has a glow, particle burst, chime and brief cue. Every submitted answer advances the fact sequence, so the next attempt differs in the same family. Families ×2/×3 use multipliers 1–10. The 1–3 restriction applies to enemy operands and weapon types, not answer values.

Ownership/ammo survives checkpoint recovery. A new run/reload resets them. No cross-route transfer: Graveyard starts with ×1 even after POC VII; original Core Clash retains its independent shield/orb/five-powered-round rules. The future boss mechanic remains undecided.

## Controls / feel

Preserved POC VII: arrows/A/D move; Space/Up/W jump; hold F fire; E open; Q autoshoot; Escape pause/leave question. Weapon selection is 1/2/3. Touch controls preserve multi-pointer movement, jump and firing, plus gun selection, autoshoot, pause and contextual OPEN. Authored 960×540 stage, uniform scale and safe areas. Player movement, animation sheets, checkpoints, health pickups, aim assistance and camera are inherited.

Eight ordinary skeleton encounters in a 3300-unit route: 1×2, 2×2, 2×3, 1×3, 2×3, 3×2, 3×3, 2×2. No mandatory math doors; ×1 can complete combat and all orbs may be ignored. Exit is available without mandatory kills, matching the prior level's optional traversal.

## Files / run

- `dist/poc-viii/{index.html,style.css,game.js}`: self-contained experimental stage, uses shared `dist/assets/` and `dist/vendor/`.
- `dist/journey/{index.html,continue.js}`: additive stage sequence.
- `qa/graveyard-playtest.cjs`: actual browser keyboard/CDP touch acceptance.
- `qa/graveyard-results.json`, `qa/graveyard-events.json`, `qa/graveyard-*.png`: recorded evidence.

In the GitHub prototype directory run `node prepare.mjs`, then `python -m http.server 8000 --directory dist`. Open `/journey/` or `/poc-viii/`. No build, CDN, API or backend needed.

QA requires Playwright and Chromium. Run `node qa/graveyard-playtest.cjs`; optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE` selects an installed browser. `SPARTICUZ_MODULE` optionally supplies server Chromium flags. Tests read `window.gameState()` / `window.pocEvents()` but never teleport, grant weapons, advance clocks, or replace gameplay rules. Physical iPhone Safari remains a device check.

## Art provenance

The dragon, observatory, platforms, core and spark are exact original Core Clash assets; Phaser remains pinned 3.90.0 MIT. See ASSETS.md. Graveyard adds simple headstones, bare tree silhouettes, and restrained background tint through Phaser graphics.

The skeleton body uses the existing procedural skeleton geometry from William's supplied, connected Higgsfield reference `https://studigo-graveyard-123.higgsfield.app`, inspected via its authorized source checkout on 2026-09-29 (`app/public/client.js`, `drawSkeleton`). Same skull/ribs/limbs/belt, rendered once to a local canvas texture; numerical labels and effects are separate. No third-party art pack or new monster species. The reference site's body drawing is embedded locally; it is not a runtime dependency. No external asset license is invented or claimed.

## Handoff prompt

Continue Studigo's experimental browser game from `feature/moon-road-core-clash`, under `prototypes/moon-road/`. Read CURRENT_GAME_HANDOFF.md and POC-VIII.md before editing. Preserve POC VII and Core Clash as golden comparison builds. Latest experiment is `/journey/` (VII → Graveyard → original boss), or `/poc-viii/` for direct testing. Inspect the actual files and recorded browser acceptance before changes. Preserve movement, controls, existing art, permanent run ownership, limited ×2/×3 ammo, operand-only matching and 20-second active-play orb retries. Do not broaden the learning concept or select a new boss mechanic without William's direction. Validate changes through real browser inputs/screenshots, document limitations, update handoff/evidence, sync the branch and publish to the existing Studigo site.

## Verified acceptance — 2026-09-29

The browser playtest passed with actual keyboard and simultaneous CDP touch at 844×390. A 2×3 skeleton was defeated with exactly 6 basic hits, 3 ×2 hits and 2 ×3 hits in ordinary gameplay. Nonmatches 2→1×3, 2→3×3, and 3→2×2 reflected with zero damage. Empty special ownership, no empty firing, per-family refills, ownership after checkpoint recovery, ignoring all orbs, frozen question/pause time, different retry questions, and both stage connections passed. Failed-orb respawn intervals were 20.007 and 20.016 active seconds. No browser page errors. Core Clash loaded with its original 50 HP.

Visual review fixed three specific weaknesses: REFLECTED text now rises above the operand badge; dormant orbs hide their OPEN prompt; successful hits now recoil/squash the existing skeleton body. Retested after these changes and inspected a three-frame reflection sequence. `qa/graveyard-results.json` and `qa/graveyard-events.json` are the machine-readable record; screenshots capture the real renderer. Physical iPhone Safari was not available for this test.
