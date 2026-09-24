// Regenerates lib/generated/route-policies.json from the canonical KB records
// named by the control plane's ROUTE_RECORDS. Run: pnpm generate:routes
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROUTE_RECORDS } from "../lib/learning/director";
import { projectRoutePolicy } from "../lib/route-policy-projection";

const repoRoot = join(__dirname, "..", "..", "..");
const projection = Object.fromEntries(
  Object.values(ROUTE_RECORDS).map((name) => {
    const record = `knowledge/teaching-coaching/${name}.md`;
    return [record, projectRoutePolicy(record, readFileSync(join(repoRoot, record), "utf8"))];
  })
);
writeFileSync(join(__dirname, "..", "lib", "generated", "route-policies.json"), `${JSON.stringify(projection, null, 2)}\n`);
