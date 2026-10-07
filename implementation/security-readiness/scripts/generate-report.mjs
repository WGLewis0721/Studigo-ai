import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const [profilePath, overridesPath, outputPath] = process.argv.slice(2);
if (!profilePath || !overridesPath || !outputPath) {
  throw new Error("Usage: node generate-report.mjs APP_PROFILE AUDIT_OVERRIDES OUTPUT_DIR");
}

const here = new URL("../framework/control-catalog.json", import.meta.url);
const [catalog, profile, audit] = await Promise.all([
  readFile(here, "utf8").then(JSON.parse),
  readFile(resolve(profilePath), "utf8").then(JSON.parse),
  readFile(resolve(overridesPath), "utf8").then(JSON.parse)
]);

if (profile.schema_version !== 1 || audit.schema_version !== 1 || catalog.schema_version !== 1) {
  throw new Error("Unsupported security-readiness schema version");
}
if (profile.app_id !== audit.app_id) throw new Error("Profile/audit app_id mismatch");

const feature = (name) => profile.features?.[name] ?? "unknown";

function applicability(control) {
  const tags = control.applies_when_any ?? ["all"];
  if (tags.includes("all")) return "applicable";
  const states = tags.map(feature);
  if (states.includes("yes")) return "applicable";
  if (states.includes("unknown")) return "needs_review";
  return "not_applicable";
}

const rows = catalog.controls.map((control) => {
  const applies = applicability(control);
  const override = audit.overrides?.[control.id] ?? {};
  const defaultStatus = applies === "not_applicable" ? "not_applicable" : applies === "needs_review" ? "needs_review" : "not_tested";
  const likelihood = Number.isFinite(override.likelihood) ? override.likelihood : 0;
  const impact = Number.isFinite(override.impact) ? override.impact : 0;
  const status = override.status ?? defaultStatus;
  const blocker = applies === "applicable" && (override.release_blocker ?? control.release_blocker);
  return {
    app_id: profile.app_id,
    app_name: profile.name,
    control_id: control.id,
    domain: control.domain,
    title: control.title,
    frameworks: (control.frameworks ?? []).join("|"),
    applicability: applies,
    status,
    severity: override.severity ?? control.severity,
    likelihood,
    impact,
    risk_score: likelihood * impact,
    release_blocker: Boolean(blocker),
    requirement: control.requirement,
    test_method: control.test_method,
    evidence_expected: control.evidence_expected,
    finding: override.finding ?? "",
    remediation: override.remediation ?? "",
    owner: override.owner ?? "",
    target_date: override.target_date ?? "",
    evidence_refs: (override.evidence_refs ?? []).join("|"),
    test_refs: (override.test_refs ?? []).join("|"),
    last_reviewed: audit.reviewed_at ?? "",
    notes: override.notes ?? ""
  };
});

const columns = Object.keys(rows[0] ?? {});
const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replaceAll('"','""') + '"' : s;
};
const csv = [columns.join(","), ...rows.map(r => columns.map(c => csvCell(r[c])).join(","))].join("\n") + "\n";

const applicable = rows.filter(r => r.applicability === "applicable");
const unresolved = applicable.filter(r => !["pass","accepted_risk"].includes(r.status));
const blockers = applicable.filter(r => r.release_blocker && !["pass","accepted_risk"].includes(r.status));
const summary = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  app_id: profile.app_id,
  app_name: profile.name,
  catalog_version: catalog.catalog_version,
  total_controls: rows.length,
  applicable_controls: applicable.length,
  needs_review: rows.filter(r => r.applicability === "needs_review").length,
  status_counts: Object.fromEntries([...new Set(rows.map(r=>r.status))].sort().map(s=>[s,rows.filter(r=>r.status===s).length])),
  severity_counts_open: Object.fromEntries(["P0","P1","P2","P3"].map(s=>[s,unresolved.filter(r=>r.severity===s).length])),
  release_blockers_open: blockers.length,
  public_release_ready: blockers.length === 0,
  highest_risk_open: unresolved.filter(r=>r.risk_score>0).sort((a,b)=>b.risk_score-a.risk_score).slice(0,10).map(r=>({control_id:r.control_id,title:r.title,severity:r.severity,risk_score:r.risk_score,status:r.status}))
};

const gateLines = [
  "# Public Launch Security Gate",
  "",
  `Application: **${profile.name}** (\`${profile.app_id}\`)`,
  "",
  `Generated from catalog **${catalog.catalog_version}**.`,
  "",
  summary.public_release_ready
    ? "## Decision: READY FROM THE RECORDED CONTROL STATE"
    : "## Decision: NOT READY FOR UNRESTRICTED PUBLIC RELEASE",
  "",
  `Open release blockers: **${blockers.length}**`,
  "",
  "A blocker is closed only by `pass` or explicit `accepted_risk` with accountable ownership.",
  "",
  "## Open blockers",
  ""
];
if (!blockers.length) gateLines.push("- None recorded.");
for (const r of blockers.sort((a,b)=>(a.severity.localeCompare(b.severity)) || b.risk_score-a.risk_score)) {
  gateLines.push(`### ${r.control_id} — ${r.title}`);
  gateLines.push(`- Severity: **${r.severity}**`);
  gateLines.push(`- Status: **${r.status}**`);
  gateLines.push(`- Risk score: **${r.risk_score || "not scored"}**`);
  if (r.finding) gateLines.push(`- Finding: ${r.finding}`);
  if (r.remediation) gateLines.push(`- Required action: ${r.remediation}`);
  if (r.evidence_refs) gateLines.push(`- Evidence: ${r.evidence_refs}`);
  gateLines.push("");
}
gateLines.push("## Rule", "", "Do not convert a blocker to pass because the control is documented. Record implementation evidence and test evidence.", "");

await mkdir(resolve(outputPath), { recursive: true });
await Promise.all([
  writeFile(resolve(outputPath, "security-control-matrix.csv"), csv),
  writeFile(resolve(outputPath, "security-summary.json"), JSON.stringify(summary, null, 2) + "\n"),
  writeFile(resolve(outputPath, "public-launch-gate.md"), gateLines.join("\n"))
]);

console.log(JSON.stringify(summary, null, 2));
