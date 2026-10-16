# Studigo — Complete Learn Upgrade Plan

Full original specifications · October 14, 2026 · GL01–GL10 + UX01–UX10. Status: proposed, not implemented. Source: pasted by the owner (William Lewis) on 2026-10-16.

The upgrade consists of two complementary plans:
1. Guided Learning Outcome and Engineering Plan (Part I, GL01–GL10)
2. Guided Learning UI/UX Implementation Plan (Part II, UX01–UX10)

# Part I — Guided Learning from Zero Knowledge

Status: Proposed net-new delivery track. Date: 2026-10-14. Product principle: Learn is a playable tutorial for knowledge. Target: One shared learning architecture that works for a first-time second-grader and a first-time college physics student.

## 1. Target outcome
A learner uploads unfamiliar material, chooses Learn, and completes a source-grounded teaching mission without needing to know what to ask, type a prompt, or have another person explain how to study. Studigo orients, introduces missing foundations, demonstrates, lets the learner act, provides help at the moment of need, checks comprehension, and gradually steps aside.
- Learn — guided mission: teaches and forms understanding; its checks are formative and do not write mastery.
- Coach — personal trainer: provides adaptive assessed practice, targeted support and evidence of mastery.
- Practice — challenge arena: measures independent performance using established assessment rules.

Design for two independent dimensions: academic complexity and topic-specific prior knowledge. Do not substitute age, grade, or explanation level for knowledge of this particular topic.

## 2. Baseline to reuse, not rebuild
The existing Studigo document-learning queue (C01–C24) already addresses source ingestion, per-page coverage, source revision/retirement, topic navigation, contextual Learn retrieval, bounded generated educational content, source blocks, accessible mobile lessons, PDF/DOCX exports, and quiet companion feedback. The codebase also has a deterministic adaptive Coach control plane. Preserve these pieces; the new work makes them function together as instruction.

These are not net-new deliverables: a new chatbot, a second topic database, a second mastery engine, a replacement RAG system, a new guide generator, a newly invented document exporter, or a redesigned mascot. Existing correct-answer celebrations must remain intact. Original teacher uploads remain the authority; generated guides are derived artifacts.

Key current gap: existing Learn can retrieve and explain a selected topic and generate an overview, but this is not a durable, sequenced, learner-active first-time learning experience.

## 3. Intended learner journey
1. Start mission. One primary action: Learn this material. The initial mode assumes new to this topic; a learner may choose I know some of this or Let me try without completing an onboarding form.
2. Briefing. "Today you'll learn…" shows one objective and a short path, drawn from selected study-guide topics. No wall of text.
3. Follow me. Studigo demonstrates a concept with a source passage or worked example. Its complexity matches the subject, not the learner's assumed age.
4. Your turn. The learner speaks, taps, orders steps, identifies evidence, types, or works a problem. One meaningful action at a time.
5. Help at point of need. Find it, Hint, Show me, Explain differently, and Read to me are available only when contextually safe. No penalty for using help.
6. Checkpoint. A brief ungraded formative check identifies what to reteach or whether to advance. This is not a mastery event.
7. Next objective or handoff. Progress is saved; help fades after demonstrated understanding. Try with Coach or Practice on my own leads to independently assessed work only when the learner elects it.

Never force the learner through a long tutorial after they show competence. Allow pause/resume, rewatch, topic jump, skip and return, without silently awarding completion or mastery.

## 4. Net-new executable deliverables

### GL01 — Source-grounded mission blueprint [P0]
Outcome: Learn knows how to begin and what to teach before the learner writes anything.
Ship: A typed, versioned LearningMissionPlan derived from current selected topic IDs, teacher-defined scope, valid source blocks/guide content, prerequisite relationships, and academic presentation level. Include objectives, ordered concept steps, demonstration opportunities, formative checkpoints, exact evidence references, and explicit unsupported_prerequisite/partial_coverage outcomes. Ensure topic-specific initial familiarity is independent from the room's explanation setting. Build lazily and reuse by source/topic revision; do not create a competing corpus.
DONE when: A novice government fixture and a novice university physics fixture both create complete, different-depth instructional maps; every selected supported concept appears once in navigable scope; missing foundations are honestly labeled, not falsely attributed to uploaded sources; a prerequisite outside uploaded scope is either deferred until suitable material is supplied or, with explicit learner permission, taught as clearly labeled general background rather than course-grounded evidence; replaced/deleted source revisions invalidate the old map.

