# Security Readiness Framework

Turns any app idea, client brief, repository or production app into the same **evidence-backed security assessment**: a ranked, ticket-ready backlog, a release decision, and flat tables for Excel, BI dashboards and trackers.

It is not Studigo-specific. Studigo (`apps/studigo/`) is the first real assessment, and `apps/example-tutor-marketplace/` shows the same process starting from a two-sentence idea.

The framework does not claim certification and does not replace a penetration test. It records what must be true, what is known, what is not yet tested, and what evidence closes each item.

## Quickstart

Requires Node 20+. No dependencies. From the repository root:

```bash
pnpm security init acme-portal --name "Acme Portal" --client "Acme" --stage idea --platforms supabase,vercel
# 1. Answer apps/acme-portal/generated/intake-questions.md in apps/acme-portal/app-profile.json
# 2. Record findings in apps/acme-portal/audit-overrides.json
pnpm security:report        # regenerate every app + the portfolio
pnpm security:check         # CI: inputs valid and generated files current
```

Outside this repository, copy the `implementation/security-readiness/` folder and run `node scripts/security-readiness.mjs <command>`.

| Command | What it does |
|---|---|
| `init <app-id> --name "App" [--client C] [--stage idea\|prototype\|beta\|production] [--platforms a,b]` | Creates `apps/<app-id>/` with an all-unknown profile, an empty audit and a first report. Never overwrites. |
| `validate [<app-dir>... \| --all]` | Checks both input files against the catalog and the evidence rules. Exit code 1 on errors. |
| `report [<app-dir>... \| --all] [--out <dir>]` | Validates, assesses and writes `generated/` for each app. |
| `portfolio [--as-of YYYY-MM-DD] [--out <dir>]` | Rolls every app in `apps/` into `portfolio/`. |
| `check` | `validate --all`, then fails if any generated file is stale. Runs in `pnpm test`. |

## How it works

```text
idea / brief / repo / production app
        │
        ▼
app-profile.json ── 23 capability flags: yes / no / unknown ──► which controls apply
        │                                                       (unknown → needs_review → scope question)
        ▼
audit-overrides.json ── per control: status, finding, evidence, tests, owner, dates
        │
        ▼
security-readiness report  (control-catalog.json: 49 controls)
        │
        ├── public-launch-gate.md     decision: not_ready | scope_incomplete | ready
        ├── actions.csv               ranked backlog, ticket-ready
        ├── security-control-matrix.csv, domains.csv, scope.csv, evidence.csv
        ├── security-summary.json
        ├── security-readiness.xlsx   all of the above as sheets
        └── intake-questions.md
```

1. **Intake.** Answer each capability question with `yes`, `no` or `unknown`. Unknown is allowed and visible: it keeps the affected controls in `needs_review` and puts a scope question at the top of the backlog. Use `templates/APP_IDEA_INTAKE_PROMPT.md` to have a model draft the profile from a brief or repository.
2. **Applicability.** A control applies when any capability in its `applies_when_any` is `yes`, or when it applies to `all`.
3. **Audit.** For each applicable control, record a status with evidence in `audit-overrides.json`. Use `templates/SECURITY_AUDITOR_PROMPT.md` to have a model draft overrides from code and configuration; a human reviews them. Controls you have not recorded are `not_tested`.
4. **Report.** The generator ranks work, decides the release state and writes the outputs. At `stage: idea`, untested controls become "Design in" actions: requirements to build in, not failures.
5. **Repeat** on every material change (new auth provider, upload type, AI provider, payments, admin surface, minors, new service). Re-answer the profile, update overrides, regenerate.

## Release decision

| Decision | Meaning |
|---|---|
| `not_ready` | At least one applicable release-blocker control is not `pass` or `accepted_risk`. |
| `scope_incomplete` | No open blockers, but unknown capabilities leave controls in `needs_review`. |
| `ready` | Every applicable blocker is closed and the scope is fully answered. |

A blocker closes only with `pass` (with at least one evidence reference) or `accepted_risk` (with a named owner and a rationale). The validator enforces both.

## Status, severity, owner roles, effort

Definitions live in `framework/control-catalog.json` (`statuses`, `severities`, `owner_roles`, `efforts`) so every tool reads the same vocabulary.

- **Status:** `pass`, `partial`, `fail`, `not_tested`, `accepted_risk` (recorded), plus `needs_review` and `not_applicable` (derived from the profile).
- **Severity:** `P0` public-release blocker, `P1` high-priority hardening, `P2` defense in depth, `P3` low.
- **Owner role:** Engineering, Platform/Ops, Security, Legal/Privacy, Product. Each control has a default role so work can be routed before people are assigned.
- **Effort:** S (about a day), M (two to five days), L (more than a week or cross-team).

## Validation rules

Errors (exit 1): malformed profile/overrides, unknown control IDs, invalid status/severity/dates, likelihood or impact outside 1-5, `pass` without evidence, `accepted_risk` without an owner and rationale, `app_id` mismatch.

Warnings: missing capability flags (treated as unknown), `pass` without a test reference, `fail`/`partial` without a finding, severity lowered below the catalog, a catalog blocker turned off, overrides on controls that do not apply.

## Files

```text
framework/
  control-catalog.json         features (intake questions) + controls (the source of truth)
  schemas/*.schema.json        JSON Schemas for the profile, overrides and catalog
  STANDARDS.md                 standards crosswalk
scripts/
  security-readiness.mjs       CLI
  lib/model.mjs                validation, applicability, assessment, ranking
  lib/outputs.mjs              tables, CSV, Markdown
  lib/xlsx.mjs                 dependency-free XLSX writer/reader
  generate-report.mjs          v1 entry point (profile, overrides, out dir)
  security-readiness.test.mjs  tests, including "committed reports are current"
templates/                     profile/overrides templates and the two AI prompts
apps/<app-id>/                 one folder per assessed app
  app-profile.json, audit-overrides.json, generated/
portfolio/                     cross-app rollup (generated)
DASHBOARD_DATA_DICTIONARY.md   every output table and column
PLAN.md                        how the framework is operated and extended
```

## Extending the catalog

Add or change controls in `framework/control-catalog.json`, then update `framework/schemas/` (the tests check that the override schema's control list and the profile schema's feature list match the catalog) and run `pnpm security:report`. Control IDs are stable: never renumber or reuse one. Retire a control by narrowing its `applies_when_any` rather than deleting it while assessments still reference it.

Platform-specific advice goes in a control's `platform_guidance` and appears in actions only for apps whose profile lists that platform.
