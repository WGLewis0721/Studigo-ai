# Studigo Engineering Roadmap

The order matters. The core product loop now works in production, so the
priority has changed from proving the architecture to proving repeatable learner
value.


## Execution order

The V3 web implementation has landed. Current `main` is the integrated adaptive
web beta; do not restart the staged Phase 1/2/3 build. Use
[`ADAPTIVE_BETA_EVIDENCE.md`](ADAPTIVE_BETA_EVIDENCE.md) as the current evidence
ledger.

Next, in order:

1. atomically link durable learning sessions to Coach issue/answer/skip/pending state;
2. finish trusted Quiz and Practice-Test evidence provenance into the shared learner state;
3. complete independently reviewed live RAG evaluation plus provider latency/cost gates;
4. move large-document ingestion to a durable retryable worker;
5. finish physical-device Study Guide/PDF acceptance and stale-scope refresh verification;
6. finish privacy/minor-data/vendor requirements;
7. build the universal Expo iOS/iPadOS client and TestFlight path.

## Shipped — October 2, 2026: integrated adaptive web beta

Merged through PRs #64, #70, #71 and #72 and deployed from `main`.

- [x] Deterministic shared learning package/director is integrated under Coach.
- [x] Atomic Coach retries preserve immutable replies and commit visible response,
      history, state, evidence and projections together.
- [x] Production enables `STUDIGO_ATOMIC_COACH` and
      `STUDIGO_ADAPTIVE_SESSION`.
- [x] Global Explanation Level remains the single room-wide value used by Coach
      and Learn.
- [x] Coach and Learn keep independent persisted presentation modes/topic scopes
      without gaining authority over mastery/progression.
- [x] Hosted synthetic acceptance covered authenticated isolation, forged-bearer
      rejection, retry/idempotency behavior, accepted assessment and PDF export.
- [x] Exact-main CI and production smoke passed for the integrated beta.
- [ ] Keep `STUDIGO_DURABLE_SESSIONS` disabled until session lifecycle and Coach
      pending encounters are atomically linked.
- [ ] Independently reviewed live RAG quality, provider p95/cost, native
      TestFlight and child/privacy acceptance remain release gates.

## Shipped — October 2, 2026: V3 learner-facing simplification

Merged in PR #66 and deployed from `main`.

- [x] Coach setup now exposes only **Show me / Coach me / Challenge me**.
- [x] Learning Tradition and Practice Recipe are removed from learner settings;
      their research records remain internal strategy/reference material.
- [x] Room-wide **Simpler / Standard / Deeper** explanation level remains
      separate and applies across Coach + Learn.
- [x] **Coach / Learn** remains the primary switch in both Chat and Topics;
      **Chat / Topics** is secondary navigation.
- [x] One-shot stretch is now **Try a harder question**, distinct from persistent
      Challenge me mode.
- [x] Legacy room preferences deterministically map into V3 mode and new writes
      canonicalize hidden compatibility fields.
- [x] Studigo's default companion window is 116×138 and the character renders at
      roughly 75% of the previous in-frame size, with deliberate transparent
      body/limb bezel overlap and foreground sill/controls.
- [x] Homepage demo mirrors the same navigation and companion geometry.
- [x] PR CI passed typecheck, tests, advisory ML eval tests, game tests and build.
- [x] Hosted Supabase `v3_coach_mode` migration applied and constraint verified.
- [ ] Physical iPhone/iPad visual acceptance: verify no facial feature is cropped
      and the intentional bezel overlap reads cleanly on the real device.

## October 2 follow-up — stale Study Guide topic recovery

Physical iPhone testing found a room whose uploaded Grade 4 Physical Science
guide was used for grounded answers while the topic selector still showed stale
animal/space topics from older derived state.

- [x] Add **Refresh study guide** beside Materials upload.
- [x] Refresh rereads the stored original even when the document is already
      `ready`; it does not short-circuit as "already processed."
- [x] Replace that document's chunks/embeddings and rebuild the topic map from
      the current guide, deactivating topics no longer present.
- [x] Start fresh Coach/Learn client context after returning from Materials;
      learning evidence/history is preserved.
- [x] Add regression coverage for the force-refresh contract.
- [ ] Physical-iPhone acceptance: refresh the current Physical Science guide and
      confirm animal, fossils and solar-system topics disappear from active scope.

## Active October 2 follow-up — recalibration + topic-scope cleanup

Physical iPhone acceptance exposed three learner-facing issues after PR #66:

- [x] Add independent **Apply Coach** and **Apply Learn** paths. Applying one
      surface starts a fresh response context for that surface only.
- [x] Physical-device follow-up clarified the contract: **Explanation level is
      global only** in Study Room Settings. Coach/Learn surface-specific
      explanation controls are removed and the temporary columns are deprecated.
