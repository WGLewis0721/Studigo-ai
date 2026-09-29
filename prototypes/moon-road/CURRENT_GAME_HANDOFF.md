# Studigo Game — Current Golden-State Handoff

> **Purpose:** give a new Gen-AI coding tool enough context to pick up exactly where Astra left off without redesigning the game, regenerating the art, changing the control feel, or accidentally replacing the proven POC VII + Core Clash behavior.
>
> **Repository:** `WGLewis0721/Studigo-ai`
>
> **Golden implementation commit:** the connected Moon Road/Core Clash work was merged in PR #45; the merge commit that introduced the prototype is `eeb845d3b2b59c27a48d969cd26c41d4032f21ab`. Later documentation may exist on top of it.
>
> **Live visual/behavior reference:** https://studigo-core-clash.william-glewis17.chatgpt.site
>
> **Design-conversation reference:** https://chatgpt.com/share/6abb2316-a428-83ea-8af5-67a9e9293072
>
> The external URLs may be login-gated or unavailable to an automated coding environment. **Do not depend on them. The repository files below are the source of truth.**

---

## 0. The one sentence to remember

**Studigo should feel like a real side-scrolling action-adventure first; the learning system is embedded in powers, resistance, resource loops, encounters, and boss opportunities instead of constantly stopping the player to do schoolwork.**

Do not turn this back into “run → popup quiz → answer → resume” as the default level loop.

---

# 1. Read these files first

Before editing any game code, read these in order:

1. `AGENTS.md`
2. `docs/AI_HANDOFF.md`
3. `prototypes/moon-road/README.md`
4. `prototypes/moon-road/ASSETS.md`
5. `prototypes/moon-road/dist/adventure/index.html`
6. `prototypes/moon-road/dist/adventure/level.css`
7. `prototypes/moon-road/dist/adventure/level.js`
8. `prototypes/moon-road/dist/index.html`
9. `prototypes/moon-road/dist/game.css`
10. `prototypes/moon-road/dist/game.js`
11. `prototypes/moon-road/qa/LEVEL-REVIEW.md`
12. `prototypes/moon-road/qa/level-playtest.cjs`
13. `prototypes/moon-road/qa/level-results.json`
14. `prototypes/moon-road/HANDOFF_INSTRUCTIONS.md` for the *next* experimental direction after the golden state is understood.

Do not start by creating a replacement engine or a fresh visual system. Inspect what exists.

---

# 2. Golden controls: two builds that must remain playable

There are two related but intentionally separate control builds.

## A. Standalone Core Clash boss — the boss/game-feel control

Files:

- `prototypes/moon-road/dist/index.html`
- `prototypes/moon-road/dist/game.css`
- `prototypes/moon-road/dist/game.js`

This is the strongest standalone boss presentation.

It establishes:

- the dragon player sprite and animation language
- the Prism Guardian boss sprite and animation language
- the moonlit observatory presentation
- the HUD visual language
- particle feedback
- hit-stop/camera shake
- powered-shot feedback
- mobile touch layout
- pause/sound behavior
- the 50 HP boss
- the shield → core opportunity → power-ammo loop
- the “Core Clash” identity

**Do not casually overwrite this build.**

## B. POC VII / Moon Road connected adventure — the level/gameplay control

Files:

- `prototypes/moon-road/dist/adventure/index.html`
- `prototypes/moon-road/dist/adventure/level.css`
- `prototypes/moon-road/dist/adventure/level.js`

This is the current connected action-platformer.

It establishes:

- one continuous scrolling route
- movement/platforming
- ordinary enemy packs
- five hearts
- health pickups
- checkpoints
- voluntary knowledge/power mechanisms
- 20-second active-play respawns after failed mechanisms
- permanent weapon unlocks
- ×3 / ×4 multi-shot weapons
- progression gates
- a Watcher miniboss
- the Core Clash guardian as the final chamber
- keyboard + simultaneous touch input
- no mandatory quiz popup during the adventure

**Preserve this build as a playtest control even when creating the next experiment.**

---

# 3. How to reconstruct and run the exact prototype

The large runtime and exact game assets are intentionally stored as encoded chunks so the prototype can be reconstructed without downloading third-party runtime files.

