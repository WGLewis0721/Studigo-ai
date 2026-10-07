import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { FRAMEWORK_DIR, applicability, assessApp, loadCatalog, validateApp } from "./lib/model.mjs";
import { actionsTable, assessmentTable, toCsv } from "./lib/outputs.mjs";
import { buildWorkbook, readZipEntries } from "./lib/xlsx.mjs";

const CLI = fileURLToPath(new URL("./security-readiness.mjs", import.meta.url));
const catalog = await loadCatalog();
const featureKeys = catalog.features.map((feature) => feature.key);

function profile(features = {}, extra = {}) {
  return { schema_version: 1, app_id: "demo-app", name: "Demo", features: { ...Object.fromEntries(featureKeys.map((k) => [k, "no"])), ...features }, ...extra };
}
const audit = (overrides = {}, extra = {}) => ({ schema_version: 1, app_id: "demo-app", reviewed_at: "2026-10-07", overrides, ...extra });
const run = (args, cwd) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });

test("catalog: unique IDs, known feature tags, and every control is actionable", () => {
  const ids = catalog.controls.map((control) => control.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const control of catalog.controls) {
    for (const tag of control.applies_when_any) assert.ok(tag === "all" || featureKeys.includes(tag), `${control.id}: ${tag}`);
    assert.ok(control.acceptance_criteria.length >= 1, `${control.id} acceptance criteria`);
    assert.ok(control.verification_steps.length >= 1, `${control.id} verification steps`);
    assert.ok(control.remediation_guidance && control.requirement, `${control.id} guidance`);
    assert.ok(control.standard_refs.length >= 1, `${control.id} standard refs`);
    assert.ok(catalog.owner_roles[control.owner_role] && catalog.efforts[control.effort], `${control.id} owner/effort`);
  }
  for (const key of featureKeys) {
    assert.ok(catalog.controls.some((control) => control.applies_when_any.includes(key)), `feature ${key} activates at least one control`);
  }
});

test("schemas stay in sync with the catalog", async () => {
  const read = async (name) => JSON.parse(await readFile(join(FRAMEWORK_DIR, "schemas", name), "utf8"));
  const overrides = await read("audit-overrides.schema.json");
  assert.deepEqual(overrides.properties.overrides.propertyNames.enum, catalog.controls.map((c) => c.id));
  const profileSchema = await read("app-profile.schema.json");
  assert.deepEqual(Object.keys(profileSchema.properties.features.properties), featureKeys);
  assert.deepEqual(profileSchema.properties.platforms.items.enum, catalog.platforms);
});

test("applicability: all, yes, unknown and no", () => {
  const control = { applies_when_any: ["payments", "webhooks"] };
  assert.equal(applicability({ applies_when_any: ["all"] }, profile()).state, "applicable");
  assert.deepEqual(applicability(control, profile({ webhooks: "yes" })), { state: "applicable", because: ["webhooks"] });
  assert.equal(applicability(control, profile({ payments: "unknown" })).state, "needs_review");
  assert.equal(applicability(control, profile()).state, "not_applicable");
  const missing = profile(); delete missing.features.payments;
  assert.equal(applicability(control, missing).state, "needs_review", "a missing flag is unknown, never no");
});

test("validation enforces the evidence and accountability rules", () => {
  const ok = validateApp(catalog, profile(), audit({ "GMS-GOV-001": { status: "pass", evidence_refs: ["docs/arch.md"], test_refs: ["t"] } }));
  assert.deepEqual(ok.errors, []);
  const errors = (overrides, p = profile(), a = audit(overrides)) => validateApp(catalog, p, a).errors.join("\n");
  assert.match(errors({ "GMS-GOV-001": { status: "pass" } }), /pass requires at least one evidence_ref/);
  assert.match(errors({ "GMS-GOV-001": { status: "accepted_risk", owner: "Ana" } }), /accepted_risk requires an owner and a rationale/);
  assert.match(errors({ "GMS-NOPE-001": { status: "fail" } }), /not a catalog control/);
  assert.match(errors({ "GMS-GOV-001": { status: "done" } }), /status must be one of/);
  assert.match(errors({ "GMS-GOV-001": { status: "fail", likelihood: 9 } }), /likelihood must be an integer from 1 to 5/);
  assert.match(errors({ "GMS-GOV-001": { status: "fail", target_date: "next week" } }), /target_date must be YYYY-MM-DD/);
  assert.match(errors({}, profile({ ai: "maybe" })), /features\.ai must be yes, no or unknown/);
  assert.match(errors({}, profile(), audit({}, { app_id: "other" })), /does not match profile/);
  const warnings = validateApp(catalog, profile(), audit({ "GMS-GOV-002": { status: "fail", severity: "P3", finding: "x" } })).warnings.join("\n");
  assert.match(warnings, /severity lowered from P0 to P3/);
  assert.match(warnings, /not applicable to this profile/);
});