- [x] Add learner-facing Learn presentation modes: **Big picture / Step by step /
      Examples first**. They change presentation order only and have no authority
      over grading, mastery, reasoning level, or adaptive progression.
- [x] Make topic scope checkbox-based multi-select with **Select all** and **Clear**.
- [x] Coach and Learn now keep independent topic selections. Example: Coach can
      use 1/2/3 while Learn uses 4/5; **Apply to Coach** never overwrites Learn,
      and **Apply to Learn** never overwrites Coach.
- [x] Remove the standalone highlighted topic dropdown; the **Topics** button
      beside Chat now opens the selector and shows selected/total count.
- [x] Send selected topic IDs to the server and intersect them with active room
      topics before the adaptive director sees them.
- [x] PR #68 CI passed typecheck, full tests, offline advisory ML evaluation,
      game prototype tests and web build; production Vercel deployment is READY.
- [x] Hosted Supabase migration `surface_explanation_levels` applied and
      recorded in migration history.
- [ ] Re-test the exact physical-iPhone failure: select Matter/Phase Changes,
      apply, then ask about condensation/heat without the old Animal Responses
      context leaking into the answer.

## Current post-beta path — hardening + iOS/iPadOS

The next major implementation pass converges the existing control plane, grounded
GenAI, simplified coaching controls and native Apple client.

Product decisions:

- keep the learner's own uploaded material as the knowledge boundary;
- keep the global Study Room explanation level (`simpler|standard|deeper`);
- reduce learner-facing Coach customization to **Show me / Coach me / Challenge me**;
- remove Learning Tradition and Practice Recipe from the learner-facing UI while
  retaining their researched techniques as internal strategy/reference material;
- restore the **Coach / Learn** segmented switch as a persistent primary control
  across both **Chat** and **Topics**; Chat/Topics is secondary navigation and
  must never replace or hide the Coach/Learn switcher;
- keep progression/mastery deterministic and replayable;
- use GenAI for grounded retrieval-aware rendering, free-form semantic
  interpretation and feedback, never as the hidden progression authority;
- ship one Expo / React Native iOS/iPadOS client over the existing hosted
  backend;
- keep `OPENAI_API_KEY` server-side only;
- permit Python/FastAPI/LangChain/ML where measured quality/maintainability gains
  justify the extra service boundary.

The staged Phase 1/2/3 plan in the root [`IMPLEMENTATION.md`](../IMPLEMENTATION.md)
has been executed for the web beta. Preserve its contracts and use its remaining
acceptance gates; do not treat it as unstarted work. Native Expo delivery,
durable-session linkage, reviewed RAG/performance evidence and release compliance
are the active continuation.

Research/reference map:
[`ADAPTIVE_GAME_DIRECTOR_RESEARCH.md`](ADAPTIVE_GAME_DIRECTOR_RESEARCH.md).

Learner-facing finish plan:
[`V3_LEARNER_UI_FINISH_PLAN.md`](V3_LEARNER_UI_FINISH_PLAN.md), including
the persistent Coach/Learn regression fix and final companion frame/safe-face
polish before native parity.

## Shipped - October 1, 2026: The companion in the app

- [x] Studigo's window in the Study Room (Coach chat, Quiz, Flashcards,
      Practice test), his seat in the header, and his card. He reacts to graded
      answers, rated cards, finished sets, replies being written and typing.
- [x] Speech is off by default: a per-room switch in Room Settings, saved in the
      browser. So is whether his window is out.
- [x] Home leads with his stage, the nearest test and a "next up" card built
      from the room's real state. First run is a guided three-step setup.
- [x] Sign-in pages share the homepage's closing field. The site has a favicon,
      an Apple touch icon and manifest icons from the canonical portrait.
- [x] One set of sprites in `public/mascot/companion/`; the homepage, the demo
      phone and the app all read it. The homepage's "arriving" note is gone.
- [x] `NEXT_PUBLIC_STUDIGO_COMPANION=off` ships the room without his window.
- [ ] Not verified on a real iPhone or with a signed-in account against hosted
      data: the room and Home were checked against local fixtures only.
- [ ] The iOS app (`APP_STORE_RELEASE_PLAN.md`) is not started.

## Shipped - October 1, 2026: Companion homepage

- [x] The homepage is the "pocket device" direction: intro, a phone running the
      interactive demo, Studigo following down the page, pinned Modes, and a new
      "For the grown-ups" section. See `DESIGN_SYSTEM.md`, Marketing.
- [x] "Sign in" goes to `/app`; "Start studying for free" goes to `/signup`.
- [x] The demo the phone runs is a static copy in `apps/web/public/demo/`, built
      by `design/companion-demo/build_public_demo.py`. The middleware skips
      `/demo/`.
- [x] The app caught up the same day (see above); the "arriving" note is gone.
- [ ] Performance pass on the homepage (the intro delays the first large paint
      on a first visit) and a real-device check on iPhone Safari.

