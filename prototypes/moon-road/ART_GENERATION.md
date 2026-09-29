# Studigo art generation integration

This prototype now has a repeatable path for creating new source art with image generation and then converting that art into the Phaser-ready sprite assets used by Core Clash, POC VII, POC VIII, and Journey.

Use this when the current accepted art is no longer enough. If a gameplay change can reuse the existing dragon, guardian, observatory, skeleton, projectiles, particles, or overlays, reuse them first.

## Files

- `scripts/art-prompts.json` — editable art-direction prompt specs for the dragon, guardian, and observatory source images.
- `scripts/generate-art.mjs` — dependency-free Node script that calls the OpenAI Images API and writes generated PNGs.
- `scripts/normalize-art.py` — existing Pillow pipeline that crops, aligns, scales, and packs source sheets into runtime assets.
- `art-source/` — accepted original source sheets.
- `art-source/generated/` — default output folder for newly generated candidates. These are review candidates, not automatically accepted game assets.
- `dist/assets/` — Phaser-ready runtime files written by the normalizer.

## Generate candidate art

Run a dry plan first:

```sh
node scripts/generate-art.mjs --asset dragon --dry-run
node scripts/generate-art.mjs --asset guardian --dry-run
node scripts/generate-art.mjs --asset observatory --dry-run
```

Then generate one or all source candidates from a shell that already has access to an OpenAI API key:

```sh
node scripts/generate-art.mjs --asset dragon
node scripts/generate-art.mjs --asset guardian
node scripts/generate-art.mjs --asset observatory
node scripts/generate-art.mjs --asset all
```

The script reads `OPENAI_API_KEY` from the process environment. It does not print, save, or manage keys.

Default outputs:

| Asset | Output |
| --- | --- |
| Dragon source sheet | `art-source/generated/dragon.png` |
| Guardian source sheet | `art-source/generated/guardian.png` |
| Observatory source image | `art-source/generated/observatory.png` |

You can override a single output path:

```sh
node scripts/generate-art.mjs --asset dragon --output art-source/generated/dragon-run-test.png
```

## Accepting generated art into the game

Generated sheets are rarely engine-ready without inspection. The normalizer's crop rectangles are tuned to the accepted source files, so a new sheet may need crop updates before it packs cleanly.

1. Inspect the generated PNG at phone size and full size.
2. Confirm transparent backgrounds for character sheets and no labels or UI text.
3. Check that every pose is fully inside its intended cell with consistent scale and facing direction.
4. If accepting the candidate, copy it over the matching file in `art-source/` or add a new named source file and update `scripts/normalize-art.py`.
5. Adjust crop rectangles, scale, baseline, and guardian core coordinates in `scripts/normalize-art.py` as needed.
6. Run:

```sh
python -m pip install Pillow
python scripts/normalize-art.py
```

7. Test the result in browser. Watch for foot jitter, clipped limbs, bad alpha edges, misaligned boss core glow, unreadable silhouettes, and projectiles spawning from the wrong place.
8. Update `ART_HANDOFF.md` and `ASSETS.md` with the accepted prompt, source filename, dimensions, provenance, and any crop changes.

## Important boundaries

This integration creates art sources. It does not redesign Studigo's learning mechanics, change combat rules, replace the accepted browser routes, or automatically deploy generated art. Treat every generated image as a candidate until it has been normalized and playtested.