test("decision: scope_incomplete, not_ready and ready", () => {
  const everythingPassed = Object.fromEntries(catalog.controls.map((c) => [c.id, { status: "pass", evidence_refs: ["e"], test_refs: ["t"] }]));
  const idea = assessApp(catalog, profile({ payments: "unknown" }), audit(everythingPassed));
  assert.equal(idea.summary.decision, "scope_incomplete");
  assert.deepEqual(idea.summary.scope_questions, ["payments"]);
  assert.equal(idea.actions[0].action_type, "decide_scope", "scope decisions are ranked first");

  const ready = assessApp(catalog, profile(), audit(everythingPassed));
  assert.equal(ready.summary.decision, "ready");
  assert.equal(ready.summary.release_blockers_open, 0);

  const blocked = assessApp(catalog, profile(), audit({ ...everythingPassed, "GMS-SUPPLY-002": { status: "partial", finding: "no push protection" } }));
  assert.equal(blocked.summary.decision, "not_ready");
  assert.deepEqual(blocked.summary.blockers.map((b) => b.control_id), ["GMS-SUPPLY-002"]);
});

test("actions: blockers first, then severity, status and risk; idea stage designs in", () => {
  const result = assessApp(catalog, profile({ api: "yes", ai: "yes" }), audit({
    "GMS-API-004": { status: "fail", finding: "leaks", likelihood: 5, impact: 5 },
    "GMS-API-002": { status: "partial", finding: "some limits", likelihood: 2, impact: 2 },
    "GMS-AI-002": { status: "fail", finding: "no suite", likelihood: 1, impact: 1 }
  }));
  const order = result.actions.map((a) => a.control_id);
  assert.ok(order.indexOf("GMS-AI-002") < order.indexOf("GMS-API-002"), "P0 fail before P0 partial");
  assert.ok(order.indexOf("GMS-API-002") < order.indexOf("GMS-API-004"), "P0 blocker before a higher-risk P1 non-blocker");
  const first = result.actions[0];
  assert.match(first.title, /^\[P0\]\[Blocker\] Fix: /);
  assert.match(first.description, /\*\*Done when:\*\*\n- \[ \] /);
  assert.deepEqual(result.actions.map((a) => a.rank), result.actions.map((_, i) => i + 1));
  const idea = assessApp(catalog, profile({ api: "yes" }, { stage: "idea" }), audit());
  assert.ok(idea.actions.every((a) => a.action_type === "design_in"));
});

test("platform guidance appears only for declared platforms", () => {
  const row = (platforms) => assessApp(catalog, profile({ public_signup: "yes" }, { platforms }), audit()).rows.find((r) => r.control_id === "GMS-AUTH-004");
  assert.match(row(["supabase"]).platform_notes.join(), /^supabase: /);
  assert.deepEqual(row([]).platform_notes, []);
});

test("CSV escapes commas, quotes and newlines", () => {
  assert.equal(toCsv([{ a: 'x,"y"\nz', b: 1 }]), 'a,b\n"x,""y""\nz",1\n');
  const table = assessmentTable(assessApp(catalog, profile(), audit()));
  assert.deepEqual(Object.keys(table[0]).slice(0, 4), ["app_id", "app_name", "control_id", "domain"], "v1 matrix columns stay first");
});

