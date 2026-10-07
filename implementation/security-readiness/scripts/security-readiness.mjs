#!/usr/bin/env node
// Security readiness CLI. Node 20+ built-ins only.
//
//   init <app-id> --name "App" [--client C] [--stage idea] [--platforms a,b]
//   validate [<app-dir>... | --all]
//   report   [<app-dir>... | --all] [--out <dir>]
//   portfolio [--out <dir>] [--as-of YYYY-MM-DD]
//   check    validate + verify every generated file is current (for CI)
//
// Common option: --apps-dir <dir> (default: ../apps next to this script).
import { mkdir, readFile, readdir, writeFile, access } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { DEFAULT_APPS_DIR, STAGES, assessApp, loadApp, loadCatalog, validateApp } from "./lib/model.mjs";
import {
  ACTION_COLUMNS, EVIDENCE_COLUMNS, actionsTable, assessmentTable, controlsTable, domainsTable, evidenceTable, gateMarkdown, intakeQuestionsMarkdown,
  portfolioAppsTable, portfolioMarkdown, scopeTable, summaryTable, toCsv
} from "./lib/outputs.mjs";
import { buildWorkbook, readZipEntries } from "./lib/xlsx.mjs";

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) { positional.push(arg); continue; }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) options[key] = true;
    else { options[key] = next; i++; }
  }
  return { positional, options };
}

const exists = (path) => access(path).then(() => true, () => false);
const today = () => new Date().toISOString().slice(0, 10);

async function discoverApps(appsDir) {
  const entries = await readdir(appsDir, { withFileTypes: true }).catch(() => []);
  const dirs = [];
  for (const entry of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    if (await exists(join(appsDir, entry.name, "app-profile.json"))) dirs.push(join(appsDir, entry.name));
  }
  return dirs;
}

async function targetApps(positional, options) {
  const appsDir = resolve(options["apps-dir"] ?? DEFAULT_APPS_DIR);
  if (options.all || !positional.length) {
    const dirs = await discoverApps(appsDir);
    if (!dirs.length) throw new Error(`No apps found in ${appsDir}. Run: init <app-id> --name "App"`);
    return dirs;
  }
  return positional.map((dir) => resolve(dir));
}

function printIssues(appDir, { errors, warnings }) {
  const label = relative(process.cwd(), appDir) || appDir;
  for (const message of errors) console.error(`ERROR   ${label}: ${message}`);
  for (const message of warnings) console.warn(`warning ${label}: ${message}`);
}

/** Every output for one app, as { relative path: string | Buffer }. */
function appOutputs(catalog, assessment) {
  const matrix = assessmentTable(assessment);
  const actions = actionsTable(assessment);
  const evidence = evidenceTable(assessment);
  const domains = domainsTable(assessment);
  const scope = scopeTable(catalog, assessment);
  return {
    "security-control-matrix.csv": toCsv(matrix),
    "actions.csv": toCsv(actions, ACTION_COLUMNS),
    "evidence.csv": toCsv(evidence, EVIDENCE_COLUMNS),
    "domains.csv": toCsv(domains),
    "scope.csv": toCsv(scope),
    "security-summary.json": JSON.stringify(assessment.summary, null, 2) + "\n",
    "public-launch-gate.md": gateMarkdown(catalog, assessment),
    "intake-questions.md": intakeQuestionsMarkdown(catalog, assessment.profile),
    "security-readiness.xlsx": buildWorkbook([
      { name: "Summary", rows: summaryTable(assessment) },
      { name: "Actions", rows: actions, columns: ACTION_COLUMNS },
      { name: "Assessment", rows: matrix },
      { name: "Domains", rows: domains },
      { name: "Scope", rows: scope },
      { name: "Evidence", rows: evidence, columns: EVIDENCE_COLUMNS },
      { name: "Controls", rows: controlsTable(catalog) }
    ])
  };
}

