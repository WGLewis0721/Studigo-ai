# Studigo engineering implementation plan

> **The only execution plan.** Cold start stays [`ENGINEERING.md`](../ENGINEERING.md). This file says what to build next, in what order, and how to know a step is done.
>
> It merges two 2026-10-07 drafts that had each declared themselves canonical:
>
> - the architecture plan already on `main` (technology register, canonical document, grader benchmark, learner-state split), and
> - the workstreams on [PR #81](https://github.com/WGLewis0721/Studigo-ai/pull/81) (`L` legibility, `E` evidence, `S` security, `H` operations, `W` walkthrough).
>
> PR #81 is not squash-merged. GitHub reports it `CONFLICTING`. Its recorded head is `e589f3a` and its base is `aa5898b` (2026-10-04), which is before the security audit and the engineering-guide consolidation on `main`. The branch tip `4756724` is the same stale base plus a docs commit. Landing it would recreate a second plan (`implementation/PLAN.md`), a second tour, and a second security authority. The propositions are here instead. Do not revive those files.
>
> Baseline this plan was written against: `main` @ `c4259fdb`, 2026-10-07. Nothing here changes production behavior until the PR for that step is accepted.

## Outcome

1. **A session can orient without a repo scan.** `AGENTS.md` plus `ENGINEERING.md` are enough to say what owns RAG, grading, ingestion, learning state, auth, and security, and what not to touch.
2. **The owner can explain any part.** How it works, why that technology, which files. Reasons in the technology register are marked `confirmed` or `inferred`. Inferred rows are not ADRs.
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
| Legibility | Cold start is short. What remains: no package README, technology rows mostly unconfirmed, `ENGINEERING.md` and this file can drift, finished-phase notes still sit next to live docs | `packages/*`, `docs/` |
| Evidence | `evals/rag` has 120 synthetic cases. ADR 001 says all are pending independent review. No committed live run. No live adapter | `evals/rag/`, `docs/adr/001-adaptive-rag-benchmark.md` |
| Retrieval | Dense top-k. Default cutoff `0.35` (`STUDIGO_MIN_SIMILARITY`, `match_study_chunks`). Score adds `source_priority / 1000`. No hybrid search, no reranker | `apps/web/lib/retrieval.ts`, `supabase/migrations/002_core_loop.sql` |
| Citations | `grounded` is `citationsUsedIn(...).length > 0`. A `[n]` marker is not semantic support. Abstention runs when no chunk passes the cutoff | `packages/ai/src/grounding.ts` |
| Grading | Short answers use a model judge with fixed bands. No human-labelled calibration set | `packages/ai/src/study.ts` |
| Learning state | Production progression is the deterministic director in `packages/learning`. `packages/mastery` (BKT, Elo, scheduler) is pure functions plus an advisory harness on synthetic data. Do not draw BKT as the production mastery write | `packages/learning/src/director.ts`, `packages/mastery/src/`, `evals/ml/` |
| Ingestion | Idempotent, but still inside the request. A large scan can hit the function timeout | `apps/web/lib/ingest.ts` |
| Security | Gate is not ready. Highest open code/ops items are in the checklist's launch-blocker order: anonymous sign-in toggle, rate and spend limits, child-privacy decision, auth CAPTCHA, live injection eval, malware scanning | checklist § Launch-blocker order |
| CI hygiene | Typecheck, unit tests, database security tests, RAG scorer tests, ML tests, and the web build run on PRs. Lint does not: `apps/web` is `next lint \|\| true`; packages echo a stub. Playwright is not in CI. No rule keeps the model SDK inside `packages/ai` | `package.json`, `.github/workflows/ci.yml` |
| Focus | Moon Keep and `services/retrieval/` are separate from the learning app. The Python service is unauthenticated and must stay off the public path | `prototypes/moon-road/`, `services/retrieval/` |

## Technology register

`confirmed` means the reason is already in the repo (an ADR or a constraint the code enforces). `inferred` means a model wrote a plausible reason and **you have not confirmed it**. Do not promote an inferred row to an ADR. If a row is wrong, correct it in the same PR that relies on it.

| Decision | Why it is in the tree | Not the default alternative | Revisit when | Status |
| --- | --- | --- | --- | --- |
| TypeScript retrieval, not the Python/FAISS service | ADR 001: the Python path uses different embeddings, FAISS, and unauthenticated room-ID endpoints, so a comparison would be confounded. Gates: 0 unauthorized retrievals, ≥95% claim support, ≥95% abstention, no regression over 2 points. Python must win by ≥5 points or ≥20% latency/cost | A second retrieval stack | A matched benchmark passes those gates | **confirmed** (ADR 001, provisional) |
| Postgres + pgvector | Vectors sit in the same database as RLS and deletions | A separate vector database and a sync/deletion problem | A matched benchmark shows a material quality or scale gain | inferred |
| RAG for course knowledge, not fine-tuning | Per-room material is private, mutable, and deletable | Fine-tuning as the source of truth | A style/behavior problem, not a knowledge problem, needs tuning | inferred |
| Deterministic director, not an agentic policy | Progression has to be replayable. `packages/learning` does not call a model | Letting the model decide mastery | A learned policy beats the director on a reviewed set without taking write authority | inferred |
| Supabase Auth + Postgres + Storage | One identity and one data plane for web now and a native client later | A second auth or storage ACL | A requirement the current products cannot meet | inferred |
| OpenAI-compatible calls only inside `packages/ai` | One server-side provider boundary. Embeddings stay 1536-d, so chat-only Ollama must not write vectors | Model SDKs in routes | A measured quality/cost/reliability win, still behind this package | inferred |
| Expo / React Native for the App Store | `docs/APP_STORE_RELEASE_PLAN.md` and the README name this as the native route. Tauri stays a desktop placeholder | A SwiftUI client that reimplements mastery | A native-only capability becomes the product | inferred |
| Postgres-backed ingestion worker | Reuse leases, retries, and idempotency already in Postgres | A new queue product before there is throughput evidence | Measured volume shows Postgres jobs are not enough | inferred |
| BKT / Elo / scheduler stay advisory | `evals/ml` is synthetic. ADR-style caution in `ENGINEERING.md`: a probability is not an evidence stage | Shipping BKT as mastery | Privacy-approved real data shows calibration | **confirmed** as not production authority |

## Workstreams

Each step lists the files to touch, when it is done, and what to run. Do the steps in the order under [Sequence](#sequence). Do not start a later step by widening scope.

### L — Legibility

Make orientation cheap. Do not add a second map until the current one fails a test.

- **L1. Orientation eval, before new docs.** Write ten fixed questions (citation check, retrieval cutoff, RLS on chunks, who owns progression, why Python retrieval is not production, what `grounded` means, where uploads are parsed, what the public-launch decision is, where mastery math lives, what a retry must not do). Run a fresh session with only `AGENTS.md` and `ENGINEERING.md`. Score answers against the files. Record accuracy and tokens in `docs/ORIENTATION_EVAL.md`.
  - Done when: the note exists and states the score. If all ten are right, skip L4's code map. If any miss, fix `ENGINEERING.md` first and rerun. Add `docs/CODEMAP.md` only if a second run still misses.
  - Verify: the eval note cites the file that answers each question.

- **L2. Confirm technology reasons.** You fill or strike the `inferred` rows above. A model may draft, not adopt.
  - Done when: every row is `confirmed` or deleted. No new ADR file unless you confirmed the reason and the decision is hard to reverse.
  - Verify: this table has no `inferred` left, or the remaining ones are explicitly deferred with your name.

- **L3. Package READMEs.** `packages/ai`, `packages/documents`, `packages/learning`, and `packages/mastery` have no README. Add a short one to each: purpose, public exports, invariants, how to test, what does not belong. State in `packages/mastery` that it is not the production progression authority.
  - Done when: each README exists and names the test command already in that package.
  - Verify: `pnpm --filter @studigo/ai test` (and the sibling filters) still pass. No behavior change.

- **L4. Docs triage.** In `docs/README.md`, a read-first list with approximate size and "read only if". Move nothing that is still a live contract. Point `SOL_PHASE*`, `ATTEMPTED_FIXES.md`, and `PROBLEM_STATEMENT.md` at as history, from the index, without using them as the idempotency tutorial. One paragraph each in `docs/README.md` for Moon Keep and `services/retrieval/` stating they are not the learning app.
  - Done when: a new reader can see which docs are live.
  - Verify: links resolve. `pnpm test` if the security-readiness check hashes docs (it should not). No deletions of product contracts.

- **L5. Keep the map true.** CI script: every repo-relative path named in `ENGINEERING.md` exists. Fail the job on a miss.
  - Done when: `.github/workflows/ci.yml` runs it, and a deliberately bad path fails locally.
  - Verify: `pnpm` script exits 0 on `main` and non-zero on a missing path.

- **L6. Rerun L1** after L2–L5. Update `docs/ORIENTATION_EVAL.md`. This is the legibility exit.

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

  Postgres/Supabase-backed worker is the default (see the register). Require a safe claim, lease recovery, bounded retries, idempotent stages, sanitized failures, an immutable original, and a derived revision.
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

### W — Walkthrough

- **W1. One status ledger.** The ledger below is the tour. Update the cell when the step lands. Do not add `AI_ENGINEERING_TOUR.md` or another walkthrough.
- **W2. Case study, after evidence.** Write `docs/AI_ENGINEERING_CASE_STUDY.md` only after E3 and E8 exist. Problem, boundary, what was measured, what changed because of the measurement, what is still open. It must not duplicate this plan.

## Status ledger

Update this table in the PR that changes the status. Do not edit it to match a plan that has not landed.

| Element | Status on `c4259fdb` | Closes |
| --- | --- | --- |
| Room-scoped pgvector retrieval | Built. Unmeasured live | E1–E3 |
| `grounded` means a citation marker is present | Built. Not semantic support | E7 |
| Abstain when nothing passes the cutoff | Built. Threshold untuned | E6 |
| Untrusted-content envelope | Built. Live injection run pending | S5 |
| Ingestion inside the request | Built. Worker not built | P1 |
| Structured generation and local typo grading | Built | — |
| Director owns progression | Built. Synthetic p95 only | P3 |
| BKT / Elo / scheduler | Built as pure functions. Advisory, synthetic eval | E9 does not promote them |
| Atomic Coach evidence write | Built | — |
| RAG harness, cases unreviewed | Harness built | E1 |
| Security gate | Not ready. 29 blockers | S1–S8 |
| Lint | Does not fail CI | H2 |
| Frozen lockfile and `pnpm audit` | In CI | done |
| Package READMEs | Absent | L3 |

## Sequence

| Order | Work | Stop if |
| --- | --- | --- |
| 1 | L1, then L2–L6 | Orientation eval is the check that the map is enough |
| 2 | E1–E3 | No retrieval change before a reviewed baseline |
| 3 | S3, S7 item 1 (anonymous toggle), S1 leftovers | Spend and anonymous accounts are the launch risks that do not need the eval |
| 4 | E4–E8, E9 | Keep dense retrieval if the ablation does not win |
| 5 | S2, S4, S5, S6 | S5 consumes the E1 injection slice |
| 6 | P1, then P2, then P3 | P2 depends on a worker that can canonicalize |
| 7 | H1, H2 | H2's smoke set must be reviewed cases from E1 |
| 8 | S8 and W2 | S8 waits on you and counsel. W2 waits on E3 and E8 |

S7 dashboard items can run beside step 2. They are not code.

### If time is short

Do L1, L3, L6, E1–E3, E7, E9's first 50 labels, S3, and the anonymous-signin toggle. Skip the reranker, skip a new vector database, skip the case-study doc, and do not publish a scorecard from unreviewed cases.

## Risks

- A 50-case slice is small. Say so next to the numbers.
- Fixture cases do not measure OCR. Scans stay a separate gate.
- The judge will drift. Humans label. The model does not fill review fields.
- A map goes stale. L5 checks paths, not sentences. L6 checks sentences.
- Inferred technology reasons will be quoted back at you. L2 exists so that does not happen.
- Merging PR #81 on top of this file will delete the merge. Close that PR. Do not rebase it onto this plan.

## Definition of done

- L6: ten orientation questions answered from `AGENTS.md` and `ENGINEERING.md`, with tokens recorded.
- Technology register has no unmarked `inferred` row.
- Reviewed eval slice, named reviewers, committed baseline JSON, ablation decision, grader report started.
- Zero unauthorized retrievals on every committed run. CI fails on a regression of that gate.
- Generated public-launch gate is `ready`, or each remaining blocker is `accepted_risk` with owner and rationale.
- P1–P3 either landed or explicitly deferred in this file with a date.
- You can explain the system in 30 seconds, 2 minutes, and 10 minutes from `ENGINEERING.md` without calling an unmeasured result finished.

## How to explain it

Use `ENGINEERING.md` for the 30-second and 2-minute versions. For ten minutes, open in this order: `docs/PRODUCT.md`, `packages/ai/src/client.ts`, `packages/ai/src/grounding.ts`, `apps/web/lib/retrieval.ts`, `packages/ai/src/study.ts`, `packages/learning/src/director.ts`, one adaptive migration, `evals/rag/`, the public-launch gate, then the status ledger above.

Short answers that are already safe:

- **Why not a system prompt around a chatbot?** Permissions, mutable private sources, citations, abstention, retries, and progression are application invariants.
- **Why RAG instead of fine-tuning?** Course text is per-room, mutable, and deletable. That reason is inferred until you confirm it in L2. The code fact is not inferred: retrieval is room-scoped and deletions are supposed to reach derived rows (P2 is the proof).
- **Why is the model not the director?** `packages/learning/src/director.ts` takes state and returns the next challenge with no model call. That is the production path.
- **Why pgvector?** Inferred until L2. Do not cite it as your decision before then.
- **What is the largest gap?** No human-reviewed live RAG scorecard, no calibrated grader, ingestion still on the request, no spend limits, public-launch gate not ready, child-privacy decision unmade.

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
