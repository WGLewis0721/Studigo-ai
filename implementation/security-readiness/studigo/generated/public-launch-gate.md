# Public Launch Security Gate

Application: **Studigo** (`studigo`)

Generated from catalog **2026-10-07**.

## Decision: NOT READY FOR UNRESTRICTED PUBLIC RELEASE

Open release blockers: **25**

A blocker is closed only by `pass` or explicit `accepted_risk` with accountable ownership.

## Open blockers

### GMS-API-002 — Rate, concurrency and cost limits
- Severity: **P0**
- Status: **fail**
- Risk score: **25**
- Finding: No centralized public rate/concurrency/spend guardrail was found for model, OCR, embedding and other expensive operations.
- Required action: Implement per-user/IP rate limits, concurrent-operation caps, token/work budgets, daily spend ceilings and a global provider circuit breaker.
- Evidence: apps/web/app/api/chat/route.ts|apps/web/app/api/documents/process/route.ts

### GMS-ACCESS-003 — Auxiliary/internal services authenticated
- Severity: **P0**
- Status: **fail**
- Risk score: **20**
- Finding: Optional Python retrieval service exposes index/search/flashcards/delete operations using supplied room IDs without an authenticated Studigo principal.
- Required action: Keep service loopback/private-only or add service authentication plus caller/room authorization and network restrictions before any public deployment.
- Evidence: services/retrieval/app/main.py|services/retrieval/README.md|apps/web/lib/retrieval-client.ts

### GMS-FILE-002 — Content signature and parser validation
- Severity: **P0**
- Status: **partial**
- Risk score: **20**
- Finding: assertContentMatchesType checks bytes for every allowed format (PDF header, PNG/JPEG/WEBP signatures, OOXML ZIP with the expected main part, UTF-8 text without NUL) before storage. Polyglot detection (e.g. PDF+HTML) is not implemented.
- Required action: Add polyglot rejection, or re-serve originals only with a forced download Content-Disposition and nosniff.
- Evidence: packages/documents/src/index.ts|packages/documents/src/file-safety.ts|apps/web/app/api/documents/upload/route.ts

### GMS-FILE-003 — Archive/decompression/image/OCR resource bounds
- Severity: **P0**
- Status: **partial**
- Risk score: **20**
- Finding: OCR page and chunk limits exist. assertSafeZip now rejects OOXML archives over 5000 parts, 300 MB declared expansion or 100x ratio, at upload and before extraction. Central-directory sizes can be understated by a crafted archive; image pixel/dimension limits, PDF object-stream bombs and parser time/memory budgets are still missing.
- Required action: Add pre-extraction archive expansion/file-count limits, image dimension limits, parser time/work limits and bomb fixtures.
- Evidence: apps/web/lib/validation.ts|packages/documents/src/extract.ts|packages/documents/src/file-safety.ts

### GMS-PRIV-002 — Minor/student-data release requirements resolved
- Severity: **P0**
- Status: **not_tested**
- Risk score: **20**
- Finding: Studigo targets learners including minors; public child-use consent/guardian/data-minimization requirements are not yet a verified release gate.
- Required action: Complete privacy/legal/product review for target markets and implement resulting onboarding/consent/retention controls.
- Evidence: docs/PRODUCT.md|docs/AUTH.md

### GMS-GOV-002 — Sensitive data classification and lifecycle
- Severity: **P0**
- Status: **partial**
- Risk score: **15**
- Finding: Sensitive student/source/AI data exists, but a complete retention/provider/deletion classification is not yet implemented and verified.
- Required action: Create data classification register and end-to-end lifecycle tests.
- Evidence: docs/ARCHITECTURE.md|docs/AUTH.md

### GMS-ACCESS-001 — Object-level authorization / tenant isolation
- Severity: **P0**
- Status: **partial**
- Risk score: **15**
- Finding: RLS and room-scoped access are core architecture and DB security tests exist, but a complete API object-substitution matrix has not been executed.
- Required action: Build BOLA/IDOR matrix for every route/resource and add foreign-ID tests.
- Evidence: apps/web/lib/retrieval.ts|docs/ARCHITECTURE.md