function portfolioOutputs(catalog, assessments, asOf) {
  const apps = portfolioAppsTable(assessments);
  const actions = assessments.flatMap((a) => actionsTable(a));
  const matrix = assessments.flatMap((a) => assessmentTable(a));
  const domains = assessments.flatMap((a) => domainsTable(a));
  const evidence = assessments.flatMap((a) => evidenceTable(a));
  const controls = controlsTable(catalog);
  return {
    "portfolio-apps.csv": toCsv(apps),
    "portfolio-actions.csv": toCsv(actions, ACTION_COLUMNS),
    "portfolio-assessment.csv": toCsv(matrix),
    "portfolio-domains.csv": toCsv(domains),
    "portfolio-evidence.csv": toCsv(evidence, EVIDENCE_COLUMNS),
    "controls.csv": toCsv(controls),
    "portfolio-summary.json": JSON.stringify({ schema_version: 2, as_of: asOf, catalog_version: catalog.catalog_version,
      apps: assessments.map((a) => a.summary) }, null, 2) + "\n",
    "PORTFOLIO.md": portfolioMarkdown(assessments, asOf),
    "portfolio.xlsx": buildWorkbook([
      { name: "Apps", rows: apps },
      { name: "Actions", rows: actions, columns: ACTION_COLUMNS },
      { name: "Assessment", rows: matrix },
      { name: "Domains", rows: domains },
      { name: "Evidence", rows: evidence, columns: EVIDENCE_COLUMNS },
      { name: "Controls", rows: controls }
    ])
  };
}

/** XLSX bytes depend on the zlib build; compare the uncompressed parts instead. */
function sameContent(name, current, next) {
  if (!name.endsWith(".xlsx")) return current.toString("utf8") === next.toString();
  try {
    const a = readZipEntries(current);
    const b = readZipEntries(next);
    return a.size === b.size && [...a].every(([key, value]) => b.get(key)?.equals(value));
  } catch { return false; }
}

async function writeOutputs(outDir, outputs, { check }) {
  const stale = [];
  if (!check) await mkdir(outDir, { recursive: true });
  for (const [name, content] of Object.entries(outputs)) {
    const path = join(outDir, name);
    if (check) {
      const current = await readFile(path).catch(() => null);
      if (!current || !sameContent(name, current, content)) stale.push(path);
    } else {
      await writeFile(path, content);
    }
  }
  return stale;
}

async function assessDir(catalog, appDir, { strict }) {
  const { profile, audit } = await loadApp(appDir);
  const issues = validateApp(catalog, profile, audit);
  printIssues(appDir, issues);
  if (issues.errors.length && strict) throw new Error(`${basename(appDir)}: fix validation errors before reporting`);
  return { assessment: assessApp(catalog, profile, audit), issues };
}

async function cmdInit(catalog, positional, options) {
  const appId = positional[0];
  if (!appId || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(appId)) throw new Error("Usage: init <app-id> --name \"App name\" (app-id: lowercase letters, digits, hyphens)");
  const appDir = join(resolve(options["apps-dir"] ?? DEFAULT_APPS_DIR), appId);
  if (await exists(join(appDir, "app-profile.json"))) throw new Error(`${appDir} already exists; edit its files instead`);
  const stage = options.stage ?? "idea";
  if (!STAGES.includes(stage)) throw new Error(`--stage must be one of ${STAGES.join(", ")}`);
  const profile = {
    schema_version: 1,
    app_id: appId,
    name: typeof options.name === "string" ? options.name : appId,
    description: typeof options.description === "string" ? options.description : "",
    client: typeof options.client === "string" ? options.client : "",
    owner: typeof options.owner === "string" ? options.owner : "",
    stage,
    platforms: typeof options.platforms === "string" ? options.platforms.split(",").map((p) => p.trim()).filter(Boolean) : [],
    environments: ["development", "production"],
    features: Object.fromEntries(catalog.features.map((feature) => [feature.key, "unknown"])),
    data_notes: [],
    deployment_notes: [],
    assumptions: []
  };
  const audit = { schema_version: 1, app_id: appId, reviewed_at: typeof options.date === "string" ? options.date : today(), reviewer: "", overrides: {} };
  await mkdir(appDir, { recursive: true });
  await writeFile(join(appDir, "app-profile.json"), JSON.stringify(profile, null, 2) + "\n");
  await writeFile(join(appDir, "audit-overrides.json"), JSON.stringify(audit, null, 2) + "\n");
  const { assessment } = await assessDir(catalog, appDir, { strict: true });
  await writeOutputs(join(appDir, "generated"), appOutputs(catalog, assessment), { check: false });
  console.log(`Created ${relative(process.cwd(), appDir)}.
Next:
  1. Answer the questions in generated/intake-questions.md by editing app-profile.json (yes / no / unknown).
  2. Record evidence-backed findings in audit-overrides.json (see templates/SECURITY_AUDITOR_PROMPT.md).
  3. Re-run: report ${relative(process.cwd(), appDir)}`);
}

