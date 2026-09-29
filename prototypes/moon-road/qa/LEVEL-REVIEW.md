# Connected level visual and interaction review

Core Clash is the final chamber of the level. Its original standalone version remains untouched.

Three weakest details identified and fixed during browser play:
1. Fast taps could fall between render frames or the shot cooldown. Fire intent now buffers until the next available shot; holding remains continuous in combat and one burst per press at an upgrade mechanism.
2. Cell outlines were hard to distinguish against the ruins. Added dark physical trays and brighter borders. The lever uses an SVG icon rather than a platform-dependent emoji.
3. The approaching camera clipped the guardian on the phone viewport. The final chamber now frames the full fight, with a live guardian core and individual loaded-round indicators.

Browser acceptance script uses keyboard and CDP multitouch against the real rendered game. It never teleports the player or writes game state. It intentionally fails both upgrades, pauses during cooldown, backtracks for alternate representations, earns both abilities, fights the watcher and defeats Core Clash. Read-only snapshots support navigation and recorded evidence; screenshots and a combat recording support visual review.

Known scope: full-size player art and generated guardian animation sheets are reused from Core Clash; small enemies reuse the guardian silhouette. This prototype measures neither long-term learning nor recall. Unpaused simulation time counts toward respawns; hidden tabs and pause screens do not. No visible respawn timer. Browser testing is Chromium phone emulation, not real iOS hardware.
