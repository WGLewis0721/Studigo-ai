// Turns an assessment into flat tables (CSV/XLSX) and human documents (Markdown).
// Table columns are the contract documented in DASHBOARD_DATA_DICTIONARY.md.

const list = (values) => values.join("|");
const lines = (values) => values.join("\n");

/** Catalog dimension table: one row per control. */
export function controlsTable(catalog) {
  return catalog.controls.map((control) => ({
    control_id: control.id,
    domain: control.domain,
    title: control.title,
    severity: control.severity,
    release_blocker: control.release_blocker,
    owner_role: control.owner_role,
    effort: control.effort,
    applies_when_any: list(control.applies_when_any),
    standard_refs: list(control.standard_refs ?? []),
    frameworks: list(control.frameworks ?? []),
    requirement: control.requirement,
    acceptance_criteria: lines(control.acceptance_criteria),
    verification_steps: lines(control.verification_steps),
    test_method: control.test_method,
    evidence_expected: control.evidence_expected,
    remediation_guidance: control.remediation_guidance
  }));
}

/** Fact table: one row per app x control. Column order keeps the v1 matrix columns first. */
export function assessmentTable(assessment) {
  return assessment.rows.map((row) => ({
    app_id: row.app_id,
    app_name: row.app_name,
    control_id: row.control_id,
    domain: row.domain,
    title: row.title,
    frameworks: list(row.frameworks),
    applicability: row.applicability,
    status: row.status,
    severity: row.severity,
    likelihood: row.likelihood,
    impact: row.impact,
    risk_score: row.risk_score,
    release_blocker: row.release_blocker,
    requirement: row.requirement,
    test_method: row.test_method,
    evidence_expected: row.evidence_expected,
    finding: row.finding,
    remediation: row.remediation,
    owner: row.owner,
    target_date: row.target_date,
    evidence_refs: list(row.evidence_refs),
    test_refs: list(row.test_refs),
    last_reviewed: row.last_reviewed,
    notes: row.notes,
    client: row.client,
    applies_because: list(row.applies_because),
    is_open: row.is_open,
    open_blocker: row.open_blocker,
    owner_role: row.owner_role,
    effort: row.effort,
    overdue: row.overdue,
    ticket: row.ticket,
    evidence_count: row.evidence_refs.length,
    test_count: row.test_refs.length,
    standard_refs: list(row.standard_refs),
    acceptance_criteria: lines(row.acceptance_criteria)
  }));
}

export const ACTION_COLUMNS = ["rank", "action_id", "app_id", "app_name", "client", "action_type", "control_id", "feature", "severity",
  "release_blocker", "status", "owner_role", "owner", "effort", "risk_score", "target_date", "ticket", "title", "description", "labels"];
export const EVIDENCE_COLUMNS = ["app_id", "control_id", "status", "kind", "ref"];

/** Ranked backlog: ticket-ready rows for Jira/Linear/GitHub import. Columns: ACTION_COLUMNS. */
export function actionsTable(assessment) {
  return assessment.actions.map((action) => ({
    rank: action.rank,
    action_id: action.action_id,
    app_id: action.app_id,
    app_name: action.app_name,
    client: action.client,
    action_type: action.action_type,
    control_id: action.control_id,
    feature: action.feature,
    severity: action.severity,
    release_blocker: action.release_blocker,
    status: action.status,
    owner_role: action.owner_role,
    owner: action.owner,
    effort: action.effort,
    risk_score: action.risk_score,
    target_date: action.target_date,
    ticket: action.ticket,
    title: action.title,
    description: action.description,
    labels: list(action.labels)
  }));
}

/** Long table: one row per evidence or test reference. */
export function evidenceTable(assessment) {
  return assessment.rows.flatMap((row) => [
    ...row.evidence_refs.map((ref) => ({ app_id: row.app_id, control_id: row.control_id, status: row.status, kind: "evidence", ref })),
    ...row.test_refs.map((ref) => ({ app_id: row.app_id, control_id: row.control_id, status: row.status, kind: "test", ref }))
  ]);
}

const STATUS_COLUMNS = ["pass", "partial", "fail", "not_tested", "accepted_risk", "needs_review", "not_applicable"];

