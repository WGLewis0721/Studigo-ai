# Phase 3.6 control-plane foundation

Implements the initial deterministic foundation described by PR #33 at
`7295fe8033d5b4a824256789af4024a78399a575`. That documentation PR is not merged
or copied into this branch. Implementation starts from main `7e9b7b0`.

## Boundaries

`apps/web/lib/learning/` owns contracts, observations, the pure reducer and the
Challenge Director. No provider calls, embeddings, learned policy or new service
is involved. Generative AI remains responsible for Coach delivery and semantic
evaluation; the control plane determines progression from explicit results.

The existing weighted `topics.mastery_score`, readiness, flashcard schedule,
and the existing `packages/mastery` research primitives are preserved. This
foundation does not replace their numerical scores or introduce another public
mastery percentage. `masteryEvidence` reports which observations have actually
been demonstrated; `reopened` means transfer evidence was contradicted in a new
context. Historical transfer successes remain recorded after reopening.

## Inspectable policy v1

| Observation | Deterministic effect |
| --- | --- |
| Two independent successes at or above current demand, on distinct encounters | Raise reasoning one step, capped at 9; consume the streak |
| Correct answer to an easier question | Evidence at that demand; no advancement above it |
| Partial answer | Hold reasoning; increase scaffold one step |
| Incorrect answer | Hold reasoning; increase scaffold; after two consecutive failures request one step at a time |
| Help/reveal | Preserve help on the encounter; reveal sets scaffold to worked example |
| Correct after help/reveal | Record recovery/help dependence; never independent mastery |
| Correct after unassisted failure | Record recovery distinctly from first-attempt success |
| Independent transfer in an explicitly new context | Strong transfer evidence |
| Partial/incorrect transfer in a new context | Rematch after 24 hours; reopen prior transfer evidence |
| Same rubric misconception in two distinct encounters | Rematch after 24 hours |
| Due rematch, independent success in a different context/encounter | Resolve; transfer rematches require transfer success |
| Skipped | Break streaks; no failure or mastery credit |
| Independent recall after 24 hours without practice | Delayed-recall signal |

Reasoning and scaffold ladders are exported constants. Support decreases one
step on a successfully assessed encounter. Route never changes these thresholds,
grading or source truth: it selects a stable existing teaching-KB record for the
renderer. All specs request plain language and one concept at a time.

Flashcards are capped at recall. Practice tests request independent whole tasks
without changing the underlying state. A transfer rematch remains pending if the
learner chooses cards. Rematches do not silently expand the teacher's scope:
the endpoint only serves active topics owned by the requesting learner.

## Persistence and integration

Quiz, Practice Test and Flashcards already persist canonical, idempotent rows in
`quiz_attempts`. `read_concept_learning_history` reads them alongside new
observations in one database snapshot. No backfill or duplicate event writes are
introduced. The existing RPCs still atomically update attempts, schedules and
the existing mastery score.

Those older rows lack verified reasoning/context/support information. The adapter
marks support unknown and evidence legacy/self-reported. Choice questions map to
recognition; other formats map conservatively to recall, never inferred transfer.
An existing correct flag wins; otherwise scores of at least 45 are partial (the
existing Coach partial boundary), lower scores incorrect. Such history can drive
retry support, but cannot establish independent mastery or raise demand.

`learning_events` stores only observations without an existing attempt home.
It accepts Learn/Coach/Weak Areas/Cram; assessed Quiz/Practice Test/Card events must
continue through their authoritative tables. A future rich-metadata integration
for those tables should extend their transactional write, not dual-write here.
Learn's existing unscored Socratic checks remain unscored.

The new table is RLS-protected, scoped by composite owner/room/topic foreign keys,
and append-only for the service role. Clients can only read their own evidence.
`record_learning_event` is service-only, checks active scope, rejects conflicting
reuse of `(owner_id,id)` and returns the same row for an identical retry. It locks
the room in the existing RPC lock order. Failed writes do not advance state.

Current state is derived, not persisted: there is no event/projection dual-write
failure. The scalar JSON read RPC avoids the Data API's row-limit truncation and
does not expose answer keys or learner responses. Replay sorts by timestamp,
then conservative outcome order for equal timestamps, then ID, rejects mixed
ownership and conflicting duplicate IDs, and retains encounter-level help across
retries. Incremental folding rejects older timestamps; use full replay if older
evidence arrives.

This first version reads complete history for one concept, so pending rematches
cannot disappear at a rolling-window boundary. Time/memory grow with that history;
introduce a versioned transactional checkpoint only when measured volume warrants
it. No database failure is converted into an empty initial state.

