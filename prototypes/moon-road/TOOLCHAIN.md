# Core Clash game toolchain

Runtime is Phaser 3.90.0 (vendored in `dist/vendor`), plain JS, GitHub Pages. Golden routes are frozen; new work goes in sibling POC routes. See CURRENT_GAME_HANDOFF.md.

Local tools live in `C:\Users\Willi\tools` (outside the repo, never commit binaries).

| Tool | Path | Status | Role in the pipeline |
| --- | --- | --- | --- |
| TexturePacker 8.3 | `C:/Program Files/CodeAndWeb/TexturePacker/bin/TexturePacker.exe` | Installed, license accepted, CLI verified | Packs frame folders into Phaser atlases via `scripts/pack-atlas.mjs` |
| LDtk 1.5.3 | `%LOCALAPPDATA%\Programs\ldtk\LDtk.exe` | Installed, opens the project; not yet re-saved by a human | Level design in `art-source/poc-xi/moon-library.ldtk`, exported by `scripts/ldtk-export.mjs` |
| Pixelorama | `~/tools/pixelorama/Pixelorama.exe` | Extracted, not exercised yet | Hand-polish sprites in `art-source/poc-xi/*-frames/`; re-pack afterwards |
| Blender 5.2 + MCP add-on | installed; Claude Code has `mcp__Blender__*` tools | Working | Render pose sheets / 3D-to-sprite (not used for POC XI) |
| Godot 4.7.2 | `~/tools/godot/Godot_v4.7.2-stable_win64_console.exe` | Extracted, not exercised | Optional prototyping reference only; not the shipping engine |
| Phaser 4.2.1 | `~/tools/phaser4/phaser-4.2.1.js` | Reference only | Do not swap into golden builds (they use 3.90.0); an upgrade is its own POC route |
| Pillow + NumPy | Python | Working | Every art generator under `scripts/` |

Local tool binaries live in `C:\Users\Willi\tools` (outside the repo; never commit binaries; `.gitignore` blocks `*.exe`, `*.msi`, `*.pck`).

## Pipeline (as used for POC XI)

1. **Source art:** accepted generated sheets live in `art-source/` and are never edited. New sprites are hand-built by the Pillow generators (`make-poc-xi-fx.py`, `make-poc-xi-world.py`, `make-poc-xi-boss.py`, `make-library-props.py`) at half resolution, outlined and doubled with nearest-neighbor.
2. **Style:** every generator snaps to one palette and outline via `scripts/pixel_style.py` (sampled from the accepted generated sprites plus beam accent ramps). New art must use it so everything shares a pixel feel.
3. **Derived sheets:** `recolor-dragon.py` (orange dragon, feet grounded), `make-warden-walk.py` and `make-twin-walk.py` (rigged walk cycles) read the generated sheets and write new ones into `dist/poc-xi/art/`.
4. **Atlases:** `node scripts/pack-atlas.mjs [library|fx|world|boss|all]` runs TexturePacker (Phaser format) into `dist/poc-xi/art/`.
5. **Levels:** edit `art-source/poc-xi/moon-library.ldtk` in LDtk, then `node scripts/ldtk-export.mjs` to regenerate `dist/poc-xi/levels.js` (a test fails if they drift).
6. **Verify:** `node --test "prototypes/moon-road/test/**/*.test.mjs"` from the repo root, then play in a browser (`python -m http.server 8123` from `dist`, open `/poc-xi/`).

## Practical notes

- `dist/` is gitignored; new routes and generated assets are added with `git add -f`.
- Browsers cache ES modules and atlases hard. Use Ctrl+F5, or in a scripted check `fetch(url, {cache: 'reload'})` every module before reloading.
- In an embedded browser pane the animation loop can be throttled between screenshots; step the scene with `scene.update(0, 16.6)` when checking motion.
- Python heredocs through some shells mangle backslashes and `\n`; write generator and edit scripts to files instead.

## Assistant access

- Claude Code: shell and file access to all tools above; Blender via MCP.
- GitHub Copilot Desktop and ChatGPT Desktop: no MCP here; they read `AGENTS.md` / `.github/copilot-instructions.md` and this file, and drive the tools through the shell commands listed.

## Worked example

POC XI (`dist/poc-xi/`, see POC-XI.md) uses the whole chain end to end: `moon-library.ldtk` -> `ldtk-export.mjs` -> `levels.js`; the four generators -> `pack-atlas.mjs all` -> `library`, `fx`, `world`, `boss` atlases. Copy that pattern for new rooms and zones.
