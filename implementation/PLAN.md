# Studigo plan

Status: proposed. Nothing here changes production behavior until the PR for the relevant step is accepted. This is the single plan. [AI_ENGINEERING_TOUR.md](AI_ENGINEERING_TOUR.md) is the walkthrough it produces, and [SECURITY_AUDIT_CHECKLIST.md](SECURITY_AUDIT_CHECKLIST.md) is the control-by-control evidence behind the security workstream.

## Outcome

After this plan, three things are true.

1. **A model can orient without reading the code.** A fresh GenAI session given a short, fixed set of files can say what each part of the repo does, where a given behavior lives, and what it must not touch, in a few thousand tokens instead of tens of thousands.
2. **I can explain it.** For any part of the system I can say how it works, why that technology was chosen over the alternatives, and which files do it, using documents that are in the repo and are kept true.
3. **Every claim has evidence.** Quality claims have a measured number next to them, and security claims have a checklist row with a status and a file.

The rules in [AGENTS.md](../AGENTS.md) still govern all of it: grounded by default, RLS preserved, provider calls inside `packages/ai`, heavy ingestion out of synchronous requests, uploaded content treated as untrusted, and tests or evals around every behavior change.

## Where things stand

| Area | Finding | Where |
| --- | --- | --- |
| Legibility | The reading list in `AGENTS.md` is about 14,500 words (roughly 20k tokens) before any code. No package has a README. Executed-phase files (`SOL_PHASE*`, `ATTEMPTED_FIXES.md`) sit beside live docs. | `AGENTS.md`, `docs/`, `packages/` |
| Rationale | Few technology choices are recorded. ADR 001 is the only one. Most "why" lives in my head or in scattered docs. | `docs/adr/` |
| Evidence | Eval cases are synthetic and unreviewed, no committed run results, no live adapter. | `evals/rag/` |
| Retrieval | Dense top-k only, fixed 0.35 cutoff, `priority/1000` bonus, no hybrid search, no reranker, chat history not used in the query. | `apps/web/lib/retrieval.ts`, `supabase/migrations/002_core_loop.sql` |
| Citations and abstention | `grounded` means a `[n]` marker appears; abstention only fires when zero chunks pass the cutoff. | `packages/ai/src/grounding.ts` |
| Security | No rate limits or quotas, no security headers, no moderation, upload checks are thin, production advisories, `latest` pins, and no child-privacy controls. | [checklist](SECURITY_AUDIT_CHECKLIST.md) |
| Operations | No tracing, cost logging, or prompt versioning; ingestion runs inside the request. | `apps/web/app/api/chat/route.ts`, `apps/web/lib/ingest.ts` |
| CI | `next lint \|\| true`, echo-stub package lints, `--no-frozen-lockfile`. | `package.json`, `.github/workflows/ci.yml` |
| Focus | Moon Keep and a side Python retrieval service sit beside the learning app. | `prototypes/moon-road/`, `services/retrieval/` |

## Workstream L: Legibility (do first)

This is the cheapest work and it makes every later step faster, for me and for any model helping me.

