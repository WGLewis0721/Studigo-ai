# Phase 3 UI change ledger — 2026-10-15

Review ledger for an independent Harmony/operations review, not a release approval. Compare each implementation commit to the immutable golden tree, and inspect the *flag-on and flag-off* paths. A visual specimen or public demo is not proof of signed-in behavior.

## Baseline and recovery

- Golden tree: `6b12d0dba24359825d1845b8fa591ee55b589a2b` (`docs(golden): freeze pre-redesign production baseline (#155)`). Remote `refs/heads/rollback/studigo-ui-golden-20261015` resolved to this exact SHA on 2026-10-15; no local rollback ref was present. The preceding application commit is `62715fda381cf00d844dd61649e048d1be1d4d35` (`main` at the golden capture). The golden merge adds documentation/images, not application code.
- Golden visual references: `docs/golden/2026-10-15/{production-landing,materials-demo,learn-demo,coach-demo}.jpg` and its `README.md`. The three room captures are synthetic public-demo states, not private-source, grade, or persistence evidence; the unscrolled landing capture misses scroll-reveal sections.
- Golden gate evidence supplied by the release operator: PR #155 merged at `6b12d0d`; CI run 585 and AI-security contention run 146 passed on its head `ac52969`; forced preview `dpl_9qLnLSmN3q9oNsiEJcbeNmm8gjfc` was READY on that head; production `dpl_4HzC5TgqPPAuHLB3LXoDJdPjzkd5` was READY at the merge SHA, with canonical alias and public room route rendering. App-code delta from `62715fd` was zero. These are **golden-gate** reports, not Phase 3 test results; independently reconfirm deployment/alias before rollback or release.
- Recovery: disable the *affected room's* flag if its off path demonstrably restores baseline behavior. If a deploy rollback is required, create a revert PR from the immutable rollback ref or promote its known-good deployment; do not force-reset `main`. Verify required CI, READY deployment, canonical route and representative learner flow. UI rollback does not reverse migrations or durable learner state.

## Before → after inventory

The right column is a review target, **not a claim of implementation**. Source of proposed ordering: `design/phase3/ROOM_BY_ROOM_ROLLOUT.md` in the Phase 3 planning worktree. Relative `room/*.tsx` paths below are under `apps/web/components/`; `lib/*.ts` paths are under `apps/web/`. Keep the five existing navigation groups (Coach, Practice, Progress, Plan, Materials) and the Coach/Learn switch unless an independently accepted product change says otherwise.

| Room | Golden owner → proposed visual placement | Behavior/authority to preserve | Implementation evidence |
| --- | --- | --- | --- |
| Hallway | `apps/web/components/room/workspace.tsx`, `mode-header.tsx`, `apps/web/components/mode-glyph.tsx`, `apps/web/app/globals.css`, `components/companion/` → `workspace.tsx` imports new `phase3-foundation.css`, marks `roomDevice[data-ui="phase3"]`; old navigation/rendering remains | Existing deep links, five groups, room/theme/preferences, one companion, settings, focus and navigation history; no client learning policy | `24f0c73` → integrated `795d80a`; four-width/focus/flag-off proof pending |
| Library | `room/materials-panel.tsx`, `guide-preview.tsx`, document routes → same panels with separate original shelf and generated guide, source spotlight; `apps/web/app/api/guides/source/route.ts` now exposes current document name/MIME/ID | Private original retrieval, upload/process/retry, partial OCR, source status/revision and authorized page evidence; never invent a highlight | UI `24f0c73` → `795d80a`; route `81a8bff`; existing download route reused. Signed-in stale/denied/return-focus proof pending |
| Classroom | `room/coach-panel.tsx` + `learn-panel.tsx`, existing application learning layer → same Learn view with focus/reading hierarchy and `learning-phase3.css`; **no new mission reducer/cursor** | Separate Coach/Learn topic state, source scope, revision-bound cursor, idempotent advance; formative Learn completion is **not** mastery | `4556150` → `a3f20a5`; visual interior only. Mission exit proof pending |
| Foyer | `apps/web/components/app-home.tsx`, `apps/web/lib/home-next.ts`, `room-card-link.tsx` → `app-home.tsx`/`.css` visual restyle; `home-next.ts` selection unchanged | Existing room selection/onboarding; only offer mission when authorized and ready, otherwise Materials | `24f0c73` → `795d80a`; no mission Start/Resume, ready/processing and exact-resume proof pending |
| Tutor | `room/coach-panel.tsx`, `coach-aside.tsx`, `use-coach-preferences.ts` → same Coach chat/aside with mode-specific intro/focus and `learning-phase3.css`; preference owner unchanged | Current Coach protocol, separate applied/draft preferences, grade/assistance accounting, retry and source scope; voice must review transcript before submit | `4556150` → `a3f20a5`; voice and failure acceptance pending |
| Practice | `room/quiz-panel.tsx`, `cards-panel.tsx`, `practice-test-panel.tsx` → same panels plus studio classes/instructions and `phase3-rooms.css`; existing endpoints untouched | Existing quiz attempt, card scheduling/review and test draft/receipt APIs remain distinct; selection ≠ submit and Learn ≠ graded transfer | `589f771` → `2252d16`; per-mode grade/duplicate/answer-leak proof pending |
| Progress | `room/mastery-panel.tsx`, `weak-areas-panel.tsx`, `lib/study-planning.ts` → same panels with evidence hero/next-step presentation; planning calculation untouched | Official evidence only, separate lesson position, correct weak-topic action | `589f771` → `2252d16`; Learn/no-change and assessed-result-once proof pending |
| Plan/controls | `room/study-plan-panel.tsx`, `cram-panel.tsx`, `room-settings.tsx`, companion owner → same panels with section intros and `phase3-rooms.css`; companion owner unchanged | Existing plan calculation, mark/skip and topic handoff; settings/draft persistence; companion never obscures answer/citation | `589f771` → `2252d16`; round-trip, settings and accessibility proof pending |

