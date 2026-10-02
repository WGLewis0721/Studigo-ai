# Studigo Architecture

## Goal

Keep the product easy to evolve by separating five concerns:

1. UI/product experience.
2. Identity/data/storage.
3. Document ingestion.
4. Retrieval + AI generation.
5. Installable/native shells.

## System map

```text
Student
  |
  v
Next.js / React PWA
  |
  |------------------------------|
  |                              |
  v                              v
Next.js server routes          Supabase Auth
  |                              |
  |                              +--> Google OAuth
  |                              +--> Apple OAuth
  |                              +--> Microsoft / Azure OAuth
  |                              +--> Email fallback
  |                              +--> Facebook later
  |                              |
  |                              v
  |                        authenticated user
  |
  +--> Supabase Postgres + RLS
  |       |-- study_rooms
  |       |-- documents
  |       |-- document_chunks + pgvector
  |       |-- topics/mastery
  |       |-- conversations/messages
  |       |-- product profile/onboarding data
  |
  +--> Supabase private Storage
  |       |-- original uploaded documents
  |
  +--> @studigo/ai
          |-- embeddings
          |-- retrieval response contract
          |-- grounded answer generation
          v
        OpenAI

Async ingestion
  upload -> queue -> extract text/OCR -> normalize -> chunk -> embed -> ready

Ingestion (implemented)
  upload -> queued -> processing -> extract text (page/slide numbers preserved)
    -> OCR pages with no text layer -> normalize -> chunk -> embed -> ready
```

## Frontend

`apps/web` is the primary product surface.

- Next.js App Router.
- Responsive by default.
- PWA manifest + service worker scaffold.
- The "Personal Learning Device" design system (V2, `docs/DESIGN_SYSTEM.md`) is the current design direction; it replaced WebForge V1.
- Do not put provider SDK secrets or privileged credentials in browser code.
- UI should consume internal API routes or a future dedicated API service.

Studigo should feel like a **personal learning device with a companion living inside it** — colorful, tactile and modern — not a generic education SaaS dashboard. Authentication, onboarding, Study Rooms, document management, tutoring, and mastery surfaces should all evolve from the same design system in `docs/DESIGN_SYSTEM.md`.

## Authentication and identity

Supabase Auth is the canonical Studigo identity layer. Do not introduce a parallel identity vendor unless a future requirement cannot reasonably be met by Supabase Auth.

### Launch providers

1. Google
2. Apple
3. Microsoft (Supabase `azure` provider)
4. Email fallback
5. Facebook later if justified by usage

Google One Tap may be evaluated after standard Google OAuth is stable.

### Web / PWA auth flow

The Next.js app should use Supabase's supported SSR/cookie pattern with PKCE for OAuth.

```text
/login
  -> signInWithOAuth(provider)
  -> Supabase Auth
  -> external provider
  -> Supabase provider callback
  -> /auth/callback
  -> exchange code for session
  -> onboarding check
      -> /onboarding for new/incomplete profile
      -> /app for returning user
```

The authenticated Supabase user ID is the principal used by RLS-protected Studigo data.

Provider credentials belong in Supabase Auth provider configuration, not in browser source code. Social provider secrets, Apple signing material, service-role keys, and OpenAI keys must never be exposed to the client or committed to the repository.

### Auth UI direction

The surrounding login/onboarding experience should use the Studigo design system: calm snow surfaces, a single colored polycarbonate panel, strong hierarchy, limited companion use, and clear study-oriented copy.

The provider buttons themselves should remain immediately recognizable and trustworthy. Do not turn Google/Apple/Microsoft sign-in controls into stylized generic product CTAs that obscure the provider identity.

### Authorization boundary

Authentication answers **who the user is**. Postgres RLS answers **what the user can access**.

Do not weaken ownership policies because requests pass through Next.js server routes. User-owned Study Rooms, documents, conversations, and mastery records must remain database-authorized.

Do not use editable Supabase `user_metadata` values for authorization decisions.

See `docs/AUTH.md` for the canonical auth/provider/session/security design.

`/` is the marketing surface. The product lives behind auth:

