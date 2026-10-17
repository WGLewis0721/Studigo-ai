# Studigo — Cross-device visual consistency program

> **Required foundation:** [Seven fundamentals and Laws of UX](FOUNDATIONAL_UX_PRINCIPLES.md) are Studigo-wide pillars, **independent of theme or artistic direction**, and are not an optional list of style references. Every screen and breakpoint is assessed against them. [Design/asset inventory reconciliation](../../design/README.md) records what is canonical, already shipped, historical, proposed or invalid. **Inventory reconciliation is complete; V0 visual evidence and responsive defect capture remain pending.** No visual redesign is authorized by this documentation pass.

**Status:** approved direction / **planning only** for work outside PR #217's Learn surface.  
**Baseline:** the accepted Learn → Explore journal, lesson window, compact bottom controls, source evidence and restrained progress glow from **PR #217**.  
**Design authority:** `docs/DESIGN_SYSTEM.md`, `docs/brand/STUDIGO_OFFICIAL_BRAND_BOARD.png`, shipped tokens in `apps/web/app/globals.css`, established room components, and the proposed design/phase3 asset inventory.  
**Rollout rule:** merging PR #217 approves the *plan*, **not** redesigns of Coach, Practice, Materials, Progress, Plan, Home, settings or companion in this PR.

## Outcome, not a rebrand

A learner should experience **one personal learning device** on a 320px iPhone, a 390px iPhone, an 820px tablet and a 1440px desktop, not separate products. Every area inherits the approved colored device shells, Snow/matte reading surfaces, tactile keys, Bricolage headings, Figtree body, JetBrains only for real metadata, one canonical orange companion, source provenance and honest learning state. Learn is the **benchmark for quality and economy of attention**; not every room needs an orange progress flame/glow.

No new global component library, duplicate brand board, imaginary state, replacement mascot, unlicensed font, or wholesale architecture rewrite.

## Research basis (reference-derived and verified code are distinct)

