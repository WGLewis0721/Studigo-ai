# Phase 3 UI reference lock — Refero and 21st.dev

**Status:** Research and adaptation decisions, 2026-10-14. This is not permission to ship another product's art, screenshots, typeface or code. Read `docs/DESIGN_SYSTEM.md`, `docs/brand/README.md`, and `docs/ux/STUDIGO_V2_PHASE3_UI_ART_DIRECTION_PLAN.md` first. The official Studigo tokens and canonical mascot override every reference below.

## Design brief and source hierarchy

Designing an evidence-led, touchable guided learning interface for elementary and college beginners on responsive web, with later iOS/iPadOS use. The learner should find a first action, see the source supporting a claim, answer by tap/speech/type, get useful help, and move to independent work. The approved Phase 3 brand board and the user's green/red/blue annotations are the visual target. Refero gives craft and product precedents; 21st.dev gives implementation candidates, subject to code/license review.

Refero research covered four style directions (physical playful product, education, structured academic, workshop), four screen queries (lesson choice, resume, speech, source reading), and four flow queries (quiz, voice, highlight, lesson start). The short list below intentionally rejects visual averaging.

## Reference lock

- **Primary precedent:** [Playdate](https://play.date), Refero style ID `c91209ef-f7f3-4d2b-bf69-41b58e4e2cc2`. Keep the feeling of an authored, collectible object: sturdy geometry, direct color fields, physical controls, a restrained neutral field, and crisp product presentation. Adapt to Studigo's existing Snow/Graphite and named shell/mode palette. Do not use Playdate's yellow, violet, Roobert, photographs, product shape or artwork.
- **Secondary, bounded precedent:** [Duolingo](https://duolingo.com), Refero style ID `9457a848-2905-4fe8-bb58-e168049120cf`. Borrow the clearly pressable key and one-question-at-a-time phone focus. Studigo's molded key already defines subtler top gloss, bottom lip and 1px press; do not import Duo green, Feather, DIN Round, owl, badges or confetti as a default lesson state.
- **Secondary, bounded precedent:** [Quizlet](https://quizlet.com), Refero style ID `d6523b05-a53f-4a2a-8829-d65a5c3724e9`. Borrow the quiet canvas beneath visibly distinct learning destinations. Use Studigo's Learn/Coach/Practice roles and exact tokens, not Quizlet violet, Hurme, pastel illustrations or a generic grid that hides the current objective.
- **Utility reference:** [PostHog](https://posthog.com), Refero style ID `13bc10c0-3cf9-4feb-8bf8-bfdd123931fc`. Its disciplined workstation framing, clear navigation and contained illustration are useful for desktop information architecture only. Do not inherit its compact 4px radius, marigold CTA, IBM Plex or three-column density on a child's lesson.
- **Media rule:** Real app evidence is rendered as a first-class, matte reading pane; the canonical Studigo companion is a bounded supportive presence. No generated hardware/mascot mockup becomes a runtime component. Decorative assets cannot carry essential text, citation facts or controls.

## Product-screen and journey ledger

| Studigo decision | Observed reference | Adaptation and boundary |
| --- | --- | --- |
| A phone lesson shows one objective, current question, progress and bottom action. Selection is distinct from submission. | [Imprint quiz feedback screen](https://refero.design/screens/0db39eb7-fc9a-4f19-8f8a-29e0808c944d); [18-step Daily Quiz flow](https://refero.design/flows/5647) shows first view → selected answer → submit → feedback → next → summary. | Use the step sequencing and clear state changes, but no automatic correctness reveal before submit. Learn feedback is formative; no score or mastery claim from a Learn checkpoint. Replace source colors and generic card styling with Studigo's materials. |
| A verified citation opens the exact passage and preserves the lesson return point. Desktop can dock the source beside instruction; phone uses a source sheet. | [Matter reading + highlighted passage + notebook](https://refero.design/pages/5cb30d29-46c3-444d-bbf7-10f1e37906f8); [Perplexity source side panel](https://refero.design/pages/ac31df3b-1a8e-4870-862e-b3ba51b41329). | Use passage prominence and source metadata. A highlight must correspond to a real source span, with document name and page/section. Do not copy Matter's content, serif article styling or Perplexity's chat layout. Missing/stale evidence gets an honest state and original-file route. |
| Voice capture is visibly recording, stopping, processing and reviewing; transcript is editable before submission. | [Voicenotes expanded transcript sheet](https://refero.design/screens/bbe0163f-daea-4822-8acc-a6b8014e225e) and [9-step Record and Transcribe flow](https://refero.design/flows/14264). | Reuse the conceptual separation of recorder controls and transcript review. Avoid live multi-speaker meeting UI; Studigo asks for a short answer. Permission denial, processing failure and retry need text-first alternatives. |
| Read-aloud settings or listening progress should not erase a learner's place. | [ElevenReader theme/read-aloud flow](https://refero.design/flows/9177). | Offer a compact persistent play/pause and passage text, with speed/reduced motion as optional controls. The original content remains readable and selectable. |
| A completion state gives one coherent next action. | [Busuu lesson-complete screen](https://refero.design/pages/629f1da8-27f7-4630-93ac-1be3532ebe52), [Imprint flow final summary](https://refero.design/flows/5647). | Use a concise completion summary and a Coach/Practice handoff. Do not infer a streak, score, grade or mastery from completing Learn. Keep confetti out of the core lesson unless separately approved. |

## 21st.dev acquisition candidates

These are **candidates for code study**, not bundled assets. The current `apps/web/package.json` has no Radix, Lucide or Motion dependencies. Each imported package must be justified against the existing code and the repo's dependency policy. Build Studigo-specific styling and semantics regardless of primitive.

| Need | Candidate and source | Decision |
| --- | --- | --- |
| Named objective stages | [Origin UI stepper, titles and descriptions](https://21st.dev/@originui/components/stepper/with-titles-and-descriptions), page lists source `21st.dev/originui/stepper` and MIT license. | Study keyboard/ARIA and structure for Brief → Show → Try → Check. Adapt to non-linear current/complete/locked stage states. Avoid additional icon dependency merely for the rail; make the approved Studigo rail in CSS/SVG. |
| Learn/Coach/Practice selector | [Halaska segmented control](https://21st.dev/@halaska-studio/components/segmented-control), page lists [upstream source](https://github.com/Halaska-Studio/ui/blob/main/halaska-kit/src/site/examples/components/segmented-control.jsx) and MIT copyright Halaska. | Useful sliding-thumb pattern. Adapt existing mode switch rather than replacing behavior. Three labeled options must remain keyboard reachable and announce selected mode; orange/teal/graphite color alone is insufficient. |
| Pressable controls | [Tactile 3D Button](https://docs.21st.dev/@bidyut10/components/three-d-button) and [3D Button](https://21st.dev/@yashsehgal/components/3d-button) as pattern references. | No code copied yet. Studigo's existing molded-key spec owns radius, gloss, lip and pressed travel; write a small shared key primitive from those tokens. Check each author's individual license before any verbatim import. |
| Read-aloud waveform and transport | [Ruixen WaveformPlayer](https://21st.dev/@ruixen.ui/components/waveform-player), seekable responsive waveform. | Study transport and elapsed/remaining behavior. Prefer native audio state + keyboard accessible range input; waveform is enhancement, not sole progress indicator. Do not use demo audio. License not verified for import. |
| Source sheet/drawer | [Scrollable Sheet](https://21st.dev/@sean0205/components/sheet/scrollable) uses dialog composition; [21st sidebar pattern research](https://21st.dev/blog/react-sidebar-component-examples). | Assess focus trap, return focus, escape, scroll containment and safe area. A plain accessible dialog/sheet may be smaller than a new UI library. Do not paste the marketplace demo, metadata, screenshot or typography into the app. |

**Rights/attribution gate:** [21st.dev terms](https://preview.21st.dev/terms) distinguish author-licensed component code from marketplace-owned demos/previews/media; the source and license of each component must be checked separately. Keep attribution and the original license notice if incorporating a source file. Do not commit marketplace thumbnails, preview images, audio or unrelated fonts as product assets. Refero screenshots and style descriptions are references, not redistributable Studigo assets. If a candidate's code/license is unclear, implement an original tokenized component from the observed interaction principle.

## Build-ready decision ledger

| Decision | Authority | Rule to preserve | Verification |
| --- | --- | --- | --- |
| Snow canvas, matte evidence panel, named shell/mode colors | `docs/DESIGN_SYSTEM.md` + marked brand boards; Playdate object precedent | Color conveys room/mode; never color alone. Evidence text never sits on gloss. | Compare full screens to official swatches and text contrast on composited surfaces. |
| One dominant action in each lesson state | Marked phone screens + Imprint flow | Keep answer selection, submit, feedback and advance separately visible and reachable. | Phone walkthrough with choice, voice, hint and source opening. |
| Tactile key family | Design system + Playdate/Duolingo | 14–17px rounded key, subtle top highlight/bottom lip, 1px press, visible keyboard focus and disabled states. | Touch, keyboard, pointer and reduced-motion state matrix. |
| Objective rail | Marked board + Origin UI stepper | Labeled stage names; current/complete/upcoming semantic state; no mastery implication. | Screen reader announcement and 200% zoom. |
| Source ticket and spotlight | Marked board + Matter | Exact document and page, verified passage, original-file link and return-to-lesson. | A test fixture citation opens its actual passage; stale source uses recovery state. |
| Voice response | Marked board + Voicenotes | Visible recording state, transcript review/edit, explicit submit, type/tap fallback. | Permission denied and transcription failure walkthroughs. |
| Companion | Canonical repo mascot assets + red markup | One bounded pose/slot, never overlapping text/actions or repeated as decoration. | Safe-zone overlays across phone and desktop. |
| Type | `docs/DESIGN_SYSTEM.md` | Bricolage display, Figtree UI/body, JetBrains Mono readouts; alternatives require specimen and approval. | Fallback, 200% zoom, long label and college vocabulary specimens. |

## Discarded patterns

- Do not copy a Duolingo path/streak/scoring layer or its mascot-led lesson. It conflicts with the green-marked evidence-first screens and Learn's formative boundary.
- Do not turn the full UI into a glossy translucent device shell. The user liked the blue-circled device as unsolicited exploration; matte reading content is required.
- Do not borrow the proprietary fonts or colors of Playdate, Quizlet, Duolingo or PostHog. Refero token extraction documents those brands; it is not a Studigo palette proposal.
- Do not import a component only to get a visual preview. When its behavior is simple, code an original CSS/SVG version using the approved tokens and document the inspiration here.