From:

`prototypes/moon-road/`

run:

```bash
node prepare.mjs
```

`prepare.mjs` concatenates the files in:

`prototypes/moon-road/runtime/part-00.txt` through `part-16.txt`

then gunzips/decodes them into `dist/`.

It reconstructs the exact local runtime/art dependencies used by the prototype.

Then serve the directory locally, for example:

```bash
python -m http.server 8000 --directory dist
```

Open:

- **Standalone boss:** http://localhost:8000/
- **POC VII adventure:** http://localhost:8000/adventure/

Do not replace the local Phaser runtime with a CDN dependency just because it is easier.

---

# 4. Engine and rendering contract

## Engine

- Phaser **3.90.0**
- bundled locally at `dist/vendor/phaser-3.90.0.min.js`
- MIT license stored with the runtime
- no runtime CDN dependency

## Internal canvas

The authored presentation is designed around a fixed:

**960 × 540**

game stage.

The stage is scaled to the available browser area.

This is intentional.

Do not rebuild the layout around arbitrary responsive DOM boxes and lose the authored framing.

## Pixel-art presentation

CSS explicitly uses:

`image-rendering: pixelated`

The art should remain crisp.

Do not add smoothing/upscaling that blurs the sprites.

## Mobile-first constraints

The game scales into the browser viewport and respects safe-area insets.

The controls are designed for landscape phone play.

Portrait displays a rotate-device hint in the standalone boss.

Touch input must continue supporting **simultaneous actions** such as movement + firing. Do not reduce touch input to one pointer at a time.

---

# 5. Existing asset bible — do not regenerate these

The current artwork is original generated Studigo prototype art. The asset record is in `ASSETS.md`.

## Art direction

The established art direction is:

**16-bit-inspired pixel-art moonlit ruined observatory**

Primary environmental feel:

- deep navy
- indigo
- slate blue
- cool moonlight
- subdued stone/brass
- sparse mint/jade energy highlights
- warm gold/cream for important power feedback

The mood is mysterious/adventurous, not horror-gore and not neon cyberpunk.

## Player character

The player is the existing **jade dragon**.

Established design:

- jade-green dragon
- gold horns
- cream belly
- purple scarf
- compact blaster
- readable silhouette at phone scale
- not realistic
- not chibi UI clip art
- not a newly redesigned mascot

**Reuse the exact existing sprite sheet.**

Do not make a “similar dragon.”
Do not create a replacement character.
Do not redraw it in another style.

## Guardian / boss

The boss is the existing **Prism Guardian**.

Established design:

- large floating/slate-brass construct
- substantial silhouette
- dark socket / live energy-core area
- reads as ancient technology / vault guardian
- much larger than player
- same generated guardian sheet is also reused by the connected prototype for smaller hostile silhouettes

**Reuse the exact existing guardian sprite sheet.**

## Environment

The existing observatory art is the visual anchor:

- layered arches / ruins
- moonlit mountainous depth
- clear side-scrolling fighting plane
- stone platforms
- dark foreground floor
- atmospheric particle motes

Do not swap it for a generic platformer background.

---

# 6. Exact runtime asset names used by the game

The current JavaScript loads the following from `dist/assets/`:

- `observatory.png`
- `platform.png`
- `core.png`
- `spark.png`
- `dragon.png`
- `guardian.png`
- `frames.json`

The standalone boss uses:

```js
this.load.image('observatory','assets/observatory.png')
this.load.image('platform','assets/platform.png')
this.load.image('spark','assets/spark.png')
this.load.image('core','assets/core.png')
this.load.spritesheet('dragon','assets/dragon.png',{frameWidth:128,frameHeight:128})
this.load.spritesheet('guardian','assets/guardian.png',{frameWidth:256,frameHeight:256})
this.load.json('frames','assets/frames.json')
```

The adventure uses the same art through paths relative to `/adventure/`.

**Keep these asset keys and frame geometry stable unless there is an explicit migration plan.**

---

# 7. Sprite frame semantics

## Dragon

The current implementation treats the dragon as a 128 × 128 spritesheet.

The authored sheet is a 6 × 2 action sheet.