### GL02 — Deterministic Learn mission director and persistence [P0]
Outcome: Studigo escorts rather than waits; session state survives interruptions.
Ship: A typed transition reducer/state machine with states briefing → foundation → demonstration → learner_action → formative_check → continue/reteach/finish, plus pause, resume, skip, revisit and handoff. Store cursor, assistance history, source revision and step outcomes under existing authenticated room ownership. The model renders source-grounded explanations and examples; application rules decide sequence, retries, checkpoint transitions and help fading. Reuse existing control-plane patterns without changing Coach's assessed mastery engine.
DONE when: Two runs with identical inputs replay identically; reloading resumes exactly where the learner left off; stale/replaced-source missions stop instead of teaching retired facts; a failed or repeated request cannot duplicate progression; Learn events never write mastery or graded attempts.

### GL03 — Mission player, not a chat prompt [P0]
Outcome: A learner can make progress without inventing a question.
Ship: A mobile-first Learn screen with a compact objective/progress header, one active teaching card, one meaningful action, context-aware assistance, Back / Next / Pause, and optional topic navigation. Reuse Studigo's Personal Learning Device design system, existing Coach/Learn switcher, accessible controls, selected topic scope and canonical dragon. No second navigation system or interruptive tutorial overlay.
DONE when: On phone and desktop, a learner enters a mission in one action and completes the first concept without typing; all controls work with touch, keyboard and screen reader; teacher-scope ordering and mode-specific topic navigation remain intact; the child and college fixtures use the same components.

### GL04 — "Find it" source spotlight [P0]
Outcome: Learners learn to locate evidence, not just read an AI answer.
Ship: From a mission step or permitted Coach help action, open the exact original page/section anchored to the current authorized revision. Highlight the supporting text where reliable location data exists; otherwise show the honest page/section reference without false word-level precision. Allow returning to the active step. On the Learn surface, permit learner-initiated selection/highlighting of meaningful words as an ungraded action.
DONE when: Every supported demo can open a matching passage in the original teacher material; partial/OCR-uncertain pages disclose that limitation; no source from another account is exposed; graded Coach/Practice contexts never reveal protected answers through Find it.

### GL05 — Speech responses in Coach and Learn [P0]
Outcome: Typing is optional, especially for young learners.
Ship: A clear Speak control using the existing answer/composer contract: request microphone consent, capture one answer, transcribe, show the transcript, then allow Retry / Edit / Submit. Provide explicit permission-denied, unavailable, low-confidence, silent and network-failure fallbacks to tap/type. Use a provider-neutral transcription adapter, bounded request sizes and the existing spend/concurrency/receipt guard for paid calls. Do not retain raw child audio by default; make privacy behavior visible and obtain applicable parental consent.
DONE when: A real mobile browser voice answer can be reviewed and submitted to Coach without keyboard use; the recognized text flows through existing authorization and assessment rules; wrong transcription is correctable; failure never consumes an attempt or silently submits; duplicate retries cannot double-charge or double-grade.

### GL06 — Source-grounded tap/selection answer vehicles [P0]
Outcome: The input method no longer becomes harder than the subject.
Ship: Typed interaction contracts for tap-to-choose, put-in-order, identify-the-evidence, and an accessible typed fallback. Start with the smallest two formats genuinely supported by the source facts (choice and evidence selection), then add ordering when meaningful. A shared answer envelope carries input modality, question ID, source snapshot, assistance level and attempt context. Learn uses these as ungraded actions; Coach can use them only with its existing assessment authority and modality-aware rubric.
DONE when: A beginner can complete the first lesson without typing or speaking; options are source-supported and do not leak answers; a guessed multiple-choice response or heavily hinted selection cannot earn the same mastery evidence as an independently explained answer; accessibility and keyboard equivalence work.

### GL07 — On-demand read-aloud [P1]
Outcome: Reading fluency does not prevent learning a concept.
Ship: Read to me on questions, step explanations and permitted selected passages. Prefer device/OS speech synthesis where reliable; expose play/pause/replay/speed and accessible text synchronization when available. Never autoplay long narration or store spoken child responses as audio. The learner can turn speech off at any time.
DONE when: A learner can hear the active question and source excerpt on mobile without losing cursor state; unsupported devices fall back to readable text; no new paid AI request is required for ordinary OS speech playback.

### GL08 — Context-sensitive companion feedback [P1]
Outcome: Preserve the joy of success while making Studigo useful when the learner is unsure.
Ship: A lightweight semantic event-to-reaction map for ready, listening, demonstrating, thinking, hinting, trying_again, checkpoint_complete, and celebrating. Extend current companion/quiet-feedback primitives rather than adding another mascot controller. The dragon can expose appropriate help actions but does not interrupt instruction or grade answers.
DONE when: Existing quiz celebrations remain recognizable; correct answers and meaningful progress have delightful feedback; errors produce gentle encouragement without shame; motion-reduction and sound-off settings are respected; no animation blocks the next action.

