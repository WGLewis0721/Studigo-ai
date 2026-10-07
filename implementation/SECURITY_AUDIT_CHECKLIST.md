# Studigo Security Audit Checklist

Audit date: 2026-10-07. Branch: `security/audit-checklist`.

This audit checks Studigo against six published control sets. Each control maps to a check, a status, and evidence: a file, a test, or a read-only query against the live Supabase/Vercel projects. Failures are ordered by launch-blocker priority at the end.

> **Not legal advice.** The privacy section (§6) is a technical checklist. The COPPA details come from a law-firm summary, not the FTC rule text. Counsel must confirm them before launch.

## Relationship to the security-readiness gate

The canonical release gate is the generated report in `implementation/security-readiness/apps/studigo/generated/public-launch-gate.md`, built from `apps/studigo/audit-overrides.json` (`pnpm security:report`). This file is the detailed audit against six named standards. Its evidence feeds that gate: each change below is recorded on the matching `GMS-*` control, and the regenerated gate is committed with it. When the two disagree, update the overrides and regenerate rather than editing a status here only.

| This checklist | Gate control |
|---|---|
| LLM10-01, API2-03, SB-02 (anonymous accounts) | GMS-AUTH-004, GMS-AUTH-001, GMS-API-002 |
| LLM10-02..06, API4, NX-06, VC-01 (rate/cost limits) | GMS-API-002, GMS-AI-007 |
| LLM01-02/03/04 (prompt injection) | GMS-AI-001, GMS-AI-002 |
| LLM02-02 (provider retention) | GMS-PRIV-003 |
| LLM02-03, API2-05 (error leakage) | GMS-API-004 |
| API8-01, NX-04 (headers/CSP) | GMS-WEB-001 |
| UP-02 (content signatures) | GMS-FILE-002 |
| UP-04 (archive bombs) | GMS-FILE-003 |
| UP-05 (malware scanning) | GMS-FILE-004 |
| LLM03-01..04 (supply chain) | GMS-SUPPLY-001, GMS-SUPPLY-002 |
| AUX-01 (Python retrieval service) | GMS-ACCESS-003 |
| CI-01 (branch protection) | GMS-CI-001 |
| PR-01..04 (minors and retention) | GMS-PRIV-001, GMS-PRIV-002, GMS-GOV-002 |
| PR-05 (privacy notice, terms, data requests) | GMS-PRIV-004 |
| PR-09 (harmful content for minors) | GMS-AI-008 |
| API2-04, API6-01, SB-03..09, VC-02, VC-04, API8-03 (platform settings) | GMS-AUTH-004, GMS-OPS-003 |

## Status key

| Status | Meaning |
|---|---|
| **PASS** | Control met; evidence cited. |
| **FIXED** | Failed at audit start; fixed on this branch, with a test where testable. |
| **PARTIAL** | Partly met; the gap is stated. |
| **FAIL** | Not met. |
| **OPS** | Needs a dashboard/console action by an owner; code cannot fix it. |
| **NOT VERIFIED** | Could not be checked from code or the available read-only tools. |

## Sources

