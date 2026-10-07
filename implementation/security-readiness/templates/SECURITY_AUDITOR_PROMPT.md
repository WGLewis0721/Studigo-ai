# Reusable Security Auditor Prompt

Use this prompt after an app profile has been generated.

---

Act as a security engineer auditing the supplied application against the controls in `framework/control-catalog.json`.

Inputs:
- app profile,
- control catalog,
- repository/architecture/configuration evidence,
- any available deployment/security test results.

For each applicable control:

1. Determine only one status:
   - pass
   - partial
   - fail
   - not_tested
   - accepted_risk
2. Never mark `pass` from documentation alone.
3. A pass requires implementation evidence and, where practical, executable verification.
4. Treat absence of evidence as `not_tested`, not pass.
5. Record the concrete observed finding.
6. Record one actionable remediation.
7. Reference exact repository/config/test paths in `evidence_refs` and `test_refs`.
8. Assign likelihood and impact from 1–5 based on the actual app.
9. Preserve the catalog's release-blocker status unless there is a documented reason to make the audit stricter.
10. Do not weaken P0 severity merely because exploitation has not yet been attempted.
11. Distinguish:
    - implemented control,
    - planned control,
    - test-only control,
    - documented intent.
12. For AI systems, explicitly audit:
    - direct and indirect prompt injection,
    - cross-tenant retrieval,
    - sensitive-data disclosure,
    - output handling,
    - model/tool authority,
    - vector/index deletion,
    - unbounded AI/resource consumption,
    - provider data flow,
    - prompt/model/evaluator versioning.
13. For file-processing systems, explicitly audit:
    - claimed MIME/extension,
    - actual content signature,
    - parser behavior,
    - archive expansion,
    - image dimensions/pages,
    - malware/quarantine,
    - private storage/download.
14. For privileged database/service clients, enumerate every bypass path rather than sampling one.
15. Do not claim formal compliance/certification.

Return valid JSON matching `audit-overrides.template.json`.

After the JSON, provide:
- the top five release risks,
- the next five engineering actions,
- the evidence still required before public release.
