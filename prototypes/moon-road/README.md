# Moon Road → Core Clash (experimental playtest)

One continuous Phaser level ending in the existing Core Clash guardian encounter. The original standalone Core Clash remains at `dist/index.html`; the connected experiment is `dist/adventure/index.html`.

Run `node prepare.mjs`, then serve `dist` with any static server (for example `python -m http.server 8000 --directory dist`) and open `/adventure/`. Runtime chunks contain the exact original generated PNG assets and MIT-licensed Phaser 3.90.0; preparation decodes them locally without downloads, secrets, or packages. See ASSETS.md.

Controls: arrows/A/D move; Space/up jump; F fire; E pull lever; 1/3/4 select; Q autoshoot; Escape pause. Touch controls support simultaneous move/fire/jump.

Knowledge cores open by contact or shooting. Tap fire to load groups with the prototype; pull the lever at the right amount. A short/overfilled attempt disappears for 20 seconds of unpaused gameplay, then returns with another group count and spatial layout. Earned abilities persist through checkpoint recovery. Five hearts; forgiving checkpoints; heal pickups. Basic shots work against ordinary enemies. Triple and four-shot weapons target separate enemies; the watcher exposes three or four nodes. The final Core Clash shield resists normal shots, which build a drop chance by 10 points per volley until guaranteed. Fill its grouped energy cells with the corresponding earned weapon to load five stronger volleys, each dealing 2 boss damage. No quiz popup in the adventure.

Experimental limits: this tests recognition of equal groups, not proven multiplication recall; no backend learner model or save system; desktop Chromium mobile emulation is not physical iPhone Safari certification. Retry representations alternate arrays and ring layouts; difficulty and voluntary revisits need a child playtest. Main boss retains the Core Clash art/combat identity while replacing its mandatory quiz with physical cell charging.

No production auth, RLS, database, or application routes changed. Do not infer learning mastery from victory alone.