- `/login`, `/signup` — Supabase email/password, session refreshed in middleware.
- `/app` — study rooms: create, open, rename, delete.
- `/app/rooms/[roomId]`: one room with five pages (`GROUPS` in
  `components/room/workspace.tsx`): Coach (Coach plus Ask and Learn behind a
  Coach / Learn switch), Practice (Quiz, Flashcards, Practice Test), Progress
  (Mastery, Weak Areas), Plan (study plan, Cram) and Materials. Older `ask` and
  `learn` links still resolve into Coach. Mode state is client-side; all data is
  server-loaded. Wide screens show a framed room with a Studigo rail and the page
  selector in the top bar; phones show a bottom tab bar.

## Backend

For the first production iteration, backend logic can remain in Next.js route handlers plus Supabase rather than adding another API framework.

Use a separate backend service only when one of these becomes real:

- Long-running processing exceeds serverless limits.
- Queues/workers become operationally significant.
- Multiple clients need a durable public API contract.
- Native apps need a separately deployed API.
- Compliance/network boundaries require separation.

## Supabase responsibilities

### Auth

Student identity, OAuth provider integration, JWT issuance/refresh, sessions, and the shared account model for web/PWA and future native shells.

### Postgres

Product records and vector index. Row Level Security is mandatory on user-owned data.

### Storage

Original source files in private bucket `study-materials`.

### pgvector

Semantic retrieval of `document_chunks`. The first migration uses 1536-dimensional embeddings to match the default `text-embedding-3-small` scaffold setting.

If the embedding model/dimensionality changes, migrate the vector column and index deliberately. Do not silently swap embedding dimensions.

## AI package

`packages/ai` owns provider-specific calls and grounded-answer behavior.

The web application should not spread direct OpenAI calls across pages/routes. Keep model calls behind this package so future agents can:

- Change chat models.
- Change embedding models.
- Add reranking.
- Add hybrid lexical/vector retrieval.
- Add another provider.
- Add evaluation instrumentation.

without rewriting the product layer.

`OPENAI_CHAT_MODEL` has no source-code default on purpose. Model selection is a deployment decision.

## Retrieval

Current sequence:

```text
question
 -> embedding
 -> room-scoped match_study_chunks RPC
 -> semantic similarity + small source-priority boost
 -> grounded LLM response
 -> source citations
```

Retrieval must always be scoped to a Study Room and authenticated owner.

Future retrieval improvements should be measured with evals before adoption:

- Chunking strategy.
- Hybrid search.
- Metadata filters.
- Query rewriting.
- Reranking.
- Multi-query retrieval.
- Page-neighbor expansion.

## Document ingestion

The upload API intentionally stops at private storage + database metadata. Do not perform heavyweight OCR/parsing synchronously inside the upload request.

Target pipeline:

1. Upload original.
2. Create document record.
3. Enqueue ingestion job.
4. Mark `queued` / `processing`.
5. Extract text with page/slide/section structure.
6. OCR image-only pages if needed.
7. Normalize without destroying headings/tables/questions.
8. Chunk with document-aware metadata.
9. Generate embeddings.
10. Insert `document_chunks`.
11. Mark document `ready`.
12. Trigger Study Room topic analysis when appropriate.

Parsers should be adapters, not embedded in route handlers.

## Source priority

The database assigns source priority:

- Study guide: 100
- Teacher material: 95
- Worksheet: 90
- Presentation: 85
- Student notes: 75
- Textbook: 70
- Other: 50

This priority adds a modest ranking boost; it must not make irrelevant study-guide chunks outrank highly relevant supporting material.

## Documents and downloads

Original documents remain private. The download endpoint creates a short-lived signed URL after RLS verifies ownership.

Do not make the bucket public for convenience.

## Executable layer

### Phase 1: PWA

The web app is the canonical client and should be installable on desktop/mobile browsers.

### Phase 2: Tauri

`apps/desktop` reserves a Tauri v2 shell. Do not enable production bundling until the frontend/backend deployment boundary is finalized. A desktop shell should call the same hosted API rather than embedding secrets or duplicating AI logic.

Tauri or any future native shell should resolve authentication to the same Supabase users and RLS model. Do not create a separate native-only account system.

