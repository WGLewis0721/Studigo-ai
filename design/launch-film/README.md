# Studigo 30s launch film — Remotion project (Round 2: polished animatic)

```bash
cd design/launch-film
npm install --ignore-scripts
npm run studio                 # live preview
npx remotion render src/index.ts Proof5s out/proof-5s.mp4
npx remotion render src/index.ts Master  out/animatic-16x9.mp4
```
`remotion.config.ts` points at the sandbox `headless_shell`; delete that line on a normal machine (Remotion downloads its own Chrome).
Deps: remotion + @remotion/cli 4.0.534, React 18.3. Sprites/fonts in `public/` (copies of repo assets). See `docs/` for claim sheet and inventory.
Out-of-workspace by design (own package.json); not part of the pnpm app build.

Round 2 outputs: `out/studigo-animatic-r2-16x9.mp4` (30s, 1920×1080, 30fps, scratch captions, no audio) and the 6s opening proof cut from it:
```bash
npx remotion render src/index.ts Master out/studigo-animatic-r2-16x9.mp4 --crf=16
ffmpeg -i out/studigo-animatic-r2-16x9.mp4 -t 6 -c:v libx264 -crf 16 -pix_fmt yuv420p out/studigo-proof-6s-r2.mp4
python3 -I scripts/blank-check.py <dir-of-jpg-frames> 150   # flags frames with no dragon
python3 -I scripts/make-maps.py                              # regenerates rig maps (then re-embed into src/maps.ts)
```
Extra deps: `@remotion/motion-blur` 4.0.534. Docs: `docs/COPY_DECK.md`, `docs/CLAIM_SHEET.md`, `docs/ASSET_INVENTORY.md`, `docs/ROUND2_NOTES.md`.
