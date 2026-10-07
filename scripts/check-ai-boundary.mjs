import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const skip = new Set(["node_modules", ".git", "dist", ".next", "coverage"]);

async function walk(dir, out) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (/\.(ts|tsx|mjs|js|jsx)$/.test(entry.name)) out.push(full);
  }
}

const files = [];
await walk(root, files);
const allowed = path.normalize(`${path.sep}packages${path.sep}ai${path.sep}`);
const hits = [];
for (const file of files) {
  if (file.includes(allowed)) continue;
  if (file.includes(`${path.sep}scripts${path.sep}check-ai-boundary.mjs`)) continue;
  const text = await readFile(file, "utf8");
  if (/(from\s+["']openai["']|require\(\s*["']openai["']\s*\))/.test(text)) {
    hits.push(path.relative(root, file));
  }
}
if (hits.length) {
  console.error("The model SDK may only be imported from packages/ai:");
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log("ai provider boundary ok");