The current runtime uses frames approximately as follows:

- frames 0–5: run-cycle frames
- frame 6: idle
- frame 7: rising jump
- frame 8: falling
- frame 9: fire
- frame 10: landing
- frame 11: victory / end-state

The runtime intentionally chooses these frames according to motion state.

Do not reorder or recrop the sheet without updating the animation contract.

## Guardian

The guardian is a 256 × 256 spritesheet.

The source design is an 8-pose sheet:

- idle
- anticipation
- punch/attack
- recovery
- phase awakening
- hit
- collapse
- shatter

The runtime uses those poses as a state-driven animation rather than a generic looping GIF.

`frames.json` contains guardian core-position metadata used to keep the live core aligned with the moving guardian frames.

**This is important:** if you alter guardian scale/crop/frame alignment, the core will visibly detach from the boss unless the metadata is also updated.

---

# 8. Visual language

## Typography

The prototype deliberately uses device monospace typography.

The visual language resembles an old game terminal / field instrument rather than a modern SaaS dashboard.

Keep:

- uppercase game labels
- compact tracking
- short calls to action
- small supporting labels
- strong, readable boss names
- minimal prose during action

Do not introduce:

- giant web-app cards
- gradient SaaS marketing UI
- rounded pill overload
- essay-length tutorial dialogs

## Color roles

Approximate established roles:

- background: `#050914`, `#0b1730`, deep navy/indigo
- standard projectile/core: cool silver-blue
- Studigo mint / success / key energy: around `#b7edc4`
- powered ammo / impact: warm gold around `#ffe6a3`
- health/hearts: warm salmon
- UI borders: blue-gray slate
- foreground text: warm cream

The exact CSS is authoritative.

## HUD

The standalone boss HUD establishes the visual bar:

- Studigo/Core Clash brand at upper left
- centered boss health/status
- sound + pause upper right
- touch controls anchored low
- ammo represented as physical loaded segments
- very little persistent explanatory text

The adventure simplifies this for the longer level but preserves the same overall vocabulary.

---

# 9. Game feel — do not flatten this into bare mechanics

Astra's result is not just a rules prototype. It has feel.

Preserve these feedback layers:

- synthesized Web Audio cues
- firing muzzle effects
- impact particles
- hit flash
- small floating damage numbers
- ring effects
- short hit-stop on meaningful impacts
- camera shake on strong hits
- boss anticipation pose before attacks
- guardian hit pose
- landing particles
- movement dust
- atmospheric pixel motes
- subtle idle motion
- visible core glow
- clear visual distinction between blocked and empowered hits

The player should know what happened without reading a paragraph.

---

# 10. POC VII — exact level structure

The connected level is a long horizontal route.

Current world constants in `level.js`:

- world width: **7600**
- floor Y: **421**
- internal screen: **960 × 540**

The current major zone labels are placed approximately at:

- x 280 — **THE MOON ROAD**
- x 1510 — **WHISPER GROVE**
- x 3400 — **FOUR WINDS**
- x 5160 — **THE WATCHER**
- x 6880 — **CORE CLASH**

The camera follows the player across the route, then shifts to a fixed/framed final-boss chamber near the end.

---

# 11. POC VII movement feel

Adventure movement values in the current implementation:

- horizontal speed: about **285 px/s**
- gravity: about **1150**
- jump velocity: about **−470**
- regular fire cooldown: about **0.32 s**

The player:

- can move left/right
- can jump
- can fire
- can change numbered weapon
- can enable autoshoot
- can pull/use a mechanism
- can pause

Movement is intentionally simple and readable, closer to a mobile action-platformer than a precision platformer.

Do not turn the next pass into a physics-heavy platforming simulation.

---

# 12. Adventure controls

## Keyboard

Current POC VII controls:

- Left / A = move left
- Right / D = move right
- Up / W / Space = jump
- F = fire
- E = use / pull lever
- 1 = base weapon
- 3 = ×3 weapon
- 4 = ×4 weapon
- Q = toggle autoshoot
- Escape = pause

## Touch

The screen provides:

- left
- right
- jump
- fire
- use/pull
- weapon buttons
- autoshoot
- pause

Touch must allow multi-touch.

