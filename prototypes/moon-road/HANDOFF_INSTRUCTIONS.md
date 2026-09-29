> **Before using this POC VIII direction, read `prototypes/moon-road/CURRENT_GAME_HANDOFF.md` first.** That file is the authoritative golden-state handoff for Astra's current sprites, assets, look, controls, POC VII level behavior, Core Clash boss behavior, QA hooks, and preservation rules. POC VIII is an additive experiment, not permission to redesign or replace the golden controls.

# Astra handoff — POC VIII: Graveyard 1·2·3

Read this before changing the experimental Studigo game prototypes.

## Where the existing work lives

Astra's current game experiments are already in this repository.

### Core Clash boss — preserve as the boss control
The polished standalone boss is here:

- `prototypes/moon-road/dist/index.html`
- `prototypes/moon-road/dist/game.js`
- `prototypes/moon-road/dist/game.css`

This is the **Core Clash / Prism Guardian control build**. It has the 50 HP guardian, shield/orb/powered-shot loop, mobile controls, generated dragon/guardian art, and the existing boss presentation.

There is also an earlier React boss alpha at:

- `apps/web/app/game/page.tsx`
- `apps/web/app/game/game.css`

Use that only as historical reference. The standalone Core Clash in `prototypes/moon-road/dist/` is the stronger boss/game-feel source of truth.

### POC VII — preserve as the prior level control
The connected Moon Road experiment is here:

- `prototypes/moon-road/dist/adventure/index.html`
- `prototypes/moon-road/dist/adventure/level.js`
- `prototypes/moon-road/dist/adventure/level.css`
- `prototypes/moon-road/qa/`

POC VII's important reusable idea is the **respawning Knowledge Drop loop**:

1. Player voluntarily attempts a knowledge/power source.
2. Success gives useful combat capability.
3. Failure does not permanently punish or lock the player out.
4. The source goes dormant.
5. It returns after about **20 seconds of active, unpaused gameplay**.
6. The retry uses a different prompt/representation from the same concept.
7. No visible countdown.

Do not destroy either control build. POC VIII should be a new sibling experiment/route so POC VII and standalone Core Clash remain playable for comparison.

---

# POC VIII direction

Behavioral reference:

**https://studigo-graveyard-123.higgsfield.app**

This is an unlisted prototype used to validate the new combat grammar. Treat it as a behavior/reference build, not a source-code dependency.

The new direction is **not** “gameplay, then stop and answer a worksheet question.”

The multiplication relationship itself becomes the enemy's combat rules.

## Level theme

Build a short **Graveyard** action-platforming level.

- Skeletons only for ordinary monsters.
- Number vocabulary for this level: **1, 2, 3 only**.
- Starting weapon: **×1**.
- Earnable power weapons: **×2** and **×3**.
- Do not add ×4 or higher to this level.
- Keep the GBA/PS2-era action-adventure feel: Castlevania, Mega Man, Metroid GBA/Prime, Kirby GBA, Prince of Persia PS2, plus Grimvalor-style mobile readability.
- The game should still feel like an action game even if the educational layer were hidden.

## Core multiplication combat grammar

Every skeleton has **two operands**:

1. a **level/type number**: 1, 2, or 3
2. a second visible **marker number**: 1, 2, or 3

The enemy's health is:

`HP = level × marker`

Example:

A Level 2 skeleton with a visible 3 represents:

`2 × 3 = 6`

It therefore has **6 HP**.

### Weapon rules

**×1 gun**
- available from the start
- unlimited ammunition
- exactly **1 damage**
- universal fallback: it can damage every skeleton

**×2 gun**
- exactly **2 damage per successful hit**
- limited ammunition
- only damages an enemy when **2 is one of that enemy's two operands**

**×3 gun**
- exactly **3 damage per successful hit**
- limited ammunition
- only damages an enemy when **3 is one of that enemy's two operands**

A nonmatching special-number weapon deals **0 damage** and is visibly **REFLECTED**.

Do not allow “any factor of HP” to work. Only ×1 or one of the enemy's two displayed operands is valid.

### Canonical example

Level 2 + marker 3 skeleton:

- HP = 6
- ×1: 1 damage × 6 hits = defeated
- ×2: 2 damage × 3 hits = defeated
- ×3: 3 damage × 2 hits = defeated

This is the heart of POC VIII.

The player should experience `2 × 3 = 6` through combat rather than having the game explain it in a paragraph.

### Other examples

**2 × 2 = 4**
- ×1 works
- ×2 works
- ×3 reflects

**1 × 3 = 3**
- ×1 works
- ×3 works
- ×2 reflects

**3 × 3 = 9**
- ×1 works
- ×3 works
- ×2 reflects

Keep weapon damage mathematically stable forever. Do not make upgrades cause ×2 to deal 4, critical hits to change the represented number, etc. Upgrade presentation/fire rate/ammo capacity later if needed, but **×2 always means 2 damage and ×3 always means 3 damage**.