### GL09 — Original-material rescue controls [P1]
Outcome: A spilled or lost paper study guide is recoverable immediately.
Ship: Separate, plainly labeled View original, Download original, and Print original from Materials and the mission evidence view, alongside separately named Download Studigo guide. Build on existing private file access and exports; preserve the uploaded bytes and owner checks, and distinguish original files from regenerated derivative content.
DONE when: A user can retrieve and print the unchanged teacher file in no more than two actions from Materials; output labels cannot confuse an original with an AI-produced edition; original retrieval still works when generated content is unavailable or being rebuilt. If printing is not supported for a file type, offer its download rather than implying success.

### GL10 — Independent practice handoff and outcome evaluation [P1; release gate]
Outcome: We demonstrate actual learning, not only attractive lesson screens.
Ship: A Try with Coach / Practice independently handoff preserving room, selected topic and correct source revision, without transferring ungraded Learn checkpoints into mastery. Add a reusable two-level evaluation harness with government vocabulary and introductory university physics materials, seeded zero prior knowledge, supported/unsupported prerequisite tests, a source replacement, voice-permission failure, OCR-uncertain page, and accessibility checks. Record privacy-safe events for mission entry, first action, help requests, independent checkpoint success, abandon/revisit and handoff (no raw learner responses or original document text in analytics).
DONE when: Learn-to-Coach/Practice transition works without manual topic reentry; only assessed Coach/Practice actions can increase mastery; the fixture suite passes on the accepted commit; a small moderated user pilot demonstrates a learner can start, act, recover from confusion and finish without a tutor operating the app.

## 5. Delivery sequence and dependencies

| Wave | Purpose | Work | Exit evidence |
|---|---|---|---|
| 1 — Playable vertical slice | A guided first lesson genuinely exists | GL01 → GL02 → GL03, thin GL04 evidence hook | Both subject fixtures can complete one briefed, demonstrated, ungraded concept without prompt composition; pause/resume works. |
| 2 — No keyboard necessary | Remove answer friction | Complete GL04; GL06 choice/evidence; GL05 speech | A learner can find evidence and respond using tap or speech; errors do not submit/grade; source and permission boundaries verified. |
| 3 — Comfortable and rewarding | Smooth the experience | GL07, GL08, GL09 | Read-aloud, unchanged joyful celebration, resilient original download/print. |
| 4 — Independent learning proof | Verify transfer, quality and release | GL10, full regression/pilot | Novice learners finish missions and transfer to appropriately assessed work; cross-age, privacy, source-revision and spend gates pass. |

Critical path: GL01 → GL02 → GL03 → GL04/GL06 → GL10. GL05 may begin in parallel once the common answer contract is stable; GL07–GL09 can proceed independently after the player APIs exist.

## 6. Architecture boundary
```
Uploaded teacher materials + versioned source blocks [EXISTING]
    → Topic scope + grounded guide edition [EXISTING]
    → GL01: LearningMissionPlan (typed, revision-bound) [NEW]
    → GL02: deterministic Learn mission director [NEW]
         ├─ AI instructor: grounded explanation/demo [REUSE provider layer]
         ├─ GL04: source spotlight [NEW UI over existing provenance]
         ├─ GL05–GL07: voice, tap, read-aloud [NEW interaction adapters]
         └─ GL03: learner mission screen [NEW]
    → formative step evidence (ungraded) [NEW]
    → GL10: optional Coach/Practice handoff [NEW]
    → existing Coach director / graded attempts / mastery [UNCHANGED]
```
Software owns: user authorization, source revision, lesson cursor, transitions, assistance policy, retries, attempt integrity, and mastery authority. AI owns: bounded source-grounded teaching language, examples and misconception-sensitive explanation. All model outputs influencing UI/actions must be schema-validated. Uploaded content is untrusted. Do not install another agent framework, provider, vector store or job queue simply to implement the mission.

## 7. Acceptance bar and leading indicators
Use these as pilot targets, not as claims about current performance:
1. Unaided start: At least 80% of a small pilot in each learner cohort can enter and complete the first guided concept without a parent/tutor operating the app.
2. Active learning: Every required learning step asks the learner to do something meaningful, not just click through exposition; an action appears within the first minute of the mission.
3. Evidence integrity: 100% of instructional facts in the named test fixtures resolve to permitted source evidence or are explicitly marked as an unsupported/externally supplied prerequisite. Never invent citations.
4. Low typing burden: The government fixture can be completed using only tap; Coach can accept a reviewed voice response. Neither path bypasses assessment protection.
5. Mastery integrity: Zero Learn-only or hint-assisted formative events modify official mastery. Source revisions never leave an active mission grounded in retired content.
6. Continuity: 100% of deterministic pause/reload/retry fixtures restore the expected step without duplicate events.
7. Joy without obstruction: Existing correct-answer celebration passes regression; learner can always continue, reduce motion, mute, or bypass nonessential animation.
8. Real understanding: Each pilot includes one independent post-lesson question in Coach or Practice; compare first-attempt accuracy with an initial unassisted check when feasible. Do not use mission completion as a substitute for learning.

