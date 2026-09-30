# Studigo Engineering Roadmap

The order matters. The core product loop now works in production, so the
priority has changed from proving the architecture to proving repeatable learner
value.

## Parallel P0 — Moon Keep II App Store production

The game now has a separate production track alongside the Study Room product.

**Current game baseline:** POC X — Moon Keep II is the approved golden build.
Treat `prototypes/moon-road/dist/poc-x/` and tag
`golden/poc-x-moon-keep-ii` as frozen gameplay reference. Read
[`../prototypes/moon-road/POC-X.md`](../prototypes/moon-road/POC-X.md) and
[`../prototypes/moon-road/CURRENT_GAME_HANDOFF.md`](../prototypes/moon-road/CURRENT_GAME_HANDOFF.md)
before game-release work.

**Commercial v1 direction:** premium paid iPhone/iPad game at **$3.99**, with no
ads, no subscription, and no required account for the first App Store release.
The production task is no longer to invent another POC; it is to package,
measure, polish, validate, and ship the approved game.

Game-release work must preserve POC X unless a task explicitly authorizes a
gameplay change. New experiments belong in sibling routes/branches rather than
silently changing the golden build.

## Current P0 — Downloadable study guide

The #1 missing user-facing feature is a simple way to **download the study guide
Studigo has built from the room**.

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

### Flashcards
- [x] Generate per topic.
- [x] Student can edit/delete. Editing preserves the spaced-repetition schedule,
  so fixing a typo never costs the recall history behind the card.
- [x] Track recall performance.

### Quiz mode
- [x] MCQ, true/false, fill-in, short response. True/false and fill-in are graded
  deterministically server-side — no model call, so they are instant and free.
  Fill-in accepts every listed spelling and forgives a single typo on a long term.
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
- Keep learning traditions as coaching routes through the same mastery target.
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
## Game production track — Moon Keep II → App Store v1

This track converts the approved browser game into a production iPhone/iPad
product without restarting game design.

### G0 — Freeze the golden game (complete)

- [x] POC X Moon Keep II approved as the current golden image.
- [x] Golden tag recorded: `golden/poc-x-moon-keep-ii`.
- [x] Current game rules, art pipeline, tests, and handoff are documented.
- [x] Browser build remains separately playable for regression comparison.
- [x] Gameplay freeze rule established: do not edit `dist/poc-x/` casually.

**Exit:** production work can compare against a stable, known-good game.

### G1 — Choose and prove the iOS packaging architecture

- [ ] Audit the existing Phaser build and the current `apps/desktop` Tauri
      scaffold.
- [ ] Compare a minimal Tauri-mobile, Capacitor, or equivalent native-wrapper
      approach for this specific offline game.
- [ ] Choose the smallest architecture that bundles the game locally, launches
      without a website dependency, and produces a normal signed iOS/iPadOS app.
- [ ] Keep gameplay code/assets local to the app for v1.
- [ ] Document the decision, file layout, build commands, signing path, and
      rollback plan in an App Store release plan.
- [ ] Produce a simulator build before adding product features.

**Exit:** a clean iOS simulator install launches Moon Keep II from local app
assets with no GitHub Pages dependency.

### G2 — Native lifecycle, controls, and offline reliability

- [ ] Lock gameplay to the intended landscape presentation.
- [ ] Verify iPhone/iPad safe areas and touch targets.
- [ ] Preserve simultaneous move + jump + fire input.
- [ ] Clear held controls correctly after backgrounding, locking, interruptions,
      and foreground return.
- [ ] Pause/resume safely across app lifecycle events.
- [ ] Define and test sound behavior for mute, headphones, Bluetooth, and audio
      interruptions.
- [ ] Add optional haptics with an in-game setting.
- [ ] Make the complete game playable with networking disabled from launch.
- [ ] Remove prototype/debug-only surfaces from the release shell.

**Exit:** the native shell behaves like a mobile game rather than a webpage in a
container.

### G3 — Save, resume, and player-state persistence

- [ ] Add local save data for checkpoints/progression, unlocked powers,
      collected upgrades, and settings.
