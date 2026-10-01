# Studigo Core Clash: art and dependencies

## Original generated artwork

The observatory, dragon animation sheet, and guardian pose sheet were created for this prototype with OpenAI's built-in image generation tool on 2026-09-28. They are original generated outputs, not assets copied from an existing game. No third-party art-pack license is claimed. Use is subject to the applicable OpenAI terms; this record is not a copyright or exclusivity guarantee.

Source sheets: `art-source/observatory.png`, `art-source/dragon.png`, `art-source/guardian.png`.
Game assets: `dist/assets/`. Normalization: `scripts/normalize-art.py`.

Art direction: 16-bit pixel-art moonlit ruined observatory; dark navy/indigo environment; jade dragon with gold horns, cream belly, purple scarf and compact blaster; substantial slate/brass floating guardian with a dark socket for its live energy core.

Prompts: environment with layered arches/mountains, moon above, clear fighting area and stone floor at roughly 80% height, no UI or characters. Dragon 6x2 action sheet: run cycle then idle, rising jump, fall, fire, landing, victory; transparent, equal scale and foot anchors. Guardian 4x2 pose sheet: idle, anticipation, punch, recovery, phase awakening, hit, collapse, shatter; transparent, consistent scale, empty core socket. Generated sheet bounds were individually cropped and aligned, using a shared scale per character. One clipped run pose is replaced by a mirrored-in-time cycle pose, preserving character scale. Effect textures are original code-native geometric shapes.

## Software

Phaser 3.90.0, MIT, https://phaser.io/ — bundled locally as `dist/vendor/phaser-3.90.0.min.js`. Full license at `dist/vendor/PHASER-LICENSE.md`. No runtime CDN dependency.

Web Audio effects are synthesized locally. Fonts are device monospace fonts; no external font license or request.

## Authoring tools (local only, not shipped)

Pixelorama (MIT), LDtk (MIT), TexturePacker (commercial, CodeAndWeb license accepted per machine), Blender and Godot (MIT/GPL, no output restrictions) are used on the developer machine to author art and levels. Their binaries and installers are not committed (see `.gitignore`); only their outputs (PNG strips, Phaser atlas JSON, `.ldtk` level JSON) are. TexturePacker free/trial output must not ship in a public build without an appropriate license. Phaser 4.2.1 is kept locally for reference only; the game ships Phaser 3.90.0. See TOOLCHAIN.md.

## POC XI hand-built art and audio

Original, not AI-generated, and drawn in code with Pillow (`scripts/make-poc-xi-fx.py`, `make-poc-xi-world.py`, `make-poc-xi-boss.py`, `make-library-props.py`) then packed with TexturePacker:
- beam, muzzle and impact sprites, the Clock Shield, carved number blocks;
- doors, portcullises, seal slabs, rune altars, the portal arch, ammo capsules and drops, shrines;
- boss attack art (bone, arcane shards, gears, shockwave crests, charge orb, rune telegraph, floor cracks, steam, chime rings);
- the Moon Library props.

All of it snaps to one master palette and outline colour sampled from the accepted generated sprites (`scripts/pixel_style.py`); the palette is derived data, not a third-party asset.

Derived from existing generated art, with no new image-model output: the orange dragon sheet (a recolor of the generated dragon, `scripts/recolor-dragon.py`) and the Clockwork Warden and Twin Warden walk cycles (procedural re-poses of their generated standing sprites, `make-warden-walk.py`, `make-twin-walk.py`).

Audio: every sound, including the five distinct beam fire and impact voices, is synthesized at runtime with the Web Audio API (`beamSfx`, `beamHitSfx`, `tone` in `dist/poc-xi/scene.js`). There are no audio files and no music yet.

Tools used to author (local only, not shipped): TexturePacker (commercial license, accepted per machine), LDtk, Pixelorama, Blender and Godot. Their binaries are never committed.

## POC VIII skeleton reference

The Graveyard skeleton body is reused from William's supplied Higgsfield prototype, `https://studigo-graveyard-123.higgsfield.app`, via its authorized source checkout (`app/public/client.js`, `drawSkeleton`, inspected 2026-09-29). The existing procedural skull, ribs, limbs and belt are rendered into a local Phaser canvas texture; number overlays and combat effects remain separate. No third-party pack license is claimed. See POC-VIII.md for provenance and preservation boundaries. All shared generated images remain unchanged.

## Reuse and transfer

See `ART_HANDOFF.md` for frame dimensions, animation ordering, generation prompt templates and Claude instructions. Original source PNGs and `scripts/normalize-art.py` are now directly tracked in the GitHub game branch. `downloads/Studigo-Art-Pack.zip` provides the originals, ready assets, frame metadata, script and provenance in one download. Runtime `dist/assets/` remains reconstructible with `node prepare.mjs`.

## POC X generated art (2026-09-29)

Generated with Higgsfield **Nano Banana** (`nano_banana_2`, 2k) on William's account. Each sheet used the accepted originals as image references so the new art matches them: `dist/assets/dragon.png`, `guardian.png`, `observatory.png` and `platform.png`, and for later sheets the first enemy sheet too. No stock art or third-party pack is used, and no license beyond the generator's terms is claimed. The raw outputs are kept unedited in `art-source/poc-x/*-raw.png`. `art-source/poc-x/process.py` makes the game files in `dist/poc-x/art/`: it keys out the magenta background, slices the cells, aligns feet, downscales to a crisp alpha, and detects the clock-dial centres. The originals in `dist/assets/` and `art-source/` are untouched.

All four sprite sheets share this style clause: "in the exact same pixel-art style, outline weight, shading and palette as the reference sprites (16-bit, crisp dark outlines, soft top-left light)". Each sheet asked for a solid flat #FF00FF background with no text or grid lines.

| Sheet | References | Prompt (abridged) |
|---|---|---|
| `enemies-raw.png` (16:9) | dragon, guardian | 4×2 side-view sheet. Row 1: cute-but-spooky skeleton warrior (bone white, slate belt): walk A, walk B, lunge, hurt. Row 2: bronze clockwork bat with gear wings, wings up and down; large armored skeleton warden with lantern and tattered purple cloak: idle, winding up to throw a bone. |
| `bosses-raw.png` (16:9) | guardian, dragon, enemies | 4×2 facing left. Row 1: Clockwork Warden, a bronze-and-slate clockwork golem with a blank cream clock dial on its chest: idle, wind-up, slam, hurt. Row 2: collapse into gears; Pendulum Sentinel, a floating brass knight with a blank cream chest disc: idle, swing, hurt. |
| `items-raw.png` (16:9) | dragon, core, enemies | 4×2 icons: energy tank, moon boots, ammo capsule, pink-red beam orb, bronze clock shield, gear with teal plus, pink heart gem, white crystal shard. The generator added text labels anyway; `process.py` crops them off. |
| `backgrounds-raw.png` (16:9) | observatory | Four 16:9 side-scroller backdrops in a 2×2 grid, no characters, UI or foreground floor, darker toward the bottom: bone crypt catacombs; star observatory interior; hidden emerald vault; clockwork tower interior. |
| `textures-raw.png` (3:2) | observatory, platform | Six seamless 16-bit wall textures in a 3×2 grid: moonlit blue-grey castle brick; warm crypt brick with bone fragments; indigo star-marble with gold veins; emerald vault stone; bronze riveted clockwork plates; slate stone with iron bands. |
