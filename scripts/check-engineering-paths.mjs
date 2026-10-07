import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const text = await readFile(path.join(root, "ENGINEERING.md"), "utf8");
const paths = new Set();
for (const match of text.matchAll(/`([^`\n]+)`/g)) {
  const raw = match[1];
  if (!raw.includes("/")) continue;
  if (raw.includes("*") || raw.includes(" ") || raw.startsWith("http")) continue;
  const candidate = raw.replace(/^\.\//, "");
  if (!/^[A-Za-z0-9_./-]+$/.test(candidate)) continue;
  paths.add(candidate);
}

const missing = [...paths].filter((candidate) => !existsSync(path.join(root, candidate)));
if (missing.length) {
  console.error("ENGINEERING.md names paths that are not in the tree:");
  for (const item of missing) console.error(`  ${item}`);
  process.exit(1);
}
console.log(`engineering paths ok (${paths.size})`);
