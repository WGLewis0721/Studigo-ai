# Studigo design inventory — reconciled 2026-10-17

**Canonical inventory:** [ASSET_INVENTORY.json](ASSET_INVENTORY.json) (39 entries; stable IDs, verified GitHub paths, ref, status, use/decision).  
**Universal design standard:** [UX and web-design foundations](../docs/ux/FOUNDATIONAL_UX_PRINCIPLES.md).  
**Identity:** [official V2 brand board](../docs/brand/STUDIGO_OFFICIAL_BRAND_BOARD.png) → [brand governance](../docs/brand/README.md) → [Design System](../docs/DESIGN_SYSTEM.md) → production components and tokens.  
**Next rollout:** [Cross-Device Visual Unification Plan](../docs/ux/STUDIGO_CROSS_DEVICE_VISUAL_UNIFICATION_PLAN.md).

**Important:** The design laws and fundamentals are *foundational rules*, not another style/theme. They apply equally to every selected visual direction. This catalog records *what exists and whether it is approved*; it does **not** authorize a new UI build or globally promote branch assets.

## Current repo truth

Inspected `main` at `00257395fe876c1c373c2365e7ccbdc784d0b889`, plus `feature/phase3-ui-foundation` at `bda6c32565c291d4a5a307f11c7cf43d5facbb83`. The unmerged branch has 107 files under `design/` versus 74 on current `main`; it also has 7 `apps/web/components/phase3/` prototype files. These are **tree-file counts**, not assertions that every file is a usable asset. The branch is not the production authority.

### What is already authoritative or shipped

| Component or asset | Verified repository owner | Reconciliation decision |
| --- | --- | --- |
| Official V2 brand board + mascot identity | `docs/brand/STUDIGO_OFFICIAL_BRAND_BOARD.png`, `docs/brand/mascot/reference/` | **Canonical**; protect and use as acceptance baseline |
| Exact design/material/color/type specification | `docs/DESIGN_SYSTEM.md`, `apps/web/app/globals.css` | **Canonical docs / shipped tokens**; no second token palette |
| Production mascot and companion | `apps/web/public/mascot/`, `apps/web/components/companion/` | **Shipped**; poses, eye tracking and interaction remain authoritative |
| Original sprites and reproducible exports | `design/companion-demo/assets/`, `build_public_demo.py` | **Production source**, not a reason to ship the demo's old page fixtures |
| Study Room shell, modes and section routing | `apps/web/components/room/workspace.tsx`, `apps/web/components/mode-glyph.tsx` | **Shipped**; preserve familiar mode navigation, 20px glyph system |
| Accepted Learn → Explore experience | `room/learn-mission.tsx`, `explore-journal.tsx`, `mission-control-icon.tsx`, `learn-progress-glow.tsx` | **Shipped and approved**; 24px action glyph system, compact 22px color-matched progress glow |
| App/browser icon images | `apps/web/app/icon.png`, `apps/web/public/icons/` | **Shipped**; derivatives of official mascot |
| Source citation design | `docs/brand/STUDIGO_GUIDED_LEARNING_BRAND_APPLICATION.png` | **Reference**, not proof every illustrated interaction is shipped |

### What should not be copied into production

| Location | Verified state | Decision |
| --- | --- | --- |
| `design/canvas.json`, `Main.dc.html`, `MainMobile.dc.html`, `DeskWorld.dc.html`, `EditorialBroadsheet.dc.html` on `main` | **Historical design canvas**; annotations still propose retired V1 paper/ink, Fraunces and Nunito typography, contrary to approved V2 Snow, Bricolage and Figtree | Keep as archived reference; do not use as current style tokens |
| `design/studigo-homepage-directions.html` | Earlier ~2.6 MB embedded homepage art exploration | Reference only; the real homepage lives in `apps/web/app/page.tsx` and production Home components |
| `design/companion-demo/` | Mix of source sprites/build and **non-production** example flows | Retain source; don't copy scripted demo behavior into production |
| `design/launch-film/` | Promo source and Remotion pipeline | Marketing only, not app UI authority |
| `docs/brand/STUDIGO_V2_PHASE3_VISUAL_BRAND_BOARD.jpg` | Generated concept, with unapproved lettering/example copy | Inspiration only; never substitute it for the official brand board |
| `design/phase3/brand/studigo-wordmark.svg` on proposal branch | Proposed orange-teal SVG wordmark | **Unapproved**; live text identity unchanged |
| `design/phase3/brand/studigo-logo-0147.svg` on proposal branch | **Invalid** 20-byte file containing literal `$(cat /tmp/logo.svg)`, not SVG source | Reject. Do not backport or import |
| `design/phase3/generated/ambient-snow-teal-source.png` | Decor-only generated background; provenance exists, publication rights/usage unapproved | Keep pending explicit rights/composition review; never use behind reading text |

