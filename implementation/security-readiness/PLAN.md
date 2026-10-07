# Security Readiness: Operating Plan

## Goal

Run the same security assessment for any app, from a rough idea to production, and get output that people can act on directly: a ranked backlog, a release decision, and tables for spreadsheets, dashboards and trackers.

## The loop for one app

| Step | Who | Input | Command / artifact | Exit criteria |
|---|---|---|---|---|
| 1. Create | Anyone | App name | `pnpm security init <app-id> --name … --stage …` | `apps/<app-id>/` exists with a first report. |
| 2. Intake | Product owner (model-assisted) | Brief, architecture, repo | `generated/intake-questions.md`, `templates/APP_IDEA_INTAKE_PROMPT.md` → `app-profile.json` | Each capability is yes/no/unknown; unknowns appear as scope actions. |
| 3. Audit | Security/engineering (model-assisted, human-reviewed) | Code, config, provider dashboards, tests | `templates/SECURITY_AUDITOR_PROMPT.md` → `audit-overrides.json` | Every applicable control has a status; fail/partial have findings; pass has evidence. |
| 4. Verify | Engineering | High-risk findings | Executable tests referenced in `test_refs` | P0/P1 controls have executable verification or a stated reason it must be manual. |
| 5. Report | CI or anyone | Steps 2-4 | `pnpm security:report` | Outputs regenerated; `pnpm security:check` passes. |
| 6. Act | Owner roles | `actions.csv` / Actions sheet | Tracker import keyed by `action_id` | Each open action has an owner and target date. |
| 7. Decide | Release owner | `public-launch-gate.md` | Gate decision | `ready`, or open blockers carry explicit `accepted_risk`. |
| 8. Re-assess | Anyone | Material change | Repeat 2-7 | See triggers below. |

At idea stage, steps 3-4 are mostly empty: applicable controls stay `not_tested` and appear as "Design in" actions. That backlog is the security requirements list for the build.

## Release gate rules

A public release must not proceed while:

- any applicable release-blocker control is not `pass` or `accepted_risk`;
- an `accepted_risk` lacks a named owner and written rationale (the validator rejects this);
- a `pass` lacks evidence (the validator rejects this).

`scope_incomplete` is not a release state: answer the scope questions first.

## Re-assessment triggers

Re-answer the profile and update affected controls when any of these change: auth provider or sign-up policy, public API surface, file upload types, payments, AI model or provider, RAG/vector store, agent/tool execution, minors or student data, external integrations or webhooks, a new service or deployment surface, an admin/operator console. Also re-run before every public release and at least quarterly.

## Operating it for clients

- One folder per app under `apps/`; set `client` in the profile for grouping.
- `pnpm security:report` rebuilds every app and the `portfolio/` rollup; hand the client their app's `security-readiness.xlsx` and `public-launch-gate.md`.
- Import `actions.csv` into the client's tracker using `action_id` as the external key so re-imports update rather than duplicate.
- Keep the catalog version in the report; when the catalog changes, regenerate every app so all assessments use the same controls.

## Maintaining the framework

- Catalog changes go through review with a test (`scripts/security-readiness.test.mjs` checks catalog integrity and schema sync).
- Add a capability flag only when it changes which controls apply; add a control only with acceptance criteria, verification steps, evidence expected and a default remediation.
- Control IDs are permanent. Never renumber.

## Backlog for the framework itself

- Optional `--format jira|linear|github` exports that map `actions.csv` to each tracker's import columns.
- Evidence freshness: flag `pass` controls whose evidence predates a material change.
- Per-control history (status over time) for trend dashboards, from successive `reviewed_at` snapshots.
