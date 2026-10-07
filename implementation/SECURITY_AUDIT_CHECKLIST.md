# Security audit checklist

Status: first pass, 2026-10-07. Static review of the code this branch is based on (`main` at `aa5898b`), plus `pnpm audit --prod`. Nothing was run against the live site, and Supabase and Vercel dashboard settings were not visible.

## How to read this

Each row is one documented control, mapped to Studigo with a status and the evidence behind it.

| Status | Meaning |
| --- | --- |
| Pass | Control is present and I saw the evidence in code or config |
| Partial | Present in part, or present with a known gap |
| Fail | Expected control not found |
| Not verified | Cannot be judged from the repo; needs a dashboard check, a test, or a decision |

Rows are numbered so they can be tracked in issues. "Fail" means "not found in the repo", so re-check before treating one as final.

## Launch blockers, in order

1. **KIDS-01 to KIDS-06.** Student and child privacy: no age gate, parental consent, privacy policy, deletion flow, or retention policy.
2. **ABUSE-01, API-04, LLM-10.** No rate limits or quotas on chat, upload, or generation, and anonymous sign-up controls are unverified.
3. **DEP-01 to DEP-03.** Production advisories, and `latest` dependency pins with a non-frozen lockfile in CI.
4. **KIDS-07.** No model-output moderation layer for a product aimed at children.
5. **FILE-03, FILE-05, FILE-06.** Uploads: no magic-byte check, no decompression limits, no malware scanning.
6. **WEB-01.** No CSP, HSTS, frame protection, or Referrer-Policy.

## 1. OWASP Top 10 for LLM Applications 2025

| ID | Risk | Status | Evidence | Action |
| --- | --- | --- | --- | --- |
| LLM-01 | Prompt injection | Partial | Uploaded content is wrapped as untrusted data and every prompt carries a rule to treat it as content (`packages/ai/src/client.ts`). The eval has an `injection` scenario, but no run results. No input or output screening. | Run the injection cases, add output screening, record results |
| LLM-02 | Sensitive information disclosure | Partial | Retrieval is owner and room scoped under RLS (Pass). Student content goes to OpenAI with no consent or age controls (see KIDS). Only 2 `console` calls in `apps/web/app/api` and `apps/web/lib`, so little content logging. | Resolve KIDS items; document what is sent to the provider |
| LLM-03 | Supply chain | Fail | See DEP-01 to DEP-03. | See DEP rows |
| LLM-04 | Data and model poisoning | Partial | Documents are per owner, so poisoning only affects the uploader's own room. This changes if shared rooms are added. | Re-assess before any sharing feature |
| LLM-05 | Improper output handling | Pass | No `dangerouslySetInnerHTML` on user or model content; the `innerHTML` uses are static templates. The rich-text files contain no link or image rendering. | Keep a test that fails if links or images are added without review |
| LLM-06 | Excessive agency | Pass | No model tool, function-calling, or file-search usage found in `packages/ai` or `apps/web`. | Re-check if tools are ever added |
| LLM-07 | System prompt leakage | Not verified | System prompt is in `packages/ai/src/grounding.ts`. It holds no secrets, but there is no leakage test. | Add an eval case that asks for the system prompt |
| LLM-08 | Vector and embedding weaknesses | Pass | `match_study_chunks` is `security invoker` and filters by owner and room; chunks have a select-own RLS policy. The `p_owner_id` argument relies on RLS to stay safe. | Add a test for a caller passing another user's `p_owner_id` |
| LLM-09 | Misinformation | Partial | Grounded prompt, citations, abstention when no chunk passes the cutoff. Citation check is marker-based, not claim-level. | See `MEASURED_EVIDENCE_PLAN.md` step 7 |
| LLM-10 | Unbounded consumption | Fail | No quota or rate limit on `/api/chat`. A turn can run 120 s with 2 SDK retries. | See ABUSE rows |

## 2. OWASP API Security Top 10 2023

