// Core model: load inputs, validate them, and assess one app against the catalog.
// Node built-ins only, so the folder can be copied into any repository.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const FRAMEWORK_DIR = fileURLToPath(new URL("../../framework/", import.meta.url));
export const DEFAULT_APPS_DIR = fileURLToPath(new URL("../../apps/", import.meta.url));

export const AUDIT_STATUSES = ["pass", "partial", "fail", "not_tested", "accepted_risk"];
export const SEVERITIES = ["P0", "P1", "P2", "P3"];
export const STAGES = ["idea", "prototype", "beta", "production"];
const FEATURE_VALUES = ["yes", "no", "unknown"];
const CLOSED = new Set(["pass", "accepted_risk", "not_applicable"]);
const STATUS_RANK = { fail: 0, partial: 1, not_tested: 2, needs_review: 3 };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const OVERRIDE_FIELDS = new Set(["status", "severity", "likelihood", "impact", "release_blocker", "finding", "remediation",
  "owner", "target_date", "ticket", "evidence_refs", "test_refs", "notes"]);

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

export async function loadCatalog(path = join(FRAMEWORK_DIR, "control-catalog.json")) {
  const catalog = await readJson(path);
  if (catalog.schema_version !== 2) throw new Error(`Unsupported catalog schema_version ${catalog.schema_version}; expected 2`);
  return catalog;
}

export async function loadApp(appDir) {
  const [profile, audit] = await Promise.all([
    readJson(join(appDir, "app-profile.json")),
    readJson(join(appDir, "audit-overrides.json"))
  ]);
  return { profile, audit };
}

const isDate = (value) => typeof value === "string" && DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** Returns { errors, warnings } as human-readable strings. Errors make a report untrustworthy. */
export function validateApp(catalog, profile, audit) {
  const errors = [];
  const warnings = [];
  const featureKeys = new Set(catalog.features.map((feature) => feature.key));
  const controls = new Map(catalog.controls.map((control) => [control.id, control]));

  if (profile.schema_version !== 1) errors.push(`app-profile: schema_version must be 1`);
  if (typeof profile.app_id !== "string" || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(profile.app_id)) {
    errors.push(`app-profile: app_id must be lowercase letters, digits and hyphens (got ${JSON.stringify(profile.app_id)})`);
  }
  if (typeof profile.name !== "string" || !profile.name.trim()) errors.push("app-profile: name is required");
  if (profile.stage !== undefined && !STAGES.includes(profile.stage)) errors.push(`app-profile: stage must be one of ${STAGES.join(", ")}`);
  for (const platform of profile.platforms ?? []) {
    if (!catalog.platforms.includes(platform)) warnings.push(`app-profile: platform "${platform}" has no guidance in the catalog`);
  }
  if (!profile.features || typeof profile.features !== "object") {
    errors.push("app-profile: features object is required");
  } else {
    for (const [key, value] of Object.entries(profile.features)) {
      if (!featureKeys.has(key)) warnings.push(`app-profile: unknown feature "${key}" is ignored`);
      if (!FEATURE_VALUES.includes(value)) errors.push(`app-profile: features.${key} must be yes, no or unknown`);
    }
    for (const key of featureKeys) {
      if (!(key in profile.features)) warnings.push(`app-profile: features.${key} is missing and treated as unknown`);
    }
  }

  if (audit.schema_version !== 1) errors.push("audit-overrides: schema_version must be 1");
  if (audit.app_id !== profile.app_id) errors.push(`audit-overrides: app_id "${audit.app_id}" does not match profile "${profile.app_id}"`);
  if (!isDate(audit.reviewed_at)) errors.push("audit-overrides: reviewed_at must be a YYYY-MM-DD date");
  const overrides = audit.overrides ?? {};
  if (typeof overrides !== "object" || Array.isArray(overrides)) errors.push("audit-overrides: overrides must be an object keyed by control ID");

  for (const [id, override] of Object.entries(overrides)) {
    const where = `audit-overrides: ${id}`;
    const control = controls.get(id);
    if (!control) { errors.push(`${where} is not a catalog control`); continue; }
    for (const field of Object.keys(override)) if (!OVERRIDE_FIELDS.has(field)) warnings.push(`${where}: unknown field "${field}" is ignored`);
    if (!AUDIT_STATUSES.includes(override.status)) errors.push(`${where}: status must be one of ${AUDIT_STATUSES.join(", ")}`);
    if (override.severity !== undefined && !SEVERITIES.includes(override.severity)) errors.push(`${where}: severity must be P0-P3`);
    for (const field of ["likelihood", "impact"]) {
      if (override[field] !== undefined && !(Number.isInteger(override[field]) && override[field] >= 1 && override[field] <= 5)) {
        errors.push(`${where}: ${field} must be an integer from 1 to 5`);
      }
    }
    if (override.release_blocker !== undefined && typeof override.release_blocker !== "boolean") errors.push(`${where}: release_blocker must be true or false`);
    if (override.target_date && !isDate(override.target_date)) errors.push(`${where}: target_date must be YYYY-MM-DD`);
    for (const field of ["evidence_refs", "test_refs"]) {
      if (override[field] !== undefined && !(Array.isArray(override[field]) && override[field].every((ref) => typeof ref === "string" && ref.trim()))) {
        errors.push(`${where}: ${field} must be a list of non-empty strings`);
      }
    }
    // Evidence rule: documentation alone never passes a control.
    if (override.status === "pass" && !(override.evidence_refs ?? []).length) errors.push(`${where}: pass requires at least one evidence_ref`);
    if (override.status === "pass" && !(override.test_refs ?? []).length) warnings.push(`${where}: pass has no test_refs; prefer executable verification`);
    if (override.status === "accepted_risk" && !(override.owner?.trim() && override.notes?.trim())) {
      errors.push(`${where}: accepted_risk requires an owner and a rationale in notes`);
    }
    if (["fail", "partial"].includes(override.status) && !override.finding?.trim()) warnings.push(`${where}: ${override.status} should state the finding`);
    if (override.severity && SEVERITIES.indexOf(override.severity) > SEVERITIES.indexOf(control.severity)) {
      warnings.push(`${where}: severity lowered from ${control.severity} to ${override.severity}; record why in notes`);
    }
    if (control.release_blocker && override.release_blocker === false) warnings.push(`${where}: release_blocker turned off for a catalog blocker; record why in notes`);
    if (profile.features && applicability(control, profile).state === "not_applicable") {
      warnings.push(`${where}: control is not applicable to this profile; the override is ignored`);
    }
  }
  return { errors, warnings };
}