## Shipped - October 1, 2026: Coach preferences and scrolling chrome

- [x] Save coaching style, learning tradition, practice recipe and explanation
      level per Study Room; reload and page navigation restore applied settings.
- [x] Coach setup and Room Settings expose Apply, pending and success/error states.
- [x] Rebuild delivery instructions during the background Apply request and use
      the saved settings in subsequent Coach/Ask replies. Learn (the Ask path)
      reads the saved explanation level on every turn, and the browser can no
      longer override saved settings with draft directives.
- [x] Preserve the pending learning encounter and evidence when delivery changes.
- [x] Preserve the October 1 Safari-style collapsing tab bar.
- [x] `20261001051830_coach_preferences.sql` is applied to the hosted Studigo
      Supabase project (recorded there as version 20261001125650). The column,
      its check constraint and the default were confirmed on the hosted database,
      and all 17 existing rooms carry the default.
- [x] Merged to `main` and deployed on Vercel. Typecheck and the full unit and
      PGlite suites pass (325 tests). The sandbox cannot reach Google Fonts, so
      `next build` was left to Vercel's build.
- [ ] Smoke-test hosted saving with a real signed-in account (Apply, reload,
      next reply uses the saved settings).
- [ ] Verify real model delivery and physical iPhone/Safari behavior.

## Latest shipped - September 30, 2026

Shipped to production from `main` (merge `2fdfe14`, deployed on Vercel).

**Study Room redesign.** The room is five pages: Coach, Practice, Progress, Plan,
Materials. Ask and Learn now live inside Coach behind an explicit Coach / Learn
switch; Quiz, Flashcards and Practice Test sit under Practice; Mastery and Weak
Areas under Progress; the study plan and Cram under Plan. Wide screens get a
framed room with a Studigo rail and a page selector in the top bar; phones get a
bottom tab bar and no device frame. Every page has one header (mascot, title, one
short sentence). The room's shell color is picked in Room Settings.

**Learn quality.**
- A reply in any form works. Learn reads the learner's meaning, not a required
  format. A number, a letter, "the second one" or a full sentence all resolve
  against the latest practice set in the conversation.
- Slight misspellings are read as what they obviously meant, and an obviously
  irrelevant reply gets a friendly redirect with no penalty.
- Factual answers and lessons are a scannable outline built from the study guide:
  short headings in the guide's order, one cited bullet per fact, at most two
  levels of nesting.
- Four starter chips sit above the Learn input: How Learn works, Explain this
  topic, What's in my guide?, Key terms. "How Learn works" is a canned local
  explainer (no model call) that says what Learn does and how it differs from
  Coach.
- Learn has its own teal identity so the Coach / Learn switch reads as two voices.

**Typed text is read like a person reads it** (one shared module, see
`ARCHITECTURE.md`). Quiz and Practice Test fill-in-the-blank, Coach commands,
practice requests, help and answer requests, and topic names all tolerate small
misspellings. A near-miss on a graded blank is credited at 85, not 100.

**Copy.** App copy and model output no longer use em dashes.

**Verified:** typecheck, the web and AI unit suites, and screenshots at phone and
desktop sizes. **Not verified:** real model output with the new prompts, the
signed-in app, a physical iPhone.

Still open from this pass:

- [ ] Verify Learn against the real model: outline compliance, off-topic
      redirects, typo handling. There is no eval for this yet, so by the AI-change
      rule below it is experimentation until one exists.
- [ ] Strict grading cannot tell apart real words that differ by one letter
      (isotonic / isotopic, sulfate / sulfite) because there is no dictionary.
      Options: score against the room's own key terms, or send ambiguous
      near-misses to the short-answer grader.
- [ ] Visual audit of the Cards and Practice Test pages (the fixture routes 500
      without a backend, so they were not screenshotted).
- [ ] Physical iPhone pass over the new phone layouts (Coach, Learn chips,
      Progress ring, Plan buttons, Materials file cards).
- [ ] Progress is the only dark page. It is a deliberate readout screen; revisit
      it if user tests find it jarring next to the others.

## Current P0 — Downloadable study guide

The PDF download is implemented. P0 is now completing or explicitly validating
its acceptance below, recording evidence and fixing outstanding defects before
V3 implementation. Do not treat implementation or local-fixture success as full
learner, hosted-data, mobile, or print validation.

First-release acceptance:

- one visible **Download study guide** action from the Study Room;
- PDF is the default and requires no format picker;
- file opens on desktop/mobile and prints cleanly;
- current topic order and learner edits are preserved;
- concise explanations/key facts remain grounded in room sources;
- references let the learner trace important claims back to source material;
- include check-yourself/retrieval prompts so the PDF supports active recall;
- insufficient source evidence produces an honest in-product state instead of a
  polished-looking fabricated guide;