| ID | Risk | Status | Evidence | Action |
| --- | --- | --- | --- | --- |
| API-01 | Broken object level authorization | Pass (static) | Routes read through the user-scoped client, so RLS applies. `documents/download` selects by id under the caller's session. `tests/database-security.test.mjs` exercises RLS roles. | Add route-level tests that request another user's ids |
| API-02 | Broken authentication | Partial | Bearer parsing rejects malformed tokens and does not fall back to cookies (`apps/web/lib/auth.ts`, `bearer-auth.ts`). Auth rate limits and CAPTCHA unverified. | Check Supabase Auth settings |
| API-03 | Broken object property level authorization | Pass (route) | `/api/quiz` selects `id, kind, prompt, choices, difficulty, topic_id` with no answer key. Not verified: whether a client can read answer keys straight from `quiz_questions` with the anon key. | Test a direct table read |
| API-04 | Unrestricted resource consumption | Fail | No limits on chat, upload, quiz, or flashcard generation. Upload cap is 50 MB, OCR 40 pages, 4000 chunks per document. | See ABUSE rows |
| API-05 | Broken function level authorization | Pass | `/api/internal/storage-cleanup` requires `CRON_SECRET`; dev routes return 404 outside development. | Use a constant-time compare for the secret |
| API-06 | Unrestricted access to sensitive business flows | Fail | Signup, upload, and generation flows have no abuse controls. | See ABUSE rows |
| API-07 | Server-side request forgery | Not verified | No user-supplied URL fetching seen in the routes I read. | Grep for `fetch(` on user input before launch |
| API-08 | Security misconfiguration | Fail | No security headers (WEB-01). 22 handlers return `error.message`, some as `detail:`. | See WEB-01, ERR-01 |
| API-09 | Improper inventory management | Partial | `/api/dev/*` and `/dev/*` are gated to development. `local-beta` is gated by development, an env flag, and loopback. Several `v1` and `learning` routes are flag-dependent. | Keep a route inventory with owner and auth mode |
| API-10 | Unsafe consumption of APIs | Partial | Model JSON output is schema-constrained and normalized (`structured()`, `normalizeGeneratedQuestion`). Waitlist posts to a Google Sheets endpoint. | Validate waitlist upstream responses |

## 3. Next.js data security audit list

| ID | Check | Status | Evidence | Action |
| --- | --- | --- | --- | --- |
| NEXT-01 | Isolated data access layer, secrets read only there | Partial | Supabase clients live in `apps/web/lib/supabase/`. Only `lib/coach-router.ts` imports `server-only`; the service-role client module does not. | Add `import "server-only"` to `service.ts` and other server modules |
| NEXT-02 | `"use client"` props do not carry private data | Not verified | Not reviewed. | Review client component props |
| NEXT-03 | `route.ts` handlers authenticate and authorize | Pass (static) | Chat, upload, and download call `requireApiUser` and check room ownership. | Table of every route and its auth mode |
| NEXT-04 | Server Actions re-authorize inside each action | Not verified | `lib/actions/auth.ts` and `rooms.ts` not reviewed in depth. | Review each action |
| NEXT-05 | Dynamic route params validated | Partial | IDs are checked with `isInteractionId` in chat; other routes not all reviewed. | Validate every `[param]` |
| NEXT-06 | Return values minimal | Partial | `/api/quiz` is minimal; 22 handlers return raw error text. | See ERR-01 |
| NEXT-07 | Rate limiting on expensive operations | Fail | See ABUSE rows. | See ABUSE rows |
| NEXT-08 | CSP and security headers | Fail | `next.config.ts` has no headers; `vercel.json` only defines the cron. | See WEB-01 |

## 4. Supabase and Vercel

| ID | Check | Status | Evidence | Action |
| --- | --- | --- | --- | --- |
| SUPA-01 | RLS enabled on every table | Pass | Scan of all migrations: every created table has `enable row level security`. | Keep the scan as a CI test |
| SUPA-02 | Storage policies scoped per user | Pass | `study-materials` policies match the first folder to `auth.uid()`; downloads use 120 s signed URLs. | None |
| SUPA-03 | Service-role key kept out of the browser | Pass (static) | Read from server modules in `apps/web/lib/supabase/service.ts`; README says it is server-only. The module has no `server-only` import. | Add `server-only` guard (NEXT-01) |
| SUPA-04 | SSL enforcement and network restrictions | Not verified | Dashboard setting. | Check and record |
| SUPA-05 | MFA on the org and owner accounts, multiple owners | Not verified | Dashboard setting. | Check and record |
| SUPA-06 | Email confirmation, custom SMTP, OTP expiry at or under 1 hour | Not verified | Dashboard setting. | Check and record |
| SUPA-07 | Auth rate limits and CAPTCHA | Not verified | Dashboard setting. | Check and record |
| SUPA-08 | Anonymous sign-ins: CAPTCHA, `is_anonymous` in policies, cleanup | Not verified | The app reads `is_anonymous` in `app/app/layout.tsx`, but I found no `signInAnonymously` call, no policy using the claim, and no cleanup job. A comment in `auth.ts` says middleware signs visitors in anonymously; it does not. | Decide whether anonymous mode is on; if yes, enable CAPTCHA and add cleanup |
| SUPA-09 | Security Advisor reviewed | Not verified | Dashboard tool. | Run and record |
| VERCEL-01 | WAF rate-limit rules on `/api/*` | Not verified | No rules in the repo. Counters are per region, and a Log action lets a rule be tested first. | Add rules for chat, upload, auth, waitlist |