Pilot fixtures: (A) unfamiliar second-grade government vocabulary; (B) unfamiliar introductory college mechanics, with actual worked math and prerequisite reasoning. Both use the same engine, schemas and interface, with different cognitive depth. Include one original-material retrieval scenario.

## 8. Engineering / release contract
- Add GL01–GL10 as a net-new segment of the existing execution queue, not a replacement master plan. Avoid duplicate implementation cards for the already completed C tasks.
- First reconcile source code and the existing queue statuses at the actual target branch; do not treat prior documentation status as proof of deployment.
- Each card produces a narrow PR with typed contracts, tests/evidence, migration if needed, UI demonstration where applicable, rollback/flag plan, and a clear pass/fail checklist. Update the existing product, architecture and design-system documents where behavior materially changes.
- Reuse existing AI admission limits, concurrency, receipt idempotency, privacy/RLS, revision invalidation and grading authority. Speech/OCR/provider-based workloads remain disabled in environments where spend safeguards are not proven.
- Roll out behind a Guided Learn flag while preserving the current Learn fallback; do not force all current learners onto an unvalidated path.
- Ship the vertical slice first. Do not hold an effective beginner mission hostage to optional animation polish, universal native UI, new games, or a full framework rewrite.

## 9. Explicitly out of scope
No new educational social network, general voice assistant, separate child-only product, automated mastery awards in Learn, new game economy, visual redesign of the dragon, replacement of existing content-generation/export systems, or autonomous agent that chooses teaching/grading policy.

Definition of product success: A student opens material they have never seen, presses Learn, follows Studigo through a real learning mission, understands enough to try independently, and can recover the original school document whenever needed.

# Part II — Guided Learning UI/UX Implementation Plan

Status: proposed product/engineering handoff, not implemented. Date: October 14, 2026. Scope: UI and interaction layer supporting GL01–GL10. Source baseline: GitHub WGLewis0721/Studigo-ai, current main (docs/DESIGN_SYSTEM.md, docs/PRODUCT.md, docs/ARCHITECTURE.md, STUDIGO_CODEX_EXECUTION_PLAN.md, apps/web/components/room/{workspace,coach-panel,learn-panel,studigo-composer,citations}.tsx). Non-goal: product-wide rebrand, new learning engine, rewriting existing completed C-series tasks, a second companion, or a new top-level Learn application.

## 1. Product outcome
A student who has never seen the uploaded subject matter can open Learn and immediately know what to do. Studigo introduces one idea, demonstrates it, lets the learner act, shows the supporting source, offers help without penalty, and advances at an appropriate pace. Chat is available but not a prerequisite. This is a playable tutorial for knowledge, not a transcript with an extra button.

UX principles
1. Show the next useful action, not an empty composer. First-run path defaults to Start learning or Continue mission; no mandatory grade/knowledge survey.
2. Guide without trapping. Back, pause, resume, ask, inspect source, skip familiar material, and change topic are discoverable and safe.
3. One active teaching stage at a time. Defer choices until necessary. The step indicator shows lesson position; it is not mastery/readiness.
4. Act before typing. Tap, choose, arrange, speak, or type based on the task. Always keep an accessible fallback.
5. Proof, not just citation labels. Find it reveals an exact verified passage/location, or states the evidence limitation.
6. Teach before assessing. Learn checks are formative and ungraded. Coach/Quiz remain the assessed sources of mastery. Hint-assisted actions are not independent demonstrations.
7. One companion, meaningful reactions. Preserve the canonical orange scholar, seat/window/stage, existing joy on correct graded answers, unobstructed controls, mute and reduced motion.
8. Academic level and prior knowledge are independent. Same UI architecture for second grade and college; vary density, representation, phrasing, content and help, not the product's identity.

## 2. Information architecture — the minimum change
Keep the current Study Room chrome: room shell, mode rail/dial, Materials, Coach, Quiz, Cards, Mastery, Plan, etc. Inside the existing Coach surface, preserve Coach | Learn as the primary switch.
- Coach mode continues to offer Chat | Topics.
- Learn mode offers Mission (default) | Chat | Topics. Chat remains the current source-grounded conversation; it is not deleted. Topics is the same integrated topic-scope selector, retaining independent Coach/Learn selections and Apply actions. The mission is an additional presentation surface fed by the new GL instructional director.
- A persistent Ask Studigo action on Mission opens a contextual compact help drawer; Open Chat is available for a fuller conversation. Closing either returns to the same mission stage without losing state.
- The existing Overview/lesson content feeds teaching stages rather than becoming a competing third lesson system. Maintain the older overview only as a useful optional reference view if it adds distinct value.
- Mission Restart and Back are not chat Clear; do not conflate session or response histories.
- Teacher study-guide topics are the map; supporting sources expand explanations but cannot silently change the required scope.