---

# Power acquisition and ammo

The player starts with ×1.

The level should introduce ×2 first, then ×3.

Once a power weapon is unlocked, the player **keeps ownership of that weapon for the rest of the run**. Running out of ammo does not remove it; the weapon simply cannot fire until replenished.

Use **Power Boost Orbs** for ammunition:

- ×2 Power Boost Orb → ×2-family challenge → refills ×2 ammunition
- ×3 Power Boost Orb → ×3-family challenge → refills ×3 ammunition

These are intentionally the place where conventional retrieval-practice questions may still exist because the player is deliberately seeking a resource.

### Orb failure behavior

If the player answers incorrectly:

- do not reveal the correct answer
- do not take a life
- do not trap the player in repeated questions
- immediately return to gameplay
- orb becomes dormant
- orb respawns after about **20 seconds of active gameplay**
- no countdown
- next attempt asks a different question from the same multiplication family

Carry this behavior forward from POC VII.

---

# Suggested Graveyard encounter progression

Keep the route compact enough for repeated child playtests.

1. **Opening — ×1 only**
   - basic 1-family encounters
   - establish that the base gun is reliable but slower

2. **Earn ×2**
   - introduce 1×2 and 2×2 skeletons
   - then introduce 2×3 so the player sees the value of weapon choice

3. **Earn ×3**
   - introduce 1×3
   - revisit 2×3
   - add 3×2 and 3×3

4. **Late mixed encounters**
   - make the player choose between preserving ×2/×3 ammo and using slower ×1 fire

5. **Exit / boss approach**
   - finish with a readable combat exam, not an environmental math puzzle

The number pair should be readable during action. Use the existing enemy sprite plus overlays/physical details as practical; the player should not have to open a menu or read a paragraph.

---

# Boss direction

Do **not** throw away the existing Core Clash boss.

POC VIII should first prove the Graveyard enemy/weapon grammar. Keep the current Core Clash guardian as the boss control/endcap while the level system is tested.

The final boss mechanic is still an open product decision. Prior ideas under consideration include:

- Castlevania-like: keep all powers; questions create a temporary damage opportunity
- Metroid-like: boss state must be matched to the correct numbered weapon
- Mega Man-like: hit a numbered weak point the required number of times to earn/trigger a challenge, then receive five empowered rounds

Do not silently choose or redesign the boss system yet. Preserve Core Clash until a dedicated boss experiment is requested.

---

# UX rules

- Mobile browser is primary.
- Keyboard remains supported.
- Large touch controls.
- Normal action should not constantly stop for questions.
- Wrong weapon feedback should be immediate: reflection/ricochet/flash + a brief cue such as `REFLECTED`.
- Do not explain multiplication after every kill.
- Let the hit count and enemy defeat communicate the relationship.
- Keep explicit educational copy minimal.
- No punishment spiral for wrong answers.
- No permanent lockout from a failed challenge.
- Do not infer “mastery” from beating the level.

---

# Scope guardrails for this POC

Do not add:

- ×4 or higher numbers
- additional subjects
- adaptive-learning/mastery algorithms
- skill trees
- inventories
- procedural levels
- environmental multiplication puzzles
- arrays/grouping minigames
- new enemy species beyond skeletons
- a redesigned Coach system
- backend learner-state architecture
- new boss pedagogy unless explicitly requested

The experiment is specifically:

**Does a 1/2/3 multiplication combat grammar make practicing multiplication feel like playing an action game rather than stopping to do schoolwork?**

---

# Acceptance criteria

Before handing POC VIII back for playtesting, verify:

1. ×1 is available immediately, unlimited, and always deals exactly 1.
2. ×2 deals exactly 2 and has limited ammo.
3. ×3 deals exactly 3 and has limited ammo.
4. Every skeleton has two visible operands in the 1–3 range.
5. Enemy max HP is exactly the product of those operands.
6. ×1 always works.
7. ×2/×3 only work when their number matches one of the enemy operands.
8. Nonmatching special shots visibly reflect and deal 0.
9. A 2×3 skeleton takes exactly 6 ×1 hits, 3 ×2 hits, or 2 ×3 hits.
10. ×2 and ×3 stay unlocked after acquisition.
11. ×2/×3 Power Boost Orbs replenish their own ammo.
12. Wrong orb answers reveal no answer and apply no life penalty.
13. Failed orbs return after ~20 seconds of active, unpaused play.
14. The retry question differs while staying in the same number family.
15. Touch and keyboard controls both work.
16. POC VII and standalone Core Clash remain untouched and playable as controls.
17. The new experiment is separately runnable and documented.

## Product principle to preserve

**If the player can demonstrate the answer through gameplay, do not ask the question.**

Questions are allowed where they serve a gameplay need (for example, voluntarily refilling scarce ×2/×3 ammo), but the multiplication itself should primarily live in combat.
