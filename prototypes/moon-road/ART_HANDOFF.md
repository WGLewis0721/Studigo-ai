# Studigo art and sprite handoff

Use this file with CURRENT_GAME_HANDOFF.md and ASSETS.md. The accepted art already exists: reuse it before generating anything new.

## What actually made the art

OpenAI's built-in image-generation tool generated three original raster images on 2026-09-28: a moonlit observatory background, a dragon action sheet, and a guardian pose sheet. This was image generation, not CSS shapes, a stock asset pack, a 3D render, or Phaser drawing the characters. The precise underlying image model/version was not recorded, so do not invent one.

The generated action sheets were not automatically engine-ready. A Python/Pillow script cropped each pose, removed transparent margins, scaled all poses consistently, aligned their feet, and packed them into horizontal transparent sprite strips. Hand-selected crop rectangles are retained in scripts/normalize-art.py. One clipped dragon run pose is replaced by a repeat of an earlier run pose. Detached projectile spill is removed from the landing cell. These are visible in the script; do not assume a perfect evenly spaced source grid.

Phaser 3.90.0 then selects frames during run/jump/fire/landing and boss anticipation/attack/recovery/hit/defeat. Movement, bobbing, recoil, particles, muzzle flash, projectiles, glowing cores, camera feedback and hit-stop are runtime code. Sound is synthesized Web Audio. The backdrop is a single image; its depth comes from the painted composition plus scrolling and runtime foreground/platform layers, not separate exported parallax layers.

## Where the files live

Repository: https://github.com/WGLewis0721/Studigo-ai
Branch: feature/moon-road-core-clash
Directory: prototypes/moon-road/

- art-source/dragon.png — original 2172×724 RGBA action sheet.
- art-source/guardian.png — original 1774×887 RGBA pose sheet.
- art-source/observatory.png — original 1672×940 RGB environment.
- scripts/normalize-art.py — exact cropping/alignment/packing pipeline.
- downloads/Studigo-Art-Pack.zip — original sources, ready PNGs, frame metadata, pipeline, provenance and this handoff.
- dist/assets/ — game-ready files, reconstructed by node prepare.mjs in the repository; also included directly in the ZIP.
- dist/game.js — reference for loading sprites, selecting poses and attaching boss-core effects.
- dist/poc-viii/game.js — reference for the same dragon in the scrolling level.

The repo's dist/assets and dist/vendor directories are generated/ignored. Their bytes are preserved in runtime/part-00.txt through part-16.txt. Run node prepare.mjs from prototypes/moon-road to recover them without a CDN or image model. This distinction matters: the runtime chunks were previously synced to GitHub, while the raw art-source sheets and normalizer were missing there. The art handoff adds those missing editable source files.

## Ready-to-use asset contract

| File under dist/assets | Dimensions | Purpose |
| --- | --- | --- |
| dragon.png | 1536×128 RGBA | 12 horizontal frames, each 128×128 |
| guardian.png | 2048×256 RGBA | 8 horizontal frames, each 256×256 |
| observatory.png | 480×270 RGB | Background displayed at 960×540 |
| platform.png | 120×24 RGB | Platform tile cropped from the original environment |
| core.png | 32×32 RGBA | Code-drawn power core |
| spark.png | 16×16 RGBA | Code-drawn particle texture |
| frames.json | JSON | Per-pose guardian core coordinates; keep with the sheet |

Dragon frames: 0–5 run cycle; 6 idle; 7 rising jump; 8 falling; 9 firing; 10 landing; 11 victory.

Guardian frames: 0 idle; 1 anticipation; 2 punch/attack; 3 recovery; 4 phase awakening; 5 hit; 6 collapse; 7 shatter. Frame 4 is available in the art but is not used as a color-phase mechanic in the current power-only boss.

Transparent square cells include padding. In Phaser use frameWidth/frameHeight of 128 or 256, not tight visible character bounds. Feet are aligned to y122 in dragon cells and y243 in guardian cells. Actor origin is (0.5, 1). Runtime display sizes can differ: root boss uses dragon146×146 and guardian284×284; the scrolling level uses dragon140×140.

```js
this.load.spritesheet('dragon', 'assets/dragon.png', {
  frameWidth: 128, frameHeight: 128
});
this.load.spritesheet('guardian', 'assets/guardian.png', {
  frameWidth: 256, frameHeight: 256
});
this.load.json('frames', 'assets/frames.json');
// Example idle dragon:
this.add.sprite(172, 427, 'dragon', 6)
  .setOrigin(0.5, 1).setDisplaySize(146, 146);
```

Use Phaser pixelArt:true and roundPixels:true, and CSS image-rendering:pixelated. Do not smooth the images. The visual style comes from authored silhouettes, palette, poses and background composition; reducing resolution alone is not the art pipeline.