- [ ] Define exactly which combat resources persist and which reset on resume.
- [ ] Restore safely after force-quit and device restart.
- [ ] Add explicit **New Game** with confirmation.
- [ ] Version the save schema so later releases can migrate it.
- [ ] Handle corrupt/incompatible saves without trapping the player.
- [ ] Add automated save/restore regression coverage.

**Exit:** a player can leave for hours or days and reliably continue the same
run.

### G4 — Learning-evidence layer

Do not use level completion as proof of multiplication mastery.

- [ ] Add a short optional first-run baseline using roughly 10–12 facts.
- [ ] Record locally, per fact:
      exposures, first weapon choice, matching/nonmatching attempts, ×1 fallback,
      response/selection time, question accuracy where applicable, repeated
      errors, and improvement across exposures.
- [ ] Distinguish factor/weapon recognition from multiplication-product recall.
- [ ] Add a parent/progress view showing practiced facts, strongest facts,
      facts needing practice, accuracy change, response-speed change, and play
      time.
- [ ] Add an optional later retention check so immediate familiarity is not
      mislabeled as durable learning.
- [ ] Keep learning telemetry local in v1.
- [ ] Do not make unsupported claims such as "mastered" solely because a boss or
      level was completed.
- [ ] Run a small before/play/after/next-day playtest and record whether facts
      encountered in the game improve more than held-back comparison facts.

**Exit:** Studigo can show evidence of intended learning effects instead of only
showing engagement or game completion.

### G5 — Premium production-polish pass

Preserve the existing combat/gameplay design while removing prototype feel.

- [ ] Final title/launch flow.
- [ ] Production pause/settings screens.
- [ ] Loading and transition polish.
- [ ] Save/checkpoint feedback.
- [ ] Weapon-unlock presentation.
- [ ] Boss introductions and completion/victory sequence.
- [ ] Audio mix and feedback pass.
- [ ] Haptic feedback pass.
- [ ] Consistent hit-stop, particles, camera feedback, and damage readability.
- [ ] Final HUD hierarchy and typography.
- [ ] Disabled/pressed/touch states for every control.
- [ ] Small-iPhone and iPad layout pass.
- [ ] Accessibility review for contrast, readable text, motion/flash concerns,
      and input clarity.
- [ ] Remove placeholder/developer wording and dead-end UI.

**Exit:** a new user can install the app without encountering anything that feels
like a developer prototype.

### G6 — Privacy, rights, and App Store compliance

For v1, keep the product deliberately simple: paid download, no ads, no required
account, no subscription, and no third-party tracking unless a later product
decision explicitly changes that.

- [ ] Audit every SDK and network request.
- [ ] Decide whether to submit in Apple's Kids category only after checking the
      current official requirements and consequences.
- [ ] Prepare the privacy policy and accurate App Privacy disclosures.
- [ ] Prepare age-rating answers.
- [ ] Add parental gates wherever current Apple policy requires them.
- [ ] Verify there are no unapproved external links/actions in child-facing UI.
- [ ] Confirm Phaser licensing is shipped/documented correctly.
- [ ] Confirm provenance/rights records for generated and reused art/audio.
- [ ] Review accessibility and platform-permission declarations.
- [ ] Run a final compliance audit against current official Apple documentation
      immediately before submission.

**Exit:** there are no known privacy, rights, policy, or metadata blockers for
App Review.

### G7 — App Store product assets and merchandising

- [ ] Final app name/subtitle.
- [ ] App icon master and required exports.
- [ ] Launch/splash composition.
- [ ] Real-gameplay App Store screenshots.
- [ ] Optional short App Preview storyboard/video.
- [ ] Store description, promotional text, and keywords.
- [ ] Support URL and privacy-policy URL.
- [ ] Copyright/credits screen.
- [ ] Price configuration target: **$3.99 USD**.
- [ ] Confirm paid-app agreements, tax, and banking setup before submission.
- [ ] Ensure store art accurately represents the actual game.

**Exit:** App Store Connect can be completed without placeholder assets or copy.

### G8 — Real-device QA and TestFlight

Test the exact release candidate rather than a nearby browser build.

