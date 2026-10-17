import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogFile = path.join(root, "design/ASSET_INVENTORY.json");
const catalog = JSON.parse(fs.readFileSync(catalogFile, "utf8"));
const issues = [];
const ids = new Set();
const paths = new Set();
const allowed = new Set(Object.keys(catalog.statuses ?? {}));

if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.entries)) {
  throw new Error("Design inventory schema is invalid.");
}
for (const entry of catalog.entries) {
  if (!entry.id || !entry.path || !entry.ref || !entry.status || !entry.role || !entry.decision) {
    issues.push(`Incomplete asset entry: ${JSON.stringify(entry)}`);
    continue;
  }
  if (ids.has(entry.id)) issues.push(`Duplicate asset ID: ${entry.id}`);
  ids.add(entry.id);
  const refPath = `${entry.ref}:${entry.path}`;
  if (paths.has(refPath)) issues.push(`Duplicate path: ${refPath}`);
  paths.add(refPath);
  if (!allowed.has(entry.status)) issues.push(`Unknown asset status: ${entry.status}`);
  if (entry.path.startsWith("/") || entry.path.includes("..") || entry.path.includes("\\")) {
    issues.push(`Unsafe inventory path: ${entry.path}`);
    continue;
  }
  if (entry.ref === "main" && !fs.existsSync(path.join(root, entry.path))) {
    issues.push(`Missing asset on current branch: ${entry.path}`);
  }
  if (entry.status === "canonical" && entry.ref !== "main") {
    issues.push(`Canonical asset must live on main: ${entry.path}`);
  }
  // Candidate branch assets have a verified provenance in the inventory but
  // are not copied into main just to satisfy this filesystem check.
}
if (issues.length) {
  console.error("Design inventory check failed:\n" + issues.map(v => "- " + v).join("\n"));
  process.exitCode = 1;
} else {
  const onMain = catalog.entries.filter(e => e.ref === "main").length;
  const external = catalog.entries.length - onMain;
  console.log(`Design inventory verified: ${onMain} local paths, ${external} branch-only references; no missing/duplicate canonical entries.`);
}