### Valuable pending Phase 3 source — candidate, not approved

These exist on [`feature/phase3-ui-foundation`](https://github.com/WGLewis0721/Studigo-ai/tree/feature/phase3-ui-foundation/design/phase3), **not** in `main`:

- [16 original 24px icons](https://github.com/WGLewis0721/Studigo-ai/tree/feature/phase3-ui-foundation/design/phase3/icons/svg) and [manifest](https://github.com/WGLewis0721/Studigo-ai/blob/feature/phase3-ui-foundation/design/phase3/icons/manifest.json). Existing `ModeGlyph` and `MissionControlIcon` already cover some roles. Compare *semantics, accessible names, stroke weights and target sizes* before adopting any individual icon; never fork a third action-glyph vocabulary by default.
- [Seven presentational components](https://github.com/WGLewis0721/Studigo-ai/tree/feature/phase3-ui-foundation/apps/web/components/phase3) with prototypes for mode switch, objective rail, evidence ticket, choices, components/fixture. The accepted production Learn experience now supersedes the proposed objective rail/switcher. **Do not replace source-aware mission logic or revive the redundant quest tracker.**
- [Ambient source and WebP exports](https://github.com/WGLewis0721/Studigo-ai/tree/feature/phase3-ui-foundation/design/phase3/generated), [typography decision](https://github.com/WGLewis0721/Studigo-ai/tree/feature/phase3-ui-foundation/design/phase3/typography), [external research ledger](https://github.com/WGLewis0721/Studigo-ai/tree/feature/phase3-ui-foundation/design/phase3/research). Reference/review only; no automatic imports or claims of approved commercial usage.

## Decision and source-of-truth hierarchy

1. **Universal constraints and principles:** accessibility, data/source integrity, the [seven web-design pillars and Laws of UX](../docs/ux/FOUNDATIONAL_UX_PRINCIPLES.md).
2. **Brand identity:** official board, companion references, Design System. Unique expression lives here; it may evolve, but cannot overrule the fundamentals.
3. **Real production behavior:** current `main` React/CSS, the actual deployed app, verified browser screenshots, persisted learning state.
4. **Editable shipped-art sources:** buildable source sprites, scripts, official mascot derivatives.
5. **Unmerged explorations:** Phase 3 prototype branch, generated ambient visuals, alternate V1 artboards and any marketing work. Their presence in Git does not confer production approval.

When a source disagrees with verified production, record the discrepancy and resolve it in a reviewed PR. Do **not** silently prefer a newer-looking generated mockup or older design notes.

## Reconciliation outcome

- **Keep:** existing approved V2 palette, room shells, readable white surfaces, fonts, canonical orange Studigo mascot and approved Learn control semantics.
- **Reuse selectively:** original Phase 3 icons and genuinely new presentational states **only after** confirming no shipped equivalent.
- **Do not merge wholesale:** `feature/phase3-ui-foundation`, proposed `apps/web/components/phase3/` or alternate homepage artboards.
- **Do not duplicate:** design systems, mascot sprites, mission progress indicators, icon semantics, or production source cards.
- **Fix before adoption:** invalid SVG placeholder, generated-asset rights and the unapproved wordmark.
- **Future audit still needed:** real authenticated responsive screenshots (320/390/820/1440), 200% text/zoom, source/no-source, loading/error/paused states, contrast, keyboard and VoiceOver. This inventory reconciliation is **not** a claim those visual audits passed.

## Keeping it accurate

The root lint command now runs `node scripts/check-design-inventory.mjs`. It validates manifest shape, unique IDs/path+branch references, statuses, and every `main`-referenced asset path in the checked-out working tree. Branch-only assets remain clearly labeled and are not erroneously required to be checked out on `main`.

When promoting a candidate: move/copy an **approved** file via a scoped PR; add its new `main` path and owner; change state only after actual integration/tests; provide creator/source, rights/license, use case, render capture, reviewer decision, and rollback. Never mark a concept as shipped because the PR or inventory exists.

The next Visual Unification step is **V0 real-screen capture and defect inventory**; no page redesign is included in this documentation pass.