## 5. File uploads (OWASP File Upload cheat sheet)

| ID | Check | Status | Evidence | Action |
| --- | --- | --- | --- | --- |
| FILE-01 | Extension allowlist | Pass | `ALLOWED_MIME_TYPES` and extension map in `packages/documents/src/index.ts`. | None |
| FILE-02 | Content-type validation | Partial | Declared type is used when allowed, else the extension decides. A client can label a file. | Treat declared type as a hint only |
| FILE-03 | Magic-byte validation | Fail | No signature check found. | Check signatures per format before storing |
| FILE-04 | Safe filenames | Pass | Storage path is `userId/roomId/documentId-` plus a name cleaned by `sanitizeFilename` (`packages/documents/src/index.ts`). | None |
| FILE-05 | Size and decompression limits | Partial | 50 MB cap; the whole file is read into memory in the request. PPTX and DOCX are zip files opened with JSZip and mammoth with no uncompressed-size limit seen. | Cap entry count and uncompressed size; stream where possible |
| FILE-06 | Malware scan or content disarm | Fail | None found. | Scan, or isolate parsing in a sandboxed worker |
| FILE-07 | Private storage, authenticated access | Pass | Private bucket, owner folder policy, `requireApiUser` on upload. | None |
| FILE-08 | Heavy parsing outside the request | Fail | `AGENTS.md` requires it; ingestion runs inside the request (README admits this). | `MEASURED_EVIDENCE_PLAN.md` step 10 |

## 6. Children, student privacy, and AI risk

| ID | Check | Status | Evidence | Action |
| --- | --- | --- | --- | --- |
| KIDS-01 | Age gate and parental consent path | Fail | Not found. Eval bands cover grades 3 to 8. | Product and legal decision, then build |
| KIDS-02 | Privacy policy and terms | Fail | Roadmap lists them unchecked; no such pages in `apps/web/app`. | Write and publish |
| KIDS-03 | Account and data deletion | Fail | No account deletion found. Room deletion removes originals via a storage cleanup job. | Build account deletion with a data export |
| KIDS-04 | Retention policy | Fail | `docs/PRODUCT.md` states intent; roadmap lists it unchecked. | Define periods, automate deletion |
| KIDS-05 | Written information security program | Fail | None found. The amended COPPA rule requires one with annual review. | Adopt this checklist as the seed |
| KIDS-06 | Separate consent for third-party disclosure | Fail | Content is sent to OpenAI; no disclosure or consent flow found. | Document the disclosure and gate it |
| KIDS-07 | Output moderation for minors | Fail | No moderation call found. | Add a moderation layer and safety evals |
| KIDS-08 | FERPA school-official terms (if sold to schools) | Not verified | A process and contract question, not a code one. | Prepare vendor terms before school pilots |
| KIDS-09 | Vendor review of model and storage providers | Partial | Provider calls are isolated in `packages/ai`; roadmap lists vendor requirements unchecked. | Complete the vendor review |
| KIDS-10 | Confabulation controls (NIST AI 600-1) | Partial | Grounding and abstention exist; no measured results yet. | `MEASURED_EVIDENCE_PLAN.md` steps 1 to 3, 7 |

## 7. Cross-cutting findings