- export does not change mastery, attempts, scheduling, topics, or source files.

Canonical acceptance test: [`USER_TEST_CASES.md`](USER_TEST_CASES.md).

The order still matters: protect the working create → upload → study flow while
shipping outputs and validating them with real learners.

## Phase 0 — Foundation (this scaffold)

- Monorepo/workspace.
- Next.js PWA shell.
- Supabase schema + RLS + private storage.
- Supabase Auth chosen as the canonical identity layer.
- Document upload/download contracts.
- OpenAI provider package.
- Room-scoped pgvector retrieval RPC.
- Grounded chat route.
- Tauri shell placeholder.
- Product/architecture/handoff docs.

Exit: another engineer can start implementation without choosing architecture from scratch.

## Phase 1 — Make the core loop real (implemented)

### Auth + rooms
- Implement branded `/login` and `/auth/callback` surfaces using the Studigo design system.
- Configure Google OAuth first.
- Configure Apple OAuth.
- Configure Microsoft/Azure OAuth with required email scope.
- Add email fallback.
- Keep Facebook as a later optional provider rather than an MVP blocker.
- Use Supabase SSR/cookie sessions with PKCE for social OAuth.
- Add session refresh/protection for private app routes.
- Route first-time users through minimal onboarding, then into `/app`.
- Create/list/open/delete Study Rooms.
- Verify RLS with integration tests using at least two different users.
- Test login/logout, expired sessions, callback failures, and duplicate/account-linking cases.

### Document UI
- Upload dropzone.
- File type/source-type selector.
- Processing states.
- Open/download/delete.
- Retry failed processing.

### Ingestion worker
- Queue model with retries and idempotency.
- PDF text extraction preserving page numbers.
- DOCX extraction preserving headings/lists/tables where practical.
- PPTX extraction preserving slide numbers.
- TXT/Markdown support.
- OCR fallback for image-only PDFs/scans.
- Normalize and chunk.
- Generate embeddings.
- Persist chunks + metadata.
- Mark ready/failed.

### Grounded Ask mode
- Chat UI.
- Source chips/citations.
- Source preview / jump to page when possible.
- Persist conversations/messages.
- Streaming response.
- Clear insufficient-evidence behavior.

Exit: a student can sign in with a primary provider, create a Study Room, upload a real study guide + textbook chapter, and get reliable cited answers.

**Status: built.** Accounts, rooms, upload with processing state, the ingestion
worker (PDF/DOCX/PPTX/TXT/MD/image, OCR fallback, page-accurate chunks), and a
streaming grounded Ask mode with citations that open the original at the cited
page. Learn, Quiz, Flashcards, and derived Mastery — the Phase 2 pieces the core
loop needed to be a study product rather than a chat window — are built on the
same retrieval path.

Still open from the original Phase 1 list:

- Ingestion runs inside the request rather than on a durable queue. It claims
  work idempotently and retries by hand, which holds at current scale; a very
  large scanned PDF can still exceed the function timeout.
- Retry is learner-initiated, not automatic with backoff.
- RLS is enforced and exercised by the app, but there is no automated
  integration test asserting cross-account isolation yet.

## Phase 2 — Turn RAG into a study product

### Study-guide analyzer
- [x] Extract explicit objectives/questions/terms.
- [x] Map them to supporting source passages.
- [x] Produce editable topic map. Learners retitle, reword, re-prioritise, remove
  and add topics. Their wording wins: a re-ingested guide re-links evidence and
  ordering but never overwrites an edit, and never resurrects a removed topic.
- [ ] Mark inferred vs explicitly stated test scope.

### Learn mode
- [x] Topic-by-topic explanation.
- [x] Socratic checks. Studigo asks the learner to explain the idea back, responds
  to what they actually said, and follows up on the gap. Formative by design: it
  records no attempt and moves no mastery.
- [x] Age/grade-level adaptation without changing factual content. `simpler` /
  `standard` / `deeper` is set per room and changes only how an idea is pitched;
  the excerpts, the citation rule and the facts are identical at every level.
- [x] Examples grounded in source when possible.
- [x] Factual answers and lessons as a cited outline built from the study guide,
  not a block of prose.
- [x] Replies accepted in any form. Learn judges meaning, tolerates small
  misspellings, and redirects an obviously irrelevant reply without penalty.
- [x] Four starter chips, including a local "How Learn works" explainer that
  contrasts Learn with Coach.
- [ ] Eval the above against the real model (see "Latest shipped").

### Flashcards
- [x] Generate per topic.
- [x] Student can edit/delete. Editing preserves the spaced-repetition schedule,
  so fixing a typo never costs the recall history behind the card.
- [x] Track recall performance.

