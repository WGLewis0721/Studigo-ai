# Studigo C07 + AI admission: consolidated stabilization handoff

**Status (2026-10-14): integrated code CI-green; security staging and original-scan acceptance NOT YET VERIFIED.**
**Integration draft:** [PR #111](https://github.com/WGLewis0721/Studigo-ai/pull/111) → `integration/document-learning-reliability`.
**Verified code head:** `d80e3d8d15397a08964b6cb8e82938c8eaab0907`.
**CI evidence:** [full CI](https://github.com/WGLewis0721/Studigo-ai/actions/runs/38571926618) PASS; [AI security contention](https://github.com/WGLewis0721/Studigo-ai/actions/runs/38571926753) PASS; Vercel preview success. Full CI covered lint, TypeScript, tests and web build. These are *offline/CI* validations only.

## Canonical code lineage and branch ownership

- Security core from draft [#98](https://github.com/WGLewis0721/Studigo-ai/pull/98) head `c77a1c485a8f2408a7af583cbcb145dd60a585e7`. Keep new SQL admission/receipt semantics, fixed NULL checks, per-IP IPv6 /64 keying, leases and stream-settlement logic.
- High-cost route wrappers from draft [#99](https://github.com/WGLewis0721/Studigo-ai/pull/99) head `e8353bc94d0579dc4773e88cd378a2d2e053aace`. Preserve route coverage, guarded OCR helper, practice-test fanout envelope, and atomic forced-reindex claim.
- C07 source [#107](https://github.com/WGLewis0721/Studigo-ai/pull/107) head `9b92a22756f839ce227f6ad6f283b846b3f824c0` plus draft [#110](https://github.com/WGLewis0721/Studigo-ai/pull/110) head `6e9afa1494ef619f04af9b69dccc2a208f25edd2`.
- This integration PR has the source commits as merge parents. **Do not independently merge the source drafts.** Preserve source branches while reviewing this integration, and decide their disposition after #111 is accepted or rejected.

## Verified integration fixes

1. **Scanned-PDF buffer ownership.** `extractPdf` gives PDF.js a copy of the buffer so `extractSinglePagePdf` can still load original pages for OCR. A synthetic no-text-layer three-page PDF regression reproduced the detached-ArrayBuffer defect before the fix and passes after it.
2. **Fail-closed OCR transcription.** The OCR code rejects incomplete, failed, refused and output-limited responses; it does not index partial transcripts. It retains specific safe error reasons and a provider capability check.
3. **Admission-connected OCR.** The C07 OCR request uses #99's `executeAdmittedOcrRequest`, which debits work, composes timeout and admission abort signals, tracks provider in-flight work, and uses zero automatic OCR retries.
4. **Safe admission denials.** Work-budget denials now have a typed `ProviderWorkBudgetError` that survives the OCR error wrapper; provider exception text remains hidden from learner-facing OCR errors. Tests verify no billable work after budget denial.
5. **Separated SDK retry control.** A raw SDK request may retry when admission is off; OCR never automatically retries, regardless of the flag. The unit tests assert both behaviors separately.
6. **Atomic forced reindex.** `processDocument(force)` uses the database `claim_forced_studigo_reindex` transition rather than clearing a processing/queued row and claiming later.
7. **Complete guarded-route operation policy.** Retained Claude's hardened policy while including Grok's `document-upload` and `flashcards-local` operations.
8. **Provider-independent offline recovery.** A synthetic three-page scan passes extraction → mocked OCR → page-preserving chunking. Third-page failure rejects the result without publishing incomplete evidence. This does **not** prove actual vision accuracy or production vector retrieval.

## Remaining non-negotiable release gates

**Security staging (must be separately authorized and executed):**
- Verify *staging only* Supabase target, then apply `supabase/migrations/20261008100000_ai_resource_admission.sql`. Confirm service-role permissions and anon/authenticated denial.
- Configure secret `STUDIGO_AI_IP_HASH_SECRET` plus all eight explicit `STUDIGO_AI_*` admission limits. Verify transport configuration and trusted-client-IP behavior. Do **not** enable admission on production.
- Verify WAF controls and provider-side spend/budget settings; document whether controls are hard or delayed/soft. Database micro-USD reservations are **estimates, not invoice reconciliation or a guaranteed dollar spending ceiling**.
- Run hosted tests of 429/503 denial without provider execution, receipt idempotency/replay, cancellation and lease liveness, forced-reindex contention, role boundaries, and actual bounded provider cost. Confirm model and transport credentials in staging.
- Resolve or explicitly accept the remaining limitations: clients do not yet supply stable `x-studigo-operation-id` values; request fingerprinting may buffer a body before admission; throughput of the global advisory lock is unmeasured; hard real-dollar caps and delayed WAF/gateway limits are not proven.

**C07 source acceptance (must be performed after security staging gate):**
- Make the original private image-only three-page `1-Study-guide-.pdf` available via an approved, private staging route. The original PDF was **not** used in these CI tests.
- Perform one explicitly authorized bounded OCR attempt, with no provider retries and a real staging spend-control decision.
- Verify extracted named facts on the correct source pages: page 1 primary/secondary sources; page 2 executive/legislative/judicial branches and Supreme Court; page 3 "Every Vote Counts".
- Verify each recovered passage is indexed in the correct Study Room, retrievable by Learn, and yields correct page-linked citations. Verify no source duplication and that illegible material is not invented.
- Record provider response status, safe attempt result, OCR page count, embedding/chunk status, Learn retrieval result and sanitized timing/spend evidence in `implementation/codex-failures.md` and the C07 tracker. Do not record private learner content.
- Only after all gates pass may reviewers change C07 from **BLOCKED** to **DONE** or merge/enable production behavior.

## Operational limits

**No live OCR, migrations, secret mutations, hard-cap setup, paid provider test, or production enablement was performed by the integration author.** Source PRs and production main were not merged or modified. PR #111 remains draft pending independent review and staging acceptance.

If later changes land in #98/#99/#107/#110, compare their exact SHAs against the pinned sources above before adopting them; do not silently replace the reconciled `ocr.ts`, `ingest.ts` or `ai-admission.ts`.


## 2026-10-14: Learn rate-limit test correction

Owner successfully completed three chat requests in the same 15:17 UTC minute, then the fourth and fifth were denied with `rate`. The original preview-only admission limits of 3 user/min, 3 IP/min, 4 global/min were too restrictive for normal Coach/Learn UI use. All three provider executions and lease closures succeeded; no stuck lease or OCR failure was involved.

Updated **only** branch-scoped Vercel preview variables for `stabilize/c07-ai-admission-20261014`: `STUDIGO_AI_USER_PER_MINUTE=15`, `STUDIGO_AI_IP_PER_MINUTE=15`, `STUDIGO_AI_GLOBAL_PER_MINUTE=20`. Kept concurrency at one per user/IP/global, day budgets at 1,500,000/1,800,000 micro-USD, admission enabled only in preview. No database rows were modified; production variables remain untouched. The preview requires a fresh build to pick up deployment-time environment changes. See latest deployment and tests on PR #111.

The configured daily micro-USD reservations still estimate work, not real provider billed spend; provider-side caps and hosted cancellation validation remain separate security-release gates. Use the stable branch preview alias, not old immutable deployment URLs.