**Concrete CMS — [7 Fundamentals of Web Design](https://www.concretecms.com/about/blog/web-design/7-fundamentals-of-web-design)** (Feb 2024): **unity, balance, hierarchy, contrast, emphasis, scale, repetition**. Apply these as a testable visual grammar, not a mood board.

**Jon Yablonski — [Laws of UX, 2nd ed., PDF link supplied by product owner](https://promptcraze.com/wp-content/uploads/2025/02/lawsofux.pdf)**. The direct PDF download is too large for the web extraction endpoint; independently corroborated the title/chapter structure from its indexed text and [O'Reilly's 2nd-edition table of contents](https://www.oreilly.com/library/view/laws-of-ux/9781098146955/), [the author's official Laws of UX](https://lawsofux.com/), and a [W3C-supplied summary](https://www.w3.org/DesignIssues/Yablonski/Summary.html). Use laws as practical heuristics—not falsely quantified cognitive performance claims:

| Principle | Studigo operational rule | What we measure |
|---|---|---|
| **Unity, repetition, Jakob's Law** | Same device chrome, active mode, action-key geometry, evidence affordance and companion position across surfaces; adapt familiar phone/tablet navigation rather than inventing custom gestures | Component/token reuse, consistent labels and placements, navigation state tests |
| **Balance, scale, hierarchy, emphasis / von Restorff** | One dominant learning task per pane, one primary action; supporting metadata/details recede until needed | Visual audit checks main task dominates at each viewport; one primary CTA in active step |
| **Contrast & aesthetic–usability effect** | Approved color pairing + typography; legibility and semantics outweigh gloss, blur, or novelty | WCAG AA contrast of text and controls; focus visibility and screen-reader label audit |
| **Hick's Law / choice overload** | Progressive disclosure: the current 1–2 decisions first; secondary settings/actions through compact menus or the journal; no duplicated switchers | Critical-path decision count and one clear next step |
| **Fitts's Law** | Touchable 44 × 44 CSS px minimum for active keys; fixed action rails in reachable places, stable ordering and comfortable gaps | Automated target-box/overlap checks at 320, 390, 820, 1440 |
| **Gestalt proximity, similarity, common region** | Put a label, control, help, result and evidence in the same coherent well; don't add disconnected summary cards above identical content | Grouping review and DOM/reading-order correspondence |
| **Tesler's Law / Miller / chunking** | Simplify navigation and layouts without removing genuine source, revision, grade, or progress complexity; group details by task | First-use flows, disclosure tests and evidence completeness |
| **Doherty threshold / perceived responsiveness** | Immediate key feedback and stable pending/retry/error states, with no phantom success; don't add animation latency to study | Input response and pending indicator measures on real devices |
| **Peak–End, goal gradient & Zeigarnik** | Helpful, calm completion/return state; progress reflects saved state, never awards fabricated mastery | Resume/finish continuity, completion wording, no false award |

### Studigo ethics override
These are aids to comprehension, **not behavioral pressure tactics**. Do not punish minors through artificial scarcity, invented deadlines, misleading performance comparisons, forced payment prompts, or nonconsensual data sharing. Motion and progress must stay informational. K–5 learners must be able to use standard words and accessible labels; icon-only keys require a name, tooltip/long-press equivalent or discoverable help.

## Golden reference and component policy

1. **Golden snapshots:** capture authenticated allowed Study Room and synthetic fixtures at `320 × 700`, `390 × 844`, `820 × 1180`, `1440 × 900` plus reduced-motion and 200% zoom. Store screenshot references with commit SHA, route, theme, device DPR, font-loading status, and data provenance. Golden is **an anchor**, not a pixel-perfect prohibition on accessibility improvements.
2. **Component inventory:** map mode/navigation keys, lesson/evidence cards, buttons, chips, menus, dialogs, tabs, progress indicators, text fields and companion surfaces to actual React/CSS owners. Tag each as **keep / adopt / consolidate / remove**. Proposed `design/phase3/` assets are not automatically production-approved.
3. **Design tokens:** extend existing `globals.css` variables; define one documented space/type/control/motion scale in `docs/DESIGN_SYSTEM.md` after audits. Avoid hard-coded competing palettes and per-room forks. Use existing `ModeGlyph` / current approved 24px actions.
4. **Accessibility/motion:** sensible DOM reading order, WCAG 2.2 AA contrast and keyboard focus, 44px targets, 200% text scaling, zero essential information conveyed by color or animation alone, motion disabled or static for `prefers-reduced-motion`. One canonical companion window never obscures a question or evidence.

## Delivery waves — separate small PRs after #217

**Current delivery ledger (2026-10-17):** V0 golden capture is complete (#220); V1 has three verified implementation increments (#221, #223, #222) documented in [V1 execution](V1_SHARED_CONTROLS_EXECUTION.md). V1 is **not closed** until responsive headers, real iPhone/iPad keyboard + VoiceOver, 200% zoom, remaining empty/error states and authenticated flows meet the original gates. V2 has not started.

| Wave | Areas, owner and tangible outcome | Acceptance gate |
|---|---|---|
| **V0 — production golden image (owner-adjusted, complete)** | Freeze approved production source and Ready Vercel rollback target; archive real public Home/sign-up and synthetic Study Room four-width captures. Defer general screen audits to the implementation waves | Verified golden commit `726b1e7`, Ready deployment `dpl_aw3c2RDmDPkQYWZcsR28e8RC8Wdn`, evidence artifact and rollback guide in [V0 record](GOLDEN_BASELINE_V0_2026-10-17.md), PR #220; not an authenticated room screenshot or exercised rollback |
| **V1 — shared controls / navigation** | Normalize responsive Study Room header and mobile tabbar, Coach/Learn mode switch, icon keys, pointer/focus/haptics, skeleton/loading/empty/error states. Pull reusable primitives from existing code; do not import another design system | All five room sections reachable, no duplicated topic/switch controls, nonoverlap 320/390/820/1440, full keyboard/VoiceOver path |
| **V2 — Materials and source inspection** | Source cards, upload/extraction/reindex flows, content lists, provenance tickets and stale/revision notices adopt Learn's matte hierarchy and compact evidence. Existing source API remains authority | Uploaded source still retrievable; extraction/reindex state honest; errors actionable; no citation or privacy regression |
| **V3 — Coach and Practice** | Coach dialogue/scaffolds, topic selection, study checks, quiz, cards, cram and practice tests inherit quiet stage layout, grouped answer keys, responsive dock and one clear next action. Preserve independent graded records and the Coach learning reducer | Exactly requested question count, results/attempts unchanged, keyboard/screen-reader and all four-width tests |
| **V4 — Progress and Plan** | Progress/readiness, weak areas, study plans and learner goals use consistent information density, progress language, category states, helpful next actions. No fake XP, mastery, streak, effort, or misleading percentages | Every metric maps to verified server datum, empty/no-source states are distinguishable, no new user tracking |
| **V5 — Home, rooms, settings, onboarding, companion** | One experience through room picker/Home/shell/settings/auth and iOS/iPad breakpoints; coherent first-run contribution (upload, goal, first useful explanation), companion presence and responsive adaptation | Accessible new/returning flows, persistence/cross-device visual parity, companion never covers controls, stable sign-in |
| **V6 — cross-device polish and release** | Consolidate redundant CSS, remove provisional duplicates, update authoritative design docs, CI screenshot/bounds/contrast tests, signed-in route matrix, release notes and rollback | Zero critical blockers; real owner-only room and correct source; load and error states; signed-in 320/390/820/1440 + 200% text, touch, keyboard, VoiceOver and reduced-motion evidence |

## Non-negotiable release matrix

**Breakpoints:** 320, 390, 820, 1440 with real zoom/font-size; portrait iPhone, tablet portrait/landscape, desktop wide; keyboard/switch control and screen reader where available.

**States for every surface:** initial, populated, empty/no source, loading, success, incomplete/paused, stale-source/revision mismatch, recoverable error, denied access, reduced-motion. Test both feature-flag OFF and ON.

**Automated rules:** no horizontal scroll or trapped overflow; no hidden action behind tabbar/notch/keyboard; 44px touch target on controls; measurable focus rings and contrast; no unintentionally duplicated CTAs; screenshots with thresholds plus human review of major differences (not only CI pixel diff). Ensure aria-live status updates avoid excessive speech during progress.

**Product rules:** preserve Learn. Earn. Play. Source-backed content is not rewritten in CSS; reading complete ≠ mastery; reward claims require real evidence; never send private student material to design/analytics tools. Games Moon Keep/Core Clash retain their own game UI while sharing mascot, identity, accessibility conventions and shell color.

**Approval workflow:** keep PRs scoped by wave, require a signed-off side-by-side of *existing baseline vs new component* for phone and desktop, consolidate to stable source (no duplicated docs). Each wave's test and production acceptance evidence must accompany its PR.

## Suggested starting backlog (ranked by first-use impact)

- **P0** Duplicate panels/labels, unclear primary action, phone overflow, keyboard-inaccessible icon, source card covering passage, companion overlap, fake progress; all become blockers.
- **P1** Inconsistent CTA height, space/line-height, iconography, selected-state styling, mobile/desktop room nav, overprominent metadata, nonessential scrolling.
- **P2** Decorative textures, secondary animations, micro-haptics, friendly empty-state copy and illustration composition after P0/P1 gates.

## Release boundary of PR #217

This file is a **plan committed in PR #217**, not authorization to redesign unrelated screens. The subsequent **Learn default release** replaces the old canary: signed-in owned Study Rooms now enter Learn → Explore with no `?guided=1` parameter and without `PHASE3_ROOM2_ROOM_IDS`. The authenticated mission API still enforces the room owner, source revision, eligible evidence, and idempotent mission receipts through the existing database RPCs. Synthetic `/explore-preview` remains development/Preview only. No learner-data reset or schema migration is required; if rollback is needed, promote the last verified Ready production deployment. The single room-wide cursor persists: **do not claim independent per-quest resumes are complete**.

**References:** [Concrete CMS](https://www.concretecms.com/about/blog/web-design/7-fundamentals-of-web-design); [Laws of UX book](https://promptcraze.com/wp-content/uploads/2025/02/lawsofux.pdf); [author's law definitions](https://lawsofux.com/); [O'Reilly chapter contents](https://www.oreilly.com/library/view/laws-of-ux/9781098146955/); [W3C summary](https://www.w3.org/DesignIssues/Yablonski/Summary.html); [Studigo design authority](../DESIGN_SYSTEM.md); [Phase 3 proposed reference inventory](https://github.com/WGLewis0721/Studigo-ai/blob/feature/phase3-ui-foundation/design/phase3/INVENTORY.md).