### Mobile route: Expo / React Native

As of October 1, 2026, the App Store route is a universal **Expo / React Native iOS/iPadOS** client. Do not start a parallel Capacitor or platform-native implementation unless this decision is explicitly revisited.

The native application is a client of the existing hosted Studigo system:

- reuse the same Supabase Auth identity and RLS-protected data;
- call the hosted Studigo API for learning/AI operations;
- keep mastery, Coach progression, retrieval, document processing, and adaptive-learning state server-owned;
- share types/contracts where practical, but do not import server-only code or secrets into the mobile bundle;
- use native file, share, authentication, safe-area, accessibility, and lifecycle behavior where iOS requires it.

For paid access, web purchases flow through Stripe and iOS digital purchases flow through StoreKit/RevenueCat; both reconcile into APEX as the canonical entitlement layer.

See [`APP_STORE_RELEASE_PLAN.md`](APP_STORE_RELEASE_PLAN.md) for the release sequence and acceptance criteria.


### V3 learning/AI service boundary

The V3 execution target is a **deterministic adaptive game director underneath a
grounded GenAI study partner**.

The control plane remains replayable application logic. It owns progression,
reasoning demand, scaffolding, rematches and mastery evidence. Model-facing code
may render a decided challenge, retrieve/source evidence, semantically interpret
free text and produce grounded feedback, but it may not silently rewrite the
ChallengeSpec or mastery policy.

A Python service (for example `services/learning-ai/`, FastAPI + LangChain) is
allowed where Phase 1 measurements show a clear benefit for RAG composition,
evaluation tooling or ML experiments. It is not automatically required for every
model call. The current TypeScript path and a Python/LangChain path must be
compared on citation quality, permission safety, latency, cost, observability and
operational complexity before the service boundary is finalized.

Supabase/Postgres remains the canonical learner-state and authorization boundary.
The default retrieval store remains the existing room-scoped pgvector data unless
an evaluated alternative preserves RLS, source priority, learner edits and
page/slide citations at least as well.

The OpenAI API key is a **server-side service secret only**. The Expo/iOS bundle
calls Studigo's authenticated backend and must never contain, fetch, cache or
persist the OpenAI service key.

See the root `IMPLEMENTATION.md` and
[`ADAPTIVE_GAME_DIRECTOR_RESEARCH.md`](ADAPTIVE_GAME_DIRECTOR_RESEARCH.md).

## Security rules