The existing browser QA specifically tested simultaneous movement + firing.

---

# 13. Player survivability in the adventure

The connected adventure uses:

- **5 hearts**
- hit invulnerability after damage
- checkpoints
- health recovery pickups

On losing all hearts:

- health is restored
- the player returns to the current checkpoint
- temporary hazards are cleared
- an active failed learning mechanism is failed/reset appropriately

The design should feel forgiving enough for a child playtest.

Failure is supposed to create another attempt, not end the session.

---

# 14. Ordinary enemy behavior

The current POC VII adventure uses small guardian-silhouette enemies.

This is deliberate reuse of the existing Guardian art, not a separate art pack.

Enemy packs are associated with the current weapon-learning progression.

The level currently contains packs keyed to 3 or 4.

The base weapon can handle ordinary play.

The earned ×3 / ×4 bursts provide the stronger/more appropriate combat response as progression advances.

The key design philosophy is:

**new knowledge should become a useful verb/tool, not merely a score bonus.**

---

# 15. POC VII knowledge-drop / power-unlock loop

This is one of the most important systems to preserve.

Two major drops are currently placed around:

- x ≈ **1520** → ×3
- x ≈ **3440** → ×4

The system is *voluntary and physical*, not a modal quiz.

## Opening a drop

A drop can be engaged through gameplay proximity/shooting.

When engaged, it creates a physical grouping mechanism.

The prototype tells the player, briefly:

**“One burst fills one group. Pull the lever when full.”**

The player fires into the mechanism to load groups.

## Success

If the loaded group count is exactly correct when the player commits/pulls the lever:

- the numbered weapon permanently unlocks
- the unlocked weapon becomes selected
- health is restored
- the checkpoint advances
- strong particle/audio feedback plays

## Failure

Failure occurs when the player:

- commits too early
- overfills
- abandons the mechanism by moving too far away

On failure:

- no permanent lockout
- no life penalty
- the opportunity disappears
- gameplay resumes
- the drop enters cooldown
- cooldown uses **active, unpaused simulation time**
- after about **20 seconds**, it returns
- no visible countdown
- the next attempt changes the representation

The retry alternates between arrangements such as:

- array-like layouts
- ring layouts

This exists to prevent the player from memorizing a screen shape rather than engaging the relationship.

## Exact validation from Astra's QA

Recorded respawns:

- **20.03 seconds**
- **20.01 seconds**

This was intentionally measured against active simulation time.

Pause does not advance the cooldown.

---

# 16. Progression gates

The POC VII route includes progression seals.

Current hard progression logic approximately blocks:

- progress near x ≈ 2600 until ×3 is unlocked
- progress near x ≈ 4780 until ×4 is unlocked
- progress past the Watcher until it is defeated

This is the Metroid/Castlevania influence:

the player can physically reach a place where the current kit is insufficient, learn/acquire the needed capability, then continue.

Do not replace this with a menu saying “complete lesson to unlock chapter.”

---

# 17. Watcher miniboss

The current miniboss appears around:

x ≈ **5280**

Current values:

- HP: **6**
- active weakness: either 3 or 4
- visible nodes indicate the required number
- wrong weapon is resisted
- correct numbered weapon deals the progress hit
- after a successful hit the active required number changes between 3 and 4

This encounter exists as a combined test of the two acquired verbs before Core Clash.

Do not turn the Watcher into a conventional quiz screen.

---

# 18. Core Clash — connected POC VII boss behavior

The connected adventure ends in the existing Prism Guardian chamber.

Boss location is around:

x ≈ **7210**

Boss HP:

**50**

Entering the final chamber:

- sets a boss checkpoint
- restores health
- reveals the boss UI
- frames the fight
- keeps the same Guardian art identity

## Boss shield

Normal/non-powered attacks do not simply chew through the 50 HP bar.

The boss is protected.

The player must create a power opportunity.

## Orb chance

Non-powered interaction with the boss increases the chance of a boss orb/power opportunity.

In the current implementation the chance grows in increments until it becomes guaranteed.

## Connected-adventure orb

The adventure version intentionally removed the standalone modal quiz.

Instead, when the orb appears it contains a physical grouped energy pattern.