Navigation invariant: switching modes or opening source/help cannot submit answers, create mastery, or advance a mission by itself.

## 3. Target screen inventory

Screen A — Learn entry / resume
- Existing room/Coach-Learn context remains visible.
- Teal Learn heading and a compact Today's mission panel with topic, objective, duration only if based on measured evidence (otherwise omit), and source readiness.
- One dominant molded key: Start learning or Continue lesson; secondary Choose topics and Review guide.
- If previously paused: show exact saved objective (Lesson 2 of 6 · Demonstration) with Continue and Start over (confirmation).
- If no ready source: say whether files are queued, reading, partially available, or missing; provide one effective next action.
- No blank question field as the hero.

Screen B — Mission briefing
- Breadcrumb: Learn · Lesson 2 of 6 and exact active topic.
- One-sentence mission objective; optional tiny path Look → Try → Check with completed/current indicators, expandable detail on demand.
- Studigo gives a short, source-relevant introduction. No cinematic detour or unskippable animation.
- Primary Show me; secondary I know this / Skip ahead, Hear it, View source.

Screen C — Demonstration / worked example
- Matte-white instructional stage, not a chat bubble stack.
- Headline, one principle or example, one illustration only when supported or pedagogically valuable, and a 1–3 step worked sequence. Bigger subjects can use equations or diagrams; younger learners receive shorter chunks.
- Toolbar: Find it, Read aloud, Another example, Give me a hint only when semantically applicable.
- Primary My turn. Scroll position, stage state and source revision are retained on pause/reload.
- Source grounding appears as a compact teal ticket, using existing citation style.

Screen D — Guided action / formative checkpoint
- Display one concrete prompt such as "Who chooses the leaders?" or "Which way does the cart accelerate?".
- Show the interaction matching the task: 2–4 choice keys, selectable words/evidence, tap-to-sequence steps, optional speech/keyboard. Do not auto-degrade demanding conceptual work to a lucky-guess quiz.
- An action dock includes Tap | Speak | Type only for supported modes. Use task-specific choice keys as the default when possible; do not surface irrelevant input modes.
- Provide Hint, Show me again, Find it where safe, and I'm stuck. After an answer, feedback is formative, the UI marks it as Practice with help / Learning checkpoint, never "Mastered".
- The director provides next allowed actions; UI does not invent grading thresholds or progression.

Screen E — Source Spotlight
- Find it opens a bottom sheet on phone, docked right-hand pane on iPad/desktop.
- Title: teacher filename, page/section, source type and revision eligibility. Highlight a verified source block/quote. If precise PDF-text alignment is unavailable, show the verified extracted excerpt plus an Open original · p. N control; do not draw a fabricated positional highlight.
- Back to lesson retains current step. Reader supports selected-text read-aloud when eligible, zoom, and reopen original.
- Missing, unreadable, stale, or unsupported evidence gets a truthful limitation and possible next action (open Materials / reprocess), never an invented quotation.
- In assessed Coach/Quiz states, reveal actions respect the existing challenge's answer-protection contract.

Screen F — Coach answer surface
- Keep the current Coach transcript and coaching preferences. Enhance the existing composer with an explicit microphone action and a task-sensitive answer presentation.
- Speak: user taps mic → permission explanation/request → visible recording state → stop → transcription preview → Submit or Retry/Edit. Never auto-submit a transcript; never record passively; no raw recording retained by default.
- Tap: when task allows, put choices directly in the challenge card, not inside the text field. Keep the typing path for open responses.
- Distinguish a hint-assisted attempt from an independent answer in feedback and evidence. Speech changes transport, not correctness or mastery policy.
- Do not duplicate a tiny companion in the composer while the canonical companion is already on screen.

Screen G — Mission checkpoint / transition
- Finish a concept with a concise "You practiced X" summary, the source it came from, and an honest indication of assistance.
- Actions: Next lesson, Try on my own in Coach, Practice questions, Review source.
- Transfer keeps the selected topic and source scope but does not convert Learn's formative activity into assessed mastery. Independent Coach/Quiz work is clearly labeled as assessment.
- Avoid reward currency, grade-like scores, or streak promises not in the current learning control plane.

