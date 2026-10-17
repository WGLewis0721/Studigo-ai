# Studigo V1 — After-action report and design-law traceability

**Date:** 2026-10-17  
**Status:** engineering implementation submitted in PR #225; final merge/deployment and owner critique are separate verification events. Update this ledger only from observed test/release evidence.  
**Release scope:** V1 shared navigation, keyboard/focus interaction, component-state semantics and responsive readability. **Not** V2 Materials, V3 Coach/Practice redesign, or a new design system.  
**Golden recovery:** frozen source [`726b1e7`](https://github.com/WGLewis0721/Studigo-ai/tree/golden/pre-v1-2026-10-17-726b1e7) and Vercel Ready deployment `dpl_aw3c2RDmDPkQYWZcsR28e8RC8Wdn`. [V0 record](GOLDEN_BASELINE_V0_2026-10-17.md). Data rollback is explicitly not promised.

## 1. Checklist — changed implementation, location, design principle and evidence

The checklist records implemented code, **not** claims of independent human/device acceptance.

| Done | Change and code owner | What was reused from design sources | Pillars and UX laws applied | Automated evidence |
|---|---|---|---|---|
| [x] | **Five-section navigation names and active state**: `components/room/workspace.tsx` (#221) | Shipped `ModeGlyph` and existing Study Room shell, inventoried in `design/ASSET_INVENTORY.json`; no imported Phase 3 glyph | **Unity/repetition**, **Jakob's Law**: the same named Coach, Practice, Progress, Plan, Materials sections regardless of collapsed label | Four-width synthetic navigation labels, exactly one `aria-current=page` |
| [x] | **Reachable navigation and visible focus**: `globals.css`, `mode-header.tsx` (#221) | Official V2 CSS color tokens in `globals.css`; approved 20px `ModeGlyph`; documented `design/README.md` canonical hierarchy | **Scale, contrast, emphasis**, **Fitts's Law**, accessible keyboard focus: hit box ≥44px, independent of icon size | Four-width bounding boxes, named header modes + linked `aria-describedby` |
| [x] | **Compact-header button compensation**: `globals.css` (#221) | Existing compact device shell/header—not the separate Phase 3 prototype header | **Balance, scale**, **Fitts's Law**: 60%-scaled heading still renders 44px targets | Browser geometry against actual transformed bounding boxes |
| [x] | **Collapsing dock / software keyboard**: `use-collapsing-tab-bar.ts`, `globals.css` (#222) | Existing `studyGroups` and companion-friendly dock composition | **Fitts's Law, Jakob's Law, Doherty threshold**: controls stay reachable; hide floating dock only when keyboard obscures an editable field; restore on blur | Focused 320/390 Playwright scroll/modal/VisualViewport simulation |
| [x] | **320px narrow-dock correction**: `globals.css` (#222) | Shipped five-button dock dimensions; no new navigation assets | **Scale, balance**, **Fitts's Law**: don't trade hit area for a decorative compact margin | 320px *rendered* key widths ≥44px; 390px layout kept |
| [x] | **Reduced-motion + dialog scroll isolation**: `use-collapsing-tab-bar.ts` (#222) | Existing motion and route navigation; no new animations | **Contrast, repetition, Jakob's Law** and reduced-motion accessibility: motion is not needed to navigate | Deterministic 320/390 no-collapse under `prefers-reduced-motion`; modal scroll test |
| [x] | **Companion avoids Materials title/status**: `companion/engine.ts` (#222) | **Existing approved Studigo sprites**, indirectly built from `design/companion-demo/assets`, and the existing `controlSafeDock`/header-avatar fallback | **Hierarchy, emphasis, Gestalt common region**, **aesthetic–usability effect**: companion delight cannot cover source-reading state | Four-width content clearance checks; safe seated fallback accepted, overlap rejected |
| [x] | **One branded route-loading presentation**: `room-loading-state.tsx`, app route `loading.tsx` files (#223) | Existing `StudigoMascot`, matte `.stateScreen`, indeterminate `.loadingBar` and official CSS tokens; no new art | **Unity, repetition, hierarchy**, **Doherty threshold**: honest pending state across app/rooms | Production build/route screenshot regression (no fabricated percent or progress) |
| [x] | **Shared no-source/empty layout**: `study-room-empty-state.tsx`, Quiz, Cards, Weak Areas, Plan (#225) | Existing `.modeEmpty` styling and typography; the same V2 brand rather than proposed Phase 3 card patterns | **Unity/repetition, hierarchy, proximity**, **Hick's Law**, **chunking**: readable heading, brief explanation, contextual next action when available | Synthetic empty-room fixture checks accessible labelled sections at four widths |
| [x] | **Functional error recovery**: `app/app/error.tsx` (#225) | Existing mascot, `.stateScreen` and action styles; no duplicate error library | **Doherty threshold, Jakob's Law, Tesler's Law**: Next.js `reset()` is wired to “Try again”; copy no longer guarantees unchanged data without evidence | Type/build checks; functional real-server failure injection not performed |
| [x] | **No obsolete `guided=1` on section navigation**: `workspace.tsx` (#225) | Existing production default Learn and shared router; no aesthetic changes | **Jakob's Law, Occam's Razor**: URL state remains understandable; other query/hash context preserved | Type/build checks, unchanged Learn mission tests and synthetic room navigation |
| [x] | **Focus return & device reflow tests**: `v1-final-qa.mjs`, synthetic fixture, CI workflow (#225) | Existing responsive Study Room chrome and `RoomSettings` focus trap | **Fitts, Jakob, scale, contrast** and keyboard semantics: focus enters modal and returns to settings button; avoids cross-width overflow | Chromium 320/390/820/1440, simulated 200% CSS zoom on 820/1440 |
| [x] | **WebKit engine regression gate**: `v1-webkit-smoke.mjs`, CI (#225) | Same production components/assets across browsers | **Unity, scale and consistency**: representative phone/tablet WebKit layout, 44px keys, focus/escape | Playwright WebKit on Linux (not actual iOS Safari) |

## 2. Checklist — `/design` inventory usage and decisions

- [x] **Consulted** [`design/README.md`](../../design/README.md) and [`design/ASSET_INVENTORY.json`](../../design/ASSET_INVENTORY.json) to separate canonical/shipped, historical and proposed work.
- [x] **Reused through the shipped app** the approved Studigo mascot and companion engine. The editable originals live under `design/companion-demo/assets/`; **none were recopied or regenerated** for V1.
- [x] **Kept** the production Study Room chrome, existing ModeGlyph/MissionControlIcon vocabulary, buttons, Snow/matte surfaces, typography and color tokens. Authority: [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) and [official brand board](../brand/STUDIGO_OFFICIAL_BRAND_BOARD.png).
- [x] **Did not import** any of the 16 proposed glyphs in `feature/phase3-ui-foundation/design/phase3/icons/svg`; shipped controls already meet this phase's semantic needs.
- [x] **Did not use** Phase 3 prototype shells, generated ambient art, the unapproved wordmark, the invalid shell-placeholder SVG, or V1 historical desktop/mobile canvases. Their states are documented in the reconciled catalog.
- [x] **No new third-party fonts, visual assets, replacement companion or UI component system.**

## 3. Universal UX laws are pillars, not the appearance

| Principle | Applied to | Why it matters |
|---|---|---|
| **Unity and repetition** (Concrete CMS) | Shared navigation, loading states, empty states | One product grammar on every Study Room surface |
| **Balance, hierarchy and emphasis** (Concrete CMS) | Companion safety zones, single empty-state task, mode header | Present learning material is more important than decoration |
| **Scale and contrast** (Concrete CMS) | 44px rendered targets, focus indicators, phone widths, 200% reflow | Legibility and use are independent of the theme |
| **Jakob's Law** | Five familiar named sections, modal close, URL behavior, stable Coach/Learn choices | Familiar paths do not need new training |
| **Fitts's Law** | 320px compact dock, header transform compensation, touch targets | Reaching a control shouldn't require pixel precision |
| **Hick's Law and chunking** | Empty-state copy and contextual action, uncluttered hierarchy | Fewer competing decisions before learning can resume |
| **Gestalt proximity/common region** | Heading, explanation and action appear in the same empty state; source/status clearance | Related information is perceptually grouped |
| **Doherty threshold** | Responsive pending states, working retry callback, keyboard response | Every wait or failure has honest, immediate feedback |
| **Tesler/Occam's Razor** | UI cleanup without changing source authorization, grading or mission database | Simplify presentation, not erase necessary complexity |
| **Aesthetic–Usability Effect** | Companion stays expressive but never blocks critical Materials content | Delight cannot replace usability |

Sources: [Foundational Studigo UX principles](FOUNDATIONAL_UX_PRINCIPLES.md), [Concrete CMS](https://www.concretecms.com/about/blog/web-design/7-fundamentals-of-web-design), [Jon Yablonski's official Laws of UX](https://lawsofux.com/), and the owner's [Laws of UX PDF](https://promptcraze.com/wp-content/uploads/2025/02/lawsofux.pdf).

### Owner-requested mobile polish — implementation candidate (awaiting production verification)

| Done | Change and code owner | What was reused from design sources | Pillars and UX laws applied | Evidence |
|---|---|---|---|---|
| [x] | **Align mobile Coach composer controls:** `apps/web/app/globals.css`, existing `StudigoComposer`, `SpeechAnswerControl` and Clear button | `design/README.md` and `design/ASSET_INVENTORY.json` identify the **existing shipped controls**. Used V2 color tokens and current icons; **no new assets copied from `/design`** | **Unity, balance, repetition, scale**; **Fitts's Law**: 44px Clear, speech and Send targets; **Hick's Law**: single simple horizontal action row | Source-level change; awaiting iPhone owner review |
| [x] | **Prevent upper mode tabs shrinking on phones:** mobile `modeFrame` scale fixed at 100% | Reused existing `ModeFrame`, current Coach/Learn typography and Studio V2 visual identity; did not use unmerged Phase 3 header prototypes | **Hierarchy, scale, contrast**, **Jakob's Law**: mode labels remain familiar and readable; no jitter between states | Source-level change; awaiting iPhone owner review |

**Manual review requested:** verify 320/390px Chat and active Coach conversation from the two user-supplied screenshots. Desktop keeps the original header behavior. This user-requested reduced-testing pass is *not* a substitute for hardware accessibility or authentication tests.

## 4. Acceptance checklist and what is not established

- [x] V0 golden source branch frozen, Ready rollback deployment identified, visual fixture/public screenshot archive produced ([record](GOLDEN_BASELINE_V0_2026-10-17.md)).
- [x] PRs #221, #223 and #222 individually passed application, database and four-width synthetic browser gates; each was merged and deployed Ready.
- [x] V1 final candidate includes focused Chromium and WebKit synthetic checks. **Mark release complete only after current PR #225's precise checks pass and Vercel main is Ready.**
- [ ] Authenticated end-to-end real-source flow on a disposable account after the owner-authorized database reset. Synthetic fixtures are not a substitute.
- [ ] Hardware iPhone Safari keyboard, notches/safe areas and iPadOS tests.
- [ ] Actual VoiceOver screen-reader navigation and hardware 200% text enlargement. Chromium CSS zoom and Linux WebKit do not establish these.
- [ ] Owner's product-design critique and approval (requested before starting V2).

**V1 implementation may be ready for critique when its software gates pass, but full hardware accessibility signoff must remain explicitly pending until observed.** Do not silently treat user critique as device certification.

## 5. Release safety and handoff

Review UI at [production](https://studigo-ai.vercel.app) **only after** the post-merge deployment is confirmed Ready. If release breaks core room navigation, restore the V0 verified deployment `dpl_aw3c2RDmDPkQYWZcsR28e8RC8Wdn`; verify schema/API compatibility and preserve learner data. Deployment rollback does **not** restore deleted Supabase accounts or uploads.

**Hold V2 until the owner critiques the V1 build.** Do not start Materials/source redesign here. Next phase prioritization should include whatever the owner finds in the real product rather than preemptively replacing approved components.
