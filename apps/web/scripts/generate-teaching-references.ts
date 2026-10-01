// Regenerates lib/generated/teaching-references.json from knowledge/teaching-coaching.
// Run: pnpm generate:references
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { projectTeachingReferences } from "../lib/teaching-reference-projection";

const repoRoot = join(__dirname, "..", "..", "..");
const kb = join(repoRoot, "knowledge", "teaching-coaching");
export function readKnowledgeFiles() {
  return ["", "exemplars", "levels"].flatMap(dir => readdirSync(join(kb, dir)).filter(f => f.endsWith(".md") && f !== "README.md")
    .map(f => ({ path: relative(repoRoot, join(kb, dir, f)), markdown: readFileSync(join(kb, dir, f), "utf8") })));
}
if (process.argv[1]?.includes("generate-teaching-references")) {
  writeFileSync(join(__dirname, "..", "lib", "generated", "teaching-references.json"), `${JSON.stringify(projectTeachingReferences(readKnowledgeFiles()), null, 2)}\n`);
}
