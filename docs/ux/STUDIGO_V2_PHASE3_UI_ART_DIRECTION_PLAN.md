# Studigo V2 Phase 3 — Artistic UI Outcome Plan

**Status:** Proposed art direction and production handoff; no UI shown in a generated board is claimed to be shipped.  
**Owner of visual approval:** Product/design owner.  
**Repository:** `WGLewis0721/Studigo-ai`  
**Primary product outcome:** A learner recognizes Studigo instantly, knows what to press next, can read and trust the lesson's evidence, and feels that Learn, Coach, and Practice belong to one deliberately crafted product on phone and wide screens.

This is the **artistic companion** to [`STUDIGO_V2_PHASE3_UX_OUTCOME_PLAN.md`](STUDIGO_V2_PHASE3_UX_OUTCOME_PLAN.md), GL01–GL10, and UX01–UX10. Those plans own teaching behavior and state. This plan owns visual identity, asset production, component language, responsive composition, and design acceptance. A future GitHub-connected design or coding tool can execute it from the links and deliverables below without depending on this chat.

## 1. Source hierarchy and markup interpretation

Read these in order before drawing or coding:

1. [`docs/brand/README.md`](../brand/README.md), [`STUDIGO_OFFICIAL_BRAND_BOARD.png`](../brand/STUDIGO_OFFICIAL_BRAND_BOARD.png), and [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md): approved identity, exact color/typography/material rules, companion, and accessibility. Current implementation must be checked separately.
2. [`STUDIGO_GUIDED_LEARNING_BRAND_APPLICATION.png`](../brand/STUDIGO_GUIDED_LEARNING_BRAND_APPLICATION.png): a proposed relationship among mission, evidence, actions, and phone layout.
3. [`STUDIGO_V2_PHASE3_VISUAL_BRAND_BOARD.jpg`](../brand/STUDIGO_V2_PHASE3_VISUAL_BRAND_BOARD.jpg): exploratory art direction based on the user's marked boards. Its tiny copy, orange/teal lettering, learner persona, screenshots, and invented mascot are not approved product assets or source evidence.
4. The user's three marked reference boards: **green = desired element or treatment; red = reject; blue = liked but unsolicited exploration**. If the markup and generated mockup conflict, follow the markup. Do not trace generated text as fact.
5. Inspect the live implementation and exact asset sources before reuse: `apps/web/app/layout.tsx`, `apps/web/app/globals.css`, `apps/web/components/room/`, `apps/web/components/mode-glyph.tsx`, `apps/web/components/studigo-mascot.tsx`, `apps/web/components/companion/`, `apps/web/public/mascot/`, and `docs/brand/mascot/`. Locate the actual current routes/components before changing them.

| From the marked boards | Keep / interpret | Production boundary |
| --- | --- | --- |
| Green: generous palette panels, named swatches, tactile material specimens, mode switch, objective rail, action keys, answer choices and citation ticket | Build a cohesive system of color, depth, controls, evidence, and progress. Keep the lesson itself calm and readable. | The official token values and role mapping in `DESIGN_SYSTEM.md` win over inconsistent generated hex labels. Tactile specimens describe digital UI materials, not a physical device requirement. |
| Green: desktop home, guided lesson, source spotlight; phone choice, voice, review, success, hint, read-aloud, completion | Produce connected screen families with consistent navigation and component states, not a collage of unrelated screens. | Use realistic fixture data labeled illustrative; a citation must resolve to the fixture source before a screen is accepted. |
| Green: practical promise, source-backed learning and prominent Studigo lettering | Make identity and evidence visible without filling every screen with branding. | Preserve current approved identity until a proposed vector wordmark is compared and explicitly approved. Do not ship the generated orange/teal wordmark by default. |
| Red: replacement dragon, mascot galleries, repeated character appearances, mascot-led lesson panels; crossed-out material collage | Use only canonical orange scholar art and existing companion logic. Let the lesson and evidence lead. | One companion placement at a time; it never covers text or actions. No new mascot, app icon, or decorative hardware artwork from generated imagery. |
| Blue: device mockup and typography/wordmark exploration | Can inform a separate future presentation study. | Do not make the device shell a prerequisite for Phase 3 UI. Evaluate type alternatives only through explicit comparison and approval. |

