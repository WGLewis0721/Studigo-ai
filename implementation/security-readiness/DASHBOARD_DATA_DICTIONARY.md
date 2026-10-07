# Dashboard / Excel Data Dictionary

The generated CSV is intentionally flat so it imports cleanly into spreadsheets and BI tools.

| Column | Meaning |
| --- | --- |
| app_id | Stable application identifier |
| app_name | Human-readable app name |
| control_id | Stable internal control ID |
| domain | Security domain |
| title | Short control title |
| frameworks | Pipe-separated standards references |
| applicability | applicable / needs_review / not_applicable |
| status | pass / partial / fail / not_tested / accepted_risk / not_applicable / needs_review |
| severity | P0 / P1 / P2 / P3 |
| likelihood | 1-5 |
| impact | 1-5 |
| risk_score | likelihood × impact |
| release_blocker | true / false |
| requirement | What must be true |
| test_method | How to verify it |
| evidence_expected | Expected proof |
| finding | Current observed gap/result |
| remediation | Next concrete action |
| owner | Responsible person/team |
| target_date | Remediation target |
| evidence_refs | Pipe-separated code/config/doc evidence |
| test_refs | Pipe-separated executable/manual test evidence |
| last_reviewed | Last audit date |
| notes | Additional context |

## Suggested dashboard views

### Executive release view
- open release blockers,
- P0/P1 fails,
- P0/P1 not tested,
- accepted risks,
- days since last review.

### Engineering view
- controls grouped by domain,
- remediation owner,
- target date,
- evidence completeness,
- test coverage.

### AI-security view
Filter domains:
- AI Security,
- RAG / Vector Security,
- Resource Abuse,
- Privacy.

### Client portfolio view
Combine CSV exports from multiple apps and group by:
- app_id,
- client,
- domain,
- severity,
- release readiness.

## Risk score

`risk_score = likelihood × impact`.

This score supports prioritization. It does not override a release blocker. A P0 control can block release even when the numeric score is lower than another issue.
