# POC IX Moon Keep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/poc-ix/`, a 12-room multiplication Metroidvania slice (factor-locked seals, skip-count factor blocks, two plate bosses, Moon Boots, Knowledge orbs) that ends at the original Core Clash.

**Architecture:** Plain ES modules under `prototypes/moon-road/dist/poc-ix/`, no build. Pure logic (`rules`, `progress`, `physics`, `world`) has no Phaser/DOM and is tested with `node --test`. Browser layer (`scene`, `actors`, `boss`, `ui`, `main`) uses the bundled Phaser 3.90.0 global and shared `../assets/`.

**Tech Stack:** Phaser 3.90.0 (global, `../vendor/phaser-3.90.0.min.js`), vanilla JS ES modules, Node 22+ `node:test`, browser QA through the in-app browser / Playwright Chromium.

**Spec:** `docs/superpowers/specs/2026-09-29-poc-ix-moon-keep-design.md`

## Global Constraints

- Only add files under `prototypes/moon-road/dist/poc-ix/`, `prototypes/moon-road/test/`, `prototypes/moon-road/qa/moon-keep-*`, docs. Never edit `/poc-vii/`, `/poc-viii/`, `/journey/`, `/adventure/`, root `dist/index.html|game.js|game.css`, `dist/assets/`, `dist/vendor/`.
- `dist/` is gitignored; new files need `git add -f`.
- Authored stage 960×540; tile 32 px; one screen = 30×17 tiles.
- Weapons ×1 (∞), ×2, ×3, ×4; base capacity 12; expansion +4. ×5 only as unbreakable teaser seal.
- ×1 never damages seals or factor blocks. Nonmatching shots reflect (0 damage, round spent, never hurt the player).
- UI copy is multiplication only: no "divide", "factor of", "÷".
- Orb cooldown 20 s of active play; wrong answers reveal nothing and cost nothing.
- Read-only test hooks `window.gameState()` / `window.pocEvents()`; no teleport or mutation hooks.
- Commit only when William asks (global rule overrides "frequent commits").

## File map

| File | Responsibility |
|---|---|
| `dist/poc-ix/package.json` | `{"type":"module"}` so node imports the modules without warnings |
| `dist/poc-ix/rules.js` | damage eligibility, HP, floater text, orb facts/choices |
| `dist/poc-ix/progress.js` | run state: weapons, ammo, hearts, items, visited, orb clocks |
| `dist/poc-ix/physics.js` | tile grid + AABB movement with one-way platforms and extra solid rects |
| `dist/poc-ix/world.js` | 12 room definitions built from helpers; entity + door data |
| `dist/poc-ix/scene.js` | Phaser scene: room load/draw, player, shots, transitions, camera |
| `dist/poc-ix/actors.js` | skeletons, seals, blocks, items, orbs, shrines, pickups |
| `dist/poc-ix/boss.js` | Twin Warden and Trine Guardian |
| `dist/poc-ix/ui.js` | DOM HUD, touch/keyboard input, question, map, overlays |
| `dist/poc-ix/main.js` | boot + read-only hooks |
| `dist/poc-ix/index.html`, `style.css` | shell |
| `test/*.test.mjs` | node tests, incl. progression solver |

---

### Task 1: rules.js

**Interfaces — Produces:**
- `CAPACITY=12`, `EXPANSION=4`, `WEAPONS=[1,2,3,4]`
- `targetHp(t)`: `t.kind` in `skeleton|seal|plate` → `t.a*t.b`; `block` → `t.product`
- `canDamage(t, w)`: skeleton → `w===1||w===t.a||w===t.b`; plate → `(w===1&&(t.a===1||t.b===1))||(w>1&&(w===t.a||w===t.b))`; seal → `w>1&&(w===t.a||w===t.b)`; block → `w>1&&t.product%w===0`
- `hitText(t, w, hpAfter)`: block → running count `String(t.product-hpAfter)`, or `"${w} × ${t.product/w} = ${t.product}"` when `hpAfter===0`; others → `"−"+w`
- `reflectText(t, w)`: block → `"×${w} skips ${t.product}"`; seal with `w===1` → `"×1 can't open seals"`; else `"REFLECTED"`
- `fact(family, attempt)` → k in 1..10 from `[4,7,2,9,5,10,3,8,6,1]` offset by family; consecutive attempts differ
- `choices(family, k, rand)` → 3 distinct positive ints incl. `family*k`, shuffled

