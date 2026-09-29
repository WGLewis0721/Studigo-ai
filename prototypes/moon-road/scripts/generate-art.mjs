#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const defaultSpecPath = resolve(root, 'scripts/art-prompts.json');

function usage() {
  return `Usage:
  node scripts/generate-art.mjs --asset dragon
  node scripts/generate-art.mjs --asset guardian --output art-source/generated/guardian-v2.png
  node scripts/generate-art.mjs --asset observatory --dry-run

Required environment:
  OPENAI_API_KEY must be available in the process environment.

Options:
  --asset <dragon|guardian|observatory|all>
  --spec <path>            Defaults to scripts/art-prompts.json
  --output <path>          Only valid for a single asset
  --model <name>           Defaults to gpt-image-1
  --size <size>            Defaults to the asset recommendedSize
  --dry-run                Print the request plan without calling the API
`;
}

function parseArgs(argv) {
  const args = { spec: defaultSpecPath, model: 'gpt-image-1', dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--asset') args.asset = argv[++i];
    else if (arg === '--spec') args.spec = resolve(root, argv[++i]);
    else if (arg === '--output') args.output = argv[++i];
    else if (arg === '--model') args.model = argv[++i];
    else if (arg === '--size') args.size = argv[++i];
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

function buildPrompt(styleGuide, asset) {
  return `${styleGuide}\n\nAsset request:\n${asset.prompt}\n\nReturn a single finished source PNG suitable for the Studigo art normalization pipeline.`;
}

async function generateImage({ apiKey, model, size, prompt, transparent }) {
  const body = {
    model,
    prompt,
    size,
    n: 1
  };
  if (transparent) body.background = 'transparent';
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || response.statusText;
    throw new Error(`OpenAI image generation failed (${response.status}): ${detail}`);
  }
  const item = payload?.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item?.url) {
    const imageResponse = await fetch(item.url);
    if (!imageResponse.ok) throw new Error(`Image download failed (${imageResponse.status})`);
    return Buffer.from(await imageResponse.arrayBuffer());
  }
  throw new Error('OpenAI image response did not include b64_json or url data.');
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  if (!args.asset) throw new Error('Missing --asset.\n\n' + usage());

  const spec = JSON.parse(await readFile(args.spec, 'utf8'));
  const names = args.asset === 'all' ? Object.keys(spec.assets) : [args.asset];
  for (const name of names) {
    if (!spec.assets[name]) throw new Error(`Unknown asset "${name}". Expected one of: ${Object.keys(spec.assets).join(', ')}, all`);
  }
  if (args.output && names.length !== 1) throw new Error('--output can only be used with one asset.');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey && !args.dryRun) throw new Error('OPENAI_API_KEY is required unless --dry-run is used.');

  for (const name of names) {
    const asset = spec.assets[name];
    const output = resolve(root, args.output || asset.output);
    const size = args.size || asset.recommendedSize || '1536x1024';
    const prompt = buildPrompt(spec.styleGuide, asset);
    const plan = { asset: name, model: args.model, size, output, transparent: Boolean(asset.transparent) };
    if (args.dryRun) {
      process.stdout.write(JSON.stringify({ ...plan, prompt }, null, 2) + '\n');
      continue;
    }
    process.stdout.write(`Generating ${name} -> ${output}\n`);
    const bytes = await generateImage({ apiKey, model: args.model, size, prompt, transparent: Boolean(asset.transparent) });
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, bytes);
    process.stdout.write(`Wrote ${bytes.length} bytes\n`);
  }
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