async function cmdValidate(catalog, positional, options) {
  let failed = false;
  for (const appDir of await targetApps(positional, options)) {
    const { profile, audit } = await loadApp(appDir);
    const issues = validateApp(catalog, profile, audit);
    printIssues(appDir, issues);
    if (issues.errors.length) failed = true;
    else console.log(`ok      ${relative(process.cwd(), appDir) || appDir} (${issues.warnings.length} warning(s))`);
  }
  if (failed) process.exitCode = 1;
}

async function cmdReport(catalog, positional, options, { check = false } = {}) {
  const stale = [];
  for (const appDir of await targetApps(positional, options)) {
    const { assessment } = await assessDir(catalog, appDir, { strict: true });
    const outDir = options.out && !options.all && positional.length === 1 ? resolve(options.out) : join(appDir, "generated");
    stale.push(...await writeOutputs(outDir, appOutputs(catalog, assessment), { check }));
    if (!check) {
      const s = assessment.summary;
      console.log(`${s.app_id}: ${s.decision} | blockers ${s.release_blockers_open} | P0 open ${s.open_by_severity.P0} | scope questions ${s.scope_questions.length} | readiness ${s.readiness_pct}% -> ${relative(process.cwd(), outDir)}`);
    }
  }
  return stale;
}

async function cmdPortfolio(catalog, options, { check = false } = {}) {
  const appsDir = resolve(options["apps-dir"] ?? DEFAULT_APPS_DIR);
  const apps = [];
  for (const appDir of await discoverApps(appsDir)) {
    const { profile, audit } = await loadApp(appDir);
    const issues = validateApp(catalog, profile, audit);
    printIssues(appDir, issues);
    if (issues.errors.length) throw new Error(`${basename(appDir)}: fix validation errors before building the portfolio`);
    apps.push({ profile, audit });
  }
  if (!apps.length) throw new Error(`No apps found in ${appsDir}`);
  // Deterministic by default: the latest review date across apps.
  const asOf = typeof options["as-of"] === "string" ? options["as-of"] : apps.map(({ audit }) => audit.reviewed_at).sort().at(-1);
  const assessments = apps.map(({ profile, audit }) => assessApp(catalog, profile, audit, { asOf }));
  const outDir = resolve(options.out ?? join(appsDir, "..", "portfolio"));
  const stale = await writeOutputs(outDir, portfolioOutputs(catalog, assessments, asOf), { check });
  if (!check) console.log(`portfolio: ${assessments.length} app(s) as of ${asOf} -> ${relative(process.cwd(), outDir)}`);
  return stale;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positional, options } = parseArgs(rest);
  const catalog = await loadCatalog(options.catalog ? resolve(options.catalog) : undefined);
  switch (command) {
    case "init": return cmdInit(catalog, positional, options);
    case "validate": return cmdValidate(catalog, positional, options);
    case "report": await cmdReport(catalog, positional, options); return;
    case "portfolio": await cmdPortfolio(catalog, options); return;
    case "check": {
      await cmdValidate(catalog, [], options);
      if (process.exitCode) return;
      const stale = [...await cmdReport(catalog, [], { ...options, all: true }, { check: true }), ...await cmdPortfolio(catalog, options, { check: true })];
      if (stale.length) {
        for (const path of stale) console.error(`stale   ${relative(process.cwd(), path)}`);
        console.error("Generated files are out of date. Run: report --all && portfolio");
        process.exitCode = 1;
      } else console.log("All generated security-readiness files are current.");
      return;
    }
    default:
      console.log(`Usage: security-readiness <init|validate|report|portfolio|check> [options]
  init <app-id> --name "App" [--client C] [--stage idea|prototype|beta|production] [--platforms supabase,vercel]
  validate [<app-dir>... | --all]
  report [<app-dir>... | --all] [--out <dir>]
  portfolio [--out <dir>] [--as-of YYYY-MM-DD]
  check
Options: --apps-dir <dir>  --catalog <path>`);
      if (command) process.exitCode = 1;
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
