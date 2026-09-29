# POC IX — Moon Keep (first Metroidvania slice)

Status: approved direction 2026-09-29 (William). Additive experiment under `prototypes/moon-road/`.

## Goal

Grow the Moon Road prototypes into a small Metroidvania in which multiplication is how you move through the world. References: Metroid Fusion / Zero Mission (room grid, hatches, minimap, item upgrades, backtracking), Castlevania SotN (map %, secret breakable walls), Mega Man (boss gives its weapon, weapon energy, switching mid-fight), Grimvalor (phone-first readability). The dragon stays a shooter; no melee or dash in this slice.

It must play like a good action game first. Math never appears as division, never reveals answers, never penalizes a wrong answer.

## Preservation

New route `dist/poc-ix/` only. `/poc-vii/`, `/poc-viii/`, `/journey/`, `/adventure/` and the Core Clash root files stay byte-for-byte unchanged. Shared `dist/assets/` and `dist/vendor/` are read, not modified. The finale links to the original Core Clash via `../poc-vii/boss.html`, exactly as the other routes do.

## Number rules

Weapons: ×1 (unlimited), ×2, ×3, ×4 (limited ammo, base capacity 12). ×5 exists only as a sealed teaser door.

| Object | Shows | HP | Damaged by | Nonmatching shot |
|---|---|---|---|---|
| Skeleton (ordinary enemy) | two operands `a · b` (1–4) | a×b | ×1, ×a, ×b | reflects, 0 damage |
| Seal (Metroid hatch lock) | two operands `a · b` | a×b | ×a, ×b only — **×1 never opens seals** | reflects |
| Factor block (SotN secret wall) | product `P` only | P | ×N where N×k = P for whole k, N ≥ 2 | reflects |
| Boss plate | two operands `a · b` | a×b | ×1 (if a or b is 1), ×a, ×b | reflects |

Damage is always the weapon number. Reflections cost the round, never hurt the player.

Factor block feedback is skip counting: each hit floats the running count (`2`, `4`, `6`); on break it floats `2 × 3 = 6`. A reflecting weapon floats `×4 skips 6`. No "divides", "factor of", or ÷ wording anywhere in UI copy.

Rule of thumb shown on intro: **×1 fights. Seals and blocks need a power shot.**

## Progression items

- ×2 — dropped by the Twin Warden (boss 1).
- Moon Boots (high jump: ~3 tiles → ~5 tiles) — Boots Chamber, behind a `1 · 2` seal right after boss 1.
- ×3 — dropped by the Trine Guardian (boss 2).
- ×4 — Knowledge orb in the hidden Vault (answer a ×4 question; same loop as POC VII drops).
- Energy tanks ×3 (+1 max heart each; base 5).
- Ammo expansions ×2 (+4 capacity to ×2 and to ×3).

Items persist through death. Death returns the player to the last shrine at full hearts. Reload = new run (no save file in this slice).

## Knowledge orbs (preserved POC VII loop)

Orbs sit in shrines. Voluntary: OPEN/E or tap. Question `N × k = ?`, k in 1–10, three choices, NOT NOW / Esc / close leave without penalty. Correct: fills that family to capacity (or unlocks ×4 at the Vault orb). Wrong: "Keep going!", no reveal, no penalty. After any submitted answer the orb goes dormant until 20 s of active play have passed (clock runs only in `play`), then returns with a different fact. A shrine orb only appears for families the player owns.

## Ammo safety (no softlocks)

- Killing a skeleton with a matching power shot drops +2 ammo of that family.
- Breaking a boss plate drops ammo for the family the next plate needs (if owned).
- In a boss fight, if the current plate can't be damaged with any owned weapon that has ammo, a capsule for a matching owned family spawns every 8 s.
- Every boss is preceded by a shrine with an orb.

## World map (grid in screens; one screen = 30×17 tiles of 32 px)

```
x:     0    1    2    3    4    5    6    7    8
y0:                  [C]  [H   H]  [I]  [J]  [L]   ← ×5 teaser door on C's west wall
y1:             [K]  [C]
y2:  [A]  [B   B]    [C]
y3:                  [C]  [D   D]  [E]  [F]  [G]
```
Cell coordinates: A(0,2) B(1–2,2) C(3,0–3) D(4–5,3) E(6,3) F(7,3) G(8,3) H(4–5,0) I(6,0) J(7,0) K(2,1) L(8,0).

| Room | Size | Contents |
|---|---|---|
| A Moon Gate | 1×1 | Start, shrine (save/heal) |
| B Great Atrium | 2×1 | Skeletons 1·2, 1·3, 2·2. High ledge (Boots) → energy tank 1. Closet behind `4 · 4` seal → energy tank 3 |
| C Central Shaft | 1×4 | Vertical. W door y2 → B; E door y3 → D; E door y0 behind `2 · 2` seal → H; W door y0 `5 · 5` seal (teaser: "NEXT ZONE"). Upper half needs Moon Boots. Factor block `9` in W wall at y1 → K |
| D Crypt Hall | 2×1 | Skeletons 1·2, 2·1, 1·4, 2·2. Factor block `6` → ×3 ammo expansion (backtrack) |
| E Crypt Shrine | 1×1 | Shrine + ×2 orb |
| F Twin Warden | 1×1 | Boss 1 |
| G Boots Chamber | 1×1 | Behind `1 · 2` seal. Moon Boots |
| H Star Walk | 2×1 | Skeletons 2·3, 3·1, 2·2, 3·2. Factor block `4` → ×2 ammo expansion |
| I Star Shrine | 1×1 | Shrine + ×2 orb + ×3 orb |
| J Trine Guardian | 1×1 | Boss 2 |
| K Vault | 1×1 | ×4 Knowledge orb, energy tank 2 |
| L Moon Vault | 1×1 | ENTER CORE CLASH finale; shows map % and items found |