## Review protocol and current disposition

For each room record the branch/commit SHA, exact changed paths and new→old component adapter, flag name/default/effective scope, command/state owner, before/after captures **from the same SHA**, focused test command/result, keyboard/screen-reader/200% zoom/reduced-motion/high-contrast findings, and a demonstrated flag-off state. Mark DONE only against that room's exit criteria in the rollout plan. A build or token contrast computation alone is not rendered acceptance.

High-risk seams: Home readiness vs real mission availability; changing source revision after a ticket or unsent answer; Coach/Learn topic switches and draft loss; pause/reload/double-submit; evidence sheet focus return; original vs generated guide; optional voice permission/transcript; choice selection vs grading; Learn completion vs mastery; cross-room topic handoff; companion/fixed dock collisions on compact phones. Authorization and source eligibility remain with server/RLS; `packages/learning` and durable learning events own progression, while Coach/Practice own grading. Styled cards, model prose, and client state grant none of those authorities.

**Integrated tree observed:** `2252d16` over golden, with the four cherry-picked commits above. `NEXT_PUBLIC_STUDIGO_PHASE3_FOUNDATION_UI === "1"` is a build-time public flag for Home/hallway/Materials. Learn/Coach and other room CSS is scoped under the hallway's `data-ui="phase3"`; this is **one coupled visual switch, not the per-room flags** envisaged by the rollout plan. A flag change requires a new build/deploy; one room cannot be disabled independently with the current switch. Flag-off rendered comparison and deployment rollback demonstration remain pending. The separate #154 mission path was **not integrated**. No new mission persistence, API or learning policy was identified in these UI diffs. Source route still queries room-scoped blocks/documents and filters current revisions; the inspector links through the existing authorized original download route. Its focus and cross-account behavior need a signed-in audit.

**Validation reported so far:** Learning agent reported typecheck, 17 focused cases in one web-package invocation, and production build passed on `4556150`; an initial root test invocation failed due to `tsx` resolution before the web-package rerun. Integration operator reported web typecheck and production build passed on integrated `2252d16`. These are agent/operator reports, not runs by this ledger keeper. Foundation/rooms focused behavior reports, signed-in rendered authorization audit, same-commit four-width and accessibility captures, and flag-off demonstration are still pending. All room exit gates are **NOT DONE / evidence pending**; especially do not relabel this visual Learn refresh as the Brief · Show · Try · Check mission. No test suites were run for this documentation ledger.

## Preview review addendum — 2026-10-15

