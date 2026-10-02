# Integrated adaptive web beta

## Scope and baseline

Implementation branch: `codex/adaptive-local-beta`. Current main baseline: `2d63b0042f3577981bd41c7879a64661dfdfafd6`; PR #59 documentation baseline: `5375cc445670f27fee2a6199206efa53f01bf594`. PR #59 remains a prerequisite documentation change, not proof of completed implementation.

The existing main interface is preserved. The only component change refreshes authoritative study data after a Coach turn. Claude retains UI/UX ownership, including future evidence-stage presentation and Coach mode controls.

## Test the existing app locally

Run `pnpm install --frozen-lockfile`, then `pnpm beta` on Node 22.13 or newer. Open `http://localhost:3000/api/local-beta/open`. This opens the existing `/app` interface with private synthetic rooms, without credentials. Keep the terminal running.

Use Coach to answer a question, request help, and answer again. Complete Quiz, inspect Progress/Weak Areas, reveal and rate Flashcards, and submit a Practice Test. Reload during a pending task to check recovery. Materials accepts bounded TXT/Markdown uploads; download the study guide or open a citation. PDF/OCR ingestion and live generation require the configured hosted services.

Local SQLite state is account-session scoped in `apps/web/.local-beta/study.sqlite`. The sandbox requires development mode, explicit opt-in, loopback hosting and same-origin requests. Production cannot activate its authentication bypass. Existing browser controls and API contracts consume the synthetic adapter; authored fixtures are not represented as model responses.

## Implemented backend changes

- Shared pure TypeScript learning package preserves the ten reasoning rungs, six scaffolds and existing progression thresholds.
- Canonical replay projection adds evidence stages and independent recall intervals of 1/3/7/14 days. Help and self-report do not manufacture independence.
- Deterministic session policy uses explicit server time, stable ordering, teacher scope, source eligibility, pending encounters and budget boundaries.
- Local issued tasks, assistance, responses, grades, drafts and retry receipts persist atomically; integrated quiz/test/card evidence updates the same local projection.
- Hosted Coach can opt into source-revision validation, durable issued encounters, immutable accepted semantic evaluations, atomic evidence writes and optimistic conversation/projection checks.
- Verified Supabase bearer authentication extends cookie authentication. `/api/v1/learning/progress` exposes canonical server projections and recommendations.
- Study-guide download source selection avoids arbitrary unrelated chunks and incomplete silent pagination.
- Historical Coach preferences remain intact with compatibility mapping for future modes. Explanation levels remain room-wide.

## Validation

`pnpm typecheck` and `pnpm test` passed: 384 tests, including 35 database isolation/security/transaction tests. Browser verification passed on desktop and phone viewport sizes with no page errors. It covered the existing Coach and five-question Quiz UI, progress/plan/cram/materials rendering, persisted uploads, source/PDF downloads, self-rated cards, practice-test drafts/results and two-session isolation.

Run browser verification with `node scripts/verify-integrated-beta.mjs`; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if Chromium is installed outside Playwright's default location. Machine-local evidence lives in `.local-beta/verification/results.json` and screenshots. These are synthetic web checks, not physical iOS or live-provider acceptance evidence.

## Migration, activation and rollback

`20261002010000_adaptive_coach_transactions.sql` is additive. It preserves historical data and adds a conversation revision, private encounter/evaluation/receipt tables, read-only canonical projections, and service-only transactional RPCs. Applied to the configured Studigo Supabase project after local security tests.

Enable `STUDIGO_ATOMIC_COACH=1` and `STUDIGO_ADAPTIVE_SESSION=1` on a preview deployment. Leave production flags unset until hosted authenticated acceptance passes. Rollback disables these flags and restores the prior app deployment; retain the additive tables and collected events. No destructive schema rollback is required.

## Remaining release gates

This is an integrated web beta, not the complete TestFlight delivery. Live authenticated generation, hosted downloads, source deletion and multi-tab concurrency need hosted acceptance. Local generation is authored and cannot establish citation quality or cost/latency targets. Production quiz/test issuance still needs complete trusted evidence provenance; historical unknown assistance remains conservative. Session plans need durable start/resume storage beyond the existing Coach encounter state. Existing UI percentages are compatibility projections pending Claude's presentation work.

The 120 reviewed RAG cases and measured Python comparison, durable queue worker, native Expo app and device/OAuth/accessibility checks, guardian/learner principals, parental consent/privacy/vendor/ZDR verification, offline BKT harness and measured performance/cost gates remain outstanding. No child pilot approval or production architecture benchmark selection is implied. Keep Python advisory/offline until its required evaluation supports a production change.