Screen H — Materials library / recovery
- Keep document cartridges and existing status states.
- Each eligible original teacher document has clear Open original / Download original / Print original actions; generated export separately says Download Studigo guide.
- Show upload/processing errors without hiding older usable content; an original remains retrievable even if generated guide composition fails, subject to the established access/retention policy.

## 4. Illustrative wireframes (structure only — not approved mockups)

Phone: Learn mission
```
┌───────────────────────────────────┐
│ ◀ Room           Learn · 2 of 6  │
│ [Coach] [LEARN]                  │
│ Mission   Chat   Topics          │
├───────────────────────────────────┤
│ Government · Voting               │
│ ● Brief  ● Show  ○ Try  ○ Check    │
│                                   │
│  [Studigo in his existing window] │
│                                   │
│  WHY DO PEOPLE VOTE?              │
│  People choose who represents ... │
│  Example: a class representative  │
│                                   │
│  [Find it]  [Hear it]             │
│                                   │
│  [        My turn        ]        │
│                                   │
├───────────────────────────────────┤
│ ? Ask Studigo       ◀ Back   ···  │
└───────────────────────────────────┘
```
The companion must not cover the teaching card, microphone, citation actions or sticky controls. Render the same chrome without him when disabled.

Phone: Source Spotlight
```
┌───────────────────────────────────┐
│ Lesson remains mounted underneath│
├───────────────────────────────────┤
│ ──  Find it in your guide     ✕  │
│ Teacher study guide · Page 3      │
│ [Verified extracted passage]      │
│ "...choose representatives..."    │
│                                   │
│ [Open original p. 3] [Read aloud]  │
└───────────────────────────────────┘
```

Wide: Learn mission + source
```
┌─────────────────────────────────────────────────────────────┐
│ Existing room shell + mode dial + Coach | Learn             │
├────────────────────────────────────┬────────────────────────┤
│ Topic / objective / mission trail  │ Source Spotlight       │
│                                    │ filename + page        │
│ Matte-white teaching stage         │ verified cited passage│
│ explanation → worked example       │ open original          │
│                                    │                        │
│ actionable learner response        │                        │
│                                    │                        │
│ [Hint]  [Show me again]  [Next]    │                        │
└────────────────────────────────────┴────────────────────────┘
```

## 5. Responsive composition

| Device | Composition | Non-negotiable |
|---|---|---|
| Phone (320–430 CSS px) | One teaching column, compact mission trail, contextual bottom action area; Source Spotlight bottom sheet; keyboard pushes/scrolls without hiding submit | One primary action visible; safe-area padding; mascot never blocks; no horizontal overflow |
| Foldable / narrow split (variable width) | Responsive container-based progression, sheet or side-pane depending on available app width, not device name | Hinge/cutout safe placement; no assumptions that two panes exist |
| iPad portrait (approx. 768px+) | Main mission stage with optional collapsible source panel; companion seated or nonblocking | Focus remains on current action |
| iPad landscape / desktop (1024px+) | Teaching pane and contextual source/help pane; maintain frosted rail and device shell | Do not turn Learn into a dense LMS dashboard |
| Keyboard / screen reader / zoom | Linear reading order, labeled steps, explicit status, alternatives to gesture/speech | No essential action depends only on dragging, animation or audio |

Target at least 44×44 CSS px for new web touch actions as a Studigo usability choice; this deliberately exceeds WCAG 2.2 AA's 24×24 CSS px minimum/spacing condition. Keep existing molded keys 44–58px high. Support 200% text zoom, prefers-reduced-motion, keyboard focus, captions/text equivalents, contrast, browser dictation and explicit permission rejection.

## 6. Design system adherence
- Reuse the Personal Learning Device V2 visual grammar: room-colored polycarbonate shell/device bezel, Snow canvas, matte-white reading surface, frosted navigation only, molded keys, teal source tickets, sparse graphite readouts.
- Learn retains its teal inner-Coach identity, Coach its tangerine/berry, Quiz its dandelion, independent of room shell.
- Use existing Bricolage Grotesque for mission title/headline, Figtree for reading and controls, JetBrains Mono sparingly for 2 / 6, page numbers and readouts.
- Use exactly the canonical Studigo companion engine/art. The mission director emits semantic events; companion animation is nonauthoritative and can be disabled. Existing graded-answer celebration remains the high point; ungraded checks get encouragement, not a fake graded-win blast.
- Motion: one 150–250ms stage transition proposed, fast response feedback, no scrolling hijack, no involuntary speech. Respect reduced motion, low power and children's attention.
- No duplicate nav pickers, gratuitous badges, giant streak widgets, chat bubble waterfalls, or a decorative NPC obstacle.

## 7. UI component architecture (proposed names; adapt to existing owners)

