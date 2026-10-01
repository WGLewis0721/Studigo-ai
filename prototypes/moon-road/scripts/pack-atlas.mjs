// Packs art-source/poc-xi/<dir> into dist/poc-xi/art/<name>.png/.json with TexturePacker (local tool, not committed).
// Usage: node scripts/pack-atlas.mjs [library|fx|all]
import {spawnSync} from 'node:child_process';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const exe = process.env.TEXTUREPACKER || 'C:/Program Files/CodeAndWeb/TexturePacker/bin/TexturePacker.exe';
const ATLASES = {library: 'frames', fx: 'fx-frames', world: 'world-frames'};
const want = process.argv[2] && process.argv[2] !== 'all' ? [process.argv[2]] : Object.keys(ATLASES);
for (const name of want) {
  if (!ATLASES[name]) { console.error(`unknown atlas ${name}`); process.exit(2); }
  const r = spawnSync(exe, ['--format', 'phaser', '--sheet', join(root, `dist/poc-xi/art/${name}.png`), '--data', join(root, `dist/poc-xi/art/${name}.json`),
    '--trim-mode', 'None', '--disable-rotation', '--extrude', '1', '--shape-padding', '2', '--png-opt-level', '0', '--scale', '1', join(root, 'art-source/poc-xi', ATLASES[name])], {stdio: 'inherit'});
  if (r.status) process.exit(r.status);
}