- **L1. Code map.** Add `docs/CODEMAP.md`, under about 150 lines. One row per app and package: what it does, entry points, what it depends on, which tests cover it, and what must not go in it. Add a short glossary (Study Room, Coach, Learn, director, mastery) and a "where does X live" table for the questions I get asked most (citation check, retrieval, RLS on chunks, grading, mastery update, upload path).
- **L2. Technology choices.** Add `docs/TECH_CHOICES.md`: for each major choice, the problem, the choice, the alternatives considered, the tradeoff accepted, and what would make me revisit it. Cover Next.js, Supabase Postgres with pgvector and HNSW, RLS as the privacy boundary, the OpenAI provider layer and its three transports, TypeScript retrieval versus the Python prototype, deterministic mastery (BKT, Elo, scheduler) versus model-judged mastery, the pnpm monorepo, the PWA with Tauri and Expo, and feature flags. Promote the big ones to ADRs. **Only reasons I can state or that are already in the repo get written down.** Where the repo does not say why, I fill it in myself rather than letting a model invent a rationale.
- **L3. Package READMEs.** Add a short `README.md` to `packages/ai`, `documents`, `learning`, `mastery`, `evals/rag`, `evals/ml`, and `apps/web`: purpose, public exports, inputs and outputs, invariants, how to test it, and what does not belong there.
- **L4. Docs triage for token cost.** Rewrite `docs/README.md` as a read-first list with approximate size next to each file, and a "read only if" note for the rest. Move executed-phase files (`SOL_PHASE*`, `ATTEMPTED_FIXES.md`, `PROBLEM_STATEMENT.md`) to `docs/archive/` with a banner and a redirect, relocating rather than deleting, per `AGENTS.md`. Add clear pointers for Moon Keep and `services/retrieval/`. Point `AGENTS.md` at the code map as the first read.
- **L5. Keep it true.** Add a small CI check that every path named in `docs/CODEMAP.md` exists and every app and package directory is listed. Fix stale comments found in the audit (the anonymous sign-in comment in `apps/web/lib/auth.ts`).
- **L6. Orientation eval.** Write ten fixed questions about the repo (for example "where is the citation check", "why pgvector", "what stops a user reading another user's chunks"). Give a fresh model session only `AGENTS.md`, the code map, and the tech choices, and score its answers against the real files. Record accuracy and tokens used in `docs/ORIENTATION_EVAL.md`, and rerun it when the structure changes.

Exit: a model with the orientation set answers the ten questions correctly with file paths, and I can read the same files aloud as my explanation.

## Workstream E: Measured evidence

The ADR gates apply: zero unauthorized retrieval, at least 95% claim support, at least 95% correct abstention, and no regression over two points.

- **E1. Review a first set.** Hand-review about 50 of the 120 cases, balanced across `plain`, `table`, `unsupported`, `conflict`, `injection`, and `foreign-user`. Record the reviewer, and flip `review.status` only for cases actually reviewed.
- **E2. Live adapter.** Build the TypeScript adapter for `evals/rag/run.mjs` that calls the real `match_study_chunks` path and logs retrieved ids with revisions, claims with sources, latency, and cost. Pin model, embedding model hash, prompt hash, and temperature.
- **E3. Baseline.** Commit the run JSON to `evals/rag/results/` and add a results table to the README: hit rate at k, claim-level support, correct abstention, unauthorized retrievals (must be zero), p95 latency, and dollars per answer.
- **E4. Hybrid retrieval.** Migration adding a `tsvector` column and index, merged with vector ranking by reciprocal rank fusion, behind a flag, with owner and room predicates unchanged.
- **E5. Reranker.** Rerank the top 20, behind a flag, with the provider call inside `packages/ai`.
- **E6. Cutoff and boost.** Choose the similarity threshold from the eval set. Replace the `priority/1000` bonus with an explicit, documented source boost that keeps teacher study-guide priority.
- **E7. Claim verifier.** Check each cited claim against its cited chunk after generation, and flag or remove unsupported claims. Measure verifier precision and recall against the human labels from E1.
- **E8. Ablation.** Report baseline, +hybrid, +rerank, +verifier on the same corpus hash, each with latency and cost change.

Exit: published baseline numbers, including any that miss the gates, and at least one measured gain with its cost stated.

## Workstream S: Security

Each step lists the checklist rows it closes. Order is by launch risk.