### GMS-ACCESS-002 — Privileged/service-role operations scoped
- Severity: **P0**
- Status: **partial**
- Risk score: **15**
- Finding: Service-role operations are intentionally server-only and many paths scope owner IDs, but service-role usage is broad enough to require a complete privileged-call inventory and negative audit.
- Required action: Inventory every createServiceSupabaseClient call; require user/room/object scope and tests or owner-scoped RPC helper.
- Evidence: apps/web/lib/supabase/service.ts|apps/web/lib/ingest.ts|apps/web/app/api/chat/route.ts

### GMS-FILE-004 — Malware/quarantine controls
- Severity: **P0**
- Status: **fail**
- Risk score: **15**
- Finding: Architecture documentation identifies malware scanning as a public-launch requirement; implementation was not found.
- Required action: Add quarantine + malware scanning or define an equivalent accepted-risk isolation model before public uploads.
- Evidence: docs/ARCHITECTURE.md

### GMS-AI-001 — Uploaded/retrieved content treated as untrusted
- Severity: **P0**
- Status: **partial**
- Risk score: **15**
- Finding: Uploaded source material is serialized as untrusted. Fixed 2026-10-07: model-extracted topic titles and earlier model-written practice questions entered system prompts as raw directive text, and /api/chat appended browser-supplied directive text to the system prompt; both now go through the untrusted-data envelope or are ignored. Full multimodal/indirect verification through production paths is still pending.
- Required action: Run text/metadata/OCR-image indirect injection corpus through actual production paths.
- Evidence: packages/ai/src/client.ts|packages/ai/src/grounding.ts|packages/ai/src/ocr.ts|apps/web/lib/directive-format.ts|apps/web/lib/engine.ts|apps/web/lib/recommendation-engine.ts|apps/web/app/api/chat/route.ts

### GMS-AI-002 — Prompt-injection regression suite
- Severity: **P0**
- Status: **partial**
- Risk score: **15**
- Finding: Adversarial RAG fixtures are designed, but the human-reviewed live production scorecard is not complete.
- Required action: Complete reviewed live eval and make injection failures release-blocking.
- Evidence: evals/rag/README.md

### GMS-AI-005 — Sensitive-data disclosure testing
- Severity: **P0**
- Status: **partial**
- Risk score: **15**
- Finding: Cross-room/user decoys and untrusted-source tests exist in the RAG evaluation design; live reviewed evidence is incomplete.
- Required action: Complete live reviewed disclosure/isolation eval and add system-prompt/secret extraction cases.
- Evidence: evals/rag/README.md

### GMS-RAG-003 — Deletion and revision propagate to derived/vector data
- Severity: **P0**
- Status: **partial**
- Risk score: **15**
- Finding: Source re-fetch and revision thinking exist, but every derived/vector path, including optional FAISS, needs verified deletion/replacement propagation.
- Required action: Add source replace/delete regression across pgvector, caches and any enabled auxiliary index.
- Evidence: apps/web/lib/retrieval.ts|services/retrieval/app/main.py

### GMS-PRIV-001 — Retention, deletion and export are implemented
- Severity: **P0**
- Status: **partial**
- Risk score: **15**
- Finding: Primary/storage cleanup mechanisms exist, but full deletion/export behavior across derived AI artifacts/providers has not been proven.
- Required action: Define retention and implement end-to-end deletion/export verification.
- Evidence: apps/web/lib/storage-cleanup.ts|docs/ARCHITECTURE.md

### GMS-LOG-002 — Logs avoid sensitive-content leakage
- Severity: **P0**
- Status: **not_tested**
- Risk score: **15**
- Finding: A production telemetry/log sampling audit has not verified absence of raw private documents, learner answers, tokens or secrets.
- Required action: Audit logs/telemetry payloads and enforce redaction/minimization.
- Evidence: implementation/AI_ENGINEERING_HARDENING_PLAN.md

### GMS-SUPPLY-002 — Secret scanning
- Severity: **P0**
- Status: **fail**
- Risk score: **15**
- Finding: No repository secret-scanning gate was found in CI.
- Required action: Enable platform secret scanning and/or CI scanner; document credential rotation response.
- Evidence: .github/workflows/ci.yml

