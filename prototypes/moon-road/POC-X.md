# POC X — Moon Keep II: Clock Tower (golden image)

**Current golden image** (tag `golden/poc-x-moon-keep-ii`, approved by William 2026-09-29). It supersedes POC IX, which stays playable as the previous golden. It's POC IX plus real generated art, the ×5 Clock Tower zone, the Clock Shield, the Training Hall, match rewards, and the Rune Gate/Sanctum portal to Core Clash.

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

**Problems hover over every non-boss monster.** Skeletons, bats and the training dummy all show their `a · b` above them with a segmented health bar. Boss plates print on the boss itself; the Clockwork Warden's plates appear on its clock dial.

**×5 Clock Tower** (map row 0). The old ×5 teaser door on the Central Shaft is now a `4 · 5` seal, so ×4 from the Hidden Vault opens it (5 shots).

| Room | Contents |
|---|---|
| M Clock Gate (1×2) | Boots climb. Skeleton `5 · 1`, bat `1 · 5` |
| N Gear Gallery (3×1) | Skeletons `2·5`, `5·4`, `3·5`; bats `5·3`, `1·5`; `15` block (×3 or ×5) hides energy tank 4 |
| O Bell Shrine | Shrine with ×2, ×3, ×4 and ×5 refill orbs |
| P Clockwork Warden | Boss. Plates `2·5, 1·5, 4·5, 3·5, 2·5, 4·5` (80 HP), beatable without ×5. Floor shockwaves (jump them) and arcing gears. Drops the **×5 beam** and the **Clock Shield**. The east door is a `5 · 5` seal (×5 only) |
| Q Training Hall (36 tiles wide, 20% wider than a screen) | Save shrine, the practice dummy, and the **+1 shield charge** on a pedestal |

**Clock Shield.** It starts with 3 charges. A charge absorbs a hit instead of a heart ("◆ BLOCKED"). Every non-boss kill restores one charge. The Training Hall's upgrade raises the maximum to 4. Charges show as ◆ next to the hearts, and a faint bubble surrounds the dragon while you have any.

**Training Hall dummy (William, 2026-09-29).** The Pendulum Sentinel is now a practice dummy with non-boss monster rules and rewards, and no risk:
- ×1 always works and a beam matching either number works. Anything else reflects.
- A matching power beam staggers it and shatters its silver armor.
- Each problem is one "life". Clearing it counts as a kill: a match clear builds your streak, refunds rounds and drops ammo, and streak bonuses apply.
- A new problem swings in after each clear. Problems shuffle through 1–5; a 5 glows, and ×5 then hits double.
- It swings and throws chime rings that deal 0 damage. They show a "0" and never break your streak.
- The room has a save shrine.

**Rune Gate and Rune Sanctum (the new way to Core Clash).** The old Moon Vault after the Trine Guardian is gone, and its portal moved here, off the Central Shaft hub. The shaft's east wall at map row 2 has a ledge (Moon Boots; a platform helps).
- **R Rune Gate:** a low corridor with one gate per power beam, `×2 ×3 ×4 ×5`. One shot of the matching beam opens each.
- **S Rune Sanctum:** a shrine with ×2–×5 refill orbs and four runes in each beam's colour and number.
  - Only a rune's own beam charges it. It skip-counts like the stone blocks (`2, 4 … 10`, `3 … 15`, `4 … 20`, `5 … 25`), then shows `N × 5 = 5N`, glows, and refills that beam.
  - When all four glow, the portal lights in their four colours. Walking in opens the same Core Clash choice as before (ENTER CORE CLASH / KEEP EXPLORING / NEW RUN), and the Core Clash encounter itself is unchanged.

**Boss orbs.** Every boss arena (Twin, Trine, Clockwork) has a ✚ knowledge orb above the floor while the boss is up. A right answer refills every beam you own and drops a heart if you're hurt. It asks about the beam the current plate needs. Same orb rules as elsewhere: no penalty, and a 20 s active-play retry.

**Boss ammo safety (POC X).**
- Breaking a plate drops enough ammo to finish the next plate, plus two for misses (at least 3). Respawning at a shrine tops every owned beam up to at least half capacity.
- If no owned beam with ammo can hurt the current plate, a capsule appears beside you after 3 s.
- Kills now also drop ×5 ammo.

## Files

- `dist/poc-x/`: same module layout as POC IX (`rules`, `progress`, `physics`, `world`, `scene`, `actors`, `boss`, `ui`, `main`).
- `dist/poc-x/art/`: sliced sprites, backdrops, textures, and `art.js`/`art.json` (frame sizes, anchors, clock-dial centres).
- `art-source/poc-x/`: raw generated sheets plus `process.py`, which keys out the magenta, slices, aligns feet, downscales and finds the dials.

## Tests

- `node --test "test/**/*.test.mjs"` runs 71 tests. They cover:
  - rules for ×5, the dummy, runes, matches and armor;
  - the shield and the streak;
  - 18-room world validation, including the 36-tile Training Hall.

  The solver proves ×4 opens the Clock Tower, ×5 opens the Training Hall and the Sanctum, all four runes charge, and there's exactly one portal.

## Known limits

- `qa/clock-tower-playtest.cjs`: a real-input run from the start through the Clock Tower. It covers the boss orb, jumping over the Warden, the Training Hall (save shrine, no damage, streaks, ammo drops, shield upgrade), the Rune Gate, all four runes, and the portal into Core Clash. Results are in `qa/clock-tower-results.json`.
- Shield absorbs are unit-tested. The scripted run didn't take a hit after getting the shield, so the in-browser absorb is still to be seen in play.
- Physical iPhone Safari is untested.