/** One row per app x domain. */
export function domainsTable(assessment) {
  const domains = [...new Set(assessment.rows.map((row) => row.domain))];
  return domains.map((domain) => {
    const rows = assessment.rows.filter((row) => row.domain === domain);
    const applicable = rows.filter((row) => row.applicability === "applicable");
    const satisfied = applicable.filter((row) => ["pass", "accepted_risk"].includes(row.status)).length;
    return {
      app_id: assessment.profile.app_id,
      domain,
      controls: rows.length,
      applicable: applicable.length,
      ...Object.fromEntries(STATUS_COLUMNS.map((status) => [status, rows.filter((row) => row.status === status).length])),
      open_blockers: rows.filter((row) => row.open_blocker).length,
      p0_open: rows.filter((row) => row.is_open && row.severity === "P0" && row.applicability === "applicable").length,
      readiness_pct: applicable.length ? Math.round((satisfied / applicable.length) * 100) : 0
    };
  });
}

/** One row per capability flag: the scope answers and what each activates. */
export function scopeTable(catalog, assessment) {
  return catalog.features.map((feature) => ({
    app_id: assessment.profile.app_id,
    feature: feature.key,
    answer: assessment.profile.features?.[feature.key] ?? "unknown",
    question: feature.question,
    controls_activated: list(catalog.controls.filter((control) => control.applies_when_any.includes(feature.key)).map((control) => control.id))
  }));
}

export function summaryTable(assessment) {
  const s = assessment.summary;
  return [
    ["App", `${s.app_name} (${s.app_id})`], ["Client", s.client], ["Stage", s.stage], ["Reviewed", s.reviewed_at],
    ["Catalog version", s.catalog_version], ["Decision", s.decision], ["Readiness %", s.readiness_pct],
    ["Open release blockers", s.release_blockers_open], ["Open P0", s.open_by_severity.P0], ["Open P1", s.open_by_severity.P1],
    ["Scope questions", s.scope_questions.length], ["Applicable controls", s.applicable_controls],
    ["Overdue", s.overdue], ["Open without owner", s.open_without_owner], ["Pass without test", s.pass_without_test]
  ].map(([metric, value]) => ({ metric, value }));
}