- Draft PR #156 now includes a preview-only synthetic `/dev/home` and `/dev/study` fixture gate: `NODE_ENV=development` or `VERCEL_ENV=preview` **and** the Phase 3 flag. The routes remain unavailable in production. The fixture displays a synthetic/no-save label and does not prove learner API behavior.
- The branch-specific flagged Vercel preview rendered a visibly new Home hero and Materials source library. On a 390px Coach view the intro and vertically wrapped topic actions initially consumed too much height. `39db238` compacts the intro and puts Clear/Previous/Next on one row. A rendered phone inspection showed the input and enabled Send button visible alongside the floating companion. The companion CSS already reserves width on `.chatRow`; `845d6a2` added a duplicate inset and made the input 110px wide, then `8cefe25` removed it. The final effective CSS matches the verified `39db238` layout. The interrupted extra inset is documented here to explain the correction.
- Preview deployment `dpl_5Wch7DquKAkUVAcaP9vRMEcNjSWT` was READY at `39db238`; the final `8cefe25` deployment and CI should be checked separately. The screenshot review used a synthetic fixture; it did not send a Coach request. Learn mode rendered in the same 390px fixture after switching modes; its lesson and starter controls were present. Full signed-in, keyboard, four-width, flag-off and mission criteria above are still pending.

## Phone working-surface pass — 2026-10-15

PR #157 compacted the Coach/Learn intro on every width. A later phone rule still assigned the chat `min(72dvh, 700px)` and `min-height: 440px`, which can lose to the shell's flex rule today and win again if specificity changes. The follow-up keeps the phone chat on `height: auto` / `min-height: 0` at specificity above the shell rule, tucks the mode subtitle away while a chat is open, and treats Materials, Practice, Progress, and Plan intros the same way on a phone: a short title, the explanatory paragraph hidden, and the mastery hero no longer a 235px poster. The quiz prompt stays the question. Flag-off markup is unchanged. This is not four-width, keyboard, or signed-in acceptance. The Learn mission in draft #154 is still not on `main`.

## Coach and Learn rollback — 2026-10-15

The Phase 3 interior on Coach and Learn is removed: `learning-phase3.css`, the intro strip, and the lesson-stage wrapper. Those two surfaces are the application baseline `62715fda381cf00d844dd61649e048d1be1d4d35`, the tree behind `docs/golden/2026-10-15/coach-demo.jpg` and `learn-demo.jpg`. The other flagged rooms stay as they are. This restores those files. It is not a new visual acceptance.

## Coach proportion lock — 2026-10-15

Accepted interaction, not a visual-acceptance close of rooms A–F. From `fb0ecc2`, the Coach tab keeps this behavior and these proportions through the rest of the Phase 3 redesign. Icons, frames, and type may change. The geometry and the motion may not.

- The row between the room nav and the orange rail starts at full size, eases to 60% after 0.5–2s on arrival or on pointer, scroll, or typing, and returns to 100% on hover, focus, or click. The orange rail does not scale.
- Clear, Previous, Next, the follow-up chips, the status line, and the topic column use the same 60% tuck and the same hover, focus, or click return. The conversation takes the freed height and the freed column width.
- Learn stays on that same Coach frame. Phone controls stay full size. Flag-off Coach is unchanged.
- Later rooms reuse the tuck on that same strip only. Titles, shelves, questions, and plans do not scale on hover.

## Plan position — 2026-10-15

The strip lock stands. The plan is not accepted. What is on `main`:

| Room | On main | Still open |
| --- | --- | --- |
| 0 Hallway | Five groups, one foundation flag, strip tuck on every room | Four-width and focus proof |
| 1 Materials | Original shelf, generated guide, source passage | Signed-in stale and denied proof |
| 2 Learn mission | An allowlisted room shows the reading steps inside the locked frame. Try can tap a sentence from the verified excerpt and open a hint. The hosted migration is reported applied. Embedded Postgres already proved resume without a mastery write. | Four-width, keyboard, and a real elementary and college source remain open. The college sample is a synthetic fixture only. This is not acceptance. |
| 3 Home | Resume appears only for an allowlisted room with an unfinished Learn cursor. The link is `?mode=learn`. There is still no Start from a document count. | Four-width and a signed-in resume capture. This is not acceptance. |
| 4 Coach | Locked at `fb0ecc2` plus the later strip measurement fix. A Learn link opens the Learn chat. Proportions were not retuned. | None for proportions |
| 5–7 Practice, Progress, Plan | Flagged skins. Strip only. Progress says a Learn reading is not mastery. Plan Start opens the activity and Mark done does not grade. Existing grading and planning untouched. | Grade, evidence, and handoff proof on a device |
| 8 Whole path | The path is written in `docs/ux/PHASE3_ROOM8_PATH.md`. Home can resume, and Learn links open Learn. | Four-width, keyboard, signed-in sources, and the release gates |

D1–D6, A–F, and S0–S4 stay open. A build is not acceptance.


