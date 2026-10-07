# Security Readiness Implementation Plan

## Goal

Turn security review from a one-off document into a reusable engineering system that can start from either:

- a rough app idea,
- a client brief,
- an existing repository,
- or a production application.

## Phase 1 — Standardize intake

Use `templates/app-profile.template.json`.

The profile captures architecture-relevant facts as `yes`, `no`, or `unknown`. Unknown capability decisions remain visible rather than being silently assumed.

**Exit:** a machine-readable app profile exists.

## Phase 2 — Generate applicable controls

The generator maps the profile to the reusable control catalog.

- `yes` capability -> matching controls are applicable.
- `unknown` capability -> matching controls require review.
- `no` capability -> controls are not applicable unless another capability activates them.
- `all` controls always apply.

**Exit:** every catalog control has an explicit applicability decision.

## Phase 3 — Evidence-driven audit

Inspect:

- source code,
- infrastructure,
- IAM/RLS/policies,
- CI/CD,
- provider configuration,
- storage,
- API boundaries,
- AI/RAG pipelines,
- logs/telemetry,
- deletion/retention,
- tests.

Record findings in the audit override file.

**Exit:** important findings have status, severity, remediation and evidence.

## Phase 4 — Adversarial verification

Turn high-risk findings into executable tests where practical.

Examples:

- cross-tenant UUID substitution,
- prompt injection embedded in source material,
- forged resource IDs,
- replayed interaction IDs,
- CSRF attempts,
- malformed/polyglot upload,
- decompression bomb,
- excessive OCR/model calls,
- XSS/model-output payload,
- stale/deleted vector retrieval,
- failed worker/retry recovery.

**Exit:** P0/P1 controls have executable verification or a documented reason why testing must be external/manual.

## Phase 5 — Release gate

A public release must not proceed while:

- any P0 applicable control is `fail`, `partial`, or `not_tested`,
- a P1 release-blocker is unresolved,
- cross-tenant isolation is unverified,
- privileged service paths have not been scoped,
- sensitive data flows are undocumented,
- AI/resource-abuse limits are absent where expensive AI operations are public.

Accepted risk requires an explicit owner and rationale.

## Phase 6 — Operationalize

Feed `security-control-matrix.csv` into:

- Excel,
- Power BI,
- Looker/Tableau,
- Jira/Linear,
- a custom security dashboard.

Recommended dashboard cards:

- release blockers,
- P0/P1 open findings,
- status by domain,
- controls without evidence,
- overdue remediation,
- controls by framework,
- last-reviewed age,
- risk-score trend,
- app-to-app comparison for a consultancy/client portfolio.

## Phase 7 — Re-audit on change

Re-run applicability and affected controls when the application changes materially:

- new auth provider,
- public API,
- file upload,
- payment processing,
- AI model/provider,
- RAG/vector store,
- agent/tool execution,
- minors/student data,
- external integration,
- new deployment surface,
- admin/operator console.

Security readiness is a maintained state, not a launch-time document.