### Quiz mode
- [x] MCQ, true/false, fill-in, short response. True/false and fill-in are graded
  deterministically server-side — no model call, so they are instant and free.
  Fill-in accepts every listed spelling and reads past swapped letters, filler
  ("it is the...") and a typo in a long or multi-word term. A typo is credited at
  85, an exact match at 100.
- [x] Explain correct/incorrect answers from source.
- [x] Avoid leakage of answer in stem. Generation is instructed against it and a
  fill-in stem containing its own answer is discarded before a learner sees it.
- [x] Store attempts.

### Practice test
- [x] Build coverage-balanced assessments from study-guide scope. Formats now
  rotate across the four question types within one test.
- [x] Separate answer/review flow.

Exit: Studigo can teach and test against the same source-grounded topic map.
**Status: met.**

## Phase 3 — Real mastery and planning

- [x] Evidence-based topic mastery model.
- [x] Weak-area queue.
- [x] Spaced retrieval scheduling.
- [x] Cram mode based on available time.
- [x] Test-date study plan.
- [x] Confidence vs performance calibration. Rating an answer is the submit
  action, so every quiz answer carries a confidence with no extra step. Wrong
  while confident is surfaced as a *blind spot* and ranked above an ordinary gap
  in Weak Areas; Mastery reports whether the learner can trust their own sense
  of what they know.
- [x] Readiness score with transparent factors.

Exit: readiness is driven by demonstrated recall, not cosmetic activity metrics.

## Phase 3.5 — Export + real-user validation (current)

### Downloadable study guide
- [x] One-click PDF export from a Study Room.
- [x] Source-grounded topic notes/key facts from linked room material.
- [x] Current learner-edited topic wording/order.
- [x] Source/page references in the exported artifact.
- [x] Embedded retrieval/check-yourself prompts.
- [x] Honest empty/insufficient-evidence state.
- [ ] Mobile download/open validation.
- [ ] Printable layout validation.
- [x] Export PDF regression coverage; export path is read-only and does not mutate mastery/practice/source state.

### Next user-validation cycle
- [ ] Run the canonical cases in [`USER_TEST_CASES.md`](USER_TEST_CASES.md).
- [ ] Re-test the create-room mobile 404 regression on iPhone/Safari.
- [ ] Measure time-to-first-value and study-guide download success.
- [ ] Observe whether users understand teacher-study-guide scope vs supporting
      textbook/material scope.
- [ ] Run the downloaded-guide trust questions with real learners.
- [ ] Convert repeated user failures into focused regression tests before adding
      more surfaces.

### Teaching + coaching knowledge base
- [x] Inventory the live Coach taxonomy directly from
      `apps/web/components/room/coach-panel.tsx`.
- [x] Map every coaching style, learning tradition, and practice recipe to the
      closest documented real-world paradigm in
      [`../knowledge/teaching-coaching/README.md`](../knowledge/teaching-coaching/README.md).
- [x] Store each option as retrieval-friendly Markdown with stable YAML metadata,
      examples, use cases, cautions, and sources.
- [x] Mark Studigo composites and product policies explicitly instead of
      presenting them as named research traditions.
- [ ] Wire Coach directive construction to retrieve these records rather than
      keeping the research rationale only in documentation.
- [ ] Review the two country-labelled composites ("Japanese-inspired" and
      "Swedish-inspired") against the KB before changing their production prompt
      wording.

Exit: a learner can complete create → upload → study → **download**, and the
artifact is trusted enough to print/use without manual reconstruction.

## Phase 3.6 — Adaptive learning game engine (planned)

Connect the existing learning surfaces through one deterministic learner-state
and challenge system rather than adding another AI orchestration layer.

Core direction:

- **Low language floor, high skill ceiling.**
- Treat Learn, Coach, Quiz, Flashcards, Practice Test, Weak Areas, and Cram as
  mini-games that contribute evidence to one learner state.
- Let demonstrated performance determine challenge; let learner preference choose
  a teaching route/build.
- Add independent reasoning and scaffolding ladders so challenge can rise without
  making language harder.
- Use simple state, counters, thresholds, reducers, and persistent encounter
  history before considering learned recommendation models.
- Let prior struggles create future rematches, while successful transfer becomes
  strong mastery evidence.
- Keep the teaching/coaching KB as internal strategy routes through the same
  mastery target; V3 no longer requires learners to select a named tradition.
- Keep generative AI as a core Coach capability for dialogue, semantic grading,
  grounded explanation, and feedback, while the learning control plane remains
  deterministic and owns progression, mastery, scaffolding, and encounter state.

Technical design, data contracts, infrastructure boundaries, delivery order, and
explicit anti-overengineering constraints live in
[`ADAPTIVE_LEARNING_ENGINE.md`](ADAPTIVE_LEARNING_ENGINE.md).