test("XLSX: valid parts, escaped text, typed cells, deterministic content", () => {
  const sheets = [{ name: "Actions", rows: [{ n: 1, ok: true, text: "a < b & \"c\"\nline\u0007" }] }, { name: "Empty", rows: [], columns: ["x"] }];
  const entries = readZipEntries(buildWorkbook(sheets));
  assert.deepEqual([...entries.keys()].sort(), ["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/styles.xml",
    "xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]);
  const sheet = entries.get("xl/worksheets/sheet1.xml").toString();
  assert.match(sheet, /<c r="A2"><v>1<\/v><\/c>/);
  assert.match(sheet, /<c r="B2" t="b"><v>1<\/v><\/c>/);
  assert.match(sheet, /a &lt; b &amp; &quot;c&quot;\nline</);
  assert.ok(!sheet.includes("\u0007"), "XML-invalid control characters are dropped");
  assert.ok(buildWorkbook(sheets).equals(buildWorkbook(sheets)));
  assert.throws(() => buildWorkbook([{ name: "Bad/Name", rows: [] }]), /Invalid sheet name/);
});

test("CLI end to end: init, validate, report, portfolio and stale detection", async () => {
  const dir = await mkdtemp(join(tmpdir(), "security-readiness-"));
  const appsDir = join(dir, "apps");
  try {
    const init = run(["init", "acme-portal", "--name", "Acme Portal", "--client", "Acme", "--date", "2026-10-07", "--apps-dir", appsDir]);
    assert.equal(init.status, 0, init.stderr);
    const app = join(appsDir, "acme-portal");
    const summary = JSON.parse(await readFile(join(app, "generated", "security-summary.json"), "utf8"));
    assert.equal(summary.decision, "not_ready");
    assert.equal(summary.scope_questions.length, featureKeys.length, "a fresh idea has every capability unknown");
    assert.match(await readFile(join(app, "generated", "intake-questions.md"), "utf8"), /public_signup/);

    assert.equal(run(["portfolio", "--apps-dir", appsDir]).status, 0);
    assert.equal(run(["check", "--apps-dir", appsDir]).status, 0, "fresh outputs are current");

    const profilePath = join(app, "app-profile.json");
    const p = JSON.parse(await readFile(profilePath, "utf8"));
    p.features.payments = "yes";
    await writeFile(profilePath, JSON.stringify(p));
    const stale = run(["check", "--apps-dir", appsDir]);
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /stale/);

    const overridesPath = join(app, "audit-overrides.json");
    const a = JSON.parse(await readFile(overridesPath, "utf8"));
    a.overrides["GMS-PAY-001"] = { status: "pass" };
    await writeFile(overridesPath, JSON.stringify(a));
    const invalid = run(["validate", "--apps-dir", appsDir]);
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /GMS-PAY-001: pass requires at least one evidence_ref/);
    assert.equal(run(["report", app]).status, 1, "report refuses invalid input");
    assert.equal(run(["init", "acme-portal", "--apps-dir", appsDir]).status, 1, "init never overwrites");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("committed reports in this repository are current", () => {
  const result = run(["check"], fileURLToPath(new URL("../../..", import.meta.url)));
  assert.equal(result.status, 0, result.stderr + result.stdout);
});

test("v1 generate-report entry point still works", async () => {
  const dir = await mkdtemp(join(tmpdir(), "security-readiness-v1-"));
  try {
    const app = fileURLToPath(new URL("../apps/studigo/", import.meta.url));
    execFileSync(process.execPath, [fileURLToPath(new URL("./generate-report.mjs", import.meta.url)), join(app, "app-profile.json"), join(app, "audit-overrides.json"), dir], { stdio: "pipe" });
    const summary = JSON.parse(await readFile(join(dir, "security-summary.json"), "utf8"));
    assert.equal(summary.app_id, "studigo");
    assert.ok(actionsTable(assessApp(catalog, profile(), audit())).length > 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("templates and the intake prompt cover every capability flag", async () => {
  const root = new URL("../templates/", import.meta.url);
  const template = JSON.parse(await readFile(new URL("app-profile.template.json", root), "utf8"));
  assert.deepEqual(Object.keys(template.features), featureKeys);
  const prompt = await readFile(new URL("APP_IDEA_INTAKE_PROMPT.md", root), "utf8");
  for (const key of featureKeys) assert.ok(prompt.includes(`\`${key}\``), `intake prompt mentions ${key}`);
  const overrides = JSON.parse(await readFile(new URL("audit-overrides.template.json", root), "utf8"));
  const errors = validateApp(catalog, { ...template, app_id: "replace-me" }, { ...overrides, reviewed_at: "2026-10-07" }).errors;
  assert.deepEqual(errors, [], "the override template is itself valid");
});