The boards include a green Poppins/Inter sample in one reference and blue Bricolage/Figtree/JetBrains in another. The repository currently specifies and loads **Bricolage Grotesque / Figtree / JetBrains Mono**. Produce a specimen comparison if the green typography treatment appears to demand a change; do not silently replace the font stack or call the generated labels authoritative. Start by changing hierarchy, sizing, weight and spacing within the existing faces.

## 2. Artistic thesis and visual outcomes

**Artistic thesis:** Studigo feels like a colorful personal learning device translated into modern software: Snow space, vivid room and mode identities, matte reading surfaces, translucent navigation, molded keys, restrained dark readouts, and a companion who belongs beside the work. The interface is useful before decorative, modern before retro, and appropriate for a young beginner without looking juvenile to a college student.

| Outcome | Visible result | Acceptance proof |
| --- | --- | --- |
| **A. Recognizable identity** | The same color logic, type, keys, icon strokes, and evidence treatment carry from home through lesson to handoff. | A side-by-side contact sheet of desktop and phone screens reads as one product with branding hidden from the reviewer; every key visual token maps to `DESIGN_SYSTEM.md` or a documented, approved addition. |
| **B. Clear first action** | The current objective and one primary action dominate each viewport; secondary actions remain discoverable. | At phone width, a novice can point to what to press first and what the current mode is within five seconds in a moderated or unmoderated task; no critical control is below a blocked fold or under the companion. |
| **C. Evidence feels tangible** | Source Spotlight is a readable, named passage with page/section, source status and a direct route to the original. The citation ticket visually connects lesson and material. | Verified fixture passage is readable at 200% zoom; missing/stale/uncertain evidence uses a distinct honest state, never a fabricated highlight. |
| **D. Interaction feels touchable** | Mode keys, choice cards, mic, progress, hint, read-aloud and handoff share material, press, focus, disabled and loading rules. | Component matrix and working prototype cover all interactive states on touch, pointer and keyboard; motion never gates an action. |
| **E. Age-flexible warmth** | Color and feedback encourage the 8-year-old while typography, density and restrained companion usage respect a college learner. | Both age-context fixtures use the same system; only content complexity and controlled density vary. No childish replacement mascot or classroom clip art. |
| **F. Faithful across form factors** | Phone shows one focused stage and a bottom-sheet source; wide screens dock evidence beside the lesson and retain the same action hierarchy. | Paired captures at compact phone, large phone, tablet and desktop show the same objective, source and response affordances with no clipped text or horizontal scroll. |

## 3. Net-new design deliverables

### D1 — Visual inventory and decision sheet

Capture the current live home, Study Room, Learn/Coach switch, Materials, citations and mobile states. List reusable components, existing tokens, assets and gaps. Create a one-page **keep / adapt / create / retire** map with evidence links, not assumptions based on screenshots. Record the three marked boards' green/red/blue decisions in the design file. **Done when:** every major proposed UI object has an owner and a source; all invented image content is labeled concept-only.

### D2 — Art-directed system specimen

Create an editable source file plus exported PNG/PDF showing: exact named shell colors and neutral variants; typography scale and text specimens; matte page/card, recessed well, translucent navigation, molded key, dark readout; radius, border, gloss, shadow and focus tokens; icon grid/stroke; mode switch, progress rail, citation ticket, action dock, choice card and source panel. Include disabled, loading, focus, pressed, selected, correct/needs-work and error states. **Done when:** one complete specimen is reproducible with CSS/SVG and the labels match implementation tokens; contrast is checked on the actual composited surfaces, not just raw color chips.

### D3 — Production identity assets

Audit the current wordmark, logo usage, icons and canonical companion exports. If the green reference's lettering is materially stronger, draw **two to three original vector wordmark proposals** from the name Studigo, with horizontal, compact and one-color lockups, clear space, minimum size and dark/light use. Compare them with the existing approved identity before any replacement. Design a coherent icon family from `mode-glyph.tsx` rather than importing a mismatched set. Create missing icons as SVG with named paths and accessible labels when used as controls. Supply source files and export recipes. **Done when:** each proposed asset has a version, license/ownership note, use case, fallback and approval status; no generated raster lettering or unapproved app icon enters the UI.