Exit: two learners using the same material can receive appropriately different
next challenges from observable performance, all mini-games contribute to one
concept-level learning state, and the learning control plane can determine the
next action independently of generation while Coach uses generative AI to deliver
that action naturally.
## Active investigation — Coach practice-set generation

Tracked in [`../PROBLEM_STATEMENT.md`](../PROBLEM_STATEMENT.md) and
[`../ATTEMPTED_FIXES.md`](../ATTEMPTED_FIXES.md).

A Coach request for *N* practice questions must return *N* distinct,
source-grounded questions rather than narrating the learner's selected
customization options.

- [x] Route "give me N questions" into a practice-generation intent instead of
      the grounded-answer/refusal path (`lib/recommendation-engine.ts`,
      `lib/engine.ts`).
- [x] Single orchestration layer: intent → topic selection → grounded
      generation → formatting → citations.
- [x] Near-duplicate collapse verified against genuinely distinct material;
      unit + end-to-end pipeline tests green 10× consecutively.
- [x] Model client falls back to Vercel AI Gateway when `OPENAI_API_KEY` is
      absent, keeping the direct OpenAI path unchanged when present.
- [ ] **Verify real generation on the deployed Vercel app** (the preview
      sandbox has env-injection + AI-Gateway-billing limits the deploy does not).
- [x] A reply to a practice set (a number, a letter, "the second one", a full
      sentence, or a misspelled command) resolves against the latest set in the
      conversation instead of starting a new topic.
- [x] Revert the temporary testing surfaces before beta: `/app` requires
      authentication again and `/dev/study` + `/api/dev/coach` are
      development-only.

## Phase 4 — Reliability, safety, cost

- RAG evaluation dataset with known source answers.
- Retrieval precision/recall checks.
- Citation correctness checks.
- Hallucination/unsupported-answer tests.
- Prompt-injection tests using hostile uploaded documents.
- Parser fuzzing/file validation.
- Malware scanning.
- Auth abuse/rate-limit tests.
- OAuth redirect/open-redirect tests.
- Rate limits/quotas.
- Cost budgets per user/room.
- Caching/deduplication.
- Model fallback strategy.
- Observability dashboards.

Exit: beta behavior is measurable and failures are diagnosable.

## Phase 5 — Product polish

- Final Studigo visual system and mascot direction. *(Visual system V2, "Personal Learning Device", is implemented across marketing, auth and the Study Room, see `docs/DESIGN_SYSTEM.md`. The room was reorganised into five pages with phone and desktop layouts on September 30, 2026. New mascot poses remain future work.)*
- Authentication/onboarding polish.
- Empty/loading/error states.
- Mobile-first study interactions.
- Accessibility review.
- PWA icons/offline shell/install education.
- Notification/reminder strategy.
- Evaluate Google One Tap only after standard Google OAuth is stable.

Exit: feels like a cohesive study companion rather than a developer tool.

## Phase 6 — Native/executable distribution

- Decide whether desktop packaging is actually valuable.
- Finalize the hosted API boundary used by both web and the chosen native client.
- Build the iOS client with Expo / React Native according to [`APP_STORE_RELEASE_PLAN.md`](APP_STORE_RELEASE_PLAN.md).
- Reuse the same Supabase identity/account model in native clients.
- Implement native-safe authentication, including Sign in with Apple when required, while preserving the shared Supabase user model.
- Keep Tauri desktop bundling/signing/updating as a separate decision; do not use the desktop scaffold as the iOS architecture.

## Phase 7 — School/family expansion (post-validation)

Only after individual-student value is proven:

- Parent mode.
- Teacher-curated rooms.
- Shared class resources with licensing/permissions.
- School/org accounts.
- Administrative controls.
- District-specific Microsoft/Entra tenant restrictions when needed.
- Required privacy/compliance work.

## Immediate next engineering tasks

1. **Production-validate Study Guide PDF download** on desktop/mobile and print.
2. Add remaining endpoint-level export tests for empty rooms, response headers,
   filenames, and learner-edited/removal cases.
3. Run the production user-test suite in
   [`USER_TEST_CASES.md`](USER_TEST_CASES.md), starting with mobile room creation
   and Study Guide download.
4. Validate downloaded-guide trust: source traceability, usefulness, printability,
   and whether a learner would use it instead of rebuilding a guide manually.
5. Wire the Coach's style/tradition/practice directives to the canonical
   [`../knowledge/teaching-coaching/README.md`](../knowledge/teaching-coaching/README.md)
   records so the current UI taxonomy and its research grounding cannot drift.
6. Add automated two-user RLS integration tests for rooms, documents, citations,
   downloads, and mutations.
7. Move ingestion off request-bound execution onto a durable retryable worker
   before large-document volume makes timeouts a common user failure.
8. Build the 25–50 item grounded RAG/citation eval set and run it before retrieval
   or model changes.
