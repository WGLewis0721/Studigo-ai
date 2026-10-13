# Studigo engineering implementation plan

> **The only execution plan.** Cold start stays [`ENGINEERING.md`](../ENGINEERING.md). This file says what to build next, in what order, and how to know a step is done.
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

Two tracks. The engineering track is L, E, P, M, S, H, W. The product track is G and O. Product-track steps wait for the decisions in Sequence step 1 (S8's age and privacy decision, G1, O1) and never run ahead of them.

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

### H — Operations and CI

- **H1. Observability.** Tracing (OpenTelemetry or a hosted product you actually operate), per-turn token and cost, prompt version id on every model call. Log ids, model, latency, and token counts. Do not log raw learner or source text by default.
  - Files: `packages/ai/src/client.ts`, chat/learn/quiz routes.
  - Done when: one real request produces a trace you can open, and the cost is computable from stored token counts.
  - Verify: a unit test that the logger redacts content fields.

- **H2. CI that can fail.** Remove `|| true` from `apps/web`'s lint. Replace package echo stubs with a real lint or stop calling them lint. Add a lint or grep check that the model SDK is not imported outside `packages/ai`. Add an eval smoke of about 10 reviewed cases that fails on an authorization miss or a large support drop. Put the Playwright beta script in CI only after it is deterministic without secrets, or mark it nightly.
  - Done when: a lint error fails the workflow. A red smoke run fails the workflow.
  - Verify: CI on this step's PR is green for the real reason, not because the script swallows the exit code.

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

### G — Learner experience

Principles: the core loop is the product. Difficulty adapts like a game assist mode and never changes what must be learned. Correctness is computed in code wherever it can be. Claims about learning wait for a measurement. There is no teacher-facing view. Child privacy (S8) gates G4 and G5.

- **G1. Core loop and success measures (decision, no code).** One sentence for the loop. Name the measures (for example time to first correct answer, session completion, return rate, flag rate) and a maximum explanation length.
  - Files: `docs/PRODUCT.md`.
  - Done when: written, and every other G step names the measure it should move.

- **G2. Deterministic math.** Generate problems in code with known answers. Check answers with a math library, with no model call. The model only explains and encourages. Render math properly.
  - Done when: a math answer is graded without a model call, and fixtures show zero wrong grades.
  - Verify: property tests over the generators.

- **G3. Word load and language level.** Short prompts, visuals first, read-aloud, tap for detail. Language level is a parameter passed into prompts, not left to the model. G4 later estimates that parameter per learner.
  - Done when: a session can be completed without any explanation over the length chosen in G1.
  - Verify: a prompt test that the parameter reaches every learner-facing generation.

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
| Learner experience (core loop, math, word load, auto level, rush detection, scheduling, flags, export quality) | Not started, except existing pieces: a PDF study guide, a room test date, a study-plan route, and practice tests. Decision G1 and child privacy S8 come first | G1 to G8 |
| Onboarding and conversion (no blank states, free allowance, honest loss framing, anchoring, endowment) | Not started. O1 guardrails and S8 come first | O1 to O8 |
| Companion bond and cosmetic rewards | Not started. Currently forbidden by `COMPANION_PARITY_PLAN.md`, `DESIGN_SYSTEM.md`, and `IMPLEMENTATION.md`. Needs owner approval | G10 |
| Pull mechanics (something waiting, warm return, fast first minute) | Not started. Needs G6 scheduling and G10 | G11 |
| Learning-outcome pilot | Not started | G12 |
| Decision records | Not written | W3 |
| Case study | Not written | W2 waits on E3 and E8 |

## Sequence

| Order | Work | Stop if |
| --- | --- | --- |
| 1 | Decisions, no code, beside everything: S8's age band and privacy decision, G1 (core loop and measures), O1 (guardrails and payment path) | These gate every product-track step |
| 2 | L1, then L3–L6. L2 is a rule, not a task | Orientation eval is the check that the map is enough |
| 3 | M1, M2, M6 (commit M1 first) | Small, and they protect every later step. M6 feeds H1 |
| 4 | E1–E3 | No retrieval change before a reviewed baseline |
| 5 | S3, S7 item 1 (anonymous toggle), S1 leftovers | Spend and anonymous accounts are launch risks that do not need the eval |
| 6 | M3–M5 | M4 uses the E9 set or a reviewed fixture |
| 7 | E4–E8, E9 | Keep dense retrieval if the ablation does not win |
| 8 | S2, S4, S5, S6 | S5 consumes the E1 injection slice |
| 9 | P1, then P2, then P3 | P2 depends on a worker that can canonicalize |
| 10 | H1, H2 | H2's smoke set must be reviewed cases from E1 |
| 11 | G2, G3, G7, G8, O2, O3 | Need the step 1 decisions. Measure with G1 |
| 12 | O4 | Needs S3 and O1's payment path |
| 13 | G4, G5, G6, G12 | Need S8's decision and the E9 labels. G4 ships behind a flag |
| 14 | G10, then G11 | Last of the G steps: retention on top of a loop that works. G11 needs G6's due-review signal and G7's saved questions |
| 15 | O5, O6, O7, O8 | O5 waits on S8's retention and export decisions. O8 uses H1 |
| 16 | Rest of S8 (counsel, policies), W3, W2 | S8 waits on you and counsel. W3 documents decisions that landed. W2 waits on E3 and E8 |

S7 dashboard items can run beside step 4. They are not code.

### If time is short

Do L1, L3, L6, M1, M2, E1–E3, E7, E9's first 50 labels, S3, and the anonymous-signin toggle. Skip the reranker, skip a new vector database, skip the case-study doc, and do not publish a scorecard from unreviewed cases.

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
