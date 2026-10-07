# Studigo 30s launch film — Remotion project (Round 1: animatic + 5s proof)

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
