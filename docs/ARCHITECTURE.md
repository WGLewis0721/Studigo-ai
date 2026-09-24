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
- WebForge V1 visual system is the current design direction.
- Do not put provider SDK secrets or privileged credentials in browser code.
- UI should consume internal API routes or a future dedicated API service.

Studigo should feel like a **living study field guide with a companion inside it**, not a generic education SaaS dashboard. Authentication, onboarding, Study Rooms, document management, tutoring, and mastery surfaces should all evolve from the same design system in `docs/DESIGN_SYSTEM.md`.

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

The surrounding login/onboarding experience should use the Studigo WebForge system: warm paper surfaces, strong editorial hierarchy, limited companion use, and clear study-oriented copy.

The provider buttons themselves should remain immediately recognizable and trustworthy. Do not turn Google/Apple/Microsoft sign-in controls into stylized generic product CTAs that obscure the provider identity.

### Authorization boundary

Authentication answers **who the user is**. Postgres RLS answers **what the user can access**.

Do not weaken ownership policies because requests pass through Next.js server routes. User-owned Study Rooms, documents, conversations, and mastery records must remain database-authorized.

Do not use editable Supabase `user_metadata` values for authorization decisions.

See `docs/AUTH.md` for the canonical auth/provider/session/security design.

`/` is the marketing surface. The product lives behind auth:

- `/login`, `/signup` — Supabase email/password, session refreshed in middleware.
- `/app` — study rooms: create, open, rename, delete.
- `/app/rooms/[roomId]` — one room with six modes: Materials, Ask, Learn, Quiz,
  Flashcards, Mastery. Mode state is client-side; all data is server-loaded.

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

### Possible later mobile route

If native store distribution becomes important, evaluate Capacitor, React Native/Expo, or platform-native shells based on actual requirements. Do not build all three.

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
test fast. Fill-in comparison strips case, accents, punctuation and articles, and
forgives one edit on terms of five characters or more — long enough that a single
edit is a typo rather than a different word.

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

## Coach generative layer

Coach questions are rendered through a fixed pipeline:
`ChallengeSpec → grounded excerpts → route policy → language floor → LLM`.

- `packages/ai/src/coach-challenge.ts`: the `CoachChallenge` shape the Coach consumes from the learning-control plane (challenge kind, scaffold level, route). This declares shapes only and decides nothing.
- `packages/ai/src/coach-language.ts`: the language-floor rules ("one main question, short sentences, familiar words, define terms right away"), reasoning-task guidance for each challenge kind, and a deterministic lint (`assessLanguageFloor`) that the tests and the turn log use. A harder question changes the reasoning task, never the English.
- `packages/ai/src/coach-routes.ts`: learning routes as phrasing policies, condensed from `knowledge/teaching-coaching/`. Routes reach the question, feedback and support prompts only, never the evaluator or `decideOutcome`.
- Learner controls: "Make it simpler", "Give me a hint", "Show me an example" and "Challenge me" are detected deterministically and are never graded. Simplify keeps the pending concepts and sources. "Challenge me" asks the director for a harder spec, and "another one" reuses the stored spec, so the Coach never auto-advances.
- `apps/web/lib/coach-challenge-adapter.ts` is a **temporary** director until `feature/adaptive-learning-core` lands. It gives a fixed starting spec, and on an explicit request it moves one rung up the ladder. It stores nothing and never reads grades.
