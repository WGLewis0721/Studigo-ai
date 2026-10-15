# Studigo Phase 3 UI source of truth

This folder contains the **proposed** art and interaction foundation for Studigo V2 Phase 3. It is a repo-native handoff, not a claim that Guided Learn is live. Start with the three plans in `docs/ux/`, `docs/brand/README.md`, and the official `docs/DESIGN_SYSTEM.md`. The approved brand tokens and canonical orange scholar take precedence over generated concept boards.

## Inventory

| Path | Purpose | Status / provenance |
| --- | --- | --- |
| `research/REFERO_21ST_REFERENCE_LEDGER.md` | Refero style/screen/flow decisions and 21st.dev pattern candidates. | Reference only; no third-party code or media imported. |
| `icons/manifest.json`, `icons/export.py`, `icons/svg/`, `icons/specimen.html` | Original 24px action/evidence glyph source, reproducible SVG exports and contact sheet. | Proposed, original code-drawn vectors. Existing 20px mode icons remain approved. |
| `typography/TYPOGRAPHY_DECISION.md` | MyFonts exploration and approved font-stack decision. | Existing Bricolage/Figtree/JetBrains remain current; commercial candidates are not bundled. |
| `generated/` | One Higgsfield ambient visual source, reproducible WebP derivatives and full provenance. | Proposed decorative experiment only; not a runtime asset or source evidence. |
| `PROGRESS.md` | Increment ledger against D1–D6, A–F and S0–S4. | Evidence-linked statuses; update with each review. |
| `INVENTORY.md`, `COMPONENT_STATES.md` | Current-owner mapping, keep/adapt/create decisions, interaction states and token contrast calculations. | Handoff documentation; rendered acceptance pending. |
| `apps/web/components/phase3/` | Reusable UI primitives, original action glyph component and synthetic interactive fixture. | Development preview; no mission API, persistence, microphone capture or grading. |

## Reproduce

```bash
python3 design/phase3/icons/export.py
python3 design/phase3/generated/build_ambient.py
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @studigo/web typecheck
corepack pnpm --filter @studigo/web dev
```

The local preview routes are `/dev/phase3` (connected journey) and `/dev/phase3/system` (editable component specimen); both return 404 outside development. They use a **synthetic passage** declared in `apps/web/components/phase3/fixture.ts`. All controls are visual/interaction fixtures. No private files, model calls or mastery writes occur. “Pause” retains the step in the component until reload; durable resume belongs to the implementation plan. The voice review sheet contains editable example text and does not access a microphone.

## Asset use and approval

The `icons/` SVGs inherit `currentColor` and must sit next to text labels in controls. The generated ambient asset may be used only behind non-reading chrome after a visual comparison; keep source text on matte white. Never use it for a passage, character, wordmark, progress state or factual illustration. New logos, app icons or fonts require separate identity approval and rights verification. No downloaded 21st.dev snippets or Refero screenshots are included.

For each future asset add: editable source, export command, creator/source URL, license/right to use, intended component, current status (`proposed`, `approved`, `exploratory`), date and an acceptance capture. If it is not listed here, it is not part of the Phase 3 source of truth.
