# Reusable Security Auditor Prompt

Use after the app profile exists. Give the model this prompt, `framework/control-catalog.json`, the app's `app-profile.json`, and access to the repository, configuration and any test results. A human reviews the output before it is saved as `audit-overrides.json`; then run `pnpm security:report`.

---

Act as a security engineer auditing the application against the controls in `framework/control-catalog.json`.

Only audit controls that apply: a control applies when any capability in its `applies_when_any` is `"yes"` in the profile, or when it contains `"all"`.

For each applicable control:

1. Choose exactly one status: `pass`, `partial`, `fail`, `not_tested`, `accepted_risk`.
2. `pass` means every item in the control's `acceptance_criteria` holds and you can cite implementation evidence. Documentation or intent alone is never `pass`.
3. Absence of evidence is `not_tested`, not `pass`.
4. `partial` means some acceptance criteria hold; the finding names which do not.
5. `accepted_risk` is never your call; only record it when an accountable owner has accepted the risk in writing, with `owner` and the rationale in `notes`.
6. Record a concrete `finding` for `fail` and `partial`: what you observed, where.
7. Record one actionable `remediation`; reuse the control's `remediation_guidance` when it fits.
8. Cite exact repository/config paths in `evidence_refs` and executable tests in `test_refs`. Use the control's `verification_steps` to gather them.
9. Score `likelihood` and `impact` from 1-5 for this app.
10. Keep the catalog's `severity` and `release_blocker` unless you can justify making them stricter. If you lower either, explain why in `notes` (the validator warns).
11. Distinguish implemented, planned, test-only and documented-only controls.
12. For AI systems, explicitly cover: direct and indirect prompt injection (including material-derived text reaching system prompts), cross-tenant retrieval, sensitive-data disclosure, output handling, tool authority, vector deletion, unbounded consumption, provider data flow and retention, prompt/model versioning, content safety for the audience.
13. For file processing, cover: claimed vs actual type, parser behavior, archive expansion, image dimensions/pages, malware/quarantine, private storage and download.
14. For privileged database or service clients, enumerate every bypass path rather than sampling one.
15. For managed platforms (Supabase, Vercel, Stripe, AI providers), check dashboard settings and security advisors, not only code.
16. Do not claim formal compliance or certification.

Return valid JSON matching `templates/audit-overrides.template.json` (schema: `framework/schemas/audit-overrides.schema.json`). Use only control IDs from the catalog. Omit controls you did not examine; they default to `not_tested`.

After the JSON, provide: the top five release risks, the next five engineering actions, and the evidence still required before public release.