/** Which capability flags make a control applicable, and the resulting state. */
export function applicability(control, profile) {
  const tags = control.applies_when_any;
  if (tags.includes("all")) return { state: "applicable", because: ["all"] };
  const value = (key) => profile.features?.[key] ?? "unknown";
  const yes = tags.filter((key) => value(key) === "yes");
  if (yes.length) return { state: "applicable", because: yes };
  const unknown = tags.filter((key) => value(key) === "unknown");
  if (unknown.length) return { state: "needs_review", because: unknown };
  return { state: "not_applicable", because: [] };
}

const severityRank = (severity) => SEVERITIES.indexOf(severity);

/** Assess one app. Deterministic: the only date used is the audit's reviewed_at (or asOf). */
export function assessApp(catalog, profile, audit, { asOf = audit.reviewed_at } = {}) {
  const platforms = profile.platforms ?? [];
  const rows = catalog.controls.map((control, order) => {
    const { state, because } = applicability(control, profile);
    const override = state === "not_applicable" ? {} : audit.overrides?.[control.id] ?? {};
    const status = state === "applicable" ? override.status ?? "not_tested" : state;
    const severity = override.severity ?? control.severity;
    const likelihood = override.likelihood ?? 0;
    const impact = override.impact ?? 0;
    const open = state !== "not_applicable" && !CLOSED.has(status);
    const blocker = state === "applicable" && (override.release_blocker ?? control.release_blocker);
    const evidenceRefs = override.evidence_refs ?? [];
    const testRefs = override.test_refs ?? [];
    return {
      order,
      app_id: profile.app_id,
      app_name: profile.name,
      client: profile.client ?? "",
      control_id: control.id,
      domain: control.domain,
      title: control.title,
      applicability: state,
      applies_because: because,
      status,
      severity,
      release_blocker: Boolean(blocker),
      open_blocker: Boolean(blocker) && open,
      is_open: open,
      owner_role: control.owner_role,
      owner: override.owner ?? "",
      effort: control.effort,
      likelihood,
      impact,
      risk_score: likelihood * impact,
      finding: override.finding ?? "",
      remediation: override.remediation || control.remediation_guidance,
      target_date: override.target_date ?? "",
      overdue: Boolean(open && override.target_date && asOf && override.target_date < asOf),
      ticket: override.ticket ?? "",
      evidence_refs: evidenceRefs,
      test_refs: testRefs,
      has_evidence: evidenceRefs.length > 0,
      has_test: testRefs.length > 0,
      requirement: control.requirement,
      acceptance_criteria: control.acceptance_criteria,
      verification_steps: control.verification_steps,
      test_method: control.test_method,
      evidence_expected: control.evidence_expected,
      standard_refs: control.standard_refs ?? [],
      frameworks: control.frameworks ?? [],
      platform_notes: platforms.filter((p) => control.platform_guidance?.[p]).map((p) => `${p}: ${control.platform_guidance[p]}`),
      last_reviewed: audit.reviewed_at,
      notes: override.notes ?? ""
    };
  });

  const unknownFeatures = catalog.features
    .filter((feature) => (profile.features?.[feature.key] ?? "unknown") === "unknown")
    .map((feature) => ({
      ...feature,
      controls: rows.filter((row) => row.applicability === "needs_review" && row.applies_because.includes(feature.key)).map((row) => row.control_id)
    }))
    .filter((feature) => feature.controls.length);

  const actions = buildActions(profile, rows, unknownFeatures);
  const summary = summarize(catalog, profile, audit, rows, unknownFeatures, actions, asOf);
  return { profile, rows, unknownFeatures, actions, summary };
}