## API and Opus handoff

Authenticated read-only endpoint:

```text
GET /api/learning/challenge?roomId=<uuid>&topicId=<uuid>&activity=coach&route=studigo_default&challengeRequest=normal
```

Returns a `ChallengeSpec` plus compact evidence, with private/no-store caching.
It reads canonical evidence and is immediately usable by existing mini-games;
it does not generate or grade content or persist an issued question. The existing
UI is not automatically switched to the director in this foundation PR.

Server-side orchestration can instead use:

```ts
const { state, events } = await loadConceptLearningState(userClient, conceptKey);
const spec = nextChallenge({
  concept: { ...conceptKey, objective }, learnerState: state,
  recentEvents: events, activity: 'coach', route: 'studigo_default',
  challengeRequest: 'normal', now
});
```

`challengeRequest` is optional. Omit it, or pass `"normal"`, for today's demand.
`"stretch"` asks for one harder rung on this issued spec only.

### One-shot stretch

Pressing "Challenge me" means "give me a harder attempt." It does not mean the
learner has demonstrated that level. Only a later assessed `LearningEvent` may
move progression.

`nextChallenge` stays pure. A stretch does not change `ConceptLearningState`,
recent events, mastery, streaks, scaffold, rematch, or encounter history, and
it does not store a preference. The next call reads persisted demand again, so
repeated presses without new evidence do not stair-step.

For one Coach encounter the issued reasoning level is persisted demand + 1,
capped at 9 (`teach_back`). The route, concept, topic, and source scope stay
the same. Scaffold and task size stay on their normal rules. The spec records
`learner_requested_stretch` in `reasons`.

Precedence, in order:

1. A due rematch that this activity can serve wins. The spec is the rematch,
   including a transfer rematch at transfer, and it does not include the stretch
   reason. Flashcards still cannot serve or clear a rematch.
2. Practice tests, Learn, Quiz, Weak Areas, and Cram keep their existing demand.
   A practice test stays an independent whole task at scaffold 0.
3. Flashcards may take the one rung only up to recall. A stretch cannot turn a
   card into transfer, a novel problem, or teach-back.
4. Coach takes the one rung, capped at 9.

The read-only endpoint accepts the same choice as
`?challengeRequest=normal|stretch`. Omitting it is normal.

Before wiring Coach:

1. Persist the issued challenge kind/context and stable encounter ID in Coach's
   pending state. Keep grading against that issued challenge and its sources.
2. Track actual help/reveals with the SAME encounter ID. Do not trust a browser
   or an LLM to claim independent support, progression or new context.
   Support given after an answer must not retroactively change that answer.
   Record the incorrect attempt with the scaffold actually used then (often 0).
   Later help on that same encounter raises support for the retry only. A later
   correct attempt records the accumulated support and is recovery, not
   independent mastery. The reducer already does this by keeping each event
   immutable and taking the max scaffold seen on the encounter; do not fold
   later help back into the earlier result.
3. Translate a server-verified assessment into `LearningEvent`; use a stable
   interaction ID and timestamp across transport retries. Call
   `recordLearningEvent(serviceClient, event)` after user-client ownership checks.
4. Reload and replay before selecting the next challenge. If persistence fails,
   report a retryable error; do not quietly advance Coach.
5. Existing Coach conversation-state writes are separate today. The integration
   must make its state/evidence commit transactional or explicitly recoverable.

Observation IDs/encounters and canonical attempt IDs use separate namespaces at
the normalization boundary. Do not emit the same assessed interaction through
two mini-game adapters. Retry means a new learner response with a new interaction
ID; network retry means the same ID and payload. Repeating correctness on the
same encounter never farms advancement.

No Opus-owned Coach presentation, generation or routing file is modified here.
Weak Areas/Cram scheduling can consume `state.rematch`; existing UI queues remain
on their current evidence ranking until that integration is deliberately wired.

## Validation and rollout

`apps/web/lib/learning.test.ts` covers transitions, deterministic replay,
assistance persistence, equal-time reveal safety, boundaries, route invariance,
legacy adaptation and failed persistence. `tests/database-security.test.mjs`
executes all repository migrations in PGlite, including two-user isolation,
grants, source-attempt reuse, idempotency, conflict rollback and scope constraints.

Apply `20260924054643_adaptive_learning_core.sql` to the target test environment
before exercising the endpoint. This branch does not apply production migrations
or merge either PR. Hosted Auth/Data API verification and Coach/UI integration
remain rollout work; embedded PostgreSQL tests do not claim to cover those.
