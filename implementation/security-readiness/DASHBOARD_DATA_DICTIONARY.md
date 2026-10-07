# Dashboard / Excel Data Dictionary

Every report produces the same tables. They are flat, keyed and documented here so they load directly into Excel, Power BI, Looker, Tableau, Google Sheets or a tracker import.

## Where the data is

| Scope | CSV / JSON | Workbook |
|---|---|---|
| One app | `apps/<app-id>/generated/*.csv`, `security-summary.json` | `apps/<app-id>/generated/security-readiness.xlsx` |
| All apps | `portfolio/portfolio-*.csv`, `controls.csv`, `portfolio-summary.json` | `portfolio/portfolio.xlsx` |

Conventions:

- CSV is UTF-8 with a header row, RFC 4180 quoting, `\n` line endings, no BOM. Excel users should open the `.xlsx`.
- Lists of references use `|` as the separator (`evidence_refs`, `standard_refs`, `labels`). Prose lists (acceptance criteria, verification steps) use line breaks inside one cell.
- Booleans are `true`/`false` in CSV and real booleans in XLSX. Dates are `YYYY-MM-DD`.
- Outputs are deterministic. The only date used is the audit's `reviewed_at` (portfolio: the latest `reviewed_at`, or `--as-of`).

## Data model

```text
controls (control_id) ──┐
                        ├── assessment (app_id, control_id) ── evidence (app_id, control_id, kind, ref)
apps (app_id) ──────────┤
                        ├── actions (action_id = app_id:control_id or app_id:scope-<feature>)
                        ├── domains (app_id, domain)
                        └── scope (app_id, feature)
```

Join everything on `app_id` and `control_id`. `controls` is the dimension; the others are facts.

## controls — `controls.csv`, sheet Controls

One row per catalog control. Identical for every app.

| Column | Meaning |
|---|---|
| control_id | Stable ID, e.g. `GMS-API-002`. Never reused. |
| domain | Security domain (Authentication, AI Security, Privacy…). |
| title | Short name. |
| severity | Default P0-P3. |
| release_blocker | Default: blocks public release when open. |
| owner_role | Default role that does the work. |
| effort | S / M / L. |
| applies_when_any | Capability flags that make it applicable (`all` = always). |
| standard_refs | Specific references, e.g. `OWASP API4:2023`, `OWASP LLM01:2025`, `NIST SSDF PS.1`. |
| frameworks | Standards families. |
| requirement | What must be true. |
| acceptance_criteria | Each condition that must hold to mark `pass`. |
| verification_steps | How to check it. |
| test_method | Summary of the verification approach. |
| evidence_expected | What proof closes it. |
| remediation_guidance | Default fix. |

## assessment — `security-control-matrix.csv`, sheet Assessment

One row per app × control. The first 24 columns match the v1 matrix.

| Column | Meaning |
|---|---|
| app_id, app_name, client | App identity and grouping. |
| control_id, domain, title, frameworks | From the catalog. |
| applicability | `applicable`, `needs_review` (depends on an unknown capability) or `not_applicable`. |
| applies_because | The capability flags that made it applicable or pending. |
| status | `pass`, `partial`, `fail`, `not_tested`, `accepted_risk`, `needs_review`, `not_applicable`. |
| severity | P0-P3 (override or catalog default). |
| likelihood, impact | 1-5 when scored, 0 when not. |
| risk_score | likelihood × impact. Prioritizes within a severity; never overrides a blocker. |
| release_blocker | Blocks release when open and applicable. |
| open_blocker | release_blocker and still open. |
| is_open | Applicable or pending, and not `pass`/`accepted_risk`. |
| requirement, test_method, evidence_expected, acceptance_criteria, standard_refs | From the catalog. |
| finding | Observed gap or result. |
| remediation | Recorded next step, or the catalog default. |
| owner_role, owner | Default role; named person or team when assigned. |
| effort | S / M / L. |
| target_date, overdue | Due date; overdue when open and past the report date. |
| ticket | Tracker key or URL. |
| evidence_refs, test_refs, evidence_count, test_count | Proof recorded so far. |
| last_reviewed | Audit `reviewed_at`. |
| notes | Context, rationale for accepted risk or lowered severity. |

## actions — `actions.csv`, sheet Actions

The ranked backlog. One row per thing to do, ready to import into Jira, Linear or GitHub Issues (map `title`, `description`, `labels`, `owner`).

Ranking: scope questions first (they decide what applies), then open blockers, severity, status (fail → partial → not_tested), risk score, catalog order.

| Column | Meaning |
|---|---|
| rank | 1 = do first. |
| action_id | Stable key: `app_id:control_id` or `app_id:scope-<feature>`. Use it to upsert tickets. |
| app_id, app_name, client | App. |
| action_type | `decide_scope` (answer a capability question), `remediate` (fail), `complete` (partial), `verify` (not tested), `design_in` (not tested at idea stage). |
| control_id, feature | What the action is about (one of the two is empty). |
| severity, release_blocker, status, risk_score | Priority inputs. |
| owner_role, owner, effort, target_date, ticket | Routing and planning. |
| title | Ticket title, e.g. `[P0][Blocker] Fix: Rate, concurrency and cost limits`. |
| description | Markdown ticket body: finding, requirement, checklist of acceptance criteria, verification steps, suggested fix, platform notes, evidence so far, evidence required, standards. |
| labels | `security-readiness`, domain, severity. |

## domains — `domains.csv`, sheet Domains

One row per app × domain: `controls`, `applicable`, a count per status, `open_blockers`, `p0_open`, `readiness_pct` (pass or accepted risk ÷ applicable).

## scope — `scope.csv`, sheet Scope

One row per app × capability flag: `feature`, `answer` (yes/no/unknown), `question`, `controls_activated`.

## evidence — `evidence.csv`, sheet Evidence

Long format, one row per reference: `app_id`, `control_id`, `status`, `kind` (`evidence` or `test`), `ref`. Use it for "controls without evidence" and "pass without tests" views.

## apps — `portfolio-apps.csv`, sheet Apps

One row per app: `decision`, `readiness_pct`, `release_blockers_open`, `p0_open`, `p1_open`, `scope_questions`, `applicable_controls`, `overdue`, `open_without_owner`, `stage`, `client`, `reviewed_at`, `catalog_version`.

## security-summary.json / portfolio-summary.json

The same measures for programmatic dashboards: decision, counts by status, open by severity / owner role / domain, blockers, highest-risk open items, scope questions and the top ten actions. `portfolio-summary.json` holds one summary per app under `apps`.

## Suggested views

| View | Build it from |
|---|---|
| Executive release | apps: decision, open blockers, P0 open, readiness %; trend by `reviewed_at`. |
| Engineering backlog | actions filtered to an owner_role, sorted by rank; group by effort. |
| Scope / intake | scope where answer = unknown; actions where action_type = decide_scope. |
| AI security | assessment where domain in AI Security, AI Operations, AI Safety, RAG / Vector Security, Resource Abuse. |
| Evidence quality | assessment where status = pass and test_count = 0; is_open and owner empty. |
| Client portfolio | portfolio files grouped by client, app, domain, severity. |
| Overdue | assessment where overdue = true. |