- [ ] Write `test/rules.test.mjs` covering: 2×3 skeleton takes ×1/×2/×3, rejects ×4; seal rejects ×1 even for `1·2`; plate `1·3` accepts ×1, plate `2·2` rejects ×1; block 6 accepts 2,3, rejects 1,4; block 9 accepts 3 only; `hitText` block 6 with ×2 gives `"2"`, `"4"`, then `"2 × 3 = 6"`; `reflectText` block `"×4 skips 6"`; `fact` differs for attempts 0..20; `choices` contains correct, 3 distinct, all > 0, for every family 2–4 and k 1–10.
- [ ] Run `node --test test/` → fails (module missing). Implement. Run → pass.

### Task 2: progress.js

**Produces:** `newRun()` → `{owned:{1:true,2:false,3:false,4:false}, ammo:{2:0,3:0,4:0}, cap:{2:12,3:12,4:12}, maxHearts:5, hearts:5, boots:false, items:Set, visited:Set, shrine:{room:'A',x:272}, active:0, orbs:{}}`; `grantWeapon(r,n)` (own + fill); `refill(r,n)`; `addAmmo(r,n,amt)` (capped, only if owned); `spend(r,n)` → bool (×1 always true; else decrements if >0); `collect(r,item)` (`item.id` once; kinds `tank` +1 max & heal, `expansion` cap +4 on `item.family` and +4 ammo if owned, `boots`, `weapon`); `visit(r,id)`; `mapPercent(r,total)`; `hurt(r)` → dead bool; `healFull(r)`; `ORB_COOLDOWN=20`; `orbReady(r,id)`; `submitOrb(r,id)` → attempt index used, sets `readyAt=active+20`, increments attempt; `orbAttempt(r,id)`.

- [ ] Test: fresh run owns only ×1; grantWeapon fills 12; spend decrements, empty → false, ×1 always true; expansion raises cap to 16 and doesn't double-apply; tank raises maxHearts and heals; hurt to 0 → dead; orb ready → submit → not ready until active advances 20; attempt increments; mapPercent(5 of 12) = 42.
- [ ] Run fail → implement → pass.

### Task 3: physics.js

**Produces:** `TILE=32`; `makeGrid(rows:string[])` → `{w,h,at(tx,ty)}` (ty<0 or ≥h → `'#'`; tx out of range → `'.'`); `moveBody(b, dx, dy, grid, rects=[])` mutates `b.x` (center), `b.y` (feet) with `b.w`,`b.h`; returns `{ground, wall, ceiling}`. `'#'` solid; `'='` one-way (only blocks downward movement when previous feet ≤ tile top). `rects` are `{x,y,w,h}` solids (top-left).

- [ ] Test: body falls onto `#` floor and reports ground; passes up through `=` and lands on it when falling; blocked by `#` wall horizontally; head hits ceiling; blocked by a rect; walking off a ledge edge → not ground.
- [ ] Run fail → implement → pass.

### Task 4: world.js + progression solver

**Produces:** `ROOMS` (object keyed `A..L`), each `{id,name,zone,gx,gy,w,h,rows:string[],doors:[{side,row,to}],entities:[...]}`; `ROOM_COUNT=12`; `doorSpan(room,door)` → `{tx, ty0, ty1}` opening tiles; `START={room:'A',x:272}`.
Entities: `skeleton{tx,ty,a,b,range}`, `seal{id,tx,ty,a,b}` (1×4 tiles), `block{id,tx,ty,tw,th,product}`, `item{id,kind,family?,tx,ty,hiddenBy?,needs?}`, `shrine{tx,orbs:[families]}`, `orb{id,family,unlock:true,tx,ty}`, `boss{id,kind,reward}`, `finale{tx}`. Doors may carry `via` (seal/block id) and `needs:['boots']`.