The orb is associated with ×3 or ×4.

The player must:

- select the matching earned weapon
- fill the grouped orbiting cells
- complete the physical pattern

Successful completion loads:

**5 POWERED SHOTS**

Each powered boss hit deals:

**2 damage**

The existing QA run completed the boss with:

- 25 powered hits
- 2 damage each
- 50 total HP

This preserves the core boss rhythm while avoiding a forced worksheet interruption in POC VII.

---

# 19. Standalone Core Clash boss — preserve this exact control too

The root `dist/index.html` boss is a different experimental control from the connected adventure.

It should remain available for comparison.

## Core loop

The standalone fight begins with:

**HIT THE SHIELD · EARN AN ORB**

The Guardian has:

**50 HP**

Normal shots:

- hit the shield/core
- deal **0 boss damage**
- give clear blocked feedback
- increase orb chance by **10 percentage points**
- eventually cause a core opportunity to appear
- probability is random before 100%, but 100% guarantees the spawn

When the core appears, the player can activate it by:

- moving into it
- or shooting it

## Standalone challenge

The core opens the current conventional multiplication challenge.

It randomly chooses a:

- ×3 fact
- or ×4 fact

with a value in the current configured range.

Correct answer:

- loads **5 powered shots**
- plays strong power feedback
- returns immediately to play

Wrong answer:

- does not deal a life penalty
- closes the challenge
- returns to combat

Powered shot:

- deals **2 boss damage**

Normal shot:

- deals **0 boss damage**

This is the older boss/control expression of the same scarce-power principle.

## Boss attack rhythm

The Guardian has a visible attack cycle of roughly:

**3.9 seconds**

The sprite moves through anticipation → punch/attack → recovery.

A ground hazard travels toward the player.

The standalone prototype is intentionally forgiving; its primary purpose is to test the shield/core/power loop and presentation rather than create a punishing life-loss boss.

---

# 20. Standalone Core Clash controls

Keyboard behavior in the current boss build:

- Arrow Left / A = move left
- Arrow Right / D = move right
- Up / W = jump
- Space = hold to fire
- F = toggle autoshoot
- Escape = pause

Touch:

- left/right
- jump
- hold fire
- autoshoot toggle
- pause
- sound toggle

The boss build also pauses/clears input on focus loss / visibility changes.

Keep this robustness.

---

# 21. Standalone boss movement constants

Current standalone Core Clash values include approximately:

- ground Y: **420**
- player speed: **218**
- gravity: **1060**
- jump velocity: **−415**
- projectile speed: **760**
- shot cooldown: about **0.26 s**
- two small platforms at approximately:
  - x 255 / y 351 / width 112
  - x 440 / y 297 / width 90

These numbers contribute to the current feel.

Do not arbitrarily “improve” them before playtesting a meaningful reason.

---

# 22. Input discipline

The current prototypes deliberately defend against messy real input.

Preserve:

- simultaneous touch
- key-hold behavior
- pointer capture
- releasing held state on pointer cancel
- clearing input on blur
- pausing on hidden tab
- no accidental page scrolling
- no context menu interference
- safe-area awareness
- landscape framing

Fast taps were specifically found to fall between frames/cooldowns during QA.

Astra fixed this with input buffering so tap fire survives until the next legal shot.

Do not remove that behavior during refactors.

---

# 23. Camera and framing

The camera language is part of the game feel.

## Adventure

- smooth horizontal follow
- level remains readable at phone scale
- final chamber changes framing so the Guardian is not clipped

## Boss

- player remains on left
- boss dominates the right
- boss core remains readable
- HUD remains above the fight
- effects cannot obscure the critical hit area for long

A previous QA pass specifically found the Guardian could be cropped on a phone viewport; Astra fixed the final chamber framing.

Do not regress this.

---

# 24. Audio

No external audio files are required.

Current sound effects are synthesized through Web Audio oscillators.

Different actions use different frequency/envelope signatures:

- normal shot
- powered shot
- hit
- block
- jump
- land
- boss phase/attack
- core spawn
- wrong answer
- shield reaction
- charge
- victory

This keeps the prototype self-contained.

If audio is changed later, preserve the same information hierarchy: each important action must sound different.

