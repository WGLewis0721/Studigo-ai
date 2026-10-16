# Moon Keep / Core Clash

Separate game. It is not the Studigo learning app and it must not be linked from `apps/web`.

- Current golden route: `dist/poc-xi/`. Read `CURRENT_GAME_HANDOFF.md` and `POC-XI.md` first.
- Frozen routes (`poc-vii`, `poc-viii`, `poc-ix`, `poc-x`, `journey`, `adventure`, and earlier) stay frozen. Start the next experiment in a new sibling route.
- Art pipeline and local tools: `TOOLCHAIN.md`. Tool binaries (`.exe`, `.msi`, Godot, Pixelorama, LDtk, TexturePacker, Blender) stay off the machine that commits. Never commit them.
- Art provenance: `ASSETS.md`. Large art lives in `art-source/` and `downloads/` and is ignored by `.cursorignore`.

```bash
node prepare.mjs
python -m http.server 8000 --directory dist
node --test "prototypes/moon-road/test/**/*.test.mjs"
```

Open `http://localhost:8000/poc-xi/`. Runtime is Phaser 3.90.0, vendored under `dist/vendor/` for GitHub Pages.