## Rebuild the existing files

For ordinary development, run node prepare.mjs. This restores the exact checked-in runtime output.

For editing/repacking the art, use Python 3 with Pillow, then run:

```sh
python -m pip install Pillow
python scripts/normalize-art.py
```

The script computes its root from its own location. Keep art-source/, scripts/ and dist/assets/ in the same relative layout. It writes ready PNGs and frames.json. Regenerating/replacing a source sheet requires revisiting every crop rectangle, baseline, scale and guardian core coordinate; the current rectangles are specific to the current images. Compare output to the golden assets before replacing anything. Changing PNG compression/library versions may change file bytes without changing pixels.

## How Claude or another agent should extend this art

Claude needs an image-generation tool/API to create comparable new raster art. Prompting a coding model alone is not the same operation. It can still use the existing files, edit game code and run the preparation script without any image-generation access.

1. Read the handoff and inspect the actual original and ready images.
2. Reuse the current art when the requested gameplay does not require new poses or scenery.
3. For new art, provide these images as visual references to an image-generation tool. Preserve the jade dragon, gold horns, cream belly, purple scarf, compact blaster, slate/brass guardian, and dark navy/indigo moonlit stone environment.
4. Generate source art into a new file; preserve the accepted originals. Use transparent backgrounds for character sheets. Keep all poses fully inside their cells with padding and a shared scale and facing direction.
5. Inspect the result. Check anatomy, silhouette, frame ordering, transparency, clipped limbs, detached effects and consistency. Do not assume the requested grid was obeyed.
6. Crop/normalize to consistent engine cells. Test animation at phone size. Fix jittering feet and moving effect anchors before approving.
7. Store original output, prompt, references, crop metadata, final sprites and provenance together. Update the handoff and browser screenshots.

### Reconstructed prompt templates

These templates reconstruct the recorded art direction. They are not claimed to be verbatim copies of the original generation requests, and they will not reproduce identical pixels. The supplied PNG files are the way to preserve the exact art.

**Dragon source sheet**

> Create a cohesive 16-bit-inspired 2D pixel-art action sprite sheet for Studigo. Match the attached accepted dragon reference: small jade-green dragon, gold horns, cream belly, purple scarf, compact blaster; readable friendly action-game silhouette. Side view facing right. Transparent background. Arrange 12 fully contained poses in a 6-column, 2-row sheet: six run poses in the first row; idle, rising jump, falling, firing, landing and victory in the second row. Maintain identical character proportions, scale, palette and foot anchor across cells. Leave generous transparent cell padding. No labels, UI, scenery or large detached projectile effects. Crisp pixel edges and deliberate shading, not smooth vector art.

**Guardian source sheet**

> Create a matching 16-bit-inspired side-view boss pose sheet for Studigo. Match the attached accepted guardian reference: substantial floating stone-and-metal guardian, slate armor and brass accents, heavy readable arms, a dark empty chest socket reserved for an animated core drawn in game. Transparent background. Eight fully contained poses in a 4-column, 2-row sheet: idle, attack anticipation, forward punch, recovery, phase awakening, hit reaction, collapse and shatter. Keep scale, proportions, facing direction and body anchor consistent. No labels, UI or painted energy core. Clear silhouettes, crisp pixel edges and coherent shading.

**Environment**

> Create a widescreen 16-bit-inspired pixel-art environment for a mobile side-scrolling action game. Moonlit ruined observatory with layered stone arches, distant mountains, a large moon above, dark navy/indigo/slate palette, cool moonlight and restrained warm brass details. Intentional foreground/background separation. Keep the central combat space uncluttered and the walkable stone floor near 80% of the image height. No characters, text or UI. Match the attached Studigo environment reference; preserve readable contrast around the dragon and boss.

## Copy/paste continuation prompt

You are continuing Studigo, not redesigning its art. Use WGLewis0721/Studigo-ai, branch feature/moon-road-core-clash, directory prototypes/moon-road. Read CURRENT_GAME_HANDOFF.md, ART_HANDOFF.md and ASSETS.md. Run node prepare.mjs and inspect art-source/ plus dist/assets/. Reuse the exact dragon, guardian and observatory assets. Preserve frame sizes, foot anchors, guardian core coordinates and pixel rendering. Use scripts/normalize-art.py only when repacking sources; its crop coordinates are specific to these sheets. If a task needs new art, use the existing images as references with an image-generation tool, preserve the originals, document the prompt and normalize/test the result. Do not substitute CSS characters, stock sprites or a new art style. Preserve the accepted math/combat rules and verify changes through real browser playtesting.