---

# 25. Current learning philosophy encoded in the game

The prototype embodies these principles:

### Learning should create capability

The strongest reward is a new useful game verb.

### Failure should not permanently punish learning attempts

A failed knowledge drop disappears temporarily and comes back.

### Retry should not be instant rote repetition

A returning drop changes representation.

### Active play, not staring, advances retry time

Cooldown counts unpaused simulation time.

### The player should feel the need for the power

Progression gates and tougher encounters make the learned weapon matter.

### Bosses are application tests

The boss asks the player to use the powers earned on the route.

### Avoid constant interruption

POC VII intentionally removed the mandatory boss quiz and replaced it with physical grouped-energy interaction.

### Do not infer mastery from victory

The prototype is a gameplay/learning-loop test, not a validated learner model.

---

# 26. What “same look and feel” means in practice

A replacement implementation is **not equivalent** merely because it has:

- a dragon
- a boss
- multiplication
- a dark background

To count as preserving the golden state, it should retain:

- exact current sprite sheets
- exact asset geometry/frame sizes
- existing observatory/platform art
- same 960×540 authored stage
- pixelated rendering
- same palette roles
- same monospace game UI character
- large phone-readable touch controls
- simultaneous touch
- short, responsive movement
- immediate firing response
- feedback particles
- hit-stop and shake
- physical ammo indicators
- visible boss core
- current Guardian animation states
- current dragon animation states
- pause/focus handling
- current progression structure
- current 20-second active-play respawn principle
- current forgiving checkpoint philosophy

Do not “modernize” away the personality.

---

# 27. What not to do

Do not:

- regenerate the dragon
- regenerate the Guardian
- swap in stock sprites
- change the art to vector/3D
- replace Phaser only to standardize frameworks
- rewrite the prototype as a React DOM game
- blur the pixel art
- change the internal resolution without a concrete reason
- remove multi-touch support
- remove fire buffering
- remove pause/focus protections
- turn Knowledge Drops into forced modal quizzes
- make a wrong answer permanently remove a power
- add a visible 20-second countdown
- infer learner mastery from completion
- merge experimental game state into production auth/database code without an explicit architecture decision
- delete the standalone boss control
- delete the POC VII adventure control

---

# 28. Current QA hooks

The level deliberately exposes read-only debugging/playtest hooks:

`window.gameState()`

and:

`window.levelEvents()`

The standalone boss exposes:

`window.gameState()`

and:

`window.coreClashEvents()`

These are useful for automated browser acceptance without directly mutating state.

Do not replace them with test-only teleport/state-cheat APIs.

The existing QA philosophy is:

**play the real game with real keyboard/touch input; inspect state only for assertions.**

---

# 29. Existing browser validation

Astra's connected-level QA used:

- Chromium
- 844 × 390 viewport
- mobile/touch mode
- real keyboard input
- Chrome DevTools Protocol simultaneous multitouch
- no state injection
- no teleporting

The script intentionally:

- moved/fired simultaneously
- failed the ×3 drop
- verified pause froze active cooldown time
- waited for the drop to return
- completed the retry
- unlocked ×3
- failed and retried ×4
- unlocked ×4
- defeated the Watcher
- entered Core Clash
- defeated the 50 HP boss
- recorded state/events/screenshots

Recorded result:

```json
{
  "victory": true,
  "unlocks": [3, 4],
  "respawn_intervals": [20.03, 20.01],
  "checkpoint_recoveries": 2,
  "boss_hits": 25,
  "damage_per_hit": [2],
  "input": "real keyboard and CDP simultaneous touch",
  "viewport": "844x390",
  "browser": "Chromium; physical iPhone Safari not tested"
}
```

Use this as a regression target.

---

# 30. Known limitations — do not misrepresent them

Current prototype limitations:

- physical iPhone Safari still requires a real-device playtest
- long-term retention is not measured
- multiplication recall is not proven solely by the POC VII physical grouping mechanic
- no production learner model
- no persistent save system for the prototype
- no backend progression persistence
- no validated adaptive difficulty
- gameplay is a prototype, not a final shipped curriculum
- small ordinary enemies reuse Guardian art rather than having a finished enemy art family