9. Finish deployed Coach "give me N questions" + tutor-scaffolding verification
   against the real production model.
10. Instrument production failure modes and user-critical funnel steps:
    create room → upload ready → first useful study action → Study Guide download.

11. Verify the September 30 Learn changes against the real model and add a small
    Learn eval (outline format, off-topic redirect, typo-tolerant grading).

Do not replace these with another foundation rewrite. The architecture has
crossed the threshold where user-value, regression prevention, and reliability
matter more than adding parallel infrastructure.

---

# Production + App Store commercialization gate — September 30, 2026

This gate is now the release definition for both the Studigo learning app and the Core Clash/Moon Road game. Existing feature phases remain valid, but neither product should be called commercially production-ready until the applicable checks below pass.

## Studigo learning app — remaining before taking money

**Chosen iOS path (October 1, 2026):** Expo / React Native client over the existing hosted Studigo backend and Supabase identity/data model. Web purchases use Stripe; iOS digital purchases use StoreKit/RevenueCat; both reconcile into APEX. See [`APP_STORE_RELEASE_PLAN.md`](APP_STORE_RELEASE_PLAN.md).

**Current assessment:** functional web product with substantial learning architecture; not yet a production-paid App Store product.

### P0 — reliability and safety before billing
- [ ] Complete the production user-validation cycle in Phase 3.5, including physical iPhone/Safari room creation, PDF download/open/print, and the deployed Coach practice-set flow.
- [ ] Add automated two-user RLS isolation tests for rooms, documents, citations, downloads, and mutations.
- [ ] Move large-document ingestion to a durable retryable worker and add bounded automatic retry/backoff.
- [ ] Complete the Phase 4 RAG/citation evaluation set, prompt-injection tests, parser/file validation, malware scanning, auth-abuse/rate-limit tests, and production observability.
- [ ] Define customer-visible service limits: upload size/count, AI usage limits, retention/deletion, supported file types, and failure/refund/support policy.
- [ ] Finish privacy policy, terms, support contact, account deletion/data deletion flow, and production data-retention documentation.

### P0 — commercial system
- [ ] Freeze the paid product model (for example subscription tiers vs one-time access) and define exactly which capabilities are free/paid.
- [ ] Use APEX as the hosted entitlement/source-of-truth layer for paid Studigo access; do not create a second client-owned balance/ledger.
- [ ] For web sales, connect the chosen payment processor to APEX and prove purchase → entitlement → access → refund/revocation end to end.
- [ ] Add customer billing/account UI: current plan, entitlement state, upgrade/manage/cancel path, and clear failed-payment state.
- [ ] Add idempotent webhook/server-notification handling, reconciliation, support/audit visibility, and production alerts for payment/entitlement failures.
- [ ] Run real test-mode purchase, renewal/cancel/refund, replay/idempotency, and entitlement-recovery acceptance before enabling live charges.

### P1 — iOS/App Store client
- [ ] Implement the chosen Expo / React Native iOS client. Preserve the hosted API/Supabase identity boundary and avoid duplicating learning state in the client.
- [ ] Configure Apple Developer/App Store Connect, permanent bundle ID, signing, capabilities, app icon, launch assets, privacy manifest/required-reason APIs as applicable, and native-safe authentication.
- [ ] Implement Sign in with Apple when required by the final authentication configuration while preserving the canonical Supabase user model.
- [ ] Implement StoreKit/App Store In-App Purchase for digital Studigo subscriptions/features sold inside the iOS app, using RevenueCat for mobile purchase/subscription state and server-side entitlement reconciliation into APEX.
- [ ] Configure App Store Server Notifications and prove purchase, restore, renewal, cancellation, billing retry, refund, and revoked entitlement behavior.
- [ ] Add Restore Purchases and ensure web-purchased and App-Store-purchased entitlements resolve to one customer access model without double-granting.
- [ ] Physical-device QA on supported iPhone/iPad sizes: auth callbacks, uploads/file picker, camera/photo imports if exposed, Study Room, Coach, quiz/flashcards, PDF export/share, background/resume, poor network, accessibility, safe areas, keyboard, and orientation.
- [ ] TestFlight internal → external beta with crash/performance telemetry and release-blocker triage.
- [ ] Complete App Store metadata: name/subtitle/description/keywords/category, age rating, screenshots/previews, privacy answers, support URL, privacy URL, review credentials/instructions, pricing/availability, and IAP/subscription metadata.
- [ ] Submit the first app + first IAP/subscription together where required, resolve review findings, and release only after the production backend and entitlement path are already accepted.

**Studigo paid-production exit:** a new customer can sign up, pay through an approved channel, receive the correct entitlement exactly once, use the core study loop reliably, restore access on another device, cancel/refund without stale access, delete their account/data, and receive support from an auditable production system.

## Studigo game / Moon Keep (Moon Road / Core Clash) — remaining before App Store sale

