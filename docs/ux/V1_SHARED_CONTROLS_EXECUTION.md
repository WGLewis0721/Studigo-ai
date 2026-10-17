# Studigo V1 — Shared navigation and control consistency

**Status:** first implementation slice in review. **No completion claim for all of V1.**  
**Golden rollback:** [V0 frozen baseline](GOLDEN_BASELINE_V0_2026-10-17.md) (SHA `726b1e7`, Vercel deployment `dpl_aw3c2RDmDPkQYWZcsR28e8RC8Wdn`).  
**Governing design law:** [Foundational UX Principles](FOUNDATIONAL_UX_PRINCIPLES.md) and [reconciled inventory](../../design/README.md). Preserve the approved Learn → Explore UI.

## What the first slice changes

- Study Room's existing five-section `StudyGroups` component (not another nav bar): stable accessible label and discoverable title for Coach, Practice, Progress, Plan, Materials even when the text is compact or hidden on phones.
- Existing `ModeHeader`: stable names and preserved short context descriptions via `aria-describedby`, while `aria-pressed` continues to convey selection. No new mode switch implementation.
- Existing shared CSS: visible on-brand focus ring for section/header keys and 44 CSS px minimum primary section target on tablet/desktop (mobile keys already larger).
- The existing synthetic four-width browser test checks every visible section's name, physical target bounds and current state plus mode-header description and touch bounds. All four breakpoints and both existing UI comparison skins are covered without new data.

These outcomes address **Jakob's Law** (consistent vocabulary), **Fitts's Law** (touch targets), **visual repetition/unity**, and keyboard/screen-reader accessibility. All changes are in existing production components, not proposed Phase 3 prototype files.

## Subsequent V1 slices (NOT implemented here)

1. Test stable reachability/collapsing tabbar with long scrolling, software keyboard, notches and Safari reduced motion. Keep one tabbar; remove only verified duplication.
2. Reconcile Coach/Learn switch and shared contextual controls, including all states and focus/return from modal/sheet actions.
3. Audit responsive header/rail and companion placement for overlap and affordance across 320, 390, 820 and 1440; resolve actual failing cases, not speculative redesign.
4. Normalize shared loading, empty, error and retry components, with clear system state, across Study Room sections without inventing new progress or completion.
5. Test real authenticated flows, iOS VoiceOver and 200% zoom in a separate authorized verification environment before claiming complete V1.

## Release conditions

- `validate`, `postgres-multisession`, `synthetic-four-width` all green on the review head.
- No regression in Learn → Explore, source inspection, Coach/Practice, selected tab state or other room navigation.
- Scope stays the shared UI only; no database work, student data reset or global rebrand.
- Merge as a small V1 increment after full tests; proceed to remaining V1 slices separately.