const ACTION_TYPE = { fail: "remediate", partial: "complete", not_tested: "verify" };
const ACTION_VERB = { remediate: "Fix", complete: "Finish", verify: "Verify", design_in: "Design in" };

function buildActions(profile, rows, unknownFeatures) {
  // Scope decisions come first: each unknown capability changes which controls apply.
  const scope = unknownFeatures.map((feature) => ({
    action_type: "decide_scope",
    control_id: "",
    feature: feature.key,
    severity: rows.filter((row) => feature.controls.includes(row.control_id)).map((row) => row.severity).sort()[0] ?? "P3",
    release_blocker: false,
    owner_role: "Product",
    owner: profile.owner ?? "",
    effort: "S",
    status: "needs_review",
    risk_score: 0,
    target_date: "",
    ticket: "",
    title: `Answer scope question: ${feature.question}`,
    description: [
      `**Question:** ${feature.question}`,
      `**Meaning:** ${feature.meaning}`,
      `**Why it matters:** answering "yes" makes ${feature.controls.length} control(s) applicable: ${feature.controls.join(", ")}.`,
      `**Done when:** features.${feature.key} in app-profile.json is "yes" or "no" and the report is regenerated.`
    ].join("\n\n"),
    labels: ["security-readiness", "scope"]
  }));

  const work = rows
    .filter((row) => row.applicability === "applicable" && row.is_open)
    .sort((a, b) => Number(b.open_blocker) - Number(a.open_blocker)
      || severityRank(a.severity) - severityRank(b.severity)
      || STATUS_RANK[a.status] - STATUS_RANK[b.status]
      || b.risk_score - a.risk_score
      || a.order - b.order)
    .map((row) => {
      // At idea stage nothing exists to verify yet: untested controls are design requirements.
      const type = row.status === "not_tested" && profile.stage === "idea" ? "design_in" : ACTION_TYPE[row.status];
      return {
        action_type: type,
        control_id: row.control_id,
        feature: "",
        severity: row.severity,
        release_blocker: row.open_blocker,
        owner_role: row.owner_role,
        owner: row.owner,
        effort: row.effort,
        status: row.status,
        risk_score: row.risk_score,
        target_date: row.target_date,
        ticket: row.ticket,
        title: `[${row.severity}]${row.open_blocker ? "[Blocker]" : ""} ${ACTION_VERB[type]}: ${row.title}`,
        description: actionDescription(row),
        labels: ["security-readiness", row.domain.toLowerCase().replace(/[^a-z0-9]+/g, "-"), row.severity]
      };
    });

  return [...scope, ...work].map((action, index) => ({
    rank: index + 1,
    action_id: `${profile.app_id}:${action.control_id || `scope-${action.feature}`}`,
    app_id: profile.app_id,
    app_name: profile.name,
    client: profile.client ?? "",
    ...action
  }));
}