Say these plainly rather than pretending they are complete.

---

# 31. How the current game should feel to the player

A child should experience something closer to:

**move → jump → shoot → see a strange mechanism → experiment → earn a stronger weapon → use it immediately → reach something that was previously blocked → survive a miniboss → enter a visually bigger final chamber → fight a boss using the tools earned during the route**

not:

**read → answer → next question → answer → reward animation**

The educational objective should be structurally necessary to the game, but the moment-to-moment activity should still feel like an action adventure.

---

# 32. Design ancestry / reference vocabulary

The current direction is informed by the structure and feel of:

- Castlevania
- Mega Man
- Metroid GBA
- Metroid Prime
- Kirby GBA
- Prince of Persia PS2
- Grimvalor

These are **design references, not cloning targets**.

What they contribute conceptually:

- Castlevania → progression, exploration, resistances, permanent capabilities
- Mega Man → readable weapon identity and boss interactions
- Metroid → capability gates and return-with-power progression
- Kirby → readable, enjoyable powers
- Prince of Persia → traversal as actual gameplay
- Metroid Prime → environmental readability and vulnerability signaling
- Grimvalor → mobile action-game responsiveness/readability

Preserve the spirit without copying their assets/layouts.

---

# 33. If you are extending from this golden state

Create a **new sibling experiment**.

Do not mutate the golden controls first.

Recommended pattern:

```
prototypes/moon-road/
  dist/
    index.html            # standalone Core Clash golden
    game.js
    game.css
    adventure/
      index.html          # POC VII golden
      level.js
      level.css
    <new-experiment>/     # new work here
```

A new experiment should be comparable side-by-side against:

1. standalone Core Clash
2. POC VII Moon Road

This is how product decisions should be made.

---

# 34. Next experiment direction

The next currently discussed experiment is documented separately in:

`prototypes/moon-road/HANDOFF_INSTRUCTIONS.md`

That document describes the Graveyard 1·2·3 multiplication-combat direction.

**Important:** do not read that as permission to replace the existing art/game feel.

The new mechanic should inherit:

- the same dragon
- the same current animation assets unless a deliberately new original asset is approved
- the same responsive control quality
- the same pixel-art treatment
- the same feedback language
- the same mobile input discipline
- the same boss presentation quality
- the same philosophy of preserving golden controls

POC VIII is a mechanics experiment built **on top of this identity**, not a reboot.

---

# 35. Minimum regression checklist before handing new work back

A new Gen-AI tool should not claim a successful continuation until it checks all of the following.

## Asset integrity

- exact existing dragon sheet is used
- exact existing Guardian sheet is used
- existing observatory/platform art still loads
- no blurry sprite filtering
- no broken guardian-core alignment

## Adventure regression

- route starts and runs
- left/right movement works
- jump works
- firing works
- simultaneous touch works
- five hearts display
- checkpoints recover correctly
- ×3 drop can fail
- active-play cooldown is ~20 s
- pause freezes cooldown
- retry representation changes
- ×3 unlock persists
- ×4 drop can fail/retry
- ×4 unlock persists
- progression gates work
- Watcher requires correct numbered weapon
- boss chamber frames correctly
- final boss can be defeated
- victory screen appears

## Boss regression

- 50 HP
- normal shielded hit gives 0 boss damage
- blocked hit feedback visible
- orb chance increases
- core appears
- core can be activated
- power opportunity resolves
- five powered shots load
- powered shot deals 2
- ammo visibly decrements
- boss animation telegraphs attack
- ground hazard works
- defeat animation completes
- victory screen appears

## UX

- phone viewport readable
- controls do not scroll page
- touch targets usable
- focus loss does not leave stuck movement/fire
- pause works
- no game-breaking browser console errors
- no mandatory new account/login/backend requirement for prototype play

---

# 36. Final instruction to the next Gen-AI tool

**Do not begin by proposing a redesign. Begin by running the existing game.**

Reconstruct `dist/` with `node prepare.mjs`, play both the standalone boss and the POC VII adventure, inspect the exact assets and current QA, and make your first change as a small additive experiment.

The work Astra already completed is the baseline.

Preserve it.

Then extend it.