- **S1. Dependencies.** Upgrade `next` to 16.3.6 or later, update `sharp` and `source-map-js`, pin `react`, `react-dom`, `typescript`, `tsx`, and `@types/*` to exact versions, use `--frozen-lockfile` in CI, and run `pnpm audit --prod` in CI (DEP-01 to DEP-03).
- **S2. Headers and errors.** Add CSP, HSTS, frame protection, Referrer-Policy, and `X-Content-Type-Options`. Replace the 22 raw `error.message` responses with stable error codes and log details server-side (WEB-01, ERR-01, API-08).
- **S3. Cost and abuse controls.** Per-user and per-IP rate limits on chat, upload, quiz, and flashcards, a daily spend cap with an alert, WAF rules for chat, upload, auth, and waitlist, and a durable limiter in place of the in-memory one (ABUSE-01, ABUSE-02, API-04, API-06, LLM-10, VERCEL-01).
- **S4. Uploads and ingestion.** Magic-byte checks per format, entry-count and uncompressed-size limits for PPTX and DOCX, and malware scanning or a sandboxed parser. Move ingestion onto a durable worker or queue; if that does not fit, document the limit and its failure mode in the README (FILE-03, FILE-05, FILE-06, FILE-08).
- **S5. Prompt safety.** Run the existing injection scenarios and record results, add a system-prompt-leak case, and add output moderation with safety evals for child-appropriate answers (LLM-01, LLM-07, KIDS-07).
- **S6. Small code fixes.** `server-only` on server modules, a timing-safe compare for the cron secret, build Ask-mode directive text server-side from topic ids, a route inventory with auth mode, and tests that request another user's ids and pass another user's `p_owner_id` (NEXT-01, SECRET-01, CLIENT-01, API-01, API-09, LLM-08).
- **S7. Dashboard walk.** Check and record Supabase SSL enforcement, MFA, email confirmation and OTP expiry, auth rate limits and CAPTCHA, the anonymous sign-in decision, and Security Advisor results (SUPA-04 to SUPA-09).
- **S8. Child privacy gate.** Needs my decisions and legal review, not just code: age gate and parental consent path, privacy policy and terms, account deletion with export, retention periods, a written information security program, separate consent for third-party disclosure, vendor review, and FERPA terms if I sell to schools (KIDS-01 to KIDS-06, KIDS-08, KIDS-09). Until this closes, access stays limited to invited adult beta users.

**Public launch gate:** S1 to S8 closed, or each open item waived in writing with a reason.

## Workstream H: Operations and CI

- **H1. Observability.** Tracing (Langfuse or OpenTelemetry), per-turn token and cost logging, and a prompt version id recorded with every model call (LOG-01).
- **H2. CI and boundaries.** Real lint in every package with `|| true` removed, a lint rule forbidding the model SDK outside `packages/ai`, an eval smoke subset of about 10 cases that fails on regression, the Playwright beta verification in CI, and a coverage report.

## Workstream W: Walkthrough

- **W1. Make the docs match the results.** Update every status cell and the limits section of the tour, and every status in the checklist, so nothing claims more than committed results support. Rewrite the README top as: problem, architecture diagram, results table, tradeoffs, known limits.
- **W2. Package the story.** A two-page summary of method, results, and tradeoffs, a three-minute demo, and a check that someone unfamiliar can follow the ten-minute demo path without help.

## Order

| Week | Work |
| --- | --- |
| 1 | L1 to L6, S1, S2, E1 to E3 |
| 2 | E4 to E8, S3, S5 |
| 3 | S4, S6, S7, H1, H2, W1, W2 |
| In parallel | S8, which waits on my decisions |

Legibility goes first because the code map, tech choices, and orientation eval also speed up the work in every other workstream.

## If time is short

Keep L1 to L3, L6, S1, S2, E1 to E3, E7, E8, and W1. Skip the queue (document the limit) and the reranker.

## Risks

- The LLM judge can drift. Human review stays the source of truth, and model self-certification is never used for review fields.
- A 50-case set is small. Report confidence intervals and say so in the README.
- Fixture cases test grounding, not OCR accuracy. Real scan and PDF fixtures remain a separate gate.
- A code map goes stale. L5 makes CI catch missing paths, but descriptions still need review when a package changes.
- A model asked to write rationale will invent one. L2 only records reasons I confirm.
- Eval spend should be small at this size; confirm after the first run and record it.

## Definition of done

- The orientation eval passes: ten questions answered correctly from the orientation set alone, with the token count recorded.
- `docs/CODEMAP.md`, `docs/TECH_CHOICES.md`, and a README in each package, with CI checking the paths.
- A reviewed eval corpus with named reviewers and a corpus hash, committed run JSON for baseline and every ablation arm, and a README results table that matches the JSON.
- Zero unauthorized retrievals across all runs, and CI that fails on an eval regression.
- The public launch gate met or each open item waived in writing.