### GMS-AUTH-001 — Authentication required for private resources
- Severity: **P0**
- Status: **partial**
- Risk score: **10**
- Finding: Auth helpers and protected app routes exist. Live 2026-10-07: Supabase anonymous sign-ins are enabled (52 of 54 users anonymous); anonymous sessions carried the authenticated role. Now treated as signed out by middleware/getUser/requireUser/requireApiUser, and restrictive RLS blocks anonymous inserts. Route-by-route unauthenticated API verification still required.
- Required action: Disable anonymous sign-ins in Supabase Auth; decide on purging existing anonymous users/data; generate endpoint inventory and add unauthenticated negative tests for every private API.
- Evidence: apps/web/lib/auth.ts|apps/web/middleware.ts|apps/web/lib/account-kind.ts|supabase/migrations/20261007120000_block_anonymous_writes.sql

### GMS-AUTH-002 — OAuth state, PKCE and redirect safety
- Severity: **P0**
- Status: **partial**
- Risk score: **10**
- Finding: OAuth callback uses Supabase code exchange and safeNext validates same-origin paths; full provider state/PKCE and preview/production callback testing remains open.
- Required action: Add OAuth integration tests for state/PKCE, encoded redirects and callback allowlists.
- Evidence: apps/web/app/auth/callback/route.ts|apps/web/lib/validation.ts|docs/AUTH.md

### GMS-WEB-002 — Untrusted/model output rendered safely
- Severity: **P0**
- Status: **partial**
- Risk score: **10**
- Finding: Production rich-text parser explicitly avoids HTML injection, but adversarial XSS/output-handling tests are not yet a release gate.
- Required action: Add model/source/user payload tests for script tags, javascript/data URLs, image beacons and malicious Markdown.
- Evidence: apps/web/lib/rich-text.ts

### GMS-FILE-005 — Private storage and scoped download
- Severity: **P0**
- Status: **partial**
- Risk score: **10**
- Finding: Files are private and signed download URLs are generated only after user-scoped document lookup, but foreign-file and URL-expiry tests should be explicit release evidence.
- Required action: Add cross-user signed-download and replay/expiry tests.
- Evidence: apps/web/app/api/documents/download/route.ts|docs/ARCHITECTURE.md

### GMS-RAG-001 — Permission-preserving retrieval
- Severity: **P0**
- Status: **partial**
- Risk score: **10**
- Finding: Canonical TypeScript retrieval is room-scoped under caller RLS; complete live cross-tenant reviewed verification is still required.
- Required action: Finish cross-tenant RAG cases and route-level retrieval isolation tests.
- Evidence: apps/web/lib/retrieval.ts|docs/ARCHITECTURE.md

### GMS-CI-001 — Protected production branch and required checks
- Severity: **P1**
- Status: **fail**
- Risk score: **16**
- Finding: GitHub main branch is currently unprotected and required status checks are not enforced at the branch level.
- Required action: Protect main with required PR/review/check rules and prevent bypass except controlled emergency process.
- Evidence: .github/workflows/ci.yml

### GMS-PRIV-003 — External provider data flows documented and configured
- Severity: **P1**
- Status: **partial**
- Risk score: **15**
- Finding: Direct OpenAI Responses calls now send store:false. Gateway/Ollama transports unchanged; no vendor data-flow register, DPA or org-level retention evidence yet.
- Required action: Create vendor data-flow register and capture provider configuration evidence.
- Evidence: packages/ai/src/client.ts

### GMS-API-003 — CSRF / request provenance protection
- Severity: **P1**
- Status: **not_tested**
- Risk score: **12**
- Finding: Local beta and waitlist have provenance/origin protections, but no universal production mutation control was verified across cookie-authenticated APIs.
- Required action: Implement/verify centralized Origin/CSRF policy and cross-site negative browser tests.
- Evidence: apps/web/lib/local-beta-access.ts

### GMS-RAG-002 — Grounding, citation support and abstention verified
- Severity: **P1**
- Status: **not_tested**
- Risk score: **12**
- Finding: The offline benchmark requires human semantic support and abstention review, but live reviewed results are not complete.
- Required action: Complete the 120-case reviewed production RAG scorecard.
- Evidence: evals/rag/README.md|packages/ai/src/grounding.ts

## Rule

Do not convert a blocker to pass because the control is documented. Record implementation evidence and test evidence.