- [ ] Test `test/world.test.mjs`: every room's rows count `h*17` and each row length `w*30`; every door with `to` has a reciprocal on the opposite side in the target room at the same global row and adjacent grid column; door openings are carved (`.`) in the wall; every `via` references an entity in that room; solver (in `test/solver.mjs`) reaches L, collects all 7 collectibles plus both boss rewards, and proves H is unreachable without boots and K is unreachable without ×3.
- [ ] Run fail → implement → pass.

### Task 5: shell, input, room rendering, player, transitions

Files: `index.html`, `style.css`, `ui.js`, `scene.js`, `main.js`.
- [ ] Shell mirrors POC VIII (header brand/hearts/map/pause, notice, controls, intro/question/pause/map/finish overlays, loading), with weapon-cycle button, minimap canvas, boss bar.
- [ ] Input: held sets per pointer; keyboard per spec; blur/visibility pause.
- [ ] Scene: draw room tiles in zone palette once per load; parallax `observatory.png`; dragon 116 px display, hitbox 40×76, speed 250, gravity 1150, jump 520 (boots 700), max fall 900; frames 0–5 run, 6 idle, 7 rise, 8 fall, 9 shoot, 10 land.
- [ ] Transition when center crosses room edge inside a door span: fade 120 ms, load target, place player 48 px inside reciprocal door on its ledge. `visit()` each room.
- [ ] Verify in browser: walk A→B→C, drop to bottom, → D and back; cannot climb C upper half.

### Task 6: combat and world objects

- [ ] Shots with aim assist (nearest targetable in facing dir, dx<600, |dy|<220), die on `#` tiles; `canDamage` gate, reflect otherwise; float `hitText`/`reflectText`; hit-stop and shake for power hits.
- [ ] Skeletons patrol ±range, contact damage, operand badge + segmented bar; power-matched kill drops +2 ammo pickup; every 3rd kill drops a heart if hurt. Respawn on room re-entry.
- [ ] Seals (solid rect, color by smallest operand ≥2, `a · b` label), blocks (solid, product label, skip-count), items (hidden until `hiddenBy` broken), persistent via `run.items` (`seal:`/`block:` ids).
- [ ] Death → last shrine, full hearts, items kept.
- [ ] Verify: ×1 on seal reflects with message; ×2 breaks `1·2` in 2 shots; block 6 shows 2,4,`2 × 3 = 6`.

### Task 7: shrines and Knowledge orbs

- [ ] Shrine: touching sets `run.shrine`, heals, "SAVED" cue. Orbs per owned family; K unlock orb for ×4. OPEN within 120 px or tap. Question overlay uses `fact`/`choices`; correct → refill (or grant ×4); wrong → "Keep going!"; both → `submitOrb`. `active` only advances in play.
- [ ] Verify: wrong answer → orb dormant → returns after 20 active s with different fact.

### Task 8: bosses

- [ ] Arena lock (red hatches solid) while boss alive; banner; DOM boss bar segmented per plate.
- [ ] Twin Warden: two scaled skeletons, plates `1·3,1·2,1·4,1·3` alternating owner; hop + arcing bone; inactive twin reflects. Drops ×2 item.
- [ ] Trine Guardian: guardian sheet (frames 0 idle, 2 punch, 5 hurt, 7 break), plates `2·3,1·4,2·2,1·3,2·4` on core; float, 3-orb volley, telegraphed dive. Drops ×3 item.
- [ ] Ammo safety: plate break drops ammo for next plate's family if owned; stuck-check spawns capsule every 8 s.
- [ ] Verify both fights through real input.

### Task 9: map, HUD, finale

- [ ] Minimap (current cell blinking, visited filled, seals as colored door ticks); full map overlay with % and items (M / header button).
- [ ] Finale L: beacon → finish overlay with map %, items n/7, ENTER CORE CLASH (`../poc-vii/boss.html`), KEEP EXPLORING.

### Task 10: QA + docs

- [ ] Full real-input playthrough in the browser at 844×390 and desktop; screenshots to `qa/moon-keep-*.png`; results `qa/moon-keep-results.json`.
- [ ] `POC-IX.md`, pointers in `README.md` and `CURRENT_GAME_HANDOFF.md`.
- [ ] Verify golden files unchanged: `git diff --stat -- dist/poc-vii dist/poc-viii dist/journey dist/index.html dist/game.js dist/game.css` is empty.
