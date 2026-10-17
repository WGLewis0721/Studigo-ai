# Studigo V1 — Shared navigation and control consistency

**Status:** PRs #221 (shared keys), #223 (unified loading) and #222 (mobile dock/companion clearance) **shipped**. PR #225 contains the V1 final shared-state, error, focus, four-width, zoom and WebKit engine acceptance increment. V1 software completion is contingent on PR #225's CI + production Ready; real-device/VoiceOver and owner critique remain pending.  
**Golden rollback:** [V0 frozen baseline](GOLDEN_BASELINE_V0_2026-10-17.md) (SHA `726b1e7`, Vercel deployment `dpl_aw3c2RDmDPkQYWZcsR28e8RC8Wdn`).  
**Governing design law:** [Foundational UX Principles](FOUNDATIONAL_UX_PRINCIPLES.md) and [reconciled inventory](../../design/README.md). Preserve the approved Learn → Explore UI.

## What the first slice changes

- Study Room's existing five-section `StudyGroups` component (not another nav bar): stable accessible label and discoverable title for Coach, Practice, Progress, Plan, Materials even when the text is compact or hidden on phones.
- Existing `ModeHeader`: stable names and preserved short context descriptions via `aria-describedby`, while `aria-pressed` continues to convey selection. No new mode switch implementation.
- Existing shared CSS: visible on-brand focus ring for section/header keys and 44 CSS px minimum primary section target on tablet/desktop (mobile keys already larger).
- The existing synthetic four-width browser test checks every visible section's name, physical target bounds and current state plus mode-header description and touch bounds. All four breakpoints and both existing UI comparison skins are covered without new data.

These outcomes address **Jakob's Law** (consistent vocabulary), **Fitts's Law** (touch targets), **visual repetition/unity**, and keyboard/screen-reader accessibility. All changes are in existing production components, not proposed Phase 3 prototype files.

## Second slice — mobile dock, keyboard and reduced motion (shipped, PR #222)

- `use-collapsing-tab-bar.ts` continues to own the *existing* navigation; no second dock or rewritten router.
- Expand/keep full size for text-input focus, reduced-motion preference, and route changes. Scroll inside a modal/sheet cannot collapse the main navigation.
- When VisualViewport reports an on-screen keyboard genuinely covering a focused editable field, hide only the floating mobile dock until the keyboard clears. Ignore pinch/zoom occlusion and desktop.
- New Playwright synthetic browser test covers 320/390 scroll-to-compact, all five 44px targets, focus-to-expand, dialog isolation, simulated viewport/keyboard restoration and reduced-motion preference.
- **Limits:** Chromium viewport simulation is not real Safari keyboard evidence. Hardware iOS/iPadOS, screen-reader/VoiceOver and 200% zoom acceptance remain open. No authenticated data was accessed.

## Shared loading state (shipped, PR #223)

Both Next.js route-loading boundaries now reuse `apps/web/components/room/room-loading-state.tsx`: the same official Studigo mascot, neutral reading surface, polite live status and indeterminate loading bar. The older plain-text room loading screen was removed without adding a new component library, completion claim or data-loading dependency. This is a reuse of existing approved app UI, not a new styling direction.

## Final V1 software candidate — PR #225

- Reuses the same existing `.modeEmpty` presentation and semantic labelled sections for Quiz, Cards, Weak Areas and Plan. No invented new challenge, progress or mastery behavior.
- Fixes Next.js app error recovery: the framework supplies `reset()`, **not** the prior `retry()` prop. The error message no longer claims saved data is safe without proof.
- Retires stale `guided=1` from normal Study Room navigation while keeping unrelated URL state intact.
- Focused Chromium 320/390/820/1440 empty-state and settings focus-return tests, plus simulated 200% layout reflow on tablet/desktop.
- Adds Playwright **Linux WebKit** phone/tablet smoke for navigation, keyboard focus and overflow; this is not a native Safari/VoiceOver pass.
- See [line-by-line V1 after-action checklist](V1_AFTER_ACTION_REPORT_2026-10-17.md) for every code change, design source and UX law.

## Owner-requested mobile corrections — pending feedback

- [x] **Coach messenger control alignment (mobile):** keep the Clear, message input, optional speech, and Send controls in one horizontal row. Each control uses a consistent 44px tap target; the message input flexes into remaining width at 320px and 390px.
- [x] **Fixed-size upper Coach/Learn tabs (mobile):** disable the existing 60%-scale tucked header on phones. Retain the original full-size visual hierarchy and prevent label shrink/flicker after chat begins. Desktop retains its existing behavior.
- [x] Reuse the approved V2 `globals.css` colors, shapes, and existing `StudigoComposer`, `ModeFrame`, `SpeechAnswerControl` and glyphs. No artwork or duplicate UI components imported from `/design`; checked `design/README.md` and its canonical inventory before adjusting shipped components.
- [ ] **Owner review on a real iPhone** for the two supplied screenshots (normal Coach and active message view). Per owner direction, keep automation lightweight; no extra full visual suite was added for this small polish pass.

Principles: **Unity/repetition, visual balance, hierarchy, scale and contrast** (seven fundamentals); **Jakob's Law** (stable familiar tabs), **Fitts's Law** (consistent 44px actions) and **Hick's Law** (one orderly action row instead of vertically scattered competing controls). These are foundational quality checks, not permission to redesign Studigo's identity.

## Remaining manual acceptance — not auto-verified

1. Real signed-in Study Room with a disposable source after the account reset, including Coach/Learn switch and settings focus return.
2. iPhone Safari software keyboard/notch/dynamic text and iPadOS portrait/landscape.
3. VoiceOver complete keyboard/screen-reader reading order and 200% device text settings.
4. Owner review/critique of the live build before beginning V2.



## Release conditions

- `validate`, `postgres-multisession`, `synthetic-four-width` all green on the review head.
- No regression in Learn → Explore, source inspection, Coach/Practice, selected tab state or other room navigation.
- Scope stays the shared UI only; no database work, student data reset or global rebrand.
- Merge as a small V1 increment after full tests; proceed to remaining V1 slices separately.