Intended path: A → B → C(down) → D → E → F (×2) → G (Boots) → back to C, climb → `2·2` seal → H → I → J (×3) → L. Optional: K via block `9` (×3), tank 1 (Boots), tank 3 (`4·4`, ×4), expansions.

## Bosses (Mega Man structure, operand plates)

A boss is a sequence of plates; the current plate's operands show on its core; the HP bar is segmented per plate. Only the current plate takes damage.

- **Twin Warden** (×2 theme; player has only ×1): two large skeletons. Plates alternate twins: `1·3`, `1·2`, `1·4`, `1·3`. Attacks: hop toward player, arcing bone throw, alternating so one is always idle. Drops ×2.
- **Trine Guardian** (reuses guardian sheet): plates `2·3`, `1·4`, `2·2`, `1·3`, `2·4` — forces ×1/×2 switching and ammo management. Attacks: float + 3-orb volley, telegraphed dive. Drops ×3.

Contact and projectiles deal 1 heart. Invulnerability 1.5 s after a hit.

## Controls

Keyboard: ←/→ or A/D move · Space/W/↑ jump · F fire (hold) · E open · 1–4 select · C cycle weapon · M map · Q autoshoot · Esc pause/leave question. Doors open by walking into them (unless sealed).

Touch: ◀ ▶, jump, fire, weapon-cycle button (shows current weapon + ammo), autoshoot, contextual OPEN; header has map and pause. Multi-pointer held input, safe areas, 960×540 authored stage, landscape. Blur/hidden tab pauses.

Aim assist (inherited): shots home toward the nearest valid target (skeleton, seal, block, boss) in the facing direction.

## HUD / map

Hearts (max 5 + tanks), current weapon + ammo, minimap (Fusion style: current cell highlighted, visited cells filled, known doors marked, seals colored by lowest operand). Pause/map screen: full grid, % explored (visited rooms / 12), items collected.

## Architecture

`dist/poc-ix/` — plain ES modules, no build, Phaser global from `../vendor/`.

| Module | Responsibility | Pure? |
|---|---|---|
| `rules.js` | `canDamage(target, weapon)`, skip-count text, ammo caps, fact rotation | yes, node-tested |
| `progress.js` | inventory, ammo, hearts, visited rooms, map %, orb cooldown clock | yes, node-tested |
| `world.js` | room definitions (ASCII tile rows + entity lists), door links | data, node-validated |
| `physics.js` | AABB vs tile collision, one-way platforms | yes, node-tested |
| `scene.js` | Phaser scene: room load, transitions, camera, rendering | browser |
| `actors.js` | player, skeletons, seals, blocks, pickups | browser |
| `boss.js` | Twin Warden, Trine Guardian | browser |
| `ui.js` | DOM HUD, touch controls, question, map, overlays | browser |
| `main.js` | wiring, `window.gameState()` / `window.pocEvents()` read-only hooks | browser |

Room art: tiles drawn with Phaser graphics in per-zone palettes (Atrium moonstone, Crypt bone-grey/amber, Observatory indigo/star-blue); reuse `observatory.png` parallax, `platform.png`, dragon, skeleton geometry, guardian sheet, `core.png` for orbs/items. No new generated art in this slice.

## Testing

- `node --test prototypes/moon-road/test/` — rules, progress, physics, and a world validator: every door has a reciprocal, tile rows match room size, and a progression solver proves the intended path completes from A with only items obtainable in order (no softlock).
- `qa/moon-keep-playtest.cjs` — Playwright, real keyboard + CDP touch at 844×390: start, door transition, seal reflect with ×1, factor-block skip count, orb wrong/cooldown/retry, boss plate switching, finale link. Reads only the read-only hooks; no teleport or state mutation.
- Record results in `qa/moon-keep-results.json` and screenshots; document in `POC-IX.md` and a pointer in `CURRENT_GAME_HANDOFF.md` / README.

## Out of scope

Melee, dash, save files, ×5 zone, generated art, backend/learner model, mastery claims, publishing (local only unless William asks).

## Changes from playtesting (2026-09-29)

- Twin Warden's dormant twin is a translucent ghost that shots pass through, so shots stop reflecting off the wrong twin mid-fight. Twins land beside the player, not on top.
- Aim assist prefers targets the current beam can hurt. It aims at mismatched targets only within 300 px, and never during a boss.
- Refill orbs added in the Central Shaft: ×2 on the middle (Atrium) ledge, ×3 beside the `9` block. Without them, running dry meant a long backtrack.
- Supply: matched power kills drop +3 (was +2). ×1 kills alternate heart (when hurt) and +2 for the emptiest owned beam. Drops drift to the player within 150 px.
- Each orb starts at its own offset in the fact sequence, so different orbs don't all open on `2 × 3`.
- Autoshoot only fires with a target in view (saves limited ammo).
- Background is one oversized parallax image that never wraps, because the observatory art isn't seamless.
