# Studigo — Foundational UX and Web Design Principles

**Status:** normative cross-product design policy, effective across all current and future surfaces.  
**Scope:** marketing site, signup/onboarding, Home, Study Rooms, Learn → Explore, Coach, Materials, Practice, Progress, Plan, settings, responsive iPhone/iPad/desktop layouts, and companion/game shell where the same interaction patterns apply.  
**Identity authority:** [Studigo Design System](../DESIGN_SYSTEM.md), [official brand board](../brand/STUDIGO_OFFICIAL_BRAND_BOARD.png), and [reconciled design inventory](../../design/README.md).  
**Implementation plan:** [Cross-Device Visual Unification](STUDIGO_CROSS_DEVICE_VISUAL_UNIFICATION_PLAN.md).

## Fundamental separation

**Principles are the foundation. Brand and aesthetics are the expression.** The seven web-design fundamentals and relevant Laws of UX apply *regardless* of whether Studigo uses an orange dragon, glossy molded keys, a Snow reading surface, playful motion, or a future approved visual direction. They should not be interpreted as visual trends or optional inspiration. Changing colors, art, textures, or shapes never waives hierarchy, clarity, navigation consistency, reachability, readable contrast, or cognitive-load management.

Laws of UX describe useful design heuristics rather than guaranteed numerical outcomes. Apply each where its underlying user-task conditions are present; validate ambiguous trade-offs against user tasks, accessibility and measured behavior. WCAG and data integrity are hard constraints, not optional heuristics.

### The seven web-design pillars

Concrete CMS's [7 Fundamentals of Web Design](https://www.concretecms.com/about/blog/web-design/7-fundamentals-of-web-design) identifies **unity, balance, hierarchy, contrast, emphasis, scale and repetition**. They apply to every interface layer:

| Pillar | Always-on Studigo interpretation | Review evidence |
|---|---|---|
| **Unity** | A learner recognizes a single product across every route, device, state, and companion placement, even when shell colors or activities differ | Compare shared UI tokens, layout grammar, navigation and state semantics |
| **Balance** | Content, action rails, art, metadata and companion have deliberate visual weight; no secondary panel competes with the learner's present task | Review at 320/390/820/1440 and with content/keyboard shown |
| **Hierarchy** | One primary task/action and obvious sequence: what this is, what to do, what happened, what's next | Five-second comprehension test, heading/DOM order, initial focus |
| **Contrast** | Critical content/controls remain distinguishable in normal/dark/reduced-motion/zoom states; not color-only meaning | WCAG contrast, focus, disabled/error and touch-state checks |
| **Emphasis** | Only the relevant next action claims visual priority; highlights are meaningful, not a field of competing badges and buttons | Primary CTA audit; no redundant callouts, panel headings or duplicate summaries |
| **Scale** | Type, tap targets, reading space and density adapt to age, distance, screen and zoom without losing affordances | 200% zoom/text, 44px minimum touch keys, reading length/overflow |
| **Repetition** | Reuse the same grammar for cards, controls, dialogs, source inspection, states and transitions | Component reuse matrix; drift audit across five Study Room modes |

### UX laws as operating standards

Definitions/source: [Jon Yablonski's Laws of UX](https://lawsofux.com/) and the [linked Laws of UX PDF](https://promptcraze.com/wp-content/uploads/2025/02/lawsofux.pdf) provided in product direction. The linked PDF was too large to verify in full through the web reader, so the implementation mapping here follows the author's public law definitions rather than claiming a full line-by-line reading of that PDF.

| Relevant law(s) | Invariant design behavior | Example verification |
|---|---|---|
| **Jakob's Law, mental models** | Preserve familiar navigation, return/back, search, file upload and lesson controls; brand expression cannot obscure their function | No extra user training needed for core flows; consistency across surfaces |
| **Hick's Law, choice overload, selective attention** | Present only the meaningful immediate decisions; reveal secondary tools by context without hiding safety/evidence | No three competing primary actions; count choices on first interaction |
| **Fitts's Law** | Maintain comfortably large reachable actions, gaps and stability; compact icon artwork does *not* imply a tiny hit target | Active tap targets ≥44×44 CSS px where applicable; nonoverlap |
| **Proximity, similarity, common region, uniform connectedness** | Related source, question, answer, feedback and action form clear groups; repeated cards mean the same thing | DOM and visual reading order agree, no disconnected evidence panels |
| **Chunking, cognitive load, working memory** | Organize lessons and setup into digestible steps; keep necessary task context visible so learners need not remember it | Task completion without repeatedly returning to notes or settings |
| **Tesler's Law / Occam's Razor** | Simplify perceived complexity without deleting necessary functionality, source provenance, revision checks or grades | Data authority preserved; no fake success or fabricated progress |
| **Aesthetic–Usability Effect** | Polish supports trust and clarity, but attractiveness never excuses poor legibility or broken flows | Test functionality with animation disabled and under keyboard/screen reader |
| **Doherty Threshold** | Respond promptly to taps and submissions; show honest processing/recovery rather than silent waits | Immediate local pressed/pending response; measure wait on representative devices |
| **Goal-Gradient Effect, Peak–End Rule, Zeigarnik** | Show truthful saved progress, resume and helpful completion; avoid psychological pressure or manipulative scarcity | Progress tied to persisted state; safe pause/return and clear finish |
| **Von Restorff Effect, serial position** | Make the relevant next action visibly distinct and put critical instructions where seen, without over-highlighting everything | Audit start/finish screens and CTA dominance |

## Nonnegotiable quality gates

1. **Universality:** Every new or redesigned surface must cite which pillars and laws informed its structure **before** visual styling is approved. Existing production screens are assessed against the same standards; no grandfather exemption.
2. **Functional hierarchy:** One obvious next action for each state; no duplicate mode/tab controls, redundant lesson summary or tooltip-only essential instruction.
3. **Accessibility:** WCAG 2.2 AA intent, keyboard/focus and screen-reader labels, 44px touch target where appropriate, supports zoom and accessible language. Color and motion are redundant cues only.
4. **Progress and learning truth:** Source excerpts remain authorized and revision-safe; no decorative scoring, fake mastery/XP, or progress disconnected from persisted lesson phases. Companion may delight, not block content.
5. **Responsive evidence:** Test 320px, 390px, 820px and 1440px alongside keyboard, 200% text/zoom, reduced motion, dense/empty/loading/error/paused states and accessible navigation. Establish screenshots from actual builds, not only concept renders.
6. **Measured exceptions:** When principles compete (e.g. large touch targets vs limited iPhone space), document the learner outcome and chosen trade-off; accessibility, security and content truth take precedence.
7. **Approval traceability:** Visual variants are welcome within these constraints. Each PR identifies source assets, existing component owners, provenance/rights, states, device evidence and review decision. The same design law is not reimplemented as a new styling dependency on every page.

### Build the house in the right order

1. **Structure**: architecture, real user tasks, information grouping, correct data states.
2. **Principles**: universal hierarchy, cognitive load, accessible interaction and response.
3. **Brand expression**: official colors, tactile surfaces, fonts, iconography and Studigo mascot.
4. **Polish**: responsive rhythm, helpful motion, audio/haptics and delight.
5. **Validation**: side-by-side screenshots, working interaction tests, a11y checks, real learner acceptance and rollback plan.

No V1 design revival, replacement dragon, icon redesign, or new component library is implied by adopting the principles. Do not start redesign implementation solely because this document exists.