### D4 — Connected screen compositions

Design **three wide** compositions (home/entry, guided mission, source spotlight) and **seven phone states** (mission choice, tap response, voice capture and review, helpful hint, read-aloud, formative success, handoff/completion). These are the specific green-marked surfaces, translated into a consistent component system. Add an original-file recovery state and empty/partial-source examples to the same design file. Specify layout, margins, type scale, primary-action placement, companion safe zones and the source-to-lesson return path. **Done when:** a reviewer can follow one realistic student journey across the layouts, every copied UI sentence is legible, and all passages link to a labeled fixture rather than invented evidence.

### D5 — Interaction and responsive prototype

Make a clickable prototype or isolated coded vertical slice that shows mode switch, objective progress, Find it sheet/side pane, tap answer, voice permission/transcript review, hint, read-aloud control, success, original-file access and Coach/Practice handoff. Model reduced motion and no-microphone routes. **Done when:** phone and wide-screen users can complete the same flow and see where they are, what changed and how to go back; the prototype never equates a Learn checkpoint with mastery.

### D6 — Integration package

Provide component specs, token changes, SVGs, approved typography assets or font loading instructions, state table, responsive rules, fixture copy, screenshot/contact sheet, and a short implementation map to the owning React/CSS modules. Deliver design and implementation in separate reviewable PRs if art approval is pending. **Done when:** another GitHub-connected tool can reproduce the result from repo files alone, build it behind the Guided Learn flag, and compare actual screenshots with the accepted compositions.

## 4. Asset creation rules when references are missing

| Gap | Make | Quality and provenance gate |
| --- | --- | --- |
| Wordmark or compact mark | Original vector paths or carefully kerned licensed type; variants and usage sheet. | Never trace the AI sheet's fuzzy lettering. Show side-by-side with current brand; approval before replacing a production mark. |
| Typeface coverage | First use current Bricolage, Figtree and JetBrains Mono with tuned weights/spacing. If inadequate, present a type specimen and license analysis for alternatives. | No custom font family merely to imitate image artifacts. If custom glyphs are justified, produce editable outlines, full character/locale coverage or a declared display-only scope, webfont formats, fallback, and readable test cases. |
| UI pictograms | Expand the existing icon grammar in SVG/React: common view box, stroke, optical alignment, filled active variant where needed. | Label controls in text or accessible name; test at 16, 20, 24 and high-density displays. |
| Tactile keys, rail, ticket, source panel | Build from design tokens and CSS/SVG layers with restrained highlights/shadows. | Materials must have consistent light direction and visible interactive state; no baked text in images. |
| Companion expressions | Reuse/crop only canonical transparent assets and existing reaction states. | Keep nose/face safe margin; avoid duplicate or newly imagined dragons. Approve any new canonical pose before product use. |
| Lesson illustrations | Prefer verified source diagrams or original pedagogic SVGs with cited/labeled relationships. | Distinguish illustration from source quotation. Do not invent facts or source pages for an attractive mockup. |
| Demo text/data | Small checked fixture from a permission-safe sample document and a separate college fixture. | Mark examples illustrative; no real learner uploads, private documents, or generated pseudo-citations in a public design asset. |

Store editable sources under `design/phase3/`, approved exports under `apps/web/public/brand/phase3/` or the current canonical asset location, and documentation/decision records under `docs/brand/`. Do not copy an entire design-tool export into runtime. Include a `design/phase3/README.md` with asset inventory, license, source, status (`approved`, `proposed`, `exploratory`), export command and owning component.

## 5. Composition and component rules

