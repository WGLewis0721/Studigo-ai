# Phase 3 visual inventory and ownership map

**Snapshot:** Repo branch `docs/phase3-outcome-ux-plan` at `f199cc6` before Phase 3 UI foundation commits. Code paths are verified as present, not proof that the proposed Guided Learn behavior exists in production. Live-page screenshot comparison remains a separate acceptance task.

| Current object | Owner / source | Phase 3 decision |
| --- | --- | --- |
| App tokens, matte/keys/room shells and responsive rules | `docs/DESIGN_SYSTEM.md`, `apps/web/app/globals.css` | **Keep** the eight named colors, neutrals, mode roles, radii, materials and contrast. Extend through scoped component classes; do not fork a parallel token palette. |
| Bricolage Grotesque, Figtree, JetBrains Mono | `apps/web/app/layout.tsx` via `next/font/google` | **Keep** for Phase 3. MyFonts exploration is recorded under `typography/`; no unlicensed font file bundled. |
| Canonical orange scholar and companion behavior | `apps/web/public/mascot/companion/`, `apps/web/components/companion/`, `docs/brand/mascot/` | **Keep** canonical assets and existing event logic. Use one restrained window/still; no generated replacement or invented icon. |
| 20px mode glyph family | `apps/web/components/mode-glyph.tsx` | **Keep** for existing mode navigation. **Create** complementary 24px action/evidence glyphs in `icons/` and generated `action-glyph.tsx`. |
| Study Room shell and mode routing | `apps/web/components/room/workspace.tsx` | **Adapt later** after Phase 2 and UX contracts settle. Phase 3 preview is isolated in `/dev/phase3`; no production routing change in this PR. |
| Coach/Learn switch, Chat/Topics | `apps/web/components/room/coach-panel.tsx` | **Keep behavior** in future integration; no second topic scope chooser. UI preview explores segmented styling only. |
| Source chips/guide reading | `apps/web/app/globals.css`, source components in `apps/web/components/room/` | **Adapt** to evidence ticket and Source Spotlight only with verified authorized block/page data. Static fixture passage is synthetic and labeled. |
| Current product and official board | `docs/PRODUCT.md`, `docs/brand/README.md`, `docs/brand/STUDIGO_OFFICIAL_BRAND_BOARD.png` | **Keep** as source of truth. Generated Phase 3 concept is exploratory. |
| Guided mission director and durable cursor | Proposed GL/UX plans, existing `packages/learning/` and `apps/web/lib/learning/` | **Create later** as a flagged feature slice; the preview has no persistence, provider call or mastery write. |

## Missing assets and decisions

- The approved brand has no need for a replacement character or a new app icon. Wordmark redesign remains **unapproved exploration**; use current text identity now.
- No approved Phase 3 action icon family existed alongside the 20px mode glyphs. The 16 original SVGs in this package address that gap, pending visual sign-off.
- No purchased MyFonts face or web embedding license is present. The current approved stack remains usable; a font change is not a prerequisite.
- There is no real source document in the public preview. The synthetic fixture cannot be used to demonstrate production retrieval or authorization.
- The Higgsfield ambient plate is decorative only and **proposed**. It is deliberately excluded from runtime until rights and composition approval.

## Green/red/blue design translation

**Green:** exact palette roles, tactile keys and wells, objective rail, mode switch, action options, citation ticket, restrained typographic hierarchy, coherent desktop and phone states.
**Red:** replacement/repeated dragon, mascot-led lesson, invented app icon, hardware-material collage.
**Blue:** optional device/lettering/typography exploration; no production dependency.

## Next integration owner map

Use `apps/web/components/phase3/` as a prototype of reusable presentational primitives. The production implementation must map `MissionStepView`/`EvidenceRef` to these components after source and session contracts exist. `workspace.tsx` and `coach-panel.tsx` own navigation; `packages/learning` or the existing application learning layer owns progression; server/RLS owns source eligibility; current Coach/Practice owns assessment. No CSS component can decide academic truth or award mastery.
