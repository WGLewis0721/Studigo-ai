# Studigo V1 — Shared navigation and control consistency

**Status:** first shared-navigation slice shipped in PR #221 (main `511cb50`); second mobile-dock slice under review. **Full V1 is not complete.**  
**Golden rollback:** [V0 frozen baseline](GOLDEN_BASELINE_V0_2026-10-17.md) (SHA `726b1e7`, Vercel deployment `dpl_aw3c2RDmDPkQYWZcsR28e8RC8Wdn`).  
**Governing design law:** [Foundational UX Principles](FOUNDATIONAL_UX_PRINCIPLES.md) and [reconciled inventory](../../design/README.md). Preserve the approved Learn → Explore UI.

## What the first slice changes

- Study Room's existing five-section `StudyGroups` component (not another nav bar): stable accessible label and discoverable title for Coach, Practice, Progress, Plan, Materials even when the text is compact or hidden on phones.
- Existing `ModeHeader`: stable names and preserved short context descriptions via `aria-describedby`, while `aria-pressed` continues to convey selection. No new mode switch implementation.
- Existing shared CSS: visible on-brand focus ring for section/header keys and 44 CSS px minimum primary section target on tablet/desktop (mobile keys already larger).
- The existing synthetic four-width browser test checks every visible section's name, physical target bounds and current state plus mode-header description and touch bounds. All four breakpoints and both existing UI comparison skins are covered without new data.

These outcomes address **Jakob's Law** (consistent vocabulary), **Fitts's Law** (touch targets), **visual repetition/unity**, and keyboard/screen-reader accessibility. All changes are in existing production components, not proposed Phase 3 prototype files.

## Second slice — mobile dock, keyboard and reduced motion (under review)

- `use-collapsing-tab-bar.ts` continues to own the *existing* navigation; no second dock or rewritten router.
- Expand/keep full size for text-input focus, reduced-motion preference, and route changes. Scroll inside a modal/sheet cannot collapse the main navigation.
- When VisualViewport reports an on-screen keyboard genuinely covering a focused editable field, hide only the floating mobile dock until the keyboard clears. Ignore pinch/zoom occlusion and desktop.
- New Playwright synthetic browser test covers 320/390 scroll-to-compact, all five 44px targets, focus-to-expand, dialog isolation, simulated viewport/keyboard restoration and reduced-motion preference.
- **Limits:** Chromium viewport simulation is not real Safari keyboard evidence. Hardware iOS/iPadOS, screen-reader/VoiceOver and 200% zoom acceptance remain open. No authenticated data was accessed.

## Remaining V1 slices (NOT implemented by these PRs)

1. Verify collapsing tabbar, software keyboard and safe-area inset behavior on actual iPhone Safari/iPadOS; browser simulation is now implemented but is not a device pass.
2. Reconcile Coach/Learn switch and shared contextual controls, including all states and focus/return from modal/sheet actions.
3. Audit responsive header/rail and companion placement for overlap and affordance across 320, 390, 820 and 1440; resolve actual failing cases, not speculative redesign.
4. Normalize shared loading, empty, error and retry components, with clear system state, across Study Room sections without inventing new progress or completion.
5. Test real authenticated flows, iOS VoiceOver and 200% zoom in a separate authorized verification environment before claiming complete V1.

## Release conditions

- `validate`, `postgres-multisession`, `synthetic-four-width` all green on the review head.
- No regression in Learn → Explore, source inspection, Coach/Practice, selected tab state or other room navigation.
- Scope stays the shared UI only; no database work, student data reset or global rebrand.
- Merge as a small V1 increment after full tests; proceed to remaining V1 slices separately.
