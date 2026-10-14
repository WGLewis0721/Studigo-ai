# Studigo engineering implementation plan

> **Broader engineering backlog.** Cold start stays [`ENGINEERING.md`](../ENGINEERING.md). The document-learning reliability and readable study-guide work is executed through the single scoped queue [`STUDIGO_CODEX_EXECUTION_PLAN.md`](../STUDIGO_CODEX_EXECUTION_PLAN.md). Use its individual cards, three-check cap, branch/commit policy and completion evidence; do not independently reassign the overlapping P1/P2 or guide work from this backlog. Other workstreams remain here.
>
> It merges two 2026-10-07 drafts that had each declared themselves canonical:
>
> - the architecture plan already on `main` (technology catalog, canonical document, grader benchmark, learner-state split), and
> - the workstreams on [PR #81](https://github.com/WGLewis0721/Studigo-ai/pull/81) (`L` legibility, `E` evidence, `S` security, `H` operations, `W` walkthrough).
>
> PR #81 is not squash-merged. GitHub reports it `CONFLICTING`. Its recorded head is `e589f3a` and its base is `aa5898b` (2026-10-04), which is before the security audit and the engineering-guide consolidation on `main`. The branch tip `4756724` is the same stale base plus a docs commit. Landing it would recreate a second plan (`implementation/PLAN.md`), a second tour, and a second security authority. The propositions are here instead. Do not revive those files.
>
> Baseline this plan was written against: `main` @ `c4259fdb`, 2026-10-07. Nothing here changes production behavior until the PR for that step is accepted.

## Outcome

1. **A session can orient without a repo scan.** `AGENTS.md` plus `ENGINEERING.md` are enough to say what owns RAG, grading, ingestion, learning state, auth, and security, and what not to touch.
2. **The owner can explain any part.** How it works, which technology is on that path, which files. The catalog records what the tree contains. It does not ask you to ratify a reason.
3. **Claims match evidence.** Quality claims cite a committed eval. Security claims cite a row in [`SECURITY_AUDIT_CHECKLIST.md`](SECURITY_AUDIT_CHECKLIST.md) and the generated gate. Planned work is not described as shipped.

`AGENTS.md` still governs the work: grounded by default, RLS preserved, provider calls inside `packages/ai`, heavy ingestion out of synchronous requests, uploaded content treated as untrusted, tests or evals around behavior changes.

When documents disagree, use this order:

1. current code and executable tests,
2. `docs/PRODUCT.md`,
3. `docs/ARCHITECTURE.md`,
4. `ENGINEERING.md` for the live map,
5. this file for planned work,
6. [`implementation/security-readiness/`](security-readiness/) for the public-launch decision,
7. dated notes (`SOL_PHASE*`, `ATTEMPTED_FIXES.md`, this checklist's history) for evidence, not for the live contract.

## Already done — do not redo

These were open in the PR #81 draft and are already on `main`. A later session that re-opens that draft will "fix" them again. Don't.

| Item | Evidence on `main` |
| --- | --- |
| Short agent cold start | `AGENTS.md` points at `ENGINEERING.md`, then one specialist doc |
| Dependency pins and Next advisory | `apps/web` depends on `next` `16.3.8`. Root `pnpm.overrides` force `sharp` ≥ 0.35.5 and `source-map-js` ≥ 1.2.2 |
| Frozen install and audit in CI | `.github/workflows/ci.yml` runs `pnpm install --frozen-lockfile` and `pnpm audit --prod --audit-level high` |
| Upload byte checks and ZIP bounds | `packages/documents/src/file-safety.ts`. Polyglot and malware scanning are still open |
| Report-Only CSP and HSTS | `apps/web/next.config.ts`. Enforced CSP is still open |
| Anonymous writes blocked in RLS | `supabase/migrations/20261007120000_block_anonymous_writes.sql`. The Supabase dashboard toggle is still an ops item |
| Prompt-boundary fixes | Topic text and browser-supplied directives no longer enter the system prompt raw. Tests in `apps/web/lib/prompt-boundary.test.ts` |
| OpenAI `store: false` on direct Responses calls | `packages/ai/src/client.ts` |
| Security system of record | Generated gate: `implementation/security-readiness/apps/studigo/generated/public-launch-gate.md`. Decision on this baseline: **not ready**, 29 open blockers. The checklist feeds that gate; it does not replace it |

## Where things stand

Checked against `main` @ `c4259fdb`, not against the 4 Oct tree.

| Area | Finding | Where |
| --- | --- | --- |
| Legibility | Cold start is short. What remains: no package README, the catalog must stay aligned with the tree, finished-phase notes still sit next to live docs | `packages/*`, `docs/`, `ENGINEERING.md` |
| Evidence | `evals/rag` has 120 synthetic cases. ADR 001 says all are pending independent review. No committed live run. No live adapter | `evals/rag/`, `docs/adr/001-adaptive-rag-benchmark.md` |
| Retrieval | Dense top-k. Default cutoff `0.35` (`STUDIGO_MIN_SIMILARITY`, `match_study_chunks`). Score adds `source_priority / 1000`. No hybrid search, no reranker | `apps/web/lib/retrieval.ts`, `supabase/migrations/002_core_loop.sql` |
| Citations | `grounded` is `citationsUsedIn(...).length > 0`. A `[n]` marker is not semantic support. Abstention runs when no chunk passes the cutoff | `packages/ai/src/grounding.ts` |
| Grading | Short answers use a model judge with fixed bands. No human-labelled calibration set | `packages/ai/src/study.ts` |
| Learning state | Production progression is the deterministic director in `packages/learning`. `packages/mastery` (BKT, Elo, scheduler) is pure functions plus an advisory harness on synthetic data. Do not draw BKT as the production mastery write | `packages/learning/src/director.ts`, `packages/mastery/src/`, `evals/ml/` |
| Ingestion | Idempotent, but still inside the request. A large scan can hit the function timeout | `apps/web/lib/ingest.ts` |
| Security | Gate is not ready. Highest open code/ops items are in the checklist's launch-blocker order: anonymous sign-in toggle, rate and spend limits, child-privacy decision, auth CAPTCHA, live injection eval, malware scanning | checklist § Launch-blocker order |
| CI hygiene | CI runs audit, `pnpm lint` (SDK boundary check and engineering-path check), typecheck, tests, ML tests, game tests, and the web build. `apps/web` lint is the boundary check only. No eslint config. Playwright and an eval smoke are not in CI | `.github/workflows/ci.yml`, `package.json`, `scripts/` |
| Focus | Moon Keep and `services/retrieval/` are separate from the learning app. The Python service is unauthenticated and must stay off the public path | `prototypes/moon-road/`, `services/retrieval/` |
| First run | New rooms start from `components/create-room-form.tsx`: title is required, subject, test date, and course are optional. No onboarding module exists | `apps/web/components/create-room-form.tsx`, `apps/web/app/app/page.tsx` |
| Exports | A study-guide PDF exists (`buildStudyGuidePdf`, `/api/study-guide/download`). No learner-data export was found | `apps/web/lib/study-guide-pdf.ts`, `apps/web/app/api/study-guide/download/route.ts` |
| Exam dates and practice tests | A room test date, a study-plan route, a cram panel, and practice tests exist | `apps/web/app/api/study-plan/`, `apps/web/components/room/cram-panel.tsx`, `apps/web/app/api/practice-tests/` |
| Payments | No payment code exists in the app. The roadmap mentions a $3.99 paid-app model for the game | `docs/ROADMAP.md` |

## Technology catalog

The live catalog is the table in `ENGINEERING.md`. It lists what is on the production path, what is a prototype, and what is only a document. Repeat it here only as the rule for keeping it:

- Describe the component, the path, and the role the code has now.
- Do not add a "why we chose this" column, and do not mark rows confirmed or inferred.
- A written reason belongs in the repo only when a change is under test. ADR 001 is that kind of note: it keeps TypeScript retrieval until a matched benchmark beats it. It is not a template for the rest of the stack.
- When a dependency, transport, or authority boundary changes, update the `ENGINEERING.md` table in the same PR.

There is no L-step that asks you to confirm those rows.

## Workstreams

Each step lists the files to touch, when it is done, and what to run. Do the steps in the order under [Sequence](#sequence). Do not start a later step by widening scope.

Two tracks. The engineering track is L, E, P, M, S, H, W. The product track is G and O. Product-track steps run on provisional defaults for the decisions in the Sequence's Deferred table (S8's age and privacy decision, G1, O1), recorded in the PR that uses them. Nothing that depends on those decisions goes to a wider audience before they are made.

### L — Legibility

Make orientation cheap. Do not add a second map until the current one fails a test.

- **L1. Orientation eval, before new docs.** Write ten fixed questions (citation check, retrieval cutoff, RLS on chunks, who owns progression, why Python retrieval is not production, what `grounded` means, where uploads are parsed, what the public-launch decision is, where mastery math lives, what a retry must not do). Run a fresh session with only `AGENTS.md` and `ENGINEERING.md`. Score answers against the files. Record accuracy and tokens in `docs/ORIENTATION_EVAL.md`.
  - Done when: the note exists and states the score. If all ten are right, skip L4's code map. If any miss, fix `ENGINEERING.md` first and rerun. Add `docs/CODEMAP.md` only if a second run still misses.
  - Verify: the eval note cites the file that answers each question.

- **L2. Keep the catalog current.** The technology table lives in `ENGINEERING.md`. A PR that adds, removes, or changes the role of a component updates that table in the same change. No separate confirmation pass.
  - Done when: the table matches the tree on this baseline (Next.js in `apps/web`, pgvector in the retrieval migration, Ollama excluded from embeddings, LangChain only under `services/retrieval/`, Expo named only in `docs/APP_STORE_RELEASE_PLAN.md`, no fine-tune job).
  - Verify: a reader can point from each row to a file. L5 fails if a named path disappears.

- **L3. Package READMEs.** `packages/ai`, `packages/documents`, `packages/learning`, and `packages/mastery` have no README. Add a short one to each: purpose, public exports, invariants, how to test, what does not belong. State in `packages/mastery` that it is not the production progression authority.
  - Done when: each README exists and names the test command already in that package.
  - Verify: `pnpm --filter @studigo/ai test` (and the sibling filters) still pass. No behavior change.

- **L4. Docs triage.** In `docs/README.md`, a read-first list with approximate size and "read only if". Move nothing that is still a live contract. Point `SOL_PHASE*`, `ATTEMPTED_FIXES.md`, and `PROBLEM_STATEMENT.md` at as history, from the index, without using them as the idempotency tutorial. One paragraph each in `docs/README.md` for Moon Keep and `services/retrieval/` stating they are not the learning app.
  - Done when: a new reader can see which docs are live.
  - Verify: links resolve. `pnpm test` if the security-readiness check hashes docs (it should not). No deletions of product contracts.

- **L5. Keep the map true.** CI script: every repo-relative path named in `ENGINEERING.md` exists. Fail the job on a miss.
  - Done when: `.github/workflows/ci.yml` runs it, and a deliberately bad path fails locally.
  - Verify: `pnpm` script exits 0 on `main` and non-zero on a missing path.

- **L6. Rerun L1** after L3–L5. Update `docs/ORIENTATION_EVAL.md`. This is the legibility exit.

### E — Measured evidence

ADR 001 gates: zero unauthorized retrieval, ≥95% claim support, ≥95% correct abstention, no regression over two points. Human review is the source of truth. The model must not write `review.status`.

- **E1. Review a first slice.** Hand-review about 50 of the 120 cases, balanced across `plain`, `table`, `unsupported`, `conflict`, `injection`, and `foreign-user`. Record the reviewer. Flip `review.status` only for cases actually reviewed.
  - Files: `evals/rag/` case files, `evals/rag/README.md`.
  - Done when: about 50 cases name a human reviewer.
  - Verify: a count of reviewed vs pending is in the README and matches the files.

- **E2. Live adapter.** TypeScript adapter for `evals/rag/run.mjs` that calls the real `match_study_chunks` path. Log retrieved ids and revisions, claims and sources, latency, and cost. Pin model, embedding model, prompt hash, and temperature.
  - Files: `evals/rag/`, `apps/web/lib/retrieval.ts`, `packages/ai`.
  - Done when: one local run completes against the reviewed slice.
  - Verify: `node evals/rag/run.mjs` (or the script's real entry) writes a JSON result and does not send service-role scope across users.

- **E3. Baseline.** Commit the run JSON under `evals/rag/results/`. README table: Recall@k, claim-level support, correct abstention, unauthorized retrievals (must be 0), p95 latency, dollars per answer. Publish misses. Do not hide a number under 95%.
  - Done when: the table matches the JSON byte for byte in the reported fields.
  - Verify: re-run on the same pins reproduces the file, or the README says why it cannot (provider nondeterminism) and stores the seed config anyway.

- **E4. Hybrid retrieval.** Migration: `tsvector` column and index. Merge with vector rank by reciprocal rank fusion, behind a flag. Owner and room predicates stay identical to `match_study_chunks`.
  - Done when: flag off matches E3. Flag on is a separate result file.
  - Verify: `tests/database-security.test.mjs` still shows user A cannot read user B.

- **E5. Rerank.** Rerank the top 20, behind a flag. Provider call stays in `packages/ai`.
  - Done when: an ablation file exists. No default-on change without E8.
  - Verify: unit test that the rerank call is not imported from `apps/web` except through `@studigo/ai`.

- **E6. Cutoff and source boost.** Choose the similarity threshold from the reviewed set. Replace `source_priority / 1000` with an explicit, documented boost that keeps teacher study-guide priority.
  - Files: `supabase/migrations/`, `apps/web/lib/retrieval.ts`, `docs` or the retrieval README section.
  - Done when: the boost is named and tested, and the old `/1000` term is gone.
  - Verify: migration test or database-security test plus a retrieval unit test for teacher-guide priority.

- **E7. Claim verifier.** After generation, check each cited claim against its cited chunk. Unsupported claims are flagged or removed. Measure verifier precision and recall against the E1 labels. `grounded: used.length > 0` may remain as a syntactic signal, but it must not be reported as semantic support. Target names from the earlier draft, only if you want them in code: `no_evidence`, `citation_present`, `verified`.
  - Files: `packages/ai/src/grounding.ts`, `evals/rag/`.
  - Done when: precision and recall are in the results README.
  - Verify: a fixture where a valid `[n]` cites a chunk that does not support the claim is not marked `verified`.

- **E8. Ablation.** Same corpus hash: baseline, +hybrid, +rerank, +verifier. Each row has latency and cost. Keep the simplest arm that clears the ADR gates. Equivalent results keep today's dense retrieval.
  - Done when: `docs/RETRIEVAL_BENCHMARK.md` states keep or change, with the JSON paths.
  - Verify: the decision cites E3–E7 files. No production default flips in the same PR as the first measurement.

- **E9. Semantic grader benchmark.** This was in the architecture draft and missing from PR #81. Build an independently labelled set, target 300–500 answers, covering correct, equivalent wording, partial, misconception, incorrect, off-topic, not-sure, typos, concise/verbose, and more than one subject. Report macro F1, per-class precision/recall, false-positive "correct", and false negatives. Do not keep a numeric correctness cutoff because it looks round.
  - Files: `evals/grading/`, `docs/SEMANTIC_GRADER_EVAL.md`, `packages/ai/src/study.ts` only if the rubric changes.
  - Done when: the doc shows the metric and the label source. The judge is not the labeler.
  - Verify: `node --test` for the scorer. Labels live in repo files with a reviewer name.

- **E10. Slice the evidence.** Report grading and retrieval error rates per slice (question type, course, subject, difficulty), not only in aggregate, because an average can hide a failing slice. Draw a stratified random sample of high-confidence gradings for ongoing audit, so novel errors are found. Add a `detected_pattern` field to graded results so disputed or flagged grades can be analyzed by what triggered them. Model-reported confidence is used only to route what a human reviews, never for escalation or progression.
  - Files: `evals/grading/`, `evals/rag/`, `packages/ai/src/study.ts` for the field.
  - Done when: the results README has per-slice tables and states the sampling procedure.
  - Verify: scorer tests for the slice report. Labels come from E9, and the judge is not the labeler.

### P — Product architecture

These are the hardening steps PR #81 did not schedule. They sit under the golden learner UI. Do not add a new product mode inside them.

- **P1. Durable ingestion.** Move extract / OCR / embed off the request path.

  ```text
  upload → document record → job → claim/lease → extract → OCR
        → canonicalize → chunk → embed → derive → ready
  ```

  Postgres/Supabase-backed worker is the implementation for this step. There is no queue product in the repo. Require a safe claim, lease recovery, bounded retries, idempotent stages, sanitized failures, an immutable original, and a derived revision.
  - Files: `apps/web/lib/ingest.ts`, `supabase/migrations/`, `supabase/functions/` or a worker entry the app already reserved.
  - Done when: a forced retry does not create a second chunk set, and a request no longer waits on OCR for the large-scan case.
  - Verify: ingest tests plus a database test for two concurrent claims.

- **P2. Canonical Studigo Document.** One versioned intermediate: normalized text, structure, sections, concepts, provenance. RAG, topics, Learn, Coach, quiz, flashcards, and the downloadable study guide derive from it or from an explicit projection.
  - Done when: replacing or deleting a source cannot leave a stale concept on another surface, and every derived fact maps to source, revision, and location.
  - Verify: a fixture that deletes a source and asserts derived rows are gone or marked stale.

- **P3. Learner-state semantics.** Split the words in code and docs:

  ```text
  evidence stage     = observed behavior
  readiness index    = deterministic product priority
  mastery probability = calibrated statistical estimate, only if calibrated
  ```

  Internal stages may be Unseen → Introduced → Assisted → Independent → Transfer → Retained. Learner-facing labels can stay simpler. `packages/mastery` does not gain write authority in this step.
  - Files: `packages/learning/`, `docs/ADAPTIVE_LEARNING_CORE.md`, `ENGINEERING.md` if the map changes.
  - Done when: the three terms are not used interchangeably in those files.
  - Verify: existing director tests still pass. No BKT call on the Coach write path unless a flag defaulting off is measured under E9-style evidence. It should not be on.

- **P4. Bounded agent, only if justified (decision first).** The core loop stays a workflow: deterministic code decides, the model reports evidence. One candidate remains: a bounded ingestion agent for "look again" cases (re-read an unreadable page, re-chunk a table).
  - If built: it runs in the background worker only, after P1. Its tools are read-only and scoped to one document, with distinct names and descriptions that state inputs and edge cases, and arguments validated in code. The loop ends on the model's stop signal, with a step cap only as a backstop. Failures return typed errors with what was attempted. A forced first tool and an allowed-tools list keep behavior predictable and the prompt cache stable. It ships behind a flag and is measured against the current workflow.
  - Done when: the decision is recorded in an ADR (W3). No agent code is written before P1 lands and ingestion failures justify it.
  - Verify: an eval comparing the agent with the current workflow on the same failing documents.

### S — Security

The backlog is the checklist's launch-blocker table, not a new list of control IDs. Record every change on the matching `GMS-*` override and regenerate the gate in the same PR (`pnpm security:report`). When the checklist and the gate disagree, fix `audit-overrides.json` and regenerate. Do not hand-edit `public-launch-gate.md`.

Public launch gate: the generated decision is `ready`, or each open blocker is `accepted_risk` with a named owner and a written rationale. Until S8 is closed or waived, access stays invited adult beta.

- **S1. Supply chain leftovers.** Pins, Next 16.3.8, frozen lockfile, and the audit gate are done. Left: GitHub secret scanning with push protection, and Dependabot or Renovate (checklist LLM03-04). Actions pinned to tags are low priority.
  - Done when: the checklist row is PASS or the dashboard step is recorded as OPS with a date.
  - Verify: a secret-looking push is blocked, or the checklist says the org setting is on.

- **S2. Headers.** HSTS is present. CSP is Report-Only. Enforce CSP after a browser pass (checklist item 11, API8-01). Do not claim headers are missing.
  - Done when: production `curl -I` shows the enforced policy you intended, and the app still loads.
  - Verify: checklist row updated; a note of which directives broke and were fixed.

- **S3. Cost and abuse.** First engineering blocker on the gate (`GMS-API-002`).
  - Edge: Vercel WAF rules from the checklist (VC-01), log-only for a day, then enforce.
  - App: per-user daily budget checked before provider calls; output-token caps on `responses.create`; reindex cooldown so `force: true` cannot reset attempts forever (LLM10-02, LLM10-03, LLM10-05).
  - Files: `apps/web/app/api/chat/route.ts`, `apps/web/app/api/documents/process/route.ts`, `apps/web/lib/ingest.ts`, `packages/ai/src/client.ts`.
  - Done when: the gate finding's "done when" paragraph is true and the override says `pass` with evidence.
  - Verify: a test that the budget denies a call over the cap, and a test that a second reindex inside the cooldown does not re-embed.

- **S4. Uploads.** Byte signatures and ZIP limits landed. Still open: polyglot rejection or forced-download `nosniff` (GMS-FILE-002), image/PDF parser budgets (GMS-FILE-003), malware scanning before school distribution (UP-05). The durable worker is P1; do not build two queues.
  - Done when: the partial gate rows move with new evidence, or stay partial with the remaining gap named.
  - Verify: `packages/documents` file-safety tests, including a bomb fixture.

- **S5. Live injection eval.** Checklist LLM01-04. Run hostile uploads through the real model path. This is E1's `injection` slice plus a system-prompt-leak case, not a new harness.
  - Done when: results are committed and the checklist row is no longer FAIL.
  - Verify: the eval fails if the model follows an instruction planted in an upload.

- **S6. Small code fixes still marked open.** `server-only` on server modules (NX-05), shared parameter validation (NX-01), neutral sign-up errors (API2-05). Also authenticate or keep loopback-only `services/retrieval` (AUX-01 / GMS-ACCESS-003). Branch protection on `main` (CI-01) is OPS: required checks, including this workflow.
  - Done when: each row cites the PR.
  - Verify: `pnpm test` and `pnpm typecheck`.

- **S7. Dashboard walk.** Needs you, not a patch: disable anonymous sign-ins, leaked-password protection, CAPTCHA, auth rate limits, SMTP, then decide what to do with the 52 anonymous users and the stray `mf_agreements` / `mf_bookings` tables. Destructive deletes need an explicit yes. Code already treats anonymous sessions as signed out; the toggle is still required.
  - Done when: the checklist's OPS rows name the date and the setting.
  - Verify: Security Advisor re-run pasted into the checklist.

- **S8. Child-privacy gate.** Counsel decides 13+ screen versus full COPPA. Then privacy policy, terms, retention, account deletion and export, written security program, separate consent if third parties see child data, vendor list (OpenAI, Supabase, Vercel, waitlist destinations), and moderation of learner text and model output (PR-09). FERPA school-official terms only if you sell to schools.
  - Done when: the decision is written down and the product matches it, or you waive public launch in writing.
  - Verify: gate rows GMS-PRIV-002, GMS-PRIV-004, GMS-AI-008 updated. No code-only "fixed" without the decision.

- **S9. Layered guardrails.** Build defense in depth, not one filter: a relevance check (off-topic input), a safety check for injection and jailbreak attempts on uploads and learner text, rules-based limits (length, patterns), output validation, and a low/medium/high risk rating for any action the model can trigger, with human oversight above low. Escalate to a human when a failure threshold is exceeded.
  - Files: `packages/ai/`, the chat, learn, and upload routes.
  - Done when: each layer is present, or deferred in this file with a reason.
  - Verify: S5's hostile-upload eval exercises each layer.

- **S10. LLM-specific risks beyond S5.** Improper output handling: model output never changes state or renders unescaped without validation. Vector and embedding weaknesses and poisoning: tests that crafted uploads and cross-room queries cannot surface another learner's chunks. System-prompt leakage: no secret or security rule exists only in a prompt. Misinformation: a measured grounded-answer rate with abstention. Excessive agency: no tool or permission beyond need.
  - Done when: each item has a checklist row with evidence or a named gap.
  - Verify: `tests/database-security.test.mjs` includes a cross-room retrieval case, and S5's eval includes a prompt-leak case.

- **S11. Risk mapping.** Map each generative-AI risk category from NIST AI 600-1 (for example confabulation, privacy, information security) to a control and a test in the existing `SECURITY_AUDIT_CHECKLIST.md`. Do not add a second checklist.
  - Done when: each category names a checklist row and a test, or a documented gap.
  - Verify: the generated public-launch gate still builds (`pnpm security:report`).

### H — Operations and CI

- **H1. Observability.** Tracing (OpenTelemetry or a hosted product you actually operate), per-turn token and cost, prompt version id on every model call. Log ids, model, latency, and token counts. Do not log raw learner or source text by default.
  - Files: `packages/ai/src/client.ts`, chat/learn/quiz routes.
  - Done when: one real request produces a trace you can open, and the cost is computable from stored token counts.
  - Verify: a unit test that the logger redacts content fields.

- **H2. CI that can fail.** Remove `|| true` from `apps/web`'s lint. Replace package echo stubs with a real lint or stop calling them lint. Add a lint or grep check that the model SDK is not imported outside `packages/ai`. Add an eval smoke of about 10 reviewed cases that fails on an authorization miss or a large support drop. Put the Playwright beta script in CI only after it is deterministic without secrets, or mark it nightly.
  - Done when: a lint error fails the workflow. A red smoke run fails the workflow.
  - Verify: CI on this step's PR is green for the real reason, not because the script swallows the exit code.

- **H3. Resilience.** Per-call timeouts, bounded retries with backoff (never on 400, 401, or 403), a circuit breaker, a degraded mode that falls back to cached or deterministic behavior, and failover across the existing transports where they are equivalent.
  - Files: `packages/ai/src/client.ts`.
  - Done when: a simulated provider outage leaves the app usable and shows a clear message.
  - Verify: tests with a stubbed client for timeout, retry, open circuit, and recovery.

- **H4. SLOs and telemetry.** Extend H1. Write service-level objectives (latency, grounded-answer rate, structured-output failure rate). Record per call: schema, model, latency, tokens, cached tokens, refusal and validation-failure counts. No learner content in logs.
  - Done when: the objectives are written and the numbers are measured from real requests.
  - Verify: the redaction test from H1 covers the new fields.

- **H5. Model and prompt pinning.** Pin the model id and a prompt version per call type, and record a prompt hash. Any change to the model, provider, or prompt requires the eval smoke (H2) to pass in the same PR.
  - Done when: changing `OPENAI_CHAT_MODEL` without a smoke result fails review or CI.
  - Verify: a documented failing example.

- **H6. Claude Code configuration and review.** Use path-scoped rules in `.claude/rules/` (for example `packages/ai/**`, `supabase/migrations/**`, `evals/**`) instead of one long file. Run review on large changes with an independent pass (a fresh session or subagent without the author's context), with a per-file pass plus a cross-file pass. Consolidating the duplicated personal instruction files is an owner task outside the repo.
  - Done when: the rules exist and load only for matching paths.
  - Verify: open a matching file and a non-matching file and check which rules load.

- **H7. Plan consistency check and assignment template.** Extend the path check (`scripts/check-engineering-paths.mjs` or a sibling) to fail when the workstream list differs across `AGENTS.md`, `ENGINEERING.md`, `README.md`, and this plan, or when a step ID here has no ledger row. Assign a step with: "Do step X. Read only its listed files. Done when its Done-when and Verify lines pass. Update its ledger row and, if the code map or workstream list changed, `ENGINEERING.md` and `README.md`."
  - Done when: CI fails on a deliberate mismatch and passes on the real tree.
  - Verify: `pnpm lint` fails with a planted mismatch and exits 0 without it.

### M — Model-call reliability

Every structured model call goes through `structured()` in `packages/ai/src/study.ts`. These steps make it fail in ways a caller can handle. No model call is added outside `packages/ai`. Principles: validate output in code, retry only what a retry can fix, and never ask the model to fill a value the source does not contain.

- **M1. Classify and retry failures.** Refusal, truncated (`status: incomplete`), empty, unparsable, and invalid are separate `StructuredOutputError` kinds. Truncation retries once with a larger output budget (default cap is 1200 tokens). Empty, unparsable, and invalid retry once with the problem stated. A refusal is never retried.
  - Files: `packages/ai/src/structured-output.ts`, `packages/ai/src/structured-output.test.ts`, `packages/ai/src/study.ts`.
  - Done when: merged, and the failure kinds are visible in M6's log.
  - Verify: `pnpm --filter @studigo/ai test` and `pnpm typecheck`. Not yet run against a live model.

- **M2. Validate at the call site.** Use the optional `validate` hook. First callers: quiz generation (answer key present and in range), topic extraction (non-empty titles), short-answer grading (score within bounds).
  - Done when: a quiz item with a bad key triggers a retry, not a silent drop. Check how `normalizeGeneratedQuestion` discards items today before changing it.
  - Verify: unit tests with a stubbed client.

- **M3. Schema pass.** Fields the source may lack become nullable. Ambiguous categories get `unclear`, and open categories get `other` plus a detail field. Derived values carry `stated` and `calculated` so software can flag a mismatch. Do not retry when the information is absent from the source: abstain.
  - Done when: each schema in `study.ts` and `coach.ts` has been reviewed against these rules, and the review is in the PR.
  - Verify: tests that a source missing a field yields null, not an invented value.

- **M4. Prompt criteria and examples.** In `evaluateCoachAnswer` and the grading prompts, add explicit criteria and 2–4 short examples of ambiguous cases (partial answer, example instead of a definition, a question back).
  - Done when: the E9 set, or a small reviewed fixture, shows no regression.
  - Verify: Coach tests plus the E9 scorer.

- **M5. Stable prompt prefix.** Static instructions and schema first, per-request content last. Keep the schema, tools, and model fixed per call type. Record cached-token counts from provider usage.
  - Done when: usage shows cache hits on repeated calls of the same type.
  - Verify: H1's trace shows cached tokens.

- **M6. Typed errors to the learner.** Routes map failure kinds to different messages (refusal, try again, too long), not a generic failure. Log kind and schema name only, never content, through `apps/web/lib/study-trace.ts`.
  - Files: chat, learn, quiz, and flashcards routes.
  - Done when: each kind shows a distinct message and one log line.
  - Verify: route tests and a redaction test (see H1).

- **M7. Routing and evaluator pass (optional, measured).** Use a smaller model for classification such as intent, and a stronger one for grading and explanation. Have an independent evaluator, with no access to the generator's reasoning, check generated questions. Adopt either only if the E9 set or a reviewed fixture shows no quality loss and cost or latency improves.
  - Done when: an ablation note states keep or drop.
  - Verify: the same fixtures run with each arm.

- **M8. Context handling in the Coach.** First check how history and chunks are passed today. Then keep a persistent "case facts" block (attempts, concepts demonstrated, the pending question) outside summarized history, trim retrieved chunks to the relevant spans, and put a short findings summary first with detail under headers, so middle content is not lost.
  - Files: `packages/ai/src/coach.ts`, `apps/web/lib/coach-*`.
  - Done when: a long-session test keeps the stated facts across turns.
  - Verify: Coach tests with a session longer than the trimmed history.

- **M9. Provenance and coverage.** Carry source metadata (document, page or slide, revision) as structured fields through every step, separate from the text. Guard in code that cited indices and returned ids belong to the set sent. Extracted topics carry an evidence field (a quote or chunk id). Report topics with no source support instead of silently dropping them.
  - Done when: a fixture citing a marker that does not exist is rejected, and an unsupported topic is reported.
  - Verify: grounding and topic-extraction tests.

- **M10. Batch for non-interactive work.** Use the provider's batch interface only for ingest-time generation (embeddings, topic maps, flashcards). Correlate requests with ids, resubmit only failures, and test the prompt on a sample first. Never for live tutoring. Confirm the chosen provider's batch terms.
  - Done when: one job runs on a sample and the cost difference is recorded.
  - Verify: the recorded run.

### G — Learner experience

Principles: the core loop is the product. Difficulty adapts like a game assist mode and never changes what must be learned. Correctness is computed in code wherever it can be. Claims about learning wait for a measurement. There is no teacher-facing view. Child privacy (S8) gates G4 and G5.

- **G1. Core loop and success measures (decision, no code).** One sentence for the loop. Name the measures (for example time to first correct answer, session completion, return rate, flag rate) and a maximum explanation length.
  - Files: `docs/PRODUCT.md`.
  - Done when: written, and every other G step names the measure it should move.

- **G2. Deterministic math.** Generate problems in code with known answers. Check answers with a math library, with no model call. The model only explains and encourages. Render math properly.
  - Done when: a math answer is graded without a model call, and fixtures show zero wrong grades.
  - Verify: property tests over the generators.

- **G3. Show, don't tell (visual explanations).** Today ingestion is text in, text out: pages become text, and a diagram on a scanned page is reduced to one bracketed line in `packages/ai/src/ocr.ts`. No page images or figures are stored and there are no explanation visuals, so the output can only be a word wall. Math is worst, because fractions, equations, and graphs flatten into text. G3 gives every explanation a picture to carry the idea. Frame it as visuals for everyone, with words on tap. Do not label a learner a "visual learner".
  - **G3a. Figures from the learner's own material.** Render the page or crop the figure, store it privately with RLS, and show it with its citation. Nothing is invented. Page rendering runs in the P1 worker, so this sub-step waits for P1.
  - **G3b. Math visuals drawn by code.** Number lines, fraction bars, area models, bar models, place-value blocks, graphs, tables, and timelines, rendered as SVG from verified data. G2's generator knows the quantities, so the picture is correct by construction. Math steps reveal one at a time.
  - **G3c. Structured diagram specs.** The model returns a schema-validated spec (nodes and links, a sequence, a table), never an image and never freeform SVG. Trusted components render it. Every label must trace to the source excerpts, or the spec is rejected. No AI-generated educational images.
  - **G3d. Representation fading.** The director chooses the representation: more pictorial at Introduced, fading toward symbols at Independent (concrete, pictorial, abstract). This shares signals with G4.
  - **G3e. Words under control.** Visual first with one short caption, detail on tap. Language level is a parameter passed into prompts, separate from explanation depth, and G4 later estimates it. Output length and sentence length are checked in code through M2's `validate` hook. Read-aloud uses the browser's speech support.
  - **G3f. Accessibility.** A text equivalent for every visual, color-blind-safe palettes, read-aloud descriptions, and reduced-motion support.
  - Files: `packages/documents/` and the P1 worker for G3a, a new visual-rendering component set in `apps/web/components/`, `packages/ai/src/study.ts` and `coach.ts` for the specs and the language parameter.
  - Done when: an explanation of an uploaded math topic leads with a correct visual and a caption, a session can be completed without any text block over the length chosen in G1, and no visual contains a label that is absent from the source.
  - Verify: schema tests that a spec with an unsourced label is rejected, snapshot tests of the code-drawn visuals against fixtures, a prompt test that the language parameter reaches every learner-facing generation, and a pilot comparison (G12) of text-only against visual-first on the same topic.

- **G4. Auto level (shadow level).** Add `auto` to `explain_level` and make it the default for new rooms. The manual simpler/standard/deeper values stay as an override. The director in `packages/learning` owns the hidden estimate and passes the result to the model as a parameter. Two axes: scaffolding (hints, pacing, explanation depth) per learner per topic, and language level per learner. It changes pitch only, never which facts are cited. No grade label is shown to the child.
  - Design checks: ceiling and floor with an occasional upward probe, several signals before a change, rushed or gamed answers excluded, cold start at standard, inferred data treated as personal data.
  - Files: `apps/web/lib/explain-level.ts`, `apps/web/lib/coach-preferences.ts`, `packages/learning/`, `apps/web/components/room/room-settings.tsx`, a migration for the new value.
  - Done when: behind a flag, with unit tests for hysteresis, bounds, and cold start. Director tests unchanged. `packages/mastery` gains no write authority.
  - Verify: tests above. The flag stays off by default until a measure from G1 shows no harm.

- **G5. Rush and gaming detection.** Very fast answers and patterned errors change the task and do not count as evidence. No accusation shown to the child.
  - Done when: a rushed answer does not move the evidence stage.
  - Verify: session tests.

- **G6. Review scheduling.** A room test date, a study-plan route, and a cram panel already exist. This step compares the scheduler in `packages/mastery` with FSRS offline in `evals/ml`. The harness uses synthetic data, so the result is exploratory until real review logs exist. Adopt only if a G1 measure improves, then connect the winner to the existing test-date planning.
  - Done when: a comparison note exists that says whether the data was synthetic or real.

- **G7. Citations, flags, upload report.** Page or slide on every citation. A flag-this-answer control stores the flag with schema name and prompt version, readable by the evals. An upload-quality report shows which pages could not be read. A learner can save a question for later, stored with RLS; this is the only source for G11's saved questions.
  - Files: a migration with RLS, answer and citation components.
  - Done when: a flag lands in a table the evals can query, and a saved question can be read back by its owner only.
  - Verify: `tests/database-security.test.mjs` shows one learner cannot read another's flags.

- **G8. Study guide export quality.** A PDF export already exists (`apps/web/lib/study-guide-pdf.ts`, `/api/study-guide/download`). Review it against the product rules: teacher-priority order, a page or slide on each citation, and rendered math (needed once G2 lands). The raw plain-text export you described was not found in the app routes, so first confirm which export is raw, then fix that one.
  - Done when: the raw-text export is identified and replaced, and a fixture room's PDF matches a snapshot.

- **G9. Learning as the mechanic.** Stays on the Moon Keep track (`prototypes/moon-road/`). No work in this plan until G1 to G5 have measures.

- **G10. Companion as the reason to return (decision first).** The objective: the avatar is a character the learner knows and cares about, and that relationship is the vehicle for continued play. This reverses the current written rules ("no reward economy, no streaks, no currency", `docs/COMPANION_PARITY_PLAN.md`, `docs/DESIGN_SYSTEM.md`, and the non-goals in `IMPLEMENTATION.md`), so the owner approves the change and those three files are updated in the same PR as the first G10 code.
  - Rules that stay:
    - The companion never changes mastery, difficulty, or grading. Cosmetic and expressive items only (emotes, outfits, names, room items).
    - Rewards are earned from what Studigo measures (demonstrated recall, completed reviews, improving a weak topic), never from uploaded grades. A grades-based bonus, if ever built, is optional, parent-controlled, verified, and reviewed by counsel (S8).
    - The currency is never sold. It is not purchasable with money.
    - Bond grows with use and never decays. No guilt messages, no punishment for absence, no streak loss.
    - Anything the companion says about progress is real data.
    - Companion rendering stays free of network calls. Bond and inventory live in app-owned state read by the component.
  - Personification levers: the learner names the companion; it remembers what the learner studied and says so ("last time you got fractions"); its expressions react to real events (`celebrate`, `thinking`); it shows what it has learned about how the learner studies (O7).
  - Files: `apps/web/` companion components, a migration with RLS for bond, inventory, and earned items, `packages/learning/` for the earning rule (deterministic, same authority boundary as the director).
  - Done when: the decision is written, an earned item can be equipped, mastery and difficulty are unchanged with items on or off (tested), and no earned item or message depends on absence.
  - Verify: director tests unchanged, a test that equipping items does not alter evidence stage or level, and a database test that one learner cannot read another's inventory.

- **G11. Pull mechanics.** The learner returns because there is something worth returning to. Onboarding and rewards build that pull. They never make staying away feel bad.
  - Mechanics:
    - **Something waiting.** The companion has something real for the learner: a review that is actually due, questions saved from their own notes, a test date they set. The software decides what is due (the scheduler, G6) and the companion presents it. Nothing is invented to create a reason.
    - **Investment worth returning to.** The name they chose, the items they earned, the room they arranged (O3, O7, G10). Leaving costs nothing and returning adds more.
    - **A warm return.** On coming back, the learner picks up where they left off in one tap. The welcome says nothing about absence.
    - **A fast first minute.** The first thing on screen is a pre-filled, worthwhile question (O2), so Studigo is the quickest route to something fun.
    - **Outcomes the learner values.** The companion works on their own class material, so the pull is also "this helps with my real homework".
  - Rules:
    - No guilt, sadness, or neglect states for absence. No streak loss.
    - Rewards are fixed and predictable. No random or variable-reward mechanics.
    - Any message about what is waiting comes from real data (same rule as G10).
    - No pressure surfaces on a child's screen (O1).
  - Done when: a returning learner sees something real waiting, one tap resumes, and no copy or state references time away.
  - Verify: a copy review against these rules, a test that "waiting" items come only from due reviews or saved questions, and the G1 return-rate measure.

- **G12. Learning-outcome pilot.** G1's measures are engagement. This step tests whether learners learn. A small pilot with a written method, a comparison (for example pre and post on the same topic, or practice-test results), and parental consent for any child's data. Counsel reviews the consent text (S8).
  - Done when: the method is committed before the pilot starts, and the result is reported with its limits whatever it shows.
  - Verify: no outcome claim appears on the site or in the pitch without a pointer to this result.

- **G13. Clarify and hand off.** When a lookup matches several records (for example two similar room or document names), ask the learner instead of guessing. When the Coach cannot make progress after a set number of attempts, compile a structured summary (topic, attempts, evidence so far, suggested next step) a human can act on. This is not a teacher-facing view.
  - Done when: an ambiguous reference triggers a question, and the failure threshold produces the summary.
  - Verify: session tests for both paths.

### O — Onboarding and conversion

Principles: no blank states (infer, pre-fill, recommend, then let the learner adjust what does not fit). Give real value before asking for money. Every contribution a learner makes improves their experience immediately. What a learner built is theirs. The common thread: never ask a user to configure software for Studigo's benefit.

Limits that apply to every O step. The audience may include children, and Prodigy's critics allege exactly this kind of pressure. No sales prompts, countdowns, or loss messaging on a child's screen. Purchase surfaces are for the paying adult. No threats about data. No invented prices, discounts, or scarcity. Counsel reviews O4 to O6 with S8 before launch.

- **O1. Guardrails and payment path (decision, no code).** Write the limits above into `docs/PRODUCT.md`, plus who pays, who sees the purchase screen, and how a child's account is separated from billing. Choose the payment path: no payment code exists in the app, the roadmap mentions a $3.99 paid-app model for the game, and this plan assumes $19.99 one-time for the study app. Confirm the price, the processor, and whether app-store purchase rules apply on iOS.
  - Done when: written, the payment path is chosen, and S8's counsel review covers it.

- **O2. No blank states.** After sign-in, the learner never faces an empty screen or a required form. Infer subject, topics, and a starting goal from the first upload (`extractTopicMap`), or from a sample course when there is no upload yet. Pre-select the defaults, including `standard` level until G4 is proven, then `auto`. The learner adjusts what does not fit. Today the first-run form is `components/create-room-form.tsx` with a required title. That form is the blank form to replace.
  - Done when: a new account reaches a first interaction with zero required fields.
  - Verify: a Playwright run of the new-account path.

- **O3. Onboarding is first use.** Each onboarding step produces something the learner can use at once (a goal, a first study guide, a first question). The first real study interaction happens inside onboarding, as in Duolingo's pattern. The learner shapes the experience: goal, subject, preferences, and a name for any companion character, if one exists.
  - Done when: time to first correct answer is measured (G1) and no onboarding step is pure registration.

- **O4. Free value first.** Needs O1's payment path. A free allowance of 5 coaching sessions and 5 study guides before the $19.99 one-time purchase. These numbers are your product decision, not verified here. Entitlements are counted in code on the server, next to the spend budget (S3), never in the prompt. A session in progress always finishes. Define "coaching session" before counting. The remaining allowance is shown as value ("3 of 5 left"), and the limit is stated before it is reached.
  - Files: a migration for an entitlements ledger with RLS, the budget code from S3, the purchase route.
  - Done when: the allowance is enforced server-side, and a denial never cuts a session in progress.
  - Verify: tests for the allowance cap, for idempotent counting, and for no mid-session cutoff.

- **O5. Honest loss framing.** Show the learner what they have built (guides, progress, learned preferences) and what continuing preserves. State plainly what happens to their data if they do not purchase: a retention window, export before deletion (G8), and a deletion path (S8). The export is the learner's own data, not only the G8 study guide PDF. Do not threaten to wipe data or use urgency.
  - Done when: the retention policy is written, the product matches it, and export works.
  - Verify: gate rows for privacy, deletion, and export (S8).

- **O6. Honest anchoring.** What a learner sees first sets the reference point, so order matters. Show the finished study guide before the price. Show the price once and plainly as one-time. If tiers ever exist, order them deliberately. No struck-through "original" prices that were never charged.
  - Done when: the purchase screen is reviewed against these rules.

- **O7. Endowment.** Rooms, guides, and preferences the learner names, organizes, or edits persist and can be exported. Learned preferences are visible and editable by the learner.
  - Files: `apps/web/lib/actions/rooms.ts`, room settings.
  - Done when: a learner can rename and reorganize what they made and see what Studigo has learned about how they study.

- **O8. Measure the funnel without pressure.** Onboarding completion, time to first correct answer, allowance use, conversion. Aggregate counts only, no child content. Any experiment runs on adult purchase surfaces only, never on a child's screen.
  - Done when: the metrics exist in H1's telemetry.

### W — Walkthrough

- **W1. One status ledger.** The ledger below is the tour. Update the cell when the step lands. Do not add `AI_ENGINEERING_TOUR.md` or another walkthrough.
- **W2. Case study, after evidence.** Write `docs/AI_ENGINEERING_CASE_STUDY.md` only after E3 and E8 exist. Problem, boundary, what was measured, what changed because of the measurement, what is still open. It must not duplicate this plan.

- **W3. Decision records.** One ADR in `docs/adr/` for each boundary worth defending: workflow rather than agent in the core loop (the simplest workflow that works), AI reports evidence and software decides, untrusted-input handling, and the structured-output contract. Add a short "Design decisions" list to `ENGINEERING.md` that links them. No new overview document.
  - Done when: each ADR names context, decision, alternatives, consequences, and the file or test that proves it.
  - Verify: L5's path check passes.

- **W4. Interview packaging.** Commit before-and-after numbers for M1 to M4 (failure rate, retries, grading agreement) with the eval results. Put the positioning statement in `docs/PRODUCT.md`, with a "true today" and an "aspirational" list. Map the seven talking points (evidence versus judgment boundary, untrusted input, grounding and abstention, structured output contract, evals, idempotent learning state, workflow versus agent) to evidence in the W3 list. No new overview document.
  - Done when: each talking point links to a file, test, or eval.
  - Verify: L5's path check passes.

## Status ledger

Update this table in the PR that changes the status. Do not edit it to match a plan that has not landed.

| Element | Status | Closes |
| --- | --- | --- |
| Room-scoped pgvector retrieval | Built. Still no human-reviewed live run | E1–E3 blocked on a human reviewer. The model must not set `review.status` |
| Hybrid retrieval and overlap rerank | Code present, flags default off. No measured gain | E4, E5. Do not turn on |
| `teacher_source_boost` | Replaces the inline `/ 1000` expression. Same magnitude. Cutoff still `0.35` | E6 numeric retune waits on E1 |
| Claim verifier | Lexical check in `packages/ai/src/verify-claim.ts`. Not human precision/recall | E7 partial |
| Grader scorer | Fixture only. Reviewer is `fixture-not-a-human` | E9 not started as a human set |
| Retrieval decision | Dense path stays. See `docs/RETRIEVAL_BENCHMARK.md` | E8 blocked on live runs |
| Untrusted-content envelope | Built. Live injection run still pending | S5 |
| Ingestion | Still inside the request. Cooldown on forced reindex. Deferred 2026-10-07: moving the job off the request without a poll loop breaks Materials upload | P1 |
| Canonical document | `documents.id` plus `storage_path` is the source row. Delete cascades chunks; `tests/database-security.test.mjs` asserts `match_study_chunks` cannot return them. A versioned normalized intermediate, and topics that only store `source_document_ids`, are still deferred 2026-10-07 because they need the P1 worker | P2 partial |
| Learner-state words | `packages/learning/src/semantics.ts` and `docs/ADAPTIVE_LEARNING_CORE.md`. Director behavior unchanged. `session.ts` `EvidenceStage` stays the projection label | P3 |
| Study trace | `apps/web/lib/study-trace.ts` redacts prompt, content, filename, and the raw owner id. Retrieval and `api/chat` log it. Token figure is a character estimate, not provider usage, and there is no hosted trace product | H1 partial |
| Id check | `apps/web/lib/ids.ts` `isUuid` is the check for room, document, and interaction ids on chat and reindex. `server-only` is not a dependency. Sign-up errors were already neutral | S6 partial |
| Daily AI budget and output cap | `consume_ai_budget`, `max_output_tokens` 1200 | S3 code. Vercel WAF is still a dashboard step |
| Upload polyglot and PNG edge | Rejected in `file-safety.ts`. Malware scanning still open | S4 partial |
| Python retrieval | Loopback middleware. Remote bind still needs the env override | S6 partial |
| Dependabot | `.github/dependabot.yml` | S1 code. Secret scanning is an org setting |
| Package READMEs and path check | In CI via `pnpm lint` | L3, L5 |
| Lint | `next lint \|\| true` is gone. CI runs the boundary and path checks | H2 partial. No eslint config in the repo |
| Security gate | Not ready. S7 and S8 are not code | Owner and counsel |
| Structured-output failures | `structured-output.ts` written and tested, wired into `structured()`. Uncommitted. Not run against a live model | M1 in progress |
| Validate hook, schemas, prompts, cache order, typed route errors | Not started | M2 to M6 |
| Learner experience (core loop, math, visual explanations, auto level, rush detection, scheduling, flags, export quality) | Not started, except existing pieces: a PDF study guide, a room test date, a study-plan route, and practice tests. Decision G1 and child privacy S8 come first | G1 to G8 |
| Onboarding and conversion (no blank states, free allowance, honest loss framing, anchoring, endowment) | Not started. O1 guardrails and S8 come first | O1 to O8 |
| Companion bond and cosmetic rewards | Not started. Currently forbidden by `COMPANION_PARITY_PLAN.md`, `DESIGN_SYSTEM.md`, and `IMPLEMENTATION.md`. Needs owner approval | G10 |
| Pull mechanics (something waiting, warm return, fast first minute) | Not started. Needs G6 scheduling and G10 | G11 |
| Learning-outcome pilot | Not started | G12 |
| Resilience, telemetry, pinning, config, consistency check (H3 to H7) | Not started | H3 to H7 |
| Routing, Coach context, provenance, batch (M7 to M10) | Not started | M7 to M10 |
| Evidence slicing, bounded-agent decision, guardrails, OWASP and NIST gaps, handoff, interview packaging | Not started | E10, P4, S9 to S11, G13, W4 |
| Decision records | Not written | W3 |
| Case study | Not written | W2 waits on E3 and E8 |

## Sequence

Ordered by net-new value a learner can see or trigger, highest first. Validations (evals, labelled reviews, audits, pilots) and steps that need a human approval are deferred to a later session. Until those are done, the build uses provisional defaults, each recorded in the PR that uses it, and anything that makes a claim about learning ships behind a flag.

### Now: highest net-new value

| Order | Work | Why it is here | Stop if |
| --- | --- | --- | --- |
| 1 | G2, with G3b (math checked in code, drawn by code) | Math is the largest visible gap, and the picture is correct by construction | A wrong grade appears on any fixture |
| 2 | G3c, G3e, G3f (structured diagram specs, caption first, accessibility) | Removes the word wall for every subject | A spec contains a label absent from the source |
| 3 | O2, O3 (no blank states, first minute) | First impression for every new learner | A required field remains on first run |
| 4 | M1, M2, M6, M8 (fewer failures, clear errors, facts kept in long sessions) | Learners feel reliability even though they never name it | |
| 5 | G4, G5 (auto level, rush detection) | The adaptive feel. Uses provisional defaults for explanation length and the age band, and ships behind a flag | Director tests change |
| 6 | G7, G8 (page and slide citations, flags, saved questions, export quality) | Trust and a visible deliverable | |
| 7 | G6, then G10, G11 (due-review signal, companion, something waiting) | The reason to return. G6's comparison runs on synthetic data and is marked exploratory | Any copy references time away |
| 8 | G13 (clarify and hand off) | Fewer wrong guesses | |
| 9 | P1, then G3a (durable uploads, then figures from the learner's own material) | Uploads stop hanging, and real figures appear next to explanations | A forced retry creates a second chunk set |
| 10 | S3, H3, H1, H4 (spend limits, resilience, telemetry) | Not user-visible, but they must be in place before anyone outside the invited group | |
| 11 | O5, O6, O7 (loss framing, anchoring, endowment) | Conversion and ownership. O6 needs the price decision, so build the structure only | |
| 12 | M3, M4, M5, M9, M10, M7, P2, P3, P4 | Quality and cost improvements, and the agent decision | |

### Deferred: validations and human approvals

These wait for another session. None of them blocks the steps above.

| Work | Waits on |
| --- | --- |
| E1 to E10 (reviewed slice, baseline, ablation, grader benchmark, slicing) | A human reviewer for the labels |
| L1 and L6 (orientation eval) | A fresh-session run |
| S5, S10, S11 (live injection eval, extra LLM risks, NIST mapping) | Evals and a checklist review |
| S1, S2, S4, S6, S7 (supply chain leftovers, headers, uploads, small fixes, dashboard walk) | Owner dashboard steps |
| S8 (age band, child privacy, counsel) | The owner and counsel |
| O1 and O4 (guardrails and payment path, free allowance) | The price and processor decision |
| O8 (funnel measures) | H4 and real traffic |
| G1 (formal measures), G12 (learning-outcome pilot) | Real learners and consent |
| H2, H5, H6, H7 (CI smoke, pinning, config, consistency check) | The eval set and owner setup |
| W2, W3, W4 (case study, decision records, interview packaging) | Evidence from the steps above |

Provisional defaults to record in the first PR that needs them: the explanation length cap (G1), the default level (`standard` until G4 is proven), and the age band (assume the youngest supported until S8 decides).

S7 dashboard items can still run beside any step. They are not code.

### If time is short

Do G2, G3b, G3c, O2, O3, M1, M2, and M6. Skip the reranker, skip a new vector database, skip the case-study doc, and do not publish a scorecard from unreviewed cases.

## Decisions on record

Product decisions already made. A step that contradicts one of these needs the owner's approval first.

| Decision | Source | Affects |
| --- | --- | --- |
| No teacher-facing view | Owner | G and O have no teacher dashboard step |
| Learning is the mechanic. Position against test-like platforms (iReady, Progress Learning) and against Prodigy's separation of game and learning | Owner | G1, G9 |
| Show, don't tell: visuals carry the idea, words are the caption | Owner | G3 |
| `auto` shadow level is the default, the manual level stays as an override, two axes (scaffolding per topic, language per learner), no grade label shown to the child | Owner | G4 |
| Rewards come from what Studigo measures (demonstrated recall, completed reviews), never from uploaded grades. Cosmetic only. The currency is never sold | Agreed | G10 |
| Pull, not push: no guilt, neglect, or streak loss. Fixed, predictable rewards, no variable-reward mechanics | Owner accepted | G10, G11 |
| No parental limit-setting feature | Owner | No step |
| The companion never changes mastery. Its rendering makes no network calls | Existing rule, kept | G10 |
| No pressure surfaces on a child's screen. Purchase surfaces are for the paying adult. No threats about data: retention window, export, deletion path | Agreed | O1, O5, S8 |
| Claims about learning wait for a measurement. No "proven" before a pilot | Agreed | G12, W4 |
| 5 free coaching sessions and 5 free study guides, then $19.99 one time | Owner, not verified | O4 |
| Stay a workflow in the core loop. Deterministic code decides, the model reports evidence | Existing rule | P4, W3 |

## Open decisions

- Age band and child-privacy approach (S8). Gates G4, G5, G10, G11, and O1 to O6.
- Payment path and price: this plan assumes $19.99 one time for the study app, and the roadmap mentions $3.99 for the game (O1).
- Which export is the raw text one (G8). A PDF study guide already exists.
- What counts as one "coaching session" (O4).
- Approval to reverse the written rules against a reward economy (G10).
- Whether a bounded ingestion agent is ever justified (P4).
- Real review logs for the scheduler comparison (G6).

## Sources and how to treat them

- Claude Certified Architect, Foundations exam guide v1.0 (July 2026), supplied by the owner. Domains and task statements informed M, E10, P4, G13, and H6. A community anti-pattern list (claudecertprep.com) is not from Anthropic.
- OpenAI: "A Practical Guide to Building Agents", and the structured-outputs, function-calling, and prompt-caching guides. These informed M1, M3, M5, S9, and P4.
- OWASP Top 10 for LLM Applications (2025) informed S10. NIST AI 600-1 informed S11. Anthropic's "Building effective agents" informed M7 and P4. SRE-style reliability practice informed H3 and H4.
- Competitor and market review (Khanmigo, NotebookLM, Quizlet, Gizmo, FSRS, Prodigy, i-Ready, Progress Learning) comes from blogs, reviews, and advocacy groups, including a 2021 complaint to the FTC about Prodigy. Treat these as allegations and use them to choose what to test, not as evidence.
- Sources were read through search summaries and are not independently verified. Check a primary source before quoting one.

## Risks

- A 50-case slice is small. Say so next to the numbers.
- Fixture cases do not measure OCR. Scans stay a separate gate.
- The judge will drift. Humans label. The model does not fill review fields.
- A map goes stale. L5 checks paths, not sentences. L6 checks sentences.
- G4 makes a claim about learning. It stays behind a flag and unannounced until a G1 measure shows no harm.
- Persuasion principles (reciprocity, loss framing, anchoring) become dark patterns when aimed at children or when the claims are false. O1 sets the limits and counsel reviews O4 to O6. Pressure never appears on a child's screen.
- Competitor criticisms (Prodigy, i-Ready) come from advocacy and blog sources. Use them to choose what to test, not as evidence.
- No payment code exists. Pricing and processor are undecided (O1), so no O4 work starts before that decision.
- Merging PR #81 on top of this file will delete the merge. That PR is closed. Do not rebase it onto this plan.

## Definition of done

- L6: ten orientation questions answered from `AGENTS.md` and `ENGINEERING.md`, with tokens recorded.
- The technology catalog in `ENGINEERING.md` still matches the tree.
- Reviewed eval slice, named reviewers, committed baseline JSON, ablation decision, grader report started.
- Zero unauthorized retrievals on every committed run. CI fails on a regression of that gate.
- Generated public-launch gate is `ready`, or each remaining blocker is `accepted_risk` with owner and rationale.
- P1–P3 either landed or explicitly deferred in this file with a date.
- M1 and M2 merged, and failure kinds appear in logs (M6).
- G1 and O1 written. Each G and O step is landed, or deferred in this file with a date. G4 and G10 stay behind flags until a G1 measure shows no harm.
- G12's method is committed before any outcome claim is made.
- H3 to H5 landed, and M7 to M10 landed or deferred in this file with a date.
- You can explain the system in 30 seconds, 2 minutes, and 10 minutes from `ENGINEERING.md` without calling an unmeasured result finished.

## How to explain it

Use `ENGINEERING.md` for the 30-second and 2-minute versions. For ten minutes, open in this order: `docs/PRODUCT.md`, `packages/ai/src/client.ts`, `packages/ai/src/grounding.ts`, `apps/web/lib/retrieval.ts`, `packages/ai/src/study.ts`, `packages/learning/src/director.ts`, one adaptive migration, `evals/rag/`, the public-launch gate, then the status ledger above.

Short answers that are already safe:

- **Why not a system prompt around a chatbot?** Permissions, mutable private sources, citations, abstention, retries, and progression are enforced in code, not in a prompt.
- **Where does course knowledge come from?** Uploaded chunks, retrieved per room. There is no fine-tuning job in the repo. Deleting a document cascades its chunks, and a database test shows those chunks cannot be retrieved. Topics that only remember `source_document_ids` are not cascade-deleted. That remainder of P2 is deferred until a worker can canonicalize.
- **Why is the model not the director?** `packages/learning/src/director.ts` takes state and returns the next challenge with no model call. That is the production path.
- **What retrieves?** `match_study_chunks` on pgvector, owner- and room-scoped, cutoff default `0.35`, plus `teacher_source_boost` (`source_priority / 1000`). Hybrid and overlap rerank stay off. The Python FAISS service is a separate prototype.
- **What is the largest gap?** No human-reviewed live RAG scorecard, no calibrated grader, ingestion still on the request, the app budget is not the Vercel WAF, public-launch gate not ready, child-privacy decision unmade.

## Documentation ownership

| File | Owns |
| --- | --- |
| `ENGINEERING.md` | Live map, authority boundary, where to edit |
| This file | Sequence, exit checks, status ledger |
| `docs/PRODUCT.md` | Product invariants |
| `docs/ARCHITECTURE.md` | Runtime and data boundaries |
| `docs/adr/001-adaptive-rag-benchmark.md` | Provisional retrieval-stack gate |
| `implementation/SECURITY_AUDIT_CHECKLIST.md` | Control-by-control audit evidence |
| `implementation/security-readiness/` | Release decision |

Do not add `implementation/PLAN.md`, a second tour, or a second checklist.
