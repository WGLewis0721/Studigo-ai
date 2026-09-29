# POC IX — Moon Keep

First Metroidvania slice of the Moon Road prototypes. Multiplication is how you move through the world. References: Metroid Fusion / Zero Mission (room grid, hatches, minimap, upgrades, backtracking), Castlevania SotN (map %, breakable secret walls, drops that drift to you), Mega Man (bosses give their beam, weapon energy, mid-fight switching), Grimvalor (phone-first readability). The dragon stays a shooter. No melee or dash.

- **Golden image** (tag `golden/poc-ix-moon-keep`); frozen. Beta test URL: https://wglewis0721.github.io/Studigo-ai/prototypes/moon-road/dist/poc-ix/
- Route: `dist/poc-ix/` → open `/poc-ix/`. ↺ (header or Pause) restarts the run after a confirm.
- Design spec: `docs/superpowers/specs/2026-09-29-poc-ix-moon-keep-design.md`. Plan: `docs/superpowers/plans/2026-09-29-poc-ix-moon-keep.md`.
- Additive: `/poc-vii/`, `/poc-viii/`, `/journey/`, `/adventure/` and the Core Clash root files are unchanged. The finale opens the original Core Clash through `../poc-vii/boss.html`.

## Rules

| Object | Shows | HP | Damaged by | Otherwise |
|---|---|---|---|---|
| Skeleton | `a · b` (1–4) | a×b | ×1, ×a, ×b | reflects, 0 damage |
| Seal (door lock) | `a · b` | a×b | ×a or ×b. **×1 never opens seals** | reflects, "×1 can't open seals" |
| Stone block | product `P` | P | any ×N ≥ 2 whose count lands on P | reflects, "×4 skips 6" |
| Boss plate | `a · b` on its core | a×b | ×1 if an operand is 1, ×a, ×b | reflects |

Damage always equals the beam number. Block hits skip-count (`2`, `4`, then `2 × 3 = 6`). Copy never uses division words.

Beams: ×1 unlimited; ×2/×3/×4 hold 12 rounds (+4 per expansion). One round per shot, including reflected shots.

## World

```
x:     0    1    2    3    4    5    6    7    8
y0:                  [C]  [H   H]  [I]  [J]  [L]   ← ×5 teaser seal on C's west wall
y1:             [K]  [C]
y2:  [A]  [B   B]    [C]
y3:                  [C]  [D   D]  [E]  [F]  [G]
```

A Moon Gate (start shrine) · B Great Atrium · C Central Shaft · D Crypt Hall · E Crypt Shrine · F Twin Warden · G Boots Chamber · H Star Walk · I Star Shrine · J Trine Guardian · K Hidden Vault · L Moon Vault (finale).

Critical path: A → B → C (down) → D → E → **Twin Warden** (×2) → `1·2` seal → **Moon Boots** → back up C (boots-only jumps) → `2·2` seal → H → I → **Trine Guardian** (×3) → L.

Optional, all by backtracking: `9` block on C's vault ledge (×3) → K: ×4 orb + energy tank 2 · Atrium shelf (boots): energy tank 1, `4·4` closet (×4) → energy tank 3 · `4` block in H (×2/×4) → ×2 expansion · `6` block in D (×2/×3) → ×3 expansion. ×5 door stays sealed ("NEXT ZONE · ×5").

## Bosses

- **Twin Warden:** two large skeletons. Plates `1·3, 1·2, 1·4, 1·3` alternate between twins. The dormant twin is a translucent ghost that shots pass through. It hops and throws bones in an arc. Beatable with ×1. Drops ×2.
- **Trine Guardian:** the original guardian sheet. Plates `2·3, 1·4, 2·2, 1·3, 2·4` force ×1/×2 switching. It floats, fires a 3-orb volley, and makes a telegraphed dive. Drops ×3.
- Arena doors lock (red hatches) until the boss falls. Breaking a plate drops ammo for the next plate's beam. If no owned beam with ammo fits the current plate, a capsule appears every 8 s.

## Knowledge orbs (POC VII loop, unchanged)

Voluntary: OPEN/E or tap. `N × k = ?`, three choices. NOT NOW / Esc / × leave with no cooldown. Correct refills that beam to capacity (the vault orb unlocks ×4). Wrong: "Keep going!", no reveal, no penalty. After any submitted answer, the orb sleeps for 20 s of active play (questions, pause, map and finish don't count), then returns with a different fact. Each orb starts at its own point in the fact sequence.

Orbs: E (×2), I (×2, ×3), C middle ledge (×2), C vault ledge (×3), K (×4 unlock). Refill orbs appear only once you own that beam.

## Supply and recovery

- Matched power kills drop +3 of that beam. ×1 kills alternate between a heart (when hurt) and +2 for your emptiest owned beam. Drops drift to you within 150 px.
- Shrines (A, E, I) save and fully heal. Death returns you to the last shrine with everything kept. Enemies respawn on room entry. Bosses and opened seals/blocks stay done.
- Aim assist prefers targets your beam can hurt. A mismatched target is only aimed at within 300 px, and never during a boss.

## Controls

Keyboard: ←/→ or A/D · Space/W/↑ jump (hold for height) · F fire · E open orb · 1–4 beam · C cycle beam · M map · Q autoshoot (fires only with a target in view) · Esc pause/leave. Touch: ◀ ▶, jump, fire, beam button (tap to cycle; shows ammo and owned pips), autoshoot, contextual OPEN, header map/pause. Multi-pointer held input, 960×540 authored stage, safe areas, blur/hidden-tab pause.

## Files

`dist/poc-ix/`: `rules.js` (damage rules/copy/facts), `progress.js` (run state), `physics.js` (tiles + AABB, one-way platforms), `world.js` (room data), `scene.js` (Phaser scene), `actors.js`, `boss.js`, `ui.js` (DOM HUD/input/map/question), `main.js`, `index.html`, `style.css`. Rooms are drawn in code with per-zone palettes over the original observatory backdrop. The dragon, platform, core, guardian and Graveyard skeleton geometry are reused; there is no new generated art.

## Tests

- `node --test test/*.test.mjs` runs 31 unit tests. They cover rules, run state, and physics. They also validate the world: reciprocal doors, carved openings, no overlaps, actors on surfaces. A progression solver proves the slice completes, Moon Boots gate the upper shaft, ×3 gates the vault, ×4 gates the closet, and ×5 stays sealed.
- `node qa/moon-keep-playtest.cjs` runs browser acceptance with real keyboard, mouse and CDP multitouch. It reads `gameState()`/`pocEvents()` only and never teleports or mutates state. It needs `playwright` (or `playwright-core`) and Chromium; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if needed. Results: `qa/moon-keep-results.json`, `qa/moon-keep-events.json`, `qa/moon-keep-*.png`.

## Known limits

Chromium only; physical iPhone Safari untested. No save file (reload = new run). Bot-driven QA proves reachability and rules, not difficulty feel. A human pass on boss tuning and ammo economy is the next useful playtest. No mastery claim.