| Component | Responsibility | Reuse/integration |
|---|---|---|
| LearnMissionSurface | Entry, stage, completion and blocked states | Mounted under existing CoachPanel Learn mode; preserves Chat/Topics |
| MissionProgress | Position and formative stage indicators, not mastery | Reads server/director view model |
| MissionStageCard | Briefing/explanation/example/checkpoint compositions | Matte reading and existing rich-text renderer |
| MissionActionDock | Valid primary/secondary actions and accessible input entry points | Current molded key primitives, sticky/safe-area behavior |
| AnswerInteraction | Typed choice/select/sequence/speech/transcript patterns | Reuse Coach/Quiz assessment contracts where applicable, distinct ungraded mode |
| SourceSpotlight | Verified cited passage and open original | Extend CitationChips and normalized blocks; no second retrieval system |
| SpeechAnswerControl | Mic lifecycle, permission, recording indicator, review and retry | Extend StudigoComposer, use transport adapter, no auto-submit |
| ReadAloudControl | On-demand playback and stop/pause; voice is optional | Shared read-aloud adapter; independent of mic/companion speech setting |
| MissionHelpSheet | Contextual hint, another example, prerequisite, ask | Only exposes director-permitted actions; never changes mastery |
| MissionHandoff | Navigate to Coach/Practice with stable topic/source reference | Existing mode navigator + assessed workflows |

Typed view model should be supplied by backend or GL state projection, e.g.:
```ts
type MissionView = {
  missionId: string;
  sourceRevisionKey: string;
  topicId: string;
  stage: 'entry' | 'briefing' | 'demonstration' | 'action' | 'checkpoint' | 'complete' | 'blocked';
  position: { lessonIndex: number; lessonCount: number };
  content: ValidatedGroundedContent | null;
  permittedActions: MissionAction[];
  assistance: 'none' | 'hinted' | 'demonstrated';
  sourceStatus: 'ready' | 'partial' | 'stale' | 'missing';
};
```
This is a draft interface, not an assertion that these server types exist. UI must not independently advance stages or award mastery, and action receipts must be idempotent.

## 8. Ten net-new UI deliverables (UX-series)

| ID | Priority | Deliverable | Maps to GL | Observable acceptance / DONE |
|---|---|---|---|---|
| UX01 | P0 | Navigation and design contract: approved annotated phone/tablet/desktop layouts, state inventory, interaction copy, scoped design tokens | GL01–GL03 | Coach/Learn switch, Chat/Topics, material scope and existing V2 theme preserved; prototype covers no-source, first-time, pause, resume and transfer |
| UX02 | P0 | Mission entry and resume surface | GL01–GL03 | A first-time learner begins with one tap; existing learner resumes same objective after reload; no blank composer needed |
| UX03 | P0 | Playable lesson stage | GL02–GL03 | Brief→Demonstrate→Act→Checkpoint appears as one coherent, keyboard-operable, mobile-first sequence; no mastery mutation |
| UX04 | P0 | Source Spotlight | GL04 | Find it opens verified excerpt with document/page and original link; explicit unsupported/stale handling; full path on phone and tablet |
| UX05 | P0 | Adaptive answer action dock + tap interactions | GL06 | Formative tap actions function without keyboard and preserve assisted/independent distinction; no unsupported answer format shown |
| UX06 | P0 | Speech input and transcript review | GL05 | Coach and Learn: permission denied, record, stop, transcription preview, edit, retry, submit; no automatic recording/submission |
| UX07 | P1 | On-demand read-aloud and contextual help | GL02, GL07 | Read selected eligible content; Hint/Again/Ask return to same step; stop audio; text-only usable; lesson does not depend on TTS |
| UX08 | P1 | Companion behavior integration | GL08 | Reacts to real stage events without blocking input; graded Quiz burst preserved; reduced-motion/disabled companion parity |
| UX09 | P1 | Original file recovery + practice handoff | GL09–GL10 | One-touch open/download/print original; generated guide unmistakable; explicit Coach/Quiz handoff preserves topic but grants no mastery |
| UX10 | P0 release gate | Responsive, accessible, real-learner acceptance | GL01–GL10 | Cross-device, keyboard, screen reader, zoom, source failure, mic rejection and source revision cases pass; observed pilot validates first-time usability |

Execution rule: UI tasks must not simulate an unimplemented GL director as a production truth. Static/fixture prototypes are allowed in UX01; later surfaces run behind a feature flag until corresponding GL backend contracts are accepted.