function actionDescription(row) {
  const parts = [];
  parts.push(`**Control:** ${row.control_id} (${row.domain}). Status: ${row.status}.`);
  if (row.finding) parts.push(`**Finding:** ${row.finding}`);
  parts.push(`**Requirement:** ${row.requirement}`);
  parts.push(`**Done when:**\n${row.acceptance_criteria.map((item) => `- [ ] ${item}`).join("\n")}`);
  parts.push(`**How to verify:**\n${row.verification_steps.map((item, index) => `${index + 1}. ${item}`).join("\n")}`);
  parts.push(`**Suggested fix:** ${row.remediation}`);
  if (row.platform_notes.length) parts.push(`**Platform notes:**\n${row.platform_notes.map((note) => `- ${note}`).join("\n")}`);
  if (row.evidence_refs.length || row.test_refs.length) {
    parts.push(`**Evidence so far:** ${[...row.evidence_refs, ...row.test_refs].join(", ")}`);
  }
  parts.push(`**Evidence required to close:** ${row.evidence_expected}`);
  if (row.standard_refs.length) parts.push(`**Standards:** ${row.standard_refs.join(", ")}`);
  return parts.join("\n\n");
}

function countBy(rows, key, values) {
  const counts = Object.fromEntries((values ?? []).map((value) => [value, 0]));
  for (const row of rows) counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  return counts;
}

function summarize(catalog, profile, audit, rows, unknownFeatures, actions, asOf) {
  const applicable = rows.filter((row) => row.applicability === "applicable");
  const open = applicable.filter((row) => row.is_open);
  const blockers = applicable.filter((row) => row.open_blocker);
  const needsReview = rows.filter((row) => row.applicability === "needs_review");
  const satisfied = applicable.filter((row) => ["pass", "accepted_risk"].includes(row.status)).length;
  const decision = blockers.length ? "not_ready" : needsReview.length ? "scope_incomplete" : "ready";
  return {
    schema_version: 2,
    app_id: profile.app_id,
    app_name: profile.name,
    client: profile.client ?? "",
    stage: profile.stage ?? "",
    catalog_version: catalog.catalog_version,
    reviewed_at: audit.reviewed_at,
    as_of: asOf,
    decision,
    public_release_ready: decision === "ready",
    scope_complete: needsReview.length === 0,
    total_controls: rows.length,
    applicable_controls: applicable.length,
    needs_review: needsReview.length,
    not_applicable: rows.filter((row) => row.applicability === "not_applicable").length,
    readiness_pct: applicable.length ? Math.round((satisfied / applicable.length) * 100) : 0,
    release_blockers_open: blockers.length,
    status_counts: countBy(rows, "status", ["pass", "partial", "fail", "not_tested", "accepted_risk", "needs_review", "not_applicable"]),
    open_by_severity: countBy(open, "severity", SEVERITIES),
    open_by_owner_role: countBy(open, "owner_role", Object.keys(catalog.owner_roles)),
    open_by_domain: countBy(open, "domain"),
    overdue: open.filter((row) => row.overdue).length,
    pass_without_test: applicable.filter((row) => row.status === "pass" && !row.has_test).length,
    open_without_owner: open.filter((row) => !row.owner).length,
    scope_questions: unknownFeatures.map((feature) => feature.key),
    blockers: blockers.map((row) => ({ control_id: row.control_id, title: row.title, severity: row.severity, status: row.status, owner_role: row.owner_role })),
    highest_risk_open: open.filter((row) => row.risk_score > 0).sort((a, b) => b.risk_score - a.risk_score || a.order - b.order).slice(0, 10)
      .map((row) => ({ control_id: row.control_id, title: row.title, severity: row.severity, risk_score: row.risk_score, status: row.status })),
    next_actions: actions.slice(0, 10).map((action) => ({ rank: action.rank, action_id: action.action_id, title: action.title, owner_role: action.owner_role }))
  };
}