- [ ] Small supported iPhone.
- [ ] Current standard-size iPhone.
- [ ] Large iPhone/Pro Max class device.
- [ ] iPad.
- [ ] At least one physical iPhone; simulator-only acceptance is insufficient.
- [ ] Clean install and first launch.
- [ ] Full game start → Clock Tower → Rune Sanctum → Core Clash → completion.
- [ ] Save, force-quit, restore, background/foreground, lock/unlock.
- [ ] Offline launch and full offline play.
- [ ] Rapid simultaneous multitouch.
- [ ] Audio/headphone interruption behavior.
- [ ] Every weapon, boss, checkpoint, shrine, gate, shield state, ammo recovery,
      and New Game flow.
- [ ] Verify the Clock Shield absorb path in a real browser/native play session;
      it was previously unit-tested but not observed in the scripted browser run.
- [ ] Fix all reproducible crashes, progression blockers, lost-save bugs, and
      broken controls.
- [ ] Upload the resulting release candidate to TestFlight.
- [ ] Run external playtests with both children and parents, capturing game feel
      and learning-evidence usability separately.

**Exit:** the exact candidate intended for review has survived real-device and
TestFlight use without release-blocking defects.

### G9 — App Store submission and v1 release

- [ ] Select the tested TestFlight build for App Review.
- [ ] Complete all required App Store Connect metadata.
- [ ] Add clear reviewer notes explaining controls, offline behavior, educational
      mechanics, and how to reach later content.
- [ ] Run a final clean-install smoke test against the submission candidate.
- [ ] Submit for App Review.
- [ ] Resolve review feedback without redesigning the golden game unless the
      feedback exposes an actual product/compliance defect.
- [ ] Tag the accepted production release and preserve the submitted source state.

**Exit:** Moon Keep II is available as a production App Store product.

### Production-ready release gate

Do not call the game production-ready until all of the following are true:

- POC X gameplay regression tests remain green;
- the native app runs locally/offline;
- save/resume is reliable;
- learning evidence is measured without claiming unsupported mastery;
- no prototype/debug surfaces remain;
- privacy/rights/App Store disclosures are complete;
- physical iPhone and iPad QA has passed;
- the exact candidate has completed TestFlight validation;
- all known P0/P1 defects are closed;
- App Store metadata and assets are final.

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

- Final Studigo visual system and mascot direction. *(Visual system V2, "Personal Learning Device", is implemented across marketing, auth and the Study Room — see `docs/DESIGN_SYSTEM.md`. New mascot poses remain future work.)*
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
- Finalize hosted API boundary.
- Reuse the same Supabase identity/account model in native shells.
- Enable Tauri bundling/signing/updating if justified.
- Evaluate mobile-store wrapper only if PWA limitations block product goals.
- If true native Apple clients are built, evaluate native Sign in with Apple while preserving the shared Supabase user model.

## Phase 7 — School/family expansion (post-validation)

Only after individual-student value is proven:

- Parent mode.
- Teacher-curated rooms.
- Shared class resources with licensing/permissions.
- School/org accounts.
- Administrative controls.
- District-specific Microsoft/Entra tenant restrictions when needed.
- Required privacy/compliance work.

## Immediate next 10 game-release tasks

1. Write the App Store release architecture decision and choose the iOS wrapper
   strategy for the existing Phaser game.
2. Produce a clean simulator build that bundles POC X locally and runs offline.
3. Add local versioned save/resume plus confirmed New Game behavior.
4. Harden iOS lifecycle handling: background/foreground, lock/unlock, audio
   interruption, and stuck-touch prevention.
5. Add the local learning-evidence schema and a minimal baseline/progress view.
6. Run the first before/play/after/next-day learning validation with a small
   fact set and comparison facts.
7. Complete the premium polish pass without changing POC X's gameplay grammar.
8. Complete privacy/rights/App Store compliance and generated-asset provenance
   review.
9. Build the App Store icon/screenshots/copy and configure the $3.99 paid-product
   metadata.
10. Run physical-device QA, upload the exact candidate to TestFlight, fix all
    P0/P1 defects, then submit that same tested build for App Review.

## Immediate next 10 engineering tasks

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

Do not replace these with another foundation rewrite. The architecture has
crossed the threshold where user-value, regression prevention, and reliability
matter more than adding parallel infrastructure.
