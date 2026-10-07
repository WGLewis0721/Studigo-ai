# Reusable Security Readiness Framework

This folder turns a product idea or an existing application into a **repeatable, evidence-backed security audit**.

It is intentionally not Studigo-specific. Studigo is the first implementation of the framework.

## Objective

Given an application profile, produce outputs that are:

- actionable by an engineer,
- traceable to documented security standards,
- explicit about what is known versus not tested,
- suitable for code review and release gating,
- machine-readable,
- easy to import into Excel, Power BI, Looker, Tableau, a ticketing system, or a custom dashboard.

The framework does **not** claim ASVS certification or replace a penetration test. It creates a consistent engineering control plane for deciding what must be tested, what failed, what blocks release, and what evidence closes each item.

## Inputs

1. **Application profile**
   - product purpose,
   - architecture/surfaces,
   - authentication,
   - tenancy,
   - uploads,
   - AI/RAG,
   - sensitive data,
   - minors,
   - external providers,
   - deployment model.

2. **Control catalog**
   - reusable controls derived from recognized security guidance.

3. **Audit overrides**
   - evidence-backed status for the current app,
   - findings,
   - remediation,
   - owner,
   - target date,
   - evidence and test references.

## Outputs

Running the generator produces:

```text
generated/
├── security-control-matrix.csv
├── security-summary.json
└── public-launch-gate.md
```

The CSV is the canonical dashboard/Excel handoff. The JSON is optimized for programmatic dashboards. The Markdown gate is optimized for humans making a release decision.

## Workflow for any app

For AI-assisted intake, start with:

- `templates/APP_IDEA_INTAKE_PROMPT.md` — converts an app idea, client brief, architecture, or repo into the standard app profile.
- `templates/SECURITY_AUDITOR_PROMPT.md` — converts code/config/test evidence into the standard audit override format.


```text
app idea / client brief
        ↓
copy app-profile.template.json
        ↓
mark capabilities yes / no / unknown
        ↓
generate baseline control matrix
        ↓
inspect architecture + code + infrastructure
        ↓
record evidence-backed audit overrides
        ↓
run security tests
        ↓
regenerate
        ↓
dashboard / Excel / tickets / release gate
        ↓
repeat on every material architecture change
```

Unknown is a first-class state. Early-stage ideas should not be forced into false precision.

## Status vocabulary

- `pass` — implementation and evidence satisfy the control.
- `partial` — some controls exist but the requirement is not fully satisfied or verified.
- `fail` — a known implementation gap violates the control.
- `not_tested` — applicable, but evidence has not been collected.
- `accepted_risk` — known gap explicitly accepted by the accountable owner.
- `not_applicable` — the application profile makes the control irrelevant.
- `needs_review` — applicability cannot be resolved because the product profile is still uncertain.

A control is never considered passed simply because documentation says it should exist.

## Severity vocabulary

- `P0` — public-release blocker; credible path to cross-tenant exposure, auth bypass, code execution, major AI abuse/cost exposure, sensitive-data compromise, or unsafe child-data handling.
- `P1` — high-priority hardening required for public production.
- `P2` — medium risk / defense-in-depth / operational maturity.
- `P3` — low-risk improvement.

## Evidence rule

Each `pass` should have at least one evidence reference and preferably one executable test reference.

Examples:

```text
evidence_refs:
- apps/web/lib/validation.ts
- supabase/migrations/2026...sql

test_refs:
- tests/database-security.test.mjs
- evals/rag/results/2026-10-reviewed.json
```

## Standards used

See `framework/STANDARDS.md`.

The baseline catalog draws from:

- OWASP ASVS 5.0
- OWASP API Security Top 10
- OWASP Top 10
- OWASP GenAI / LLM Top 10
- NIST AI RMF and NIST AI 600-1
- NIST SSDF SP 800-218
- OWASP File Upload, Logging, CSP and related cheat sheets
- platform-specific authorization guidance where applicable, such as Supabase RLS

## Commands

For Studigo:

```bash
pnpm security:report
```

For another application profile:

```bash
node implementation/security-readiness/scripts/generate-report.mjs \
  path/to/app-profile.json \
  path/to/audit-overrides.json \
  path/to/output-directory
```

The generator uses only Node built-ins so it can be copied into another repository with minimal friction.

## Reuse outside Studigo

The reusable pieces are:

```text
framework/
templates/
scripts/
DASHBOARD_DATA_DICTIONARY.md
```

The `studigo/` directory is only an example implementation. For a client or new product, create a sibling directory with that app's profile, audit overrides, and generated outputs.