**Current assessment (September 30, 2026):** POC XI Moon Keep is the golden image: a polished, hand-playtested browser slice with 19 rooms, three bosses, a Core Clash portal, and a cohesive art, sound and animation pass. It is still a prototype, not a shippable $3.99 game. Earlier goldens POC X and POC IX stay frozen. Details: `prototypes/moon-road/CURRENT_GAME_HANDOFF.md` and `POC-XI.md`.

### Done so far (prototype)
- [x] Metroidvania core: multiplication gates the world (seals, stone blocks, runes), ×1-×5 beams from bosses and orbs, match rewards, silver armor, Clock Shield, Training Hall, Rune Sanctum portal to Core Clash.
- [x] Authoring pipeline: LDtk levels exported to the game, TexturePacker atlases, Pillow art generators on one shared palette, documented in `TOOLCHAIN.md` (also usable from Copilot and ChatGPT desktop through shell commands).
- [x] First polish pass: distinct beam, door, seal, block, shrine and boss-attack art; per-beam synthesized sounds; barrel-tip muzzle; orange grounded hero; walk cycles for two bosses; squash/stretch and recoil; auto-fire that no longer wastes shots.
- [x] 121 automated tests in CI (rules, physics, world graph and solver, atlas and art contracts).

### P0 — turn the slice into a product
- [ ] Promote a deliberate release candidate from a new route without modifying any golden build.
- [ ] Define the 1.0 content scope: complete beginning to ending, expected playtime, zone/boss count, multiplication families and difficulty coverage (currently ×1-×5; decide on ×6-×10), checkpoint/save model, and replay loop.
- [ ] Animation to Metroid Zero Mission / Castlevania standard: repaint or regenerate the sprite sheets with real frame-by-frame cycles (hero run/jump/fire/hurt/death, skeleton and bat attacks, true walk and attack cycles for the Clockwork Warden, Twin Warden and Trine Guardian), then run them through `pixel_style.py`.
- [ ] Music and mix: composed or licensed score per zone, boss themes, volume/mute settings; keep synthesized SFX or replace with authored ones.
- [ ] Durable local save/progression, settings, pause/resume, reset, and version migration (today every run restarts from the Moon Gate).
- [ ] Balance and difficulty playtests with real children and parents: boss HP and ammo economy, auto-fire, shield, safety capsules.
- [ ] Connect gameplay telemetry to learning evidence without claiming mastery from completion alone: attempts, fact-family accuracy, retries, time-to-correct, delayed rematch performance, and transfer checks.
- [ ] Define the learning-success acceptance test and verify with real playtests that learning interactions do not damage the "good game first" loop.
- [ ] Finish production art/audio/content provenance and licenses (see `ASSETS.md`: generated sheets plus hand-built sprites); remove dev-only assets and tooling from the shipping bundle.
- [ ] Automated playthrough for the current route (the Playwright scripts in `qa/` target earlier routes), plus crash/error telemetry, performance budgets and a deterministic release build.
- [ ] Physical iPhone/iPad testing for touch concurrency, landscape/safe areas, interruption/resume, audio session, memory/thermal behavior, low-power devices, and offline play.

### P1 — content and tooling follow-ups
- [ ] Open `moon-library.ldtk` in LDtk, author further rooms there, and move more of the existing hand-coded rooms (`world.js`) into LDtk.
- [ ] Exercise Pixelorama and Godot in the pipeline or drop them from the toolchain.
- [ ] Decide whether to evaluate Phaser 4.x as a separate upgrade route.

### P1 — native packaging and commerce
- [ ] Package the Phaser game in a production iOS shell or native host with no dependence on a development server/CDN.
- [ ] Configure bundle ID, signing, icons, launch screen, supported orientations/devices, privacy metadata, age rating, support/privacy URLs, and App Store listing assets.
- [ ] For the intended $3.99 model, prefer a paid-app purchase if 1.0 is a complete game with no separate digital unlock. If later selling levels/currency/content inside the app, use StoreKit IAP and server reconciliation where entitlement portability requires it.
- [ ] Run TestFlight internal/external playtests and capture crashes, completion failures, control complaints, learning-loop drop-off, and device-specific regressions.
- [ ] Submit the release candidate to App Review and resolve review issues without weakening the golden gameplay contract.

**Game paid-production exit:** a customer can buy/install the game from the App Store, finish the complete 1.0 experience offline on supported devices, retain progress across normal app lifecycle events, and receive a stable product with documented support/privacy and validated learning instrumentation.

## Shared commercialization rule

Do not gate launch on every later roadmap idea. Gate it on **reliable core value + safe data handling + accepted commerce + supportability + store compliance**. New adaptive features, extra subjects, parent/school expansion, additional game worlds, and deeper personalization are post-launch unless testing shows one is necessary for the core promise.