- Never expose `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, social-provider secrets, or Apple signing keys to the client.
- Use PKCE/state protections for OAuth and validate application redirect destinations.
- Avoid open redirects through callback query parameters.
- Do not use editable user metadata for authorization.
- Validate uploads server-side.
- Private storage only.
- RLS on all user-owned tables.
- Room-scoped retrieval.
- Signed download URLs with short TTL.
- Treat uploaded text as untrusted data, not executable instructions.
- Prompt injection inside source material must not override system/product policy.
- Add malware scanning and file-content validation before broad public launch.
- Test duplicate-email/account-linking behavior before public beta.
- Test session expiration, logout, and preview/production callback allowlists.

## Observability to add before beta

- Structured request IDs.
- Auth failure/callback diagnostics without logging provider secrets or tokens.
- Ingestion job status + retries.
- Model latency/token/cost metrics.
- Retrieval trace (chunk IDs, scores, source mix).
- User-visible document processing failures.
- Error reporting.
- RAG eval set and regression suite.

## Ingestion pipeline

`apps/web/lib/ingest.ts` runs one document from stored original to retrievable
chunks. It is invoked by `POST /api/documents/process` after upload and by the
Retry action.

1. **Claim.** The status update is conditional on the document still being in
   `uploaded`, `queued`, or `failed`, so a double-click or a retry racing the
   first run cannot ingest the same file twice.
2. **Extract.** PDF via `unpdf` (one entry per page), DOCX via `mammoth`
   (headings/lists/tables preserved, split into citable sections), PPTX by
   reading `ppt/slides/slideN.xml` plus speaker notes, TXT/Markdown by heading.
3. **OCR.** A PDF page whose text layer is under the threshold is isolated with
   `pdf-lib` and transcribed on its own, so the transcription keeps the page
   number a citation has to point at. Uploaded images go straight to OCR.
4. **Chunk.** Page by page, so every chunk has exactly one citable location.
   Long pages split on paragraph then sentence boundaries with a small overlap.
5. **Embed and store.** Batched embeddings, then chunks written with the
   service-role client. Re-ingestion deletes the previous pass first.
6. **Topic map.** A study guide or teacher material additionally produces the
   topic map, with each topic linked to the passages that support it.

Ownership is always verified through RLS with the user's own client *before*
the service-role worker touches anything.

## Grounding contract

- Retrieval is scoped to one room and one owner, in SQL, in `match_study_chunks`.
- Excerpts reach the model numbered, wrapped in `<course_material>`, with an
  explicit rule that their contents are data and never instructions.
- The model cites inline as `[n]`. Only markers that appear in the answer become
  citation chips, and an invented marker is discarded — so a chip is evidence,
  not decoration.
- An answer with no citations is reported as ungrounded in the UI.
- Every chip links to the learner's own original file, at the cited page.

## Mastery

The Phase 3.6 deterministic control-plane foundation is documented in
[`ADAPTIVE_LEARNING_CORE.md`](ADAPTIVE_LEARNING_CORE.md). It derives challenge
demand, support and rematches from shared observations while preserving the
existing numerical mastery/readiness and transactional attempt writes below.
A learner stretch request raises only that one issued challenge. It is not
evidence and does not write concept state.

Readiness is derived, never stored as a decorative number.

- A topic's mastery is the weighted average of the learner's recent attempts on
  it, most recent weighted highest, damped until there are at least four
  attempts.
- Flashcard reviews are recorded as attempts too, at lower scores.
- Room readiness averages mastery across *all* topics, so a topic never
  practiced counts as zero — "ready" means ready for the whole test.
- With no attempts at all, the UI shows "—", not a number.

## Practice types and grading

Four question kinds share one grader, `apps/web/lib/grading.ts`, so a single quiz
answer and the same question inside a practice test can never be scored two
different ways.

| Kind | Graded by | Cost |
| --- | --- | --- |
| `multiple_choice` | chosen index vs `correct_choice` | none |
| `true_false` | chosen index vs `correct_choice` | none |
| `fill_blank` | normalized match against `accepted_answers` | none |
| `short_answer` | model, against `expected_answer` | one model call |

Only short answers reach a model, which is what keeps a 20-question practice
test fast. Fill-in comparison (`gradeBlankAnswer` in `packages/ai/src/study.ts`)
strips case, accents, punctuation, articles and answer filler such as "it is the",
then matches exactly (score 100) or as a typo (score 85) using
`packages/ai/src/typos.ts`, described under "Reading typed text" below. The
short-answer grader prompt also tells the model to read straight through spelling
mistakes, shorthand and missing punctuation.

`accepted_answers` is answer-key data. Like `correct_choice` and
`expected_answer`, it is excluded from the column grant to `authenticated`, so
the browser cannot read it before answering.

Generated questions pass `normalizeGeneratedQuestion` before they are stored. It
rejects what would otherwise reach a learner as broken: a true/false item with no
key, a fill-in with zero or several blanks, a multiple choice with duplicate
options, and a stem that contains its own answer.

## Confidence and calibration

Rating an answer *is* the submit action in Quiz, so confidence costs the learner
no extra step and is present on effectively every attempt. It is stored on
`quiz_attempts.confidence` (1 guessing, 2 unsure, 3 confident) and is nullable,
so older attempts and flashcard rows stay valid.

Two derived signals come from it, both in `apps/web/lib/study-planning.ts`:

- **Blind spots** — wrong while confident. `rankWeakAreas` raises urgency for
  them and labels them, because a learner who does not know that they do not
  know something will not revise it on their own.
- **Calibration** — `summarizeCalibration` compares reported confidence with
  actual outcomes and reports whether the learner reads themselves accurately.
  It stays silent below four rated answers rather than inventing a verdict.

Neither replaces mastery. Mastery says what was demonstrated; calibration says
whether the learner's own sense of it can be trusted.

## Learner edits to generated material

Studigo generates the topic map and the flashcards, but the learner is the one
who knows when it read the teacher wrong. Edits go through
`update_topic`, `set_topic_active`, `create_topic`, `update_flashcard` and
`delete_flashcard` — `security invoker` functions callable only by the service
role, after the route has confirmed ownership through RLS with the user's client.

Two rules make editing safe to rely on:

- `refresh_topic_map` treats `learner_edited` as authoritative. Re-ingesting a
  guide re-links evidence, key terms and ordering, but never overwrites a title,
  objective or priority the learner set.
- A topic the learner removed carries `learner_removed` and stays out of scope
  through any number of re-ingests. Re-adding it restores the original row, with
  its practice history, rather than creating a duplicate.

Editing a flashcard deliberately does not touch `ease`, `interval_days`,
`repetitions` or `due_at`.

## Explanation level

### Applying delivery preferences

**Shipping state before the V3 migration:** Coach setup edits style, learning
tradition and practice recipe; Room Settings owns the room-wide explanation
level. `study_rooms.explain_level` remains canonical for Coach and Learn.

**V3 target:** preserve `study_rooms.explain_level` exactly as the independent
global room setting, but collapse learner-facing Coach customization to
`show | coach | challenge`. Learning-tradition and practice-recipe research
moves behind the UI as internal strategy/reference material. The migration must
not conflate language level with reasoning demand.

The current endpoint behavior is described below until that migration ships.

Coach setup edits a draft. **Apply** sends the current delivery choices to
`POST /api/coach/preferences`. The asynchronous request validates the IDs,
rebuilds the delivery configuration deterministically and commits the choices
to the owned `study_rooms` row. The UI reports recalibrating, success or a
retryable error; it changes the active choices only after the saved row returns.
No model call or separate job queue is needed to rebuild this configuration.

`study_rooms.coach_preferences` stores only the three option IDs;
`explain_level` remains the shared explanation-level source. `/api/chat` reads
and compiles the saved settings for every turn, rather than trusting draft
directives or route IDs from the browser. Coach receives all four settings;
Ask/Learn receives the explanation level. Existing topic explanations and
Socratic checks already read the same level. Room Settings also uses Apply and
checks that the update actually returned the learner's room.

For a pending Coach encounter, a newly applied route changes rendering only.
Its original ChallengeSpec, expected concepts, source chunks, encounter ID,
support history and grading remain intact. New replies use the applied delivery
settings; existing messages are preserved. Draft changes never affect a reply.

The phone tab bar preserves the Safari-style collapse already shipped on
October 1 (`use-collapsing-tab-bar.ts`). It shrinks 30% on downward scrolling
and expands on upward scrolling; Coach chat remains stable so its composer
does not jump. The preference fix does not add a second scroll controller.

`study_rooms.explain_level` (`simpler` / `standard` / `deeper`) changes how Learn
mode and the Socratic check pitch an idea. It never changes which excerpts are
retrieved, which facts are stated, or the citation rule — every level is bound to
the same material, and the prompt says so explicitly.

## Socratic checks

`POST /api/learn/check` opens a check with one open question, then responds to
the learner's explanation and follows up on the gap. It is formative: it writes
no attempt and moves no mastery, because a teaching conversation should not
punish thinking out loud. Measurement stays in Quiz, where the learner knows they
are being assessed.

## Learn answers

Learn is the Ask path with a different layout and voice, not a separate engine.

- **Outline format.** Grounded answers pass `format: "outline"` to
  `streamGroundedAnswer`, which appends `OUTLINE_FORMAT_RULE` (in
  `packages/ai/src/grounding.ts`) to the system prompt: one bold short answer
  first, short headings in the study guide's order, one cited bullet per fact,
  at most two nesting levels, no paragraph longer than a sentence. A greeting or
  an unsupported question gets one plain sentence instead. `explainTopic` writes
  its lesson in the same outline style.
- **Rendering.** `lib/rich-text.ts` parses nested lists (`ListItem` carries
  `inline` and an optional `sublist`) and `components/room/rich-text.tsx` renders
  them, so a nested bullet reads as a detail of the bullet above it.
- **Plain punctuation.** `PLAIN_PUNCTUATION_RULE` (`packages/ai/src/client.ts`) is
  part of the base system prompt, the outline rule and `structured()`, so model
  output avoids em dashes.
- **Socratic verdicts.** The check judges what the learner meant, not how they
  phrased it. `normalizeSocraticResponse` maps the model's reply onto one verdict
  (`understood`, `partial`, `not_sure`, `off_topic`) and only `understood` marks
  the check done. Every verdict has fallback feedback, an off-topic reply is
  redirected, and none of it is scored.
- **Practice replies.** `extractLatestPracticeSetFromHistory`, `isPracticeReply`
  and `resolvePracticeQuestion` in `lib/recommendation-engine.ts` resolve a
  number, letter, ordinal or sentence against the latest practice set, and
  `buildPracticeTutorDirective` frames the tutor reply.
- **Starter chips.** `learnStarters()` and `LEARN_GUIDE_TEXT` live in
  `lib/coach-route-selection.ts`. The "How Learn works" guide is a local message
  (`kind: "guide"` in `coach-panel.tsx`): it never reaches the model and is
  filtered out of the history sent with later questions.

## Reading typed text

`packages/ai/src/typos.ts` is the one place that decides whether two words are
"the same word, mistyped". It has three strictness levels so that being generous
in conversation never makes grading generous.

| Level | Function | Used for | Rule |
| --- | --- | --- | --- |
| Loose | `wordsMatch` | Ranking and finding a named topic (`findNamedTopic`, `pickTopic`) | A near match is enough, because a wrong guess only changes a suggestion |
| Strict | `typoOfWord`, `termMatch` | Grading blanks | Digits never bend. Words under five letters must match exactly. One edit allowed, two on terms of twelve letters or more with the same first three letters, which keeps endothermic and exothermic apart. A small `PROTECTED_WORDS` list (stick, stock, simple, and similar) is never treated as a typo of its neighbour |
| Command repair | `repairCommandTypos` | Coach commands and practice requests | Closed vocabulary, short messages only, and used only as a fallback after the text as typed has failed to match, so anything that matched before still matches the same way |

Callers: `detectTurnIntent` and `classifyControlWord` in `packages/ai/src/coach.ts`
(command words in `COACH_COMMAND_WORDS`), `classifyIntent` in
`lib/recommendation-engine.ts` (`PRACTICE_COMMAND_WORDS`), and `gradeBlankAnswer`.
`lib/recommendation-engine.ts` re-exports `editDistance` and `wordsMatch` from the
shared module.

Known limit: there is no dictionary, so strict grading cannot separate two real
words that differ by one letter (isotonic and isotopic, sulfate and sulfite).
Short terms are protected by the length rule; long ones are a tracked roadmap item.

## Coach generative layer

The architectural invariant for V3 is: **the director decides; GenAI renders and
interprets**. The room explanation level changes language, not the issued
reasoning target. Coach mode biases delivery/support, not mastery thresholds.

The Coach starts at the control plane's `ChallengeSpec` (`apps/web/lib/learning`, see `docs/ADAPTIVE_LEARNING_CORE.md`) and ends at a learner-facing turn:
`ChallengeSpec → grounded excerpts → route policy → language floor → LLM`.

- `apps/web/lib/coach-director.ts`: the Coach's only doorway to the control plane. It calls `loadConceptLearningState` + `nextChallenge` with `activity: "coach"` for every new question, including "another one" and the existing one-shot "Challenge me" control (renamed "Try a harder question" in V3). The Coach never builds, edits or steps a spec; it has no difficulty ladder of its own.
- `apps/web/lib/coach-render.ts`: renders a spec into phrasing instructions using Astra's types directly. It covers the reasoning task for `challengeKind`, the support for `scaffoldLevel`, `taskSize`, `requireNewContext`, and the route policy named by `spec.routeRecord`. `parseIssuedSpec` re-validates a stored spec against the control plane's constants.
- Route policy has one source: the `knowledge/teaching-coaching/*.md` record that `spec.routeRecord` names. `lib/route-policy-projection.ts` extracts `ui_label`, "Core sequence" and "Recommended coaching rules" deterministically. `pnpm --filter @studigo/web generate:routes` writes that projection to `lib/generated/route-policies.json`, which is bundled, so there is no runtime KB read or RAG. A drift test fails if the JSON no longer matches the records.
- `packages/ai/src/coach-language.ts`: the language-floor rules, a deterministic lint, and its enforcement. The lint checks for one main question, sentences of 20 words or fewer, no packed lists, no stacked task verbs, no formal connectors, and at most two 13+-letter words. Every generated or simplified question goes through `enforceLanguageFloor`:
  1. Validate.
  2. If it fails, make at most one constrained rewrite (`rewriteCoachQuestion`), which changes wording only; the concepts, sources and spec are not outputs of that call.
  3. Re-validate, and reject a rewrite that drops the reasoning demand, becomes a bare yes/no question for a reasoning task, or adds a citation.
  4. If the rewrite fails validation or is rejected, keep the original. Harder English is preferred to silently easier thinking. There are no loops. `packages/ai` never interprets a spec; it receives only rendered instruction lines, and keeps the spec opaque in `coach_state.issuedChallenge`.
- `coach_state.issuedChallenge` = `{ spec, encounterId, scaffoldUsed }`. The encounter ID is stable across hints and reveals of the same question. `scaffoldUsed` only rises, and is set from the resolved intent or outcome, not just the regex's first read:
  - simplify: 1
  - hint, clarification answer, or irrelevant-redirect clue: 2
  - example: 3
  - reveal (including an evaluator-resolved "show me the answer") or an incorrect-answer correction: 5

  It is carried into `awaiting_control` after a correct answer, so an assisted success can never look independent. An unknown (`null`) value stays unknown. This records what the learner actually received so a future `LearningEvent` can report it honestly.
- Learner controls ("Make it simpler", "Give me a hint", "Show me an example", "Challenge me") are detected deterministically and are never graded. Simplify keeps the pending concepts, sources and spec.
- If the control-plane read fails, the question is rendered without a target, nothing is stored as issued, and no progression is claimed.
- **Coach ↔ control-plane loop:** ChallengeSpec → question → reply → semantic evidence → deterministic outcome → `LearningEvent` → replayed state → next ChallengeSpec.
  - The existing one-shot "Challenge me" command sends `challengeRequest: "stretch"`; V3 renames it "Try a harder question". Persistent "Challenge me" selects `coach_mode = challenge` as a delivery/support bias and does not itself send stretch. Everything else sends "normal".
  - Each Coach submission carries a client UUID that becomes the persisted user message's ID (`lib/coach-interaction.ts`). An exact retry reuses the row; conflicting reuse fails closed with a 409.
  - The message's server `created_at` is the event time. Support given in reply to an attempt is stamped at +1 ms.
  - Events are built only from the persisted issued spec, encounter, user and message (`lib/coach-learning-events.ts`), with deterministic IDs `coach:<interactionId>:attempt|support|skip`.
  - The issued spec must match the authenticated user, the room and the pending topic before the service-role write.
  - Commit order: record evidence, then save Coach state (one retry), then stream. A failed event write advances nothing. A retry after a failed state write re-records idempotently and keeps the committed result.
  - The director reloads persisted history for every new question.

## Teaching references in Coach prompts

`knowledge/teaching-coaching/` now has 43 records: the 14 option records, 26 reference replies (`exemplars/`) and 3 explanation levels (`levels/`). They are compiled at build time into `apps/web/lib/generated/teaching-references.json` (`lib/teaching-reference-projection.ts`, `pnpm generate:references`, drift test in `lib/teaching-reference.test.ts`). `compileCoachPreferences` adds a `Teaching reference` directive with both the style and the tradition records, the practice recipe and the reference reply for the chosen style at the room's level; the `Explanation level` directive carries the level's rules and sample, which Learn also receives. There is no runtime retrieval and no added model call, and the added text is capped (`REFERENCE_WORD_BUDGET`) so Coach latency is preserved.
