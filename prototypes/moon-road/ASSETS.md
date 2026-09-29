# Studigo Core Clash: art and dependencies

## Original generated artwork

The observatory, dragon animation sheet, and guardian pose sheet were created for this prototype with OpenAI's built-in image generation tool on 2026-09-28. They are original generated outputs, not assets copied from an existing game. No third-party art-pack license is claimed. Use is subject to the applicable OpenAI terms; this record is not a copyright or exclusivity guarantee.

Source sheets: `art-source/observatory.png`, `art-source/dragon.png`, `art-source/guardian.png`.
Game assets: `dist/assets/`. Normalization: `scripts/normalize-art.py`. Candidate generation: `ART_GENERATION.md`, `scripts/art-prompts.json`, and `scripts/generate-art.mjs`.

Art direction: 16-bit pixel-art moonlit ruined observatory; dark navy/indigo environment; jade dragon with gold horns, cream belly, purple scarf and compact blaster; substantial slate/brass floating guardian with a dark socket for its live energy core.

Prompts: environment with layered arches/mountains, moon above, clear fighting area and stone floor at roughly 80% height, no UI or characters. Dragon 6x2 action sheet: run cycle then idle, rising jump, fall, fire, landing, victory; transparent, equal scale and foot anchors. Guardian 4x2 pose sheet: idle, anticipation, punch, recovery, phase awakening, hit, collapse, shatter; transparent, consistent scale, empty core socket. Generated sheet bounds were individually cropped and aligned, using a shared scale per character. One clipped run pose is replaced by a mirrored-in-time cycle pose, preserving character scale. Effect textures are original code-native geometric shapes.

## Software

Phaser 3.90.0, MIT, https://phaser.io/ — bundled locally as `dist/vendor/phaser-3.90.0.min.js`. Full license at `dist/vendor/PHASER-LICENSE.md`. No runtime CDN dependency.

Web Audio effects are synthesized locally. Fonts are device monospace fonts; no external font license or request.

## POC VIII skeleton reference

The Graveyard skeleton body is reused from William's supplied Higgsfield prototype, `https://studigo-graveyard-123.higgsfield.app`, via its authorized source checkout (`app/public/client.js`, `drawSkeleton`, inspected 2026-09-29). The existing procedural skull, ribs, limbs and belt are rendered into a local Phaser canvas texture; number overlays and combat effects remain separate. No third-party pack license is claimed. See POC-VIII.md for provenance and preservation boundaries. All shared generated images remain unchanged.

## Reuse and transfer

See `ART_HANDOFF.md` for frame dimensions, animation ordering, generation prompt templates and Claude instructions. Original source PNGs and `scripts/normalize-art.py` are now directly tracked in the GitHub game branch. `downloads/Studigo-Art-Pack.zip` provides the originals, ready assets, frame metadata, script and provenance in one download. Runtime `dist/assets/` remains reconstructible with `node prepare.mjs`.


## Generating new candidate art

Use `ART_GENERATION.md`, `scripts/art-prompts.json`, and `scripts/generate-art.mjs` when new image-generated source art is needed. Generated candidates default to `art-source/generated/` and must be inspected, normalized, and playtested before replacing accepted assets.
