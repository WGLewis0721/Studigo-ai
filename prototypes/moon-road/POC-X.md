# POC X — Moon Keep II: Clock Tower (beta)

The working build after the POC IX golden image. It's POC IX plus real generated art, the ×5 Clock Tower zone, the Clock Shield, and a mini-boss trial. POC IX stays frozen (tag `golden/poc-ix-moon-keep`).

- Route: `dist/poc-x/`. Beta test URL once merged: https://wglewis0721.github.io/Studigo-ai/prototypes/moon-road/dist/poc-x/
- Not linked from the Studigo app.
- ↺ in the header or Pause restarts the run after a confirm.

## What changed from POC IX

**Art.** Everything except the dragon, guardian and observatory is new generated art, made with the originals as references (see ASSETS.md):
- Art skeletons with walk, lunge and hurt poses.
- Clockwork bats.
- The Twin Warden as an armored lantern skeleton.
- The Clockwork Warden boss and the Pendulum Sentinel.
- Item icons.
- Painted backdrops for the crypt, observatory, vault and clock tower.
- A wall texture per zone.

The atrium and shaft keep the original observatory backdrop.

**Problems hover over every non-boss monster.** Skeletons, bats and the trial mini-boss all show their `a · b` above them with a segmented health bar. Boss plates print on the boss itself; the Clockwork Warden's plates appear on its clock dial.

**×5 Clock Tower** (map row 0). The old ×5 teaser door on the Central Shaft is now a `4 · 5` seal, so ×4 from the Hidden Vault opens it (5 shots).

| Room | Contents |
|---|---|
| M Clock Gate (1×2) | Boots climb. Skeleton `5 · 1`, bat `1 · 5` |
| N Gear Gallery (3×1) | Skeletons `2·5`, `5·4`, `3·5`; bats `5·3`, `1·5`; `15` block (×3 or ×5) hides energy tank 4 |
| O Bell Shrine | Shrine with ×2, ×3, ×4 and ×5 refill orbs |
| P Clockwork Warden | Boss. Plates `2·5, 1·5, 4·5, 3·5, 2·5, 4·5` (80 HP), beatable without ×5. Floor shockwaves (jump them) and arcing gears. Drops the **×5 beam** and the **Clock Shield**. The east door is a `5 · 5` seal (×5 only) |
| Q Pendulum Trial | Mini-boss. Drops **+1 shield charge** |

**Clock Shield.** It starts with 3 charges. A charge absorbs a hit instead of a heart ("◆ BLOCKED"). Every non-boss kill restores one charge. The trial upgrade raises the maximum to 4. Charges show as ◆ next to the hearts, and a faint bubble surrounds the dragon while you have any.

**Pendulum Trial**, as William specified:
- It uses the same rules as monsters: ×1 always works, a beam matching either number works, anything else reflects.
- It has one health pool of 20, which is 25% of the Clockwork Warden's 80.
- It starts on `1 · 2`, then reshuffles through 1–5 (every 2.6 s, or after 4 damage).
- A 5 shows only briefly. While it does, the trial glows pink and a ×5 hit deals double (10).
- It swings gently on a pendulum and has no projectiles. It's meant as a short trial of every beam, not a hard fight.

**Boss ammo safety (POC X).**
- Breaking a plate drops exactly enough ammo to finish the next plate.
- If no owned beam with ammo can hurt the current plate, a capsule appears beside you after 3 s.
- Kills now also drop ×5 ammo.

## Files

- `dist/poc-x/`: same module layout as POC IX (`rules`, `progress`, `physics`, `world`, `scene`, `actors`, `boss`, `ui`, `main`).
- `dist/poc-x/art/`: sliced sprites, backdrops, textures, and `art.js`/`art.json` (frame sizes, anchors, clock-dial centres).
- `art-source/poc-x/`: raw generated sheets plus `process.py`, which keys out the magenta, slices, aligns feet, downscales and finds the dials.

## Tests

- `node --test "test/**/*.test.mjs"` runs POC IX's 31 tests plus 34 for POC X. The POC X tests add ×5 rules, trial damage including the ×5 double, the shield, and 17-room world validation. The solver proves ×4 opens the Clock Tower, ×5 opens the trial, the Warden is beatable before ×5, and the trial has 25% of the Warden's health.
- `node qa/clock-tower-playtest.cjs` is a real-input run from the start through the Clock Tower, Warden and trial. Results are in `qa/clock-tower-results.json` and `qa/clock-tower-*.png`.

## Known limits

- The QA bot proves reachability and rules, not difficulty feel. William is playtesting the Warden and trial next.
- Shield absorbs are unit-tested. The scripted run didn't take a hit after getting the shield, so the in-browser absorb is still to be seen in play.
- Physical iPhone Safari is untested.
