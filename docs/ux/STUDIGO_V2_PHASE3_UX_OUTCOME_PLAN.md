# Studigo V2 Phase 3 — Outcome-Driven UX Delivery Plan

**Status:** Proposed delivery contract, not evidence of shipped functionality  
**Prepared:** 2026-10-14 America/Chicago  
**Product outcome:** A student uploads unfamiliar class material, presses **Learn**, and is guided to an independent attempt without needing to invent a prompt or have another person operate Studigo.

This plan consolidates the two shared Guided Learning Experience and UI/UX chats, the existing [Guided Learning Outcome Plan](https://chatgpt.com/s/t_6ad03c6ebc388191a6057d24753b0d61), the [Guided Learning UI/UX Plan](https://chatgpt.com/s/t_6ad03c45e6c88191b5d55ae00542cc89), and the repository's product/design contracts. GL01–GL10 and UX01–UX10 remain the detailed implementation cards. This document defines the **outcome gates and delivery order** for Studigo V2 Phase 3; it does not replace the document-learning C-series queue or declare any GL/UX item complete.

## 1. The experience contract

| Activity | Job for the learner | Authority |
| --- | --- | --- |
| **Learn** | Discover and understand an unfamiliar concept through a guided mission. | Formative steps and checks; no official mastery writes. |
| **Coach** | Apply the concept, ask for help, recover from mistakes, and improve. | Existing assessment rules account for hints and response modality. |
| **Practice** | Demonstrate understanding independently. | Existing graded attempt and mastery authority. |

The teacher's study guide sets the learning scope. Uploaded material supplies evidence. The learner's corrections remain authoritative. The same instructional system must support a first-time second-grade government lesson and a first-time college physics lesson, varying academic complexity and topic familiarity **independently**.

The mission sequence is **Briefing → Foundation → Demonstration → Learner action → Formative checkpoint → Advance/reteach**. The compact UI may show **Brief · Show · Try · Check**, but the underlying mission cannot skip a needed foundation or claim that an ungraded check proves mastery.

## 2. Outcomes and acceptance evidence

| Outcome | What the student can do | Net-new work | Acceptance evidence |
| --- | --- | --- | --- |
| **O1. Begin without a prompt** | Open a ready room, start one concrete objective in one action, and resume the same step after leaving. | GL01–GL03; UX01–UX03: revision-bound mission blueprint, deterministic director, Mission default view, entry/resume, lesson player. | Both beginner fixtures complete a full first concept without free-text prompting; the first meaningful learner action appears within one minute; pause/reload/retry restores the exact cursor without duplicate advancement. |
| **O2. See where teaching came from** | Tap **Find it**, inspect a verified passage and page, and return to the active lesson. | GL04; UX04: Source Spotlight on a phone sheet or wide side pane, original-file link, honest partial/missing evidence states. | Every source-grounded fixture fact traces to an eligible current source block; stale, OCR-uncertain, missing and deleted evidence never display a fabricated quotation or precise highlight; cross-account access is denied. |
| **O3. Respond without typing** | Choose, select evidence, or speak when the task supports it; review a transcript before submitting. | GL05–GL06; UX05–UX06: task-sensitive answer dock, tap contracts, mic lifecycle, edit/retry/fallback. | Elementary fixture completes a formative concept with taps alone; a real mobile Coach answer can be spoken, reviewed, edited and submitted; denied mic/silence/network failure never consumes an attempt or silently submits. |
| **O4. Get help at the point of need** | Request a hint, another example, **Read to me**, or a source view without losing the step. | GL07–GL08; UX07–UX08: on-demand read-aloud, contextual help, restrained canonical companion reactions. | Text-only flow remains usable; read-aloud can stop/replay; hints remain recorded as assistance; existing graded success celebration survives; reduced motion, sound-off and hidden companion do not block progression. |
| **O5. Recover and transfer** | Retrieve the unchanged teacher file, then choose an independent Coach or Practice attempt in the same topic. | GL09–GL10; UX09: original-file controls and explicit assessed handoff. | Original opens/downloads/prints in at most two actions from Materials where supported, distinctly named from the generated guide; source/topic scope survives handoff; zero Learn-only or heavily assisted formative events increase official mastery. |
| **O6. Prove real learning** | Finish a mission and attempt a new question without lesson guidance. | GL10; UX10: cross-device acceptance and two-cohort pilot. | Observed elementary and college beginners can start, act, recover, find evidence and transfer without a facilitator operating the app; independent first attempts are measured separately from lesson completion and delight. |

These are **pilot targets**, not current performance claims: at least 80% of tested beginners in *each* cohort should enter and complete a first concept unaided; at least 80% should find a cited passage via **Find it**; 100% of tested source-grounded facts should resolve to eligible evidence or disclose its absence; zero Learn events should alter official mastery.

## 3. Delivery sequence and gates

### Wave 1 — A playable teaching mission

**Order:** UX01 screen/state contract → GL01 mission plan → GL02 director/persistence → UX02–UX03 player, with a thin verified GL04 source link. Preserve the current Coach/Learn switch, Learn Chat/Topics access and selected study-guide scope. Begin with a flagged government concept, then prove the same components can teach introductory college physics without child-level simplification.

**Exit gate:** A novice can press **Start learning**, see a brief objective, receive a sourced demonstration, act, get formative feedback, and resume after reload. Software decides transitions; generated text cannot award progress or mastery. The source revision and evidence outcome are explicit. If this gate fails, do not polish the rest of the interface as if the mission exists.

### Wave 2 — Evidence and low-friction response

**Order:** Complete GL04/UX04 → GL06/UX05 tap choice and evidence selection → GL05/UX06 reviewed speech. Add ordering only when it represents the source material and has an accessible equivalent. **Find it** must not reveal protected answers in assessed Coach/Practice states.

**Exit gate:** The elementary mission works without a keyboard, source passages are verifiable, and a mobile Coach voice answer passes through review and the existing grading path. Permission failure and a bad transcript recover without grading or duplicate cost.

### Wave 3 — Comfort, character, and original material

**Order:** GL07/UX07 read-aloud and contextual help → GL08/UX08 existing companion integration → GL09/UX09 original-file recovery and clear practice transition. Keep feedback brief and optional.

**Exit gate:** A learner can hear permitted content on demand, continue with speech disabled, retrieve the original teacher document even if a generated guide fails, and recognize the current Studigo companion without a replacement mascot or interruptive animation.

### Wave 4 — Learning transfer and release decision

**Order:** GL10/UX10 cross-device and real-learner acceptance, then a limited flagged rollout. Preserve the old Learn path as fallback until the new one clears the gates.

**Exit gate:** Both novice cohorts complete a mission and attempt independent work in Coach/Practice with the same topic and valid source revision. Source trust, mastery integrity, accessibility, privacy, spend and recovery scenarios pass on the accepted commit. Release based on observed behavior, not finished task counts or attractive mockups.

## 4. Required UI surfaces and states

1. **Mission start/resume:** one primary action; optional reversible “I know some of this” or “Let me try”; no blank prompt or long onboarding form.
2. **Lesson player:** compact objective and position rail, one matte reading stage, one meaningful action, contextual help, Back/Next/Pause, optional Chat/Topics. Progress rail means *lesson position*, not mastery.
3. **Source Spotlight:** verified excerpt, document/page, current revision, open original, return to the same step. Use a phone bottom sheet and wide side pane. If location precision is uncertain, show an honest page/section rather than a fake highlight.
4. **Answer surface:** tap choices/evidence and text fallback; speak only after a user action, then stop → transcript preview → edit/retry/submit. No auto-record or auto-submit.
5. **Checkpoint and handoff:** “You practiced X” plus assistance/source context; Next, Review, Try with Coach, Practice independently. Distinguish formative success from assessed mastery.
6. **Materials recovery:** Open/Download/Print **original** and Download **Studigo guide** are plainly separate; partial processing does not hide an older eligible original.

Every surface needs ready, loading, empty, partial OCR, missing source, stale revision, permission denied, offline/provider failure, resumed and reduced-motion states where relevant. One primary action remains visible on a phone, while tablet/desktop may dock evidence beside the lesson. New touch actions target at least 44×44 CSS px; keyboard, screen reader, 200% zoom and non-audio alternatives remain functional.

## 5. Architecture and trust boundaries

- Reuse existing ingestion/OCR, source blocks, topic map, guide edition, retrieval, Coach director, graded attempts, companion assets, private files, RLS and provider admission. Confirm each dependency at the implementation branch before assigning a card; historic task labels are not proof of current deployment.
- Add only the instructional layer: a typed, revision-bound `LearningMissionPlan`; deterministic session reducer and durable cursor; validated activity/view models; source-anchored UI; answer modality and assistance metadata. No second corpus, mastery engine, chatbot stack or mascot controller.
- Software owns authorization, source eligibility, permitted actions, progression, receipts and grading. AI supplies bounded, source-grounded teaching language and examples. Unsupported prerequisites are disclosed or taught as clearly labeled general background only with explicit learner choice.
- Uploaded content is untrusted. Voice uses the existing spend/concurrency guard; no raw child audio retention by default. Analytics capture privacy-safe transitions, not original text, audio or raw answers.
- Feature-flag the new Guided Learn path. Preserve the existing Learn experience and a rollback route through the pilot.

## 6. Validation and decision record

The acceptance package for each wave includes a phone and wide-screen capture, a working interaction demo, focused behavior tests, accessibility evidence, source/authorization tests where applicable, and a short **DONE / NOT DONE / BLOCKED** conclusion. The final pilot uses representative government and introductory mechanics materials, plus source replacement, partial OCR, microphone failure, refresh/retry and a learner returning after interruption.

Record separately:

- **Usability:** unaided start, time to first action, Find-it success, tap/voice recovery, abandonment.
- **Learning:** a baseline unassisted check when practical, help used, and first independent Coach/Practice attempt after instruction.
- **Integrity:** evidence provenance, stale-source rejection, duplicate-event prevention, zero formative mastery writes.
- **Experience:** companion delight without blocked actions; original-file recovery; accessibility and reduced-motion parity.

If learners complete screens but cannot explain or apply the concept independently, Phase 3 has not met its product outcome.

## 7. Visual direction and next assignment

Use the [official brand foundation](../brand/STUDIGO_OFFICIAL_BRAND_BOARD.png) for tokens and current assets. The [Phase 3 visual concept](../brand/STUDIGO_V2_PHASE3_VISUAL_BRAND_BOARD.jpg) expresses the green-marked editorial treatment—palette, tactile controls, desktop/phone composition and visible evidence—but its generated copy, sample learner and exploratory wordmark are **not** implementation specifications. Use the [guided learning application](../brand/STUDIGO_GUIDED_LEARNING_BRAND_APPLICATION.png) for proposed screen relationships, then verify each interaction against this outcome contract and the GL/UX plans.

**First implementation assignment:** UX01 and the thin GL01/GL02 contract. Produce an approved screen/state map and a navigable fixture prototype, then implement UX02–UX03 as one flagged vertical slice. Do not start with mascot polish, a broad new navigation system, or a screen-only rewrite. The first review must show an actual beginner mission reaching an ungraded checkpoint and resuming correctly.
