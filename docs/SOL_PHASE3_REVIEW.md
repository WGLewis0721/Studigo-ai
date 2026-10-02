# Sol Phase 3 integrated review

Actual sequential GPT 6.1 Sol xhigh backend review, 2026-10-02 UTC, after the low
`4da861a` and medium `dbb9a4f` passes. The coordinating agent merged Claude's
latest main into `codex/sol-phase3-review` at `b1f220b`. No UI, CSS or components
were edited. This is an engineering repair/audit pass, not Phase 3 release or
TestFlight acceptance.

## Findings and repairs

| Severity | Finding | Result |
| --- | --- | --- |
| P1 | An old Coach retry could enter a newer pending question's evaluator; the latest retry returned an acknowledgement instead of its original answer. Assistant history was written after the evidence transaction. | The flagged path reads private immutable reply receipts before current state. New `commit_adaptive_coach_response` writes reply, assistant history, state, evidence and projections together. Nothing is streamed before that commit. Reuse does not append another assistant row. Historical receipts without replies fail explicitly; they do not regenerate a historical answer. |
| P1 | Source checks preceded model work, leaving a source deletion/content/status race before evidence commit. | Additive migration `20261002030000` locks original owned source/topic rows, verifies ready/nonblank content and the existing SHA-256 snapshots inside the commit, and rejects changed rubrics/source identities. Source failure rolls back reply, state and learning writes. Accepted semantic evaluations remain immutable for retries. A skip can remain bookkeeping after source deletion. |
| P1 | New Coach tasks and session recommendations could use a stale concept projection. Atomic skip/issuance did not fold the buffered skip into its new spec. | New specs carry their canonical `stateRevision`. The director folds trusted pending observations before issuance; DB CAS checks the combined revision under the same room lock as Coach/Quiz/card/test writers. The unapplied session migration adds a concept revision check. Exact duplicate receipts remain recoverable after state/source changes. |
| P1 | A lost first conversation SSE caused a null-conversation retry to create another conversation, then conflict with its existing message. | Stable interaction IDs recover the owned original conversation before creation. Content/room conflicts fail. Conversation and session UUID case normalizes to database identities; session fingerprints remain stable. Simultaneous first submissions that race before the message exists can still conflict; hosted acceptance must cover this case. |
| P2 | Retention used timestamp/ID ordering while progression put failure/support before success at equal timestamps. | Both use `orderLearningEvents`; equal-time failure/success across encounters now produce the same conservative day-one schedule independent of IDs/input order. Ten reasoning rungs, six scaffolds and progression thresholds are preserved. |
| P2 | Skipped Plan work could reintroduce a source-ineligible canonical topic. | Carry-forward uses the same supported ordered topic set as the plan. |
| P2 | RAG score summaries compared configuration/counts without retaining corpus identity; aggregate scores could conceal grade-band regression. | Matched corpus hashes are required. Two-point aggregate and subgroup regression tolerance, 95% grounding/abstention gates, and existing improvement thresholds remain intact. Unit cases check one-point/exact-two-point acceptance and greater-than-two-point rejection. |
| P2 | Offline BKT removed assistance before selecting independent targets and could use another outcome from the same timestamp. | Prior/equal-time assistance remains visible, unknown support is conservative, and equal-time predictions precede all updates. Later feedback does not remove an earlier independent target. Python remains advisory/offline, with no provider/database/policy writer. |

The router invalidates removed topics and historical pending tasks without a
verified durable encounter/source snapshot before grading. A failed topic read
cannot masquerade as removal. Generated/evaluated concept IDs, statuses, rubric
weights, critical flags and source IDs receive bounded shape checks. Hash-based
context identity prevents exact repeated-question reuse; it does not prove
semantic novelty or pedagogical quality.

## Validation actually performed

Supported Node **22.23.3**: web typecheck passes before the final one-line evaluator
guard amendment; shared learning **15/15**, RAG scorer **7/7**, focused web **72/72**,
then the expanded atomic wrapper/session-input suite **9/9** pass. Python harness
**8/8** passes. The focused web run predates the last UUID normalization and
expanded skip/activation/evaluator cases; the separate nine-case run covers those.
These are synthetic/unit checks. The final evaluator guard requires complete
concept evidence when a model control intent falls back to assessed-answer routing.

The final actual PostgreSQL migrations/security suite passed **44/44** on Node 22,
including new exact-reply, source mutation, rubric immutability, inactive topic,
accepted-evaluation retention, stale concept/session rollback, buffered-skip CAS
and competing-reply cases. Earlier runs could not initialize PGlite: WASM
`unreachable` occurred before any migration/test. Default concurrent web runners
also hit esbuild `cannot allocate memory`; serial execution passed. A system read
showed about 214 MB free physical memory and 289 MB free virtual memory. After
headroom recovered, the final DB run passed. No unrelated process or local beta
server was stopped. The coordinator must run the final combined suite/build.