Ordered delivery waves
- Wave A — Wire the journey: UX01 → UX02 → UX03. First functional thin vertical slice: source-backed government concept, first-time start, show, tap, checkpoint, resume.
- Wave B — Make it independent: UX04 → UX05 → UX06. A learner can find evidence, respond by tapping, or speak and review in Coach without typing.
- Wave C — Finish the experience: UX07 → UX08 → UX09. Add on-demand audio, proper companion semantics, backup teacher file affordances and deliberate practice transfer.
- Wave D — Validate before default-on: UX10 and GL10 acceptance. Disable the flag / roll back on serious failures; preserve the current Learn path until the new path is proven.

## 9. States and risks that require explicit UI treatment
- No material; uploaded but queued; partial OCR; fresh document lacking the requested topic; network/provider failure; no evidence; source revision changed mid-lesson; teacher document deleted; return after browser/app restart.
- Mic permission denied, missing microphone, silence, noisy transcript, child pronunciation recognition error, unsupported speech locale, voice unavailable/over budget; provide tap/keyboard fallback.
- Hint requested before graded answer: respect challenge reveal state; show no source spoilers on protected assessed questions.
- Learn chat pending while mode switches: preserve previous Coach/Learn state; no unexpected cancellation, duplicate send or wrong-mode reply.
- Unknown prior knowledge: first encounter starts with foundation by default; Skip familiar material is reversible and does not award mastery.
- Long college equations, diagrams or source excerpts should wrap/zoom gracefully without reducing academic complexity to child-level material.

## 10. Validation scorecard (proposed pilot targets, not achieved metrics)
1. Unaided start: at least 80% of trial users in each novice cohort begin their first useful learning action without facilitator help.
2. Source findability: at least 80% in each cohort can find a cited passage using Find it without assistance.
3. No-keyboard completion: novice elementary test fixture can finish one concept's formative path by tapping. A speech-to-text attempt can be reviewed and submitted in Coach with working fallback.
4. Truth and assessment: zero fabricated passage highlights; zero ungraded Learn events increase official mastery; hint-assistance remains visible in evidence.
5. State: successful restoration across reload, mode switch, source revision and intermittent errors in the named scenarios.
6. A11y: no critical keyboard/VoiceOver/focus errors; usable at 200% zoom; target size and safe areas; all tasks doable without audio or dragging.
7. Companion and documents: existing Quiz success animation still works; original teacher document open/download/print remains accessible whenever permissions and retention allow.
8. Learning transfer: observed learners can start an independent Coach/Practice attempt from the finished lesson; distinguish perceived delight from genuine learning transfer.

Pilot with at least one beginner elementary cohort and one beginner college cohort, with representative source fixtures and guardian approval where appropriate. Measure action completion, assistance requests, mis-taps, abandonment, and post-lesson independent performance without logging student speech/audio or raw responses.

## 11. Definition of UI release readiness
- There is a usable Start learning flow for a brand-new topic, not merely a refreshed chat transcript.
- Source Spotlight and multimodal input have safe alternatives and truthful failure states.
- Existing Coach grading, Quiz celebrations, topic scope, original document access and mastery trust are intact.
- UI runs as the same V2 device identity on phone, tablet, desktop and future native iOS/iPadOS, with shared behavior contracts and no duplicated learning authority.
- The new Learn experience passes observed end-to-end beginner scenarios in both second-grade government and college physics.

## 12. Engineering handoff
Owner mapping, not carte blanche to rewrite: apps/web/components/room/workspace.tsx (mount/nav), coach-panel.tsx (Learn/Coach surfaces), learn-panel.tsx (source-grounded Learn baseline), studigo-composer.tsx (speech adapter/action shell), citations.tsx (source tickets), components/companion/* and lib/companion-logic.ts (existing companion), docs/DESIGN_SYSTEM.md (UI contract). Align with GL instructional contracts and docs/PRODUCT.md before editing.

For each UX-series PR: include relevant prototypes/screenshots at 375px and 1024px or larger; demonstrate the intended user interaction; add focused UI tests and accessibility evidence; show unchanged grading/source/privacy boundaries; merge only after dependencies pass. No autonomous main/production merge from this plan.

Suggested first Codex assignment: UX01. Output a navigable static design prototype + screen/state map rooted in existing Studigo components; no backend changes. Then implement UX02–UX03 as the smallest feature-flagged vertical slice, not as isolated decorative mockups.

External accessibility grounding
- W3C WCAG 2.2 AA SC 2.5.8 (24×24 CSS px target size or exceptions): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- W3C WCAG 2.2 AA SC 2.5.7 (non-drag alternative): https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements

Final product standard: A learner opens unfamiliar material, presses Learn, immediately sees a concrete mission objective and a first action, finds evidence and responds by tap/speech/type as appropriate, receives helpful feedback, resumes reliably, and enters independent practice without conflating assisted learning with mastered knowledge.