| ID | Finding | Status | Evidence | Action |
| --- | --- | --- | --- | --- |
| ABUSE-01 | No per-user quotas or budget caps on model-backed routes | Fail | `/api/chat`, upload, quiz, flashcards, practice tests. | Per-user and per-IP limits, a daily spend cap, and an alert |
| ABUSE-02 | Waitlist limiter is in memory per instance | Partial | Code comment says best-effort; platform rule is the durable layer. | Add a WAF rule |
| DEP-01 | Production advisories | Fail | `pnpm audit --prod` on 2026-10-07: critical in `next` (RCE in `next/og`; repo pins 16.3.4, fixed in 16.3.6 or later); high in `sharp` (below 0.35.5) and `source-map-js` (below 1.2.2); moderate in `sprintf-js`. The app does not import `next/og`, so the critical item is probably not reachable. | Upgrade `next`; update the others; add audit to CI |
| DEP-02 | Unpinned dependencies | Fail | `react`, `react-dom`, `@types/*`, `typescript`, `tsx` are `latest` in `apps/web/package.json`. | Pin exact versions |
| DEP-03 | Non-frozen lockfile in CI | Fail | `pnpm install --no-frozen-lockfile` in `.github/workflows/ci.yml`. | Use `--frozen-lockfile` |
| WEB-01 | No security headers | Fail | `next.config.ts` and `vercel.json` set none. | Add CSP, HSTS, `frame-ancestors`, Referrer-Policy, `X-Content-Type-Options` |
| ERR-01 | Raw error text returned to clients | Fail | 22 handlers return `error.message`; some include `detail: error.message` (for example `api/chat`, `api/quiz`). | Map to stable error codes; log details server-side |
| CLIENT-01 | Client-influenced system prompt text | Partial | In Ask mode only directives named "Current topic" or "Current topics" are kept (`directivesForTurn`), but their instruction text, up to 600 characters, comes from the client and reaches the system prompt. | Build that text server-side from topic ids |
| SECRET-01 | Cron secret compared with `!==` | Partial | `apps/web/app/api/internal/storage-cleanup/route.ts`. | Use a timing-safe compare |
| LOG-01 | No audit trail or telemetry | Fail | Only 2 `console` calls; no tracing. | `MEASURED_EVIDENCE_PLAN.md` step 9 |
| DOC-01 | Stale comment about anonymous sign-in | Partial | `apps/web/lib/auth.ts`. | Correct the comment |

## 8. Strengths worth keeping

- RLS on every table, with tests that run the real migrations in embedded Postgres (`tests/database-security.test.mjs`).
- Per-user storage folders and short-lived signed URLs.
- A `safeNext` redirect guard, and a development-only local-beta bypass limited to loopback.
- Untrusted-document envelope in every prompt, and no model tool use.
- Idempotent ingestion and interaction ids for Coach turns.

## 9. How to re-run this audit

1. `pnpm audit --prod` and record the result.
2. `pnpm test:security` for the database tests.
3. Re-run the RLS scan: every `create table` in `supabase/migrations` needs a matching `enable row level security`.
4. Grep for `error.message`, `dangerouslySetInnerHTML`, `fetch(`, and `process.env` outside server modules.
5. Walk the dashboard rows (SUPA-04 to SUPA-09, VERCEL-01) and record the answers with dates.
6. Update statuses and the date at the top.

## Limits of this review

- Static reading of the code at the base commit; no live testing, fuzzing, or penetration testing.
- Dashboard and account settings were not visible.
- COPPA and FERPA rows are technical checks drawn from public summaries, not legal advice. Have counsel confirm requirements and dates.
- OWASP ASVS is not used as a row set here. The page I fetched showed 4.0.3 as stable with 5.0 in release candidate, and I could not confirm a final 5.0. Choose a version and level before a formal ASVS pass.

## Sources

- [OWASP Top 10 for LLM Applications 2025](https://genai.owasp.org/llm-top-10/)
- [OWASP LLM Prompt Injection Prevention cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
- [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- [OWASP File Upload cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [Next.js data security guide](https://nextjs.org/docs/app/guides/data-security)
- [Next.js Content Security Policy guide](https://nextjs.org/docs/app/guides/content-security-policy)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Vercel WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
- [White & Case summary of the amended COPPA Rule](https://www.whitecase.com/insight-alert/unpacking-ftcs-coppa-amendments-what-you-need-know)
- [FERPA school official criteria (U.S. Department of Education)](https://studentprivacy.ed.gov/faq/who-school-official-under-ferpa)
- [NIST AI 600-1, Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