- **Home/entry:** a clear room and objective, a single Start/Resume key, three understandable Learn/Coach/Practice routes and material status. Color denotes place/mode, with words and icons carrying the same meaning. Avoid a dense dashboard.
- **Mission:** objective and position rail above one matte reading stage; key concept and sourced example; one action cluster within reach. The companion sits in a reserved corner and can disappear without changing layout semantics.
- **Find it:** citation ticket opens the verified passage in a sheet or docked pane. The passage is the hero, with document name and page readout, an original-file action and a clear return to the lesson. Reading content does not sit on gloss or frosted plastic.
- **Modes:** Learn teal, Coach tangerine/berry, Practice its documented mode tone. The switch reads as a segmented navigational choice, not as mastery. Keep Chat and Topics accessible per `PRODUCT.md`.
- **Answers:** tap choices look touchable; the selected state is persistent and text-labeled. The voice key shows permission, recording, stopping, transcript review, edit and retry as distinct states. The primary action is never hidden by a keyboard, safe area or companion.
- **Feedback:** formative Learn success is a small warm confirmation and a Next action, without confetti, score inflation or mastery claim. Hint/read-aloud are supportive controls and do not overpower the task.
- **Motion:** press depth, restrained panel reveal and rail update communicate change; reduced-motion has immediate equivalent states. Optional character motion cannot delay content.

Use the official radii (`8/12/16/22/30/40`), 44–58px key heights and text contrast rules. New controls need at least a 44×44 CSS-pixel target, visible focus, keyboard order and screen-reader label. Provide responsive specs in CSS pixels tied to layout breakpoints found in code; do not hardcode a particular phone model as the only design target.

## 6. Sequence and acceptance gates

| Pass | Work | Reviewable outcome / stop condition |
| --- | --- | --- |
| **1. Direction lock** | D1 inventory, exact token mapping, green/red/blue sheet, two paired hero compositions. | Product owner can approve a visual thesis that honors the green elements and excludes red elements. If a proposed wordmark/font change is unresolved, keep current approved identity and continue with layout. |
| **2. System craft** | D2 specimens and D3 original assets; tokenized component playground. | Core controls form one coherent family in normal/active/focus/disabled/loading states. Assets are editable, licensed and versioned. |
| **3. Journey design** | D4 connected wide/phone compositions with trustworthy fixture data; D5 interaction prototype. | A novice can identify the current mode, next action and source; phone/wide layouts complete the same lesson path without occlusion. |
| **4. Product integration** | D6 package and flagged UI implementation, screenshot comparison, accessibility/behavior checks on accepted commit. | Acceptance compares coded views with approved compositions at four widths and checks source, microphone, keyboard, reduced-motion and missing-evidence states. No unapproved identity asset slips into production. |

Design review should include side-by-side captures, a component state matrix, a short asset provenance table, and a **pass/fail** record for outcomes A–F. Do not close a pass because ten pretty images exist. Close it when the reusable art system and the actual learner journey meet the stated proof.

## 7. Handoff instructions for the next GitHub-connected tool

1. Read this file, `docs/brand/README.md`, `docs/DESIGN_SYSTEM.md`, `docs/PRODUCT.md`, `AGENTS.md`, `ENGINEERING.md`, and the linked brand images. Then inspect only the related current components and assets. Treat the repo and approved board as authoritative for current identity; treat generated boards as art direction.
2. Start with D1 and Pass 1. Show **one connected visual system** across home, lesson and evidence before expanding to all phone states. In the review, annotate each major decision with `keep/adapt/create` and its source.
3. If a needed icon, wordmark, illustration or type treatment is absent, create a real editable asset following §4; do not substitute another dragon, rasterize text, or pretend an AI mockup is source art. Flag identity changes as proposed until approved.
4. Keep design source, exports, fixture text and implementation map in the paths above. Open a feature branch/PR with links to previews and exact assets; do not bury the only reference in a chat or external design-tool session.
5. After visual approval, implement a narrow flagged UI slice with tests appropriate to changed behavior and compare rendered screens at compact phone, large phone, tablet and desktop. Record what is implemented versus still conceptual. Preserve the existing Learn fallback until functional UX acceptance is complete.

**First assignment:** deliver D1 plus the Pass 1 direction lock as a reviewable board with a desktop mission, phone mission and Source Spotlight using the repo's exact tokens and canonical companion. Include a short list of missing assets and the decision on whether any new lettering is actually needed.
