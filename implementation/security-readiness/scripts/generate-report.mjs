#!/usr/bin/env node
// Compatibility entry point for the v1 usage:
//   node generate-report.mjs APP_PROFILE AUDIT_OVERRIDES OUTPUT_DIR
// Prefer `security-readiness.mjs report <app-dir>`, which also validates inputs.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assessApp, loadCatalog, validateApp } from "./lib/model.mjs";
import { assessmentTable, gateMarkdown, toCsv } from "./lib/outputs.mjs";

const [profilePath, overridesPath, outputPath] = process.argv.slice(2);
if (!profilePath || !overridesPath || !outputPath) {
  console.error("Usage: node generate-report.mjs APP_PROFILE AUDIT_OVERRIDES OUTPUT_DIR");
  process.exit(1);
}
const catalog = await loadCatalog();
const [profile, audit] = await Promise.all([profilePath, overridesPath].map(async (path) => JSON.parse(await readFile(resolve(path), "utf8"))));
const { errors, warnings } = validateApp(catalog, profile, audit);
for (const message of warnings) console.warn(`warning: ${message}`);
if (errors.length) {
  for (const message of errors) console.error(`ERROR: ${message}`);
  process.exit(1);
}
const assessment = assessApp(catalog, profile, audit);
await mkdir(resolve(outputPath), { recursive: true });
await Promise.all([
  writeFile(resolve(outputPath, "security-control-matrix.csv"), toCsv(assessmentTable(assessment))),
  writeFile(resolve(outputPath, "security-summary.json"), JSON.stringify(assessment.summary, null, 2) + "\n"),
  writeFile(resolve(outputPath, "public-launch-gate.md"), gateMarkdown(catalog, assessment))
]);
console.log(JSON.stringify(assessment.summary, null, 2));