const csvCell = (value) => {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function toCsv(rows, columns = Object.keys(rows[0] ?? {})) {
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n") + "\n";
}

const DECISION_TEXT = {
  not_ready: "NOT READY FOR UNRESTRICTED PUBLIC RELEASE",
  scope_incomplete: "SCOPE INCOMPLETE: ANSWER THE SCOPE QUESTIONS, THEN RE-ASSESS",
  ready: "READY FROM THE RECORDED CONTROL STATE"
};

/** The human release decision. Everything here is derived from the tables above. */
export function gateMarkdown(catalog, assessment) {
  const s = assessment.summary;
  const out = [
    "# Public Launch Security Gate", "",
    `Application: **${s.app_name}** (\`${s.app_id}\`)${s.client ? ` · Client: ${s.client}` : ""}${s.stage ? ` · Stage: ${s.stage}` : ""}`, "",
    `Reviewed **${s.reviewed_at}** against catalog **${s.catalog_version}**. Generated by \`security-readiness report\`; do not edit by hand.`, "",
    `## Decision: ${DECISION_TEXT[s.decision]}`, "",
    "| Measure | Value |", "|---|---|",
    `| Open release blockers | **${s.release_blockers_open}** |`,
    `| Open P0 / P1 | ${s.open_by_severity.P0} / ${s.open_by_severity.P1} |`,
    `| Readiness (pass or accepted risk / applicable) | ${s.readiness_pct}% of ${s.applicable_controls} |`,
    `| Unanswered scope questions | ${s.scope_questions.length} (${s.needs_review} controls pending) |`,
    `| Open items without an owner | ${s.open_without_owner} |`,
    `| Overdue | ${s.overdue} |`, "",
    "A blocker closes only with `pass` (with evidence) or `accepted_risk` (with a named owner and rationale).", ""
  ];
  if (s.stage === "idea") {
    out.push("At idea stage every applicable control starts `not_tested`. Treat them as design requirements: build them in, then record evidence as the app is built.", "");
  }

  const byRole = Object.entries(s.open_by_owner_role).filter(([, count]) => count);
  if (byRole.length) {
    out.push("## Open work by owner role", "", "| Owner role | Open controls |", "|---|---|", ...byRole.map(([role, count]) => `| ${role} | ${count} |`), "");
  }

  if (assessment.unknownFeatures.length) {
    out.push("## Scope questions", "", "Answer these in `app-profile.json`. Each answer decides whether the listed controls apply.", "");
    for (const feature of assessment.unknownFeatures) out.push(`- **${feature.key}**: ${feature.question} _(activates ${feature.controls.join(", ")})_`);
    out.push("");
  }

  const blockers = assessment.rows.filter((row) => row.open_blocker)
    .sort((a, b) => a.severity.localeCompare(b.severity) || b.risk_score - a.risk_score || a.order - b.order);
  out.push("## Open release blockers", "");
  if (!blockers.length) out.push("- None recorded.", "");
  for (const row of blockers) {
    out.push(`### ${row.control_id}: ${row.title}`, "");
    out.push(`- Severity **${row.severity}**, status **${row.status}**, risk ${row.risk_score || "not scored"}, owner role ${row.owner_role}${row.owner ? ` (${row.owner})` : ""}, effort ${row.effort}`);
    if (row.finding) out.push(`- Finding: ${row.finding}`);
    out.push(`- Action: ${row.remediation}`);
    out.push(`- Done when: ${row.acceptance_criteria.join(" ")}`);
    if (row.evidence_refs.length) out.push(`- Evidence: ${row.evidence_refs.join(", ")}`);
    out.push("");
  }

  out.push("## Next actions", "", "Full ranked backlog with ticket-ready descriptions: `actions.csv` or the Actions sheet.", "",
    "| # | Action | Owner role | Effort |", "|---|---|---|---|",
    ...assessment.actions.slice(0, 15).map((action) => `| ${action.rank} | ${action.title.replaceAll("|", "\\|")} | ${action.owner_role} | ${action.effort} |`), "");
  out.push("## Rule", "", "Do not mark a control `pass` because it is documented. Record implementation evidence and, where practical, an executable test.", "");
  return out.join("\n");
}

/** Interview sheet for an app at idea stage, or any app with unknown capabilities. */
export function intakeQuestionsMarkdown(catalog, profile) {
  const out = [
    `# Intake questions: ${profile.name}`, "",
    "Answer each question with **yes**, **no** or **unknown** in `app-profile.json` under `features`.",
    "Unknown is allowed. It keeps the affected controls in `needs_review` and shows up as a scope action until answered.", "",
    "| # | Feature key | Question | Current answer | Controls it activates |", "|---|---|---|---|---|"
  ];
  catalog.features.forEach((feature, index) => {
    const controls = catalog.controls.filter((control) => control.applies_when_any.includes(feature.key)).map((control) => control.id);
    out.push(`| ${index + 1} | \`${feature.key}\` | ${feature.question} | ${profile.features?.[feature.key] ?? "unknown"} | ${controls.join(", ")} |`);
  });
  out.push("", "Also record, in the profile:", "", "- `platforms`: hosting/backend/AI/payment platforms in use (" + catalog.platforms.join(", ") + ") to get platform-specific guidance.",
    "- `data_notes`: each kind of personal or sensitive data.", "- `deployment_notes`: where it runs and which providers receive data.", "- `assumptions`: anything you assumed rather than confirmed.", "");
  return out.join("\n");
}

/** Portfolio: one row per app. */
export function portfolioAppsTable(assessments) {
  return assessments.map(({ summary: s }) => ({
    app_id: s.app_id, app_name: s.app_name, client: s.client, stage: s.stage, reviewed_at: s.reviewed_at,
    decision: s.decision, readiness_pct: s.readiness_pct, release_blockers_open: s.release_blockers_open,
    p0_open: s.open_by_severity.P0, p1_open: s.open_by_severity.P1, scope_questions: s.scope_questions.length,
    applicable_controls: s.applicable_controls, overdue: s.overdue, open_without_owner: s.open_without_owner,
    catalog_version: s.catalog_version
  }));
}

export function portfolioMarkdown(assessments, asOf) {
  const out = ["# Security Readiness Portfolio", "", `As of **${asOf}**. Generated by \`security-readiness portfolio\`; do not edit by hand.`, "",
    "| App | Client | Stage | Decision | Readiness | Open blockers | Open P0 | Scope questions | Reviewed |", "|---|---|---|---|---|---|---|---|---|"];
  for (const { summary: s } of assessments) {
    out.push(`| ${s.app_name} (\`${s.app_id}\`) | ${s.client} | ${s.stage} | ${s.decision} | ${s.readiness_pct}% | ${s.release_blockers_open} | ${s.open_by_severity.P0} | ${s.scope_questions.length} | ${s.reviewed_at} |`);
  }
  out.push("", "Ranked work across apps: `portfolio-actions.csv` or the Actions sheet in `portfolio.xlsx`.", "");
  return out.join("\n");
}