1. [OWASP Top 10 for LLM Applications 2025](https://genai.owasp.org/llm-top-10/), plus the [LLM Prompt Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
2. [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
3. [Next.js data security guide](https://nextjs.org/docs/app/guides/data-security) and [CSP guide](https://nextjs.org/docs/app/guides/content-security-policy)
4. [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod), [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [Vercel WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
5. [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
6. COPPA amendments ([White & Case summary](https://www.whitecase.com/insight-alert/unpacking-ftcs-coppa-amendments-what-you-need-know)), [FERPA school official criteria](https://studentprivacy.ed.gov/faq/who-school-official-under-ferpa), [NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)

ASVS is not used as a control set here. At audit time the OWASP page still listed 4.0.3 as stable, and 5.0 final was not confirmed. Use 4.0.3 for any ASVS mapping until 5.0 is verified.

## Live-environment evidence (read-only, 2026-10-07)

| Check | Result |
|---|---|
| Supabase Security Advisor, project `Studigo` | Anonymous-access warnings on 19 tables (fires only when anonymous sign-ins are **enabled**). Leaked-password protection **disabled**. `public.touch_updated_at` has a mutable `search_path`. Unrelated tables `mf_agreements` and `mf_bookings` exist in the Studigo database. |
| `auth.users` | 54 users, **52 anonymous**, none created in the last 7 days. Anonymous users own 16 rooms and 14 documents. Nothing cleans these up automatically. |
| Public tables without RLS | None. |
| `study-materials` bucket | Private. **No** `file_size_limit` or `allowed_mime_types`. |
| Vercel firewall config, project `studigo-ai` | **None exists** (API returned 404). No WAF rate-limit rules. |
| Production response headers (`/`) | HSTS present. No CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` or `Permissions-Policy`. |
| `/dev/study`, `/game`, `POST /api/local-beta` in production | All return 404. |
| `pnpm audit --prod` | 1 critical (Next.js `next/og` RCE, GHSA-vcvr-r3jv-pc5j), 2 high (sharp/librsvg, source-map-js), 1 moderate (sprintf-js). |

---

## 1. OWASP Top 10 for LLM Applications 2025

| ID | Control | Status | Evidence / action |
|---|---|---|---|
| LLM01-01 | Uploaded material is wrapped as data, and every prompt says it is not instructions | PASS | `asUntrustedMaterial` and `UNTRUSTED_MATERIAL_RULE` in `packages/ai/src/client.ts:148,157`. Used by every grounding, study, coach and OCR prompt. Tested in `packages/ai/src/untrusted.test.ts`. |
| LLM01-02 | Material-derived text (topic titles, earlier model-written practice questions) never enters the system prompt raw | **FIXED** | Before: topic titles extracted by the model from uploads went into the system prompt as plain directive text. This happened in `buildLearnerStateDirective` (`apps/web/lib/engine.ts`) and in the tutor directive's practice blocks (`apps/web/lib/recommendation-engine.ts`). A crafted study guide could add a line like `[COACH MODE] …`. Now both go inside the untrusted-data envelope. Test: `apps/web/lib/prompt-boundary.test.ts`. |
| LLM01-03 | No browser-supplied text reaches the system prompt | **FIXED** | Before: `/api/chat` accepted a `directives[{name:"Current topics", instruction}]` field (≤600 chars) and appended it to the system prompt. Now the route ignores it, and the engine builds the scope directive from validated `topicIds` (`buildTopicScopeDirective` in `apps/web/lib/directive-format.ts`). Test: `prompt-boundary.test.ts` ("the chat route never forwards…"). |
| LLM01-04 | Prompt-injection regression suite against a live model, using hostile uploads end to end | FAIL | Only serialization and boundary tests exist. ROADMAP.md:626 lists this as open. Add fixtures to `evals/rag/` (instructions in the body, filename, slide notes and OCR text) and assert grounded refusal and correct citations. |
| LLM01-05 | Output screening | PARTIAL | Citations are filtered to supplied markers (`citationsUsedIn`, `packages/ai/src/grounding.ts:118`). Structured generations use strict JSON schema (`packages/ai/src/study.ts:28`). Nothing checks that a cited claim is actually supported, and there is no content screen on output (see NIST harmful content, §6). |
| LLM01-06 | Least privilege for the model | PASS | No tool or function calling. The model cannot read or write data. All persistence goes through the server after ownership checks. |
| LLM01-07 | Filter what enters the vector store | PARTIAL | Bounded by `MAX_OCR_PAGES` (40) and `MAX_CHUNKS_PER_DOCUMENT` (4000) (`apps/web/lib/validation.ts:21-22`) and by byte/type checks (§5). Chunk text is not screened for injection patterns before embedding. That is acceptable only while LLM01-02/03 hold and LLM01-04 is added. |
| LLM02-01 | No cross-user or cross-room leakage through retrieval | PASS | `match_study_chunks` is `security invoker`, filters room and owner, and RLS applies (`supabase/migrations/002_core_loop.sql:150-191`). Tests: `tests/database-security.test.mjs` ("User A cannot read, update or delete User B …"). |
| LLM02-02 | Minimize what student content the model provider keeps | **FIXED** (direct) / OPS | The Responses API stores responses by default. Direct-OpenAI calls now send `store: false` (`responseOptions()`, `packages/ai/src/client.ts`; test in `client.test.ts`). The AI Gateway and Ollama paths are unchanged until verified. **OPS:** confirm the OpenAI org's data controls and retention, and sign a DPA. Required for COPPA third-party disclosure (§6). |
| LLM02-03 | Database and storage error text is not returned to clients | **FIXED** | `detail: error.message` removed from `/api/documents/upload`, `/api/documents/[documentId]`, `/api/chat`, `/api/quiz` and `/api/flashcards`. Logs keep error codes only. |
| LLM02-04 | Streamed errors do not leak provider internals | PARTIAL | `/api/chat` sends `error.message` of any thrown error in the SSE `error` event. Map these to fixed learner-facing strings. |
| LLM03-01 | No floating dependency specifiers | **FIXED** | 19 `"latest"` specifiers pinned to the versions the lockfile already resolved (React 19.3.0, openai 7.15.0, TypeScript 7.0.2, …). |
| LLM03-02 | Reproducible installs | **FIXED** | CI used `pnpm install --no-frozen-lockfile` (`.github/workflows/ci.yml`), which together with `latest` could resolve new versions on every run. Now `--frozen-lockfile`. |
| LLM03-03 | Known-vulnerable dependencies | **FIXED** | `next` 16.3.4 → 16.3.8 (critical `next/og` RCE; `next/og` is not used, but the patch is in the same minor line). `sharp` → 0.35.5 and `source-map-js` → 1.2.2 via root `pnpm.overrides`. CI now runs `pnpm audit --prod --audit-level high`. One remaining moderate (sprintf-js, no patch) is reachable only through mammoth's CLI argument parser, which Studigo never calls. Accepted. |
| LLM03-04 | Secret scanning and dependency updates in CI | FAIL | No secret scanning and no Dependabot/Renovate. Enable GitHub secret scanning with push protection, and Dependabot security updates. Actions are pinned to tags, not SHAs (low). |
| LLM05-01 | Model text is rendered safely | PASS | `RichText` (`apps/web/components/room/rich-text.tsx`) parses into React nodes only. No `dangerouslySetInnerHTML` on model text. The `innerHTML` uses in `components/companion/*` and `components/home/*` write static strings only. |
| LLM05-02 | No auto-linked or active content in model output | PASS | The rich-text parser has no link or image node type. |
| LLM08-01 | RLS on chunks and embeddings; browser writes revoked | PASS | `chunks_select_own` (`001_initial.sql:166`). Insert/update/delete revoked (`002_core_loop.sql:33`). Composite ownership constraints are tested ("Composite ownership constraints reject…"). |
| LLM08-02 | The retrieval function cannot widen scope | PASS (note) | Authenticated callers may pass `p_owner_id`, but invoker RLS still limits rows to `auth.uid()`. Hardening option: ignore `p_owner_id` unless `current_user = 'service_role'`. |
| LLM08-03 | Deleting a source removes its vectors | PASS | FK cascade. Test: "Deletion cascades atomically…". |
| LLM10-01 | Accounts cannot be minted at will to spend AI budget | **FIXED** (code) / **OPS** | Live: anonymous sign-ins are enabled, and 52 of 54 users are anonymous. With the public anon key, anyone could create unlimited accounts and drive upload, OCR, embedding and chat costs. Code: `isSignedInAccount` (`apps/web/lib/account-kind.ts`) makes middleware, `getUser`, `requireUser` and `requireApiUser` treat anonymous sessions as signed out. Migration `20261007120000_block_anonymous_writes.sql` adds restrictive RLS that blocks anonymous inserts on rooms, conversations, plan events and stored originals, so direct PostgREST/Storage access is closed too. Test: "Anonymous Auth sessions cannot create…". **OPS:** disable anonymous sign-ins in Supabase Auth, then decide whether to purge the 52 anonymous users and their 16 rooms and 14 documents. |
| LLM10-02 | Per-user rate limits and quotas on AI routes | **FAIL — blocker** | No limits on `/api/chat`, `/api/learn*`, `/api/quiz`, `/api/flashcards`, `/api/practice-tests*`, `/api/topics`, `/api/documents/upload`, `/process` or `/reindex`. See VC-01 for the edge layer. App layer: add a per-user daily budget table checked before provider calls. |
| LLM10-03 | Output-token caps on model calls | FAIL | No `max_output_tokens` on any `responses.create`. Set it per call (chat, quiz JSON, topic map, OCR), sized from measured outputs so structured responses are not truncated. |
| LLM10-04 | Input bounds | PASS | Question ≤4000 chars (`apps/web/app/api/chat/route.ts:49`). History ≤6×4000 (`packages/ai/src/grounding.ts:133`). OCR ≤40 pages, ≤4000 chunks. Embedding inputs ≤24k chars. Provider timeout 120 s with 2 retries (`client.ts:64-65`). |
| LLM10-05 | Reprocessing cannot loop | FAIL | `/api/documents/reindex` calls `processDocument({force:true})`, which deliberately resets `attempts` (`apps/web/lib/ingest.ts:71`). It has no cooldown, so one study guide can be re-OCR'd and re-embedded without limit. Add a cooldown, or count it against the LLM10-02 budget. |
| LLM10-06 | Provider-side spend limits and alerts | NOT VERIFIED / OPS | Set OpenAI project budget alerts and hard limits. |

## 2. OWASP API Security Top 10 2023

| ID | Control | Status | Evidence / action |
|---|---|---|---|
| API1 | Object-level authorization (`documentId`, `roomId`, `topicId`, `cardId`, `questionId`, `testId`) | PASS | Every route proves ownership with the user-scoped (RLS) client before any service-role read or write, then passes `owner_id = user.id` to the service RPC. Examples: `/api/flashcards/[cardId]`, `/api/quiz/attempt`, `/api/practice-tests/submit`, `/api/documents/*`, `/api/topics/[topicId]`, and `assertRoomAccess` (`apps/web/lib/retrieval.ts:131`). The DB tests cover cross-owner denial for every user table. |
| API2-01 | Bearer path | PASS | `requireApiUser` validates the token with Supabase Auth (`getUser(token)`). A malformed bearer never falls back to the cookie session (`apps/web/lib/auth.ts:41`). |
| API2-02 | Cookie path | PASS | Uses `getUser()` (server-verified), not `getSession()`. Middleware refreshes the session. |
| API2-03 | Anonymous sessions | **FIXED** | See LLM10-01. |
| API2-04 | Password policy and breached-password check | FAIL / OPS | Leaked-password protection is disabled (Advisor). The 8-character minimum is enforced only in the server action (`apps/web/lib/actions/auth.ts`), so direct Auth API sign-ups skip it. **OPS:** enable leaked-password protection and set the minimum length in Supabase Auth. |
| API2-05 | Account enumeration | PARTIAL (low) | `signUpAction` returns Supabase's `error.message` verbatim (`actions/auth.ts:62`), e.g. "User already registered". Return a neutral message. |
| API2-06 | Cron endpoint authentication | PASS (low note) | `CRON_SECRET` bearer check (`apps/web/app/api/internal/storage-cleanup/route.ts:6`). The comparison is not constant-time. Low risk for a high-entropy secret. |
| API3 | Property-level authorization (answer keys) | PASS | Column grant excludes answer-key columns (`002_core_loop.sql:235`, `20260914090000_practice_depth.sql:14`). Keys are returned only after an attempt, and practice-test keys only after submission. Tests: "Browser cannot select any private quiz answer column…", "Whole practice tests hide keys…". |
| API4 | Unrestricted resource consumption | **FAIL — blocker** | Same as LLM10-02 and VC-01. |
| API6-01 | Sensitive flow: signup | FAIL / OPS | No CAPTCHA on sign-up or sign-in. Enable Supabase Auth CAPTCHA (Turnstile/hCaptcha) and pass the token from `auth-form.tsx`. |
| API6-02 | Sensitive flow: upload | PARTIAL | Authenticated, owner-checked, type- and byte-checked (§5). Not rate-limited (LLM10-02). |
| API6-03 | Sensitive flow: waitlist | PARTIAL | In-memory per-instance limiter (`apps/web/lib/waitlist.ts:67`). `docs/WAITLIST_API.md:141` already calls for a WAF rule. |
| API8-01 | Security headers | **FIXED** (partial CSP) | `apps/web/next.config.ts` now sends an enforced CSP (`frame-ancestors 'self'; base-uri 'self'; object-src 'none'`), `X-Frame-Options: SAMEORIGIN`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, and a full CSP in **Report-Only**. Verified on a local production build. Framing is `'self'`, not `'none'`, because the homepage demo and `/dev/study` frame same-origin pages. Next step: browser pass, then enforce the full policy (nonce-based if `'unsafe-inline'` scripts must go). |
| API8-02 | Database function hardening | **FIXED** | `touch_updated_at` `search_path` pinned in the new migration. |
| API8-03 | Schema drift | FAIL / OPS | `public.mf_agreements` and `public.mf_bookings` exist in the live Studigo database. No Studigo migration creates them. Confirm the owner, then move or drop them through a migration. |
| API9-01 | Dev and local-beta routes | PASS | `/dev/*` and `/api/dev/*` return 404 unless `NODE_ENV=development`. Local beta requires development, `STUDIGO_LOCAL_BETA=1`, a loopback host and a same-origin request (`apps/web/lib/local-beta-access.ts`). Production returns 404 (verified). |
| API9-02 | Versioned and flagged routes | PASS | `/api/v1/learning/sessions` returns 404 unless `STUDIGO_DURABLE_SESSIONS=1`. `/api/v1/learning/progress` is owner-checked. |
| AUX-01 | Auxiliary services authenticated | **FAIL — blocker if deployed** | Found by the readiness gate (GMS-ACCESS-003), not by this pass. The optional Python retrieval service (`services/retrieval/app/main.py`) accepts room IDs with no authenticated Studigo principal. Keep it loopback-only, or add service authentication and caller/room authorization before any non-local deployment. |
| CI-01 | Protected `main` and required checks | **FAIL / OPS** | Found by the readiness gate (GMS-CI-001). `main` is unprotected, so CI (including the new audit step) is advisory. Enable branch protection with required status checks. |
| API9-03 | API inventory | PARTIAL | No single route inventory with each route's auth, cost class and limit. `/game` ships in the web build (static; production currently returns 404). AI_HANDOFF says the game must not be linked from `apps/web`. Remove the route or document it. |

## 3. Next.js data security

| ID | Control | Status | Evidence / action |
|---|---|---|---|
| NX-01 | Validate route parameters and bodies | PARTIAL | Most bodies are type-checked. Path params (`[documentId]`, `[cardId]`, `[topicId]`) are not UUID-validated; Postgres rejects bad input and the route returns 404. Some routes call `.trim()` on unchecked body fields (e.g. `/api/quiz` `roomId`), so a non-string returns 500. Add one shared UUID/body validator. |
| NX-02 | Authorize ownership, not just login | PASS | See API1. |
| NX-03 | Return only the fields the UI needs | PASS | Explicit `select` lists on user-facing reads. `select('*')` is used only server-side and then projected (quiz attempt, practice-test submit). |
| NX-04 | Headers and CSP | **FIXED** (partial) | See API8-01. |
| NX-05 | Server-only modules are marked | PARTIAL | `apps/web/lib/supabase/service.ts` and `packages/ai` are imported only from server code today (verified: no client imports; only the `NEXT_PUBLIC_SUPABASE_*`, `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_STUDIGO_COMPANION` vars are referenced). Add `import "server-only"` to `service.ts` so the build fails if that changes. |
| NX-06 | Rate limiting on expensive operations | **FAIL — blocker** | See LLM10-02. |
| NX-07 | No open redirects | PASS | `safeNext` (`apps/web/lib/validation.ts`). `appOrigin` comes from deployment config, never the request host (`apps/web/lib/app-origin.ts`). |
| NX-08 | Server Actions authorize | PASS | Room actions call `requireUser`, and writes go through the RLS client (`apps/web/lib/actions/rooms.ts`). |

## 4. Supabase and Vercel

| ID | Control | Status | Evidence / action |
|---|---|---|---|
| SB-01 | RLS on every table | PASS | Live query: no `public` table without RLS. Service-only tables (`storage_cleanup_jobs`, `learning_session_receipts`) have RLS with no policies, which is intended. |
| SB-02 | Anonymous sign-ins | **FIXED** (code) / **OPS** | See LLM10-01. Policies now check the `is_anonymous` claim for writes. Supabase sets no automatic cleanup and defaults to 30 anonymous sign-ins per hour per IP. Disable the feature. |
| SB-03 | Leaked-password protection | FAIL / OPS | Advisor warning. Enable it. |
| SB-04 | CAPTCHA on auth | FAIL / OPS | Not configured in code. See API6-01. |
| SB-05 | Auth rate limits, short OTP/magic-link expiry, email confirmation | NOT VERIFIED / OPS | Not readable through the available tools. Check Auth → Rate Limits and Providers → Email. |
| SB-06 | Custom SMTP | NOT VERIFIED / OPS | The default Supabase SMTP is rate-limited and not for production. |
| SB-07 | SSL enforcement and network restrictions | NOT VERIFIED / OPS | Database → Settings. |
| SB-08 | MFA on the Supabase and Vercel owner accounts | NOT VERIFIED / OPS | Account settings. |
| SB-09 | Backups / PITR | NOT VERIFIED / OPS | Confirm the plan's backup tier. |
| SB-10 | Security Advisor clean | PARTIAL | `search_path` lint is fixed by the migration. The anonymous-access lints clear once anonymous sign-ins are disabled. The no-policy INFO findings are intended. The `mf_*` tables are API8-03. |
| SB-11 | Private storage, owner-folder policies | PASS | Bucket `public=false`. Policies key on `foldername[1] = auth.uid()` (`001_initial.sql:260-278`). Test: "Stored-original policies prevent cross-owner…". |
| SB-12 | Storage-layer size and type limits | **FIXED** | The migration sets `file_size_limit` = 50 MB and an `allowed_mime_types` list that mirrors `packages/documents`. |
| SB-13 | Service-role key server-only | PASS | Referenced only in `apps/web/lib/supabase/service.ts`. Never `NEXT_PUBLIC_`. |
| VC-01 | Vercel WAF rate limiting | **FAIL — blocker / OPS** | No firewall config exists. Proposed rules, each starting with the **Log** action for a day, then Deny/429. Counters are per region, so set limits per region. (1) `/api/chat`, `/api/learn*`, `/api/quiz`, `/api/flashcards`, `/api/practice-tests*`, `/api/topics`: ~60/min per IP. (2) `/api/documents/upload`, `/process`, `/reindex`: ~10/min per IP. (3) `/login`, `/signup` POST: ~10/min per IP. (4) `/api/waitlist`: ~5/min per IP. These are an edge backstop; per-user budgets (LLM10-02) remain necessary because IP limits do not bound one account spread across IPs. |
| VC-02 | Preview deployments do not expose production data | NOT VERIFIED / OPS | `appOrigin` trusts `VERCEL_URL` on preview. Confirm Deployment Protection is on for previews, and whether previews use the production Supabase project and OpenAI key. |
| VC-03 | Cron secret | PASS | See API2-06. |
| VC-04 | Environment variable scoping | NOT VERIFIED / OPS | Confirm `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` and `CRON_SECRET` are marked Sensitive and scoped to the environments that need them. |

## 5. File uploads (OWASP File Upload Cheat Sheet)

| ID | Control | Status | Evidence / action |
|---|---|---|---|
| UP-01 | Extension and type allowlist | PASS | `ALLOWED_MIME_TYPES` and `assertUploadAllowed` (`packages/documents/src/types.ts`, `index.ts`). |
| UP-02 | Magic-byte / content validation | **FIXED** | Before: the declared MIME type or extension decided the type. Now `assertContentMatchesType` (`packages/documents/src/file-safety.ts`) checks the bytes. PDF: `%PDF-` within 1 KB. PNG, JPEG and WEBP: signatures. DOCX/PPTX: a ZIP containing `word/document.xml` or `ppt/presentation.xml`. Text: no NUL bytes, valid UTF-8. Called in `/api/documents/upload` before storage. Test: `packages/documents/src/file-safety.test.ts`. |
| UP-03 | Server-generated storage names | PASS | `{userId}/{roomId}/{uuid}-{sanitized}` (`buildDocumentStoragePath`). The original name is display-only. |
| UP-04 | Size limits and decompression bombs | **FIXED** (partial) | 50 MB cap (app and bucket). `assertSafeZip` reads the ZIP central directory and rejects >5000 parts, >300 MB declared uncompressed, or >100× expansion. It runs at upload and again before DOCX/PPTX extraction. **Limitation:** a hand-crafted archive can understate sizes in its central directory, and PDF object-stream bombs are not covered. The full fix is the durable worker with memory/time budgets (Hardening Plan Phase 3). |
| UP-05 | Malware scanning / content disarm for PDF and Office | **FAIL** | None. Originals are served back only through 120 s signed URLs to their owner (`documents/download/route.ts:35`), which limits spread. Before school distribution, add scanning (e.g. ClamAV in the ingestion worker, or a scanning service) and treat unscanned files as `queued`. |
| UP-06 | Safe ZIP handling | PASS | Archives are parsed in memory and never extracted to disk, so there is no path-traversal surface. Bomb limits are covered in UP-04. |
| UP-07 | Heavy work out of the upload request | PARTIAL | Upload only stores and queues. Extraction, OCR and embedding run in a separate client-triggered `/api/documents/process` request (300 s), so this is still request-bound. Hardening Plan Phase 3 replaces it with a durable worker. |
| UP-08 | Downloads authorized and short-lived | PASS | RLS ownership check, then a 120 s signed URL from the private bucket. |
| UP-09 | Upload size reachable on the platform | NOT VERIFIED | Vercel Functions cap request bodies at about 4.5 MB, so the 50 MB limit may not be reachable through `/api/documents/upload`. Verify. If confirmed, move to signed direct-to-Storage uploads, which the new bucket limits and the anonymous-insert policy already cover. |

## 6. Children and education privacy

| ID | Control | Status | Evidence / action |
|---|---|---|---|
| PR-01 | COPPA applicability decided | **FAIL — blocker for any under-13 audience** | `docs/PRODUCT.md:128` says Studigo "may eventually be used by minors". The development fixture is "Fifth Grade Science" (ages ~10–11). Sign-up collects email and name with no age screen. Per the White & Case summary, the amended rule's compliance date (22 Apr 2026) has passed. Counsel must decide: (a) a 13+ age screen with terms that exclude younger children, or (b) full COPPA compliance. |
| PR-02 | COPPA: written information security program, reviewed at least annually | FAIL | None. This checklist can seed it; it needs an owner, scope, risk assessment and review cadence. |
| PR-03 | COPPA: no indefinite retention; a written retention policy | FAIL | No retention policy. 52 anonymous accounts with data persist indefinitely. Only deleted documents are cleaned up (`storage_cleanup_jobs` cron). |
| PR-04 | COPPA: separate parental consent for third-party disclosure | FAIL | Student materials and messages go to OpenAI (and optionally the Vercel AI Gateway). With an under-13 audience, this disclosure needs its own consent. |
| PR-05 | Privacy policy, terms, account deletion, data export | FAIL | No privacy or terms page in `apps/web/app`. No account-deletion or export flow. Room deletion cascades correctly (tested). Already tracked in `docs/APP_STORE_RELEASE_PLAN.md:112`. |
| PR-06 | FERPA "school official" readiness (only if schools adopt Studigo) | FAIL (deferred) | Needs a contract template that covers an institutional service, school direct control, use limited to the authorized purpose, and the school's legitimate-interest criteria. Also needs per-school data segregation and deletion on termination. Not needed for direct-to-learner launch; required before any school sale. |
| PR-07 | NIST AI 600-1: confabulation | PARTIAL | Grounded-only system prompt, an insufficient-evidence refusal, and citations limited to supplied excerpts. The live, human-reviewed RAG scorecard is still open (Hardening Plan Phase 1). |
| PR-08 | NIST AI 600-1: data privacy | PARTIAL | RLS, private storage and `store:false` are in place. PR-03, PR-04 and PR-05 are open. |
| PR-09 | NIST AI 600-1: harmful content (minors) | FAIL | No moderation of learner input or model output. Add the provider moderation endpoint (or equivalent) on learner messages and generated text, with a safe-messaging response path for self-harm content. |
| PR-10 | NIST AI 600-1: third-party components | PARTIAL | §1 LLM03 fixes are in place. Still needed: vendor list and DPAs (OpenAI, Supabase, Vercel, Google Sheets/FormSubmit for the waitlist). |

---

## Launch-blocker order

Work these top-down. "Code" items can land through PRs. "OPS" items need an account owner in a dashboard.

| # | Item | Type | State after this branch |
|---|---|---|---|
| 1 | Disable Supabase anonymous sign-ins (LLM10-01, SB-02) | OPS | Code and RLS defenses landed; **dashboard toggle pending** |
| 2 | Edge rate limits: Vercel WAF rules (VC-01) | OPS | Rules proposed above; **not created** |
| 3 | Per-user AI/ingestion budgets, reindex cooldown, output-token caps (LLM10-02/03/05) | Code | Open |
| 4 | COPPA audience decision and age screen (PR-01) | Counsel + code | Open |
| 5 | Privacy policy, terms, retention policy, account deletion (PR-03, PR-05) | Counsel + code | Open |
| 6 | CAPTCHA, leaked-password protection, password minimum, auth rate limits, SMTP (API2-04, API6-01, SB-03..06) | OPS + small code | Open |
| 7 | Prompt-injection live eval suite (LLM01-04) | Code/eval | Open; boundary fixes landed |
| 8 | Moderation for a minor audience (PR-09) | Code | Open |
| 9 | Malware scanning and durable worker (UP-05, UP-07) | Code/infra | Open; byte and ZIP checks landed |
| 9a | Lock down or authenticate the Python retrieval service (AUX-01); protect `main` (CI-01) | Code + OPS | Open |
| 10 | Purge 52 anonymous users and their data; remove `mf_*` tables (API8-03) | OPS (destructive; needs explicit approval) | Open |
| 11 | Enforce full CSP after a browser pass (API8-01) | Code | Report-Only shipped |
| 12 | Secret scanning and Dependabot (LLM03-04); `server-only` marker (NX-05); shared param validator (NX-01); neutral sign-up errors (API2-05) | Code/OPS | Open |

### Fixed on this branch

| Change | Files | Test |
|---|---|---|
| Anonymous sessions treated as signed out | `apps/web/lib/account-kind.ts`, `lib/auth.ts`, `middleware.ts` | `lib/account-kind.test.ts` |
| Restrictive RLS: no anonymous inserts; bucket size/MIME limits; `touch_updated_at` search_path | `supabase/migrations/20261007120000_block_anonymous_writes.sql` | `tests/database-security.test.mjs` (fails without the migration, passes with it) |
| Topic titles and practice text kept out of raw system-prompt text; browser directives ignored | `lib/directive-format.ts`, `lib/engine.ts`, `lib/recommendation-engine.ts`, `app/api/chat/route.ts`, `components/room/coach-panel.tsx` | `lib/prompt-boundary.test.ts` |
| Upload byte checks and ZIP-bomb guard | `packages/documents/src/file-safety.ts`, `index.ts`, `app/api/documents/upload/route.ts` | `packages/documents/src/file-safety.test.ts` |
| `store: false` on direct OpenAI Responses calls | `packages/ai/src/client.ts`, `grounding.ts`, `study.ts`, `ocr.ts` | `packages/ai/src/client.test.ts` |
| DB error text no longer returned to clients | upload, document delete, chat, quiz and flashcards routes | — |
| Security headers and Report-Only CSP | `apps/web/next.config.ts` | Verified with `next start` + `curl -I` |
| Dependency pins, Next 16.3.8, sharp/source-map-js overrides, frozen-lockfile CI, audit gate | `package.json` files, `pnpm-lock.yaml`, `.github/workflows/ci.yml` | `pnpm audit --prod --audit-level high` exits 0 |

These changes narrow several P0 controls (GMS-FILE-002, GMS-FILE-003, GMS-AI-001, GMS-AUTH-001) but close none of them, so every one stays `partial`. The gate showed 25 open blockers after this audit; catalog 2026-10-07 added four blocker controls this audit surfaced (GMS-AUTH-004, GMS-AI-008, GMS-PRIV-004, GMS-OPS-003), so the current gate shows 29.

### Deploy note

Apply migration `20261007120000_block_anonymous_writes.sql` with the normal migration flow. It only adds restrictive insert policies and bucket limits. Real accounts are unaffected, and anonymous users keep read and delete access to what they already own.

## Re-running this audit

- `pnpm test` (unit and DB security), `pnpm audit --prod --audit-level high`
- Supabase Security Advisor, plus `select count(*) filter (where is_anonymous) from auth.users`
- Vercel → Firewall → confirm the rate-limit rules are active
- `curl -I https://<production-domain>/` for headers
- Re-check this file's NOT VERIFIED rows each release
