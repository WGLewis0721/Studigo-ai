// Packs art-source/poc-xi/frames/*.png into a Phaser atlas with TexturePacker (local tool, not committed).
import {spawnSync} from 'node:child_process';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const exe = process.env.TEXTUREPACKER || 'C:/Program Files/CodeAndWeb/TexturePacker/bin/TexturePacker.exe';
const r = spawnSync(exe, ['--format', 'phaser', '--sheet', join(root, 'dist/poc-xi/art/library.png'), '--data', join(root, 'dist/poc-xi/art/library.json'),
  '--trim-mode', 'None', '--disable-rotation', '--extrude', '0', '--shape-padding', '2', '--png-opt-level', '0', '--scale', '1', join(root, 'art-source/poc-xi/frames')], {stdio: 'inherit'});
process.exit(r.status ?? 1);
