# Guided Learn — Five-Chapter Visual Acceptance Ledger (2026-10-16)

**Status:** five review branches implemented and stacked as drafts; production not activated. Do not equate synthetic green with a signed-in, age-appropriate release. The earlier #191 Guided Learn pause remains authoritative.

## Reference lock

**Primary authority: Studigo's verified live UI and existing design system**, not a new brand or copied component kit. Preserve the orange Studigo dragon, Coach/Learn mode switch, tangerine Coach rail, source teal, molded button/card geometry, room theme, existing student-content permission boundaries, fixed phone action reach, and native-looking iPad/desktop hierarchy.

Secondary references, bounded by job:

| Reference | Real source | Studigo adaptation | Exclusion |
|---|---|---|---|
| Refero Duolingo style and Brilliant iOS onboarding | Refero styles `fad6cd55-121c-4050-bfa9-f7cccbf81d78`; flow `4316` | clear first action; friendly companion encouragement; no blank onboarding form | do not copy their palettes, gamification economy or paywall |
| Refero Imprint first lesson and Read/Quiz/Reward | Refero iOS flows `5636`, `5644` | short concept → example → one tap action → feedback → next, with visible progress | ungraded Learn never mints XP/mastery |
| Refero voice and reader screens | Refero Voicenotes `97f2df3c-8378-4f3a-9b06-addd30a0d83a`; Matter `17c03d5a-0704-4802-bcd9-d7032dd04fb0` | explicitly controlled record/transcript/confirm; restrained source reader | no continuous listening, auto-send, invented PDF highlights |
| 21st.dev Stepper | https://21st.dev/community/components/nyxbui/stepper/default | short server-bound sequence and prior/next clarity | do not import a second state machine or extra dependency |
| Pinterest education interaction sketches | https://www.pinterest.com/pin/gamified-learning-app-ui-in-2025--229472543509420844/ | reference only for mobile card grouping / thumb reach | never use an unlicensed illustration or off-brand asset |
| Google Material communication | https://codelabs.developers.google.com/codelabs/material-communication-guidance | labels by user task: Start learning, Find it, Check, Back | no jargon, icon-only essential actions, or new dashboard |
| Apple HIG privacy, accessibility and iOS | https://developer.apple.com/design/human-interface-guidelines/privacy/ ; https://developer.apple.com/design/human-interface-guidelines/designing-for-ios/ | request microphone only at use time; accessible action targets; mobile bottom-sheet | no microphone prompts at launch; no voice claims before physical-device testing |
| Apple App Store Brilliant listing | https://apps.apple.com/us/app/brilliant-learn-math-coding/id913335252 | reusable interactive tutoring cadence across grade levels | do not represent commercial learning outcomes as proven for Studigo |

The above names and URLs document inspiration and patterns—not replicated pixels, external code, or licensed assets.

## Chapters and screenshot acceptance

| Chapter | PR | Review object | Intended screenshots | Implementation verification |
|---|---|---|---|---|
| 1: Invitation | #208 `feat/gl-ch1-mission-invitation` | Source-aware first-use/returning mission entry | `*-guided-learn-invitation-phase3.png` | CI/security/visual already green for Chapter 1 |
| 2: First lesson | #209 `feat/gl-ch2-durable-lesson-player` | Server-owned stages, Back/Pause, resume and formative tap | `*-guided-learn-first-step-phase3.png`, `*-choose-phase3.png`, `*-paused-phase3.png` | Chapter 2 CI/security/visual green |
| 3: Find it/Try it | #210 `feat/gl-ch3-source-and-tap` | Page-grounded source pane/sheet and assisted hint | `*-source-phase3.png`, `*-hint-phase3.png` | Chapter 3 CI/security/visual green |
| 4: Speak/Listen | #211 `feat/gl-ch4-voice-readaloud-companion` | Visible opt-in transcript review and on-demand read-aloud | `*-voice-consent-phase3.png` | Chapter 4 CI/security/visual green; real voice not proven |
| 5: Independence | #212 `feat/gl-ch5-recovery-independent-handoff` | No mastery claim, handoff to existing Quiz/Coach, distinct original links | `*-handoff-phase3.png`, `*-original-recovery-phase3.png` | Wait for exact-head CI/security/visual |

Each `*` must be evidenced at 320px, 390px, 820px and 1440px for the same commit, plus legacy-vs-Phase3 regression. Screenshots are local synthetic fixtures, not real learner data.

## Explicit release blockers

1. Original source eligibility and source-revision changes proven with authenticated existing learner room, including stale/partial/revoked evidence and RLS.
2. Full lesson action persistence, multiple topics, interrupted generation, retries, browser reload and double-action races proven on backend; unit tests are not a substitute.
3. Actual iPhone/iPad speech recognition, permission denial, locale, safe youth notice/consent, read-aloud interruption, device dictation fallback.
4. Keyboard, VoiceOver, dynamic type/200% reflow, reduced-motion, no covered touch targets; test mobile screenshot and real hardware.
5. Independent grading and mastery separation audited end to end. No fabricated citations, no altered spend ceilings and no duplicate private file exposure.
6. Actual beginner elementary and introductory university learner pilot with observation, not a claimed automated proxy.

**Merge sequence:** #208 → #209 → #210 → #211 → #212, one accepted and rebased onto main at a time. Keep production signed-in Guided Learn disabled until the complete release gate passes. This document is the one acceptance ledger; avoid duplicating another roadmap.
