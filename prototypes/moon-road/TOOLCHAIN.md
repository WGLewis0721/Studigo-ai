# Core Clash game toolchain

Runtime is Phaser 3.90.0 (vendored in `dist/vendor`), plain JS, GitHub Pages. Golden routes are frozen; new work goes in sibling POC routes. See CURRENT_GAME_HANDOFF.md.

Local tools live in `C:\Users\Willi\tools` (outside the repo, never commit binaries).

| Tool | Path | Role in the pipeline |
| --- | --- | --- |
| Pixelorama | `tools\pixelorama\Pixelorama.exe` | Hand-edit/clean sprites, palettes, animation strips; CLI export: `Pixelorama.exe --headless --export ...` |
| LDtk 1.5.3 | `%LOCALAPPDATA%\Programs\ldtk\LDtk.exe` | Level design; save `.ldtk` JSON into `art-source/`, load as JSON in Phaser |
| TexturePacker 8.3 | `C:/Program Files/CodeAndWeb/TexturePacker/bin/TexturePacker.exe` (CLI needs one-time license accept: `--agree-to-the-terms-of-the-license-agreement`, or open the GUI once) | Pack frames into Phaser atlas: `TexturePacker --format phaser --sheet out.png --data out.json frames/` |
| Blender 5.2 + MCP add-on | installed; Claude Code has `mcp__Blender__*` tools | Render pose sheets / 3D-to-sprite |
| Godot 4.7.2 | `tools\godot\Godot_v4.7.2-stable_win64_console.exe` | Optional: prototyping/particles/tilemap reference only; not the shipping engine |
| Phaser 4.2.1 | `tools\phaser4\phaser-4.2.1.js` | Reference only. Do not swap into golden builds (they use 3.90.0); any upgrade is a separate POC route |

## Pipeline

1. Source art: Higgsfield/image-gen or Blender render -> `art-source/`.
2. Clean in Pixelorama; normalize with `scripts/normalize-art.py`.
3. Pack with TexturePacker (Phaser atlas JSON) or keep the 128/256 strip contract in ART_HANDOFF.md.
4. Levels in LDtk -> `.ldtk` JSON -> loaded by the POC route.
5. `node prepare.mjs` and the `qa/` playtest scripts verify before PR.

## Assistant access

- Claude Code: shell + file access to all tools above; Blender via MCP.
- GitHub Copilot Desktop and ChatGPT Desktop: no MCP here; they read `AGENTS.md` / `.github/copilot-instructions.md` and this file, and drive the tools through the shell/CLI commands listed.

## Worked example

POC XI (`dist/poc-xi/`, see POC-XI.md) uses the whole chain: `art-source/poc-xi/moon-library.ldtk` -> `scripts/ldtk-export.mjs` -> `levels.js`, and `scripts/make-library-props.py` -> `scripts/pack-atlas.mjs library` -> `library.png/.json`. Copy that pattern for new rooms. `dist/` is gitignored, so new routes are added with `git add -f`.