Logs: `C:/Users/Willi/projects/Labs/artifacts/results/studigo-sol-xhigh-web-focused.log`
and `studigo-sol-xhigh-atomic-focused.log`. `studigo-sol-xhigh-db-node22.log`
records the final 44-case pass. No hosted mutation, model call, native/device check, production
build, deployment, commit or merge was performed by this review subagent.

## Release gates retained

1. **P1: durable Session → Coach lifecycle remains disconnected.** Session API
   requests carry no conversation/encounter binding. Start/recommend/select/end
   do not atomically issue, resume, answer, skip or cancel Coach pending state;
   ending a session leaves a separate Coach question pending. Reading a pending
   topic before a plan commit would still race and would be ambiguous with
   multiple conversations. Implement a reviewed session/conversation/encounter
   transaction with revisions and receipts before advertising a complete
   durable guided session. Keep this limitation explicit in beta scope.
2. Activation requires reviewed migrations `20261002020000` then `20261002030000` before
   deploying flagged code. Migration `20261002010000` was preserved unchanged.
   The source helper in `20000` is required by `STUDIGO_ADAPTIVE_SESSION` readers
   even when `STUDIGO_DURABLE_SESSIONS` is off. Disable flags/revert the app for
   rollback; preserve additive tables/history.
3. Hosted authenticated generation, initial/old retries, source mutation/deletion,
   transaction failures and real multi-connection/multi-tab ordering still need
   acceptance. Embedded PostgreSQL checks actual transactions/CAS but serializes
   its connection and cannot establish hosted lock scheduling or provider output
   quality. Exact snapshot replies may cite a subsequently deleted source;
   source access remains independently authorized and can fail.
4. Quiz/Practice Test issuance provenance remains incomplete; legacy assistance
   stays unknown and Flashcard ratings remain self-report. Complete cross-surface
   evidence before claiming independent mastery from those production surfaces.
5. Canonical view numbers `0/25/60/100` are compatibility stage indices, never
   measured mastery percentages or director inputs. Existing readiness/mastery
   labels still need Claude's evidence-stage presentation. Canonical Weak Areas
   also omits recent quiz/blind-spot metadata; shared ordering is intact, but
   confidence-specific diagnosis needs an explicit policy/presentation follow-up.
6. PR #59/downloadable-guide P0, 120 independently reviewed live RAG cases,
   same-store Python/TypeScript measurements (including source recall, teacher
   priority, duplicates, injection and deletion), operational/worker/privacy
   acceptance, measured provider latency/cost and real BKT exports remain open.
7. Expo/iOS/iPadOS implementation and physical-device OAuth, lifecycle,
   accessibility, secure-token and PDF-sharing acceptance remain open. Synthetic
   browser/PDF evidence cannot close those gates. No child-pilot approval is implied.

The next step is the coordinator's final supported-runtime verification and
reviewed preview migration/deployment, then hosted acceptance. Return the current
interface and evidence-stage presentation work to Claude with these limits.

## Coordinator verification

The final complete code suite passed on Node 22.23.3 with serial test execution:
**430 JavaScript/TypeScript/PostgreSQL/RAG tests**, **eight Python tests**, and
workspace typecheck. Serial execution uses the same test files as `pnpm test`;
only runner concurrency differs. CI now also runs `pnpm test:ml`.
`pnpm build:web` also passed on Node 22.23.3. The existing Next.js middleware
deprecation warning remains; it does not prevent the build.

Reviewed migrations `20261002020000` then `20261002030000` were applied to the
configured hosted Supabase project. Schema/grant checks confirm authenticated
clients cannot commit Coach responses, the backend service can, and scoped
source reads remain available. Production deployment and flags were not changed.
Explicit Vercel exclusions keep private local acceptance tokens/results/runtimes
out of uploaded deployment source.

The existing browser harness passed all eight flow groups at desktop and phone
viewport sizes with no page errors: Coach/help/grade, Quiz, shared progress/plan,
upload/reload, PDF/citations, self-rated Flashcards, Practice Test drafts/results
and two-session isolation. The first cold navigation timed out while the host
was constrained; the unchanged harness passed on rerun using installed Chromium.
GitHub CI also passed on Node 22, including the new offline ML checks and web build.

Vercel marked a direct CLI preview `BLOCKED` under its team collaboration policy.
The connected GitHub pipeline built the same commit successfully. The coordinator
configured the three non-secret feature flags only for this review branch's
preview and uses the connected pipeline for deployment. No key retrieval was needed.
