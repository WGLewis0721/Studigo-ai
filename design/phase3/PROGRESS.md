# Phase 3 UI production ledger

**Working branch:** `feature/phase3-ui-foundation` · **Status:** in progress · **Scope:** design assets and a reusable UI foundation while Phase 2 continues. This ledger records evidence; an image in a mood board is not a production asset or a shipped screen.

## Source and approval rules

1. `docs/brand/STUDIGO_OFFICIAL_BRAND_BOARD.png`, `docs/DESIGN_SYSTEM.md`, and `docs/brand/README.md` govern current identity and exact tokens. The Phase 3 application and visual boards are concept references; the three marked images' green selections drive composition, red marks exclude elements, and blue marks remain exploratory.
2. The canonical companion is the existing orange scholar under `docs/brand/mascot/` and `apps/web/public/mascot/`. Do not replace or multiply it from a generated concept.
3. Poppins/Inter appears in one green reference; the currently approved Bricolage Grotesque/Figtree/JetBrains Mono stack is specified in the repo. A font change needs a specimen, web-use license, coverage/fallback check and explicit approval. A newly drawn wordmark also remains proposed until approval.
4. Third-party components and assets need a source URL, author, license, version/date, modifications and destination. Inspiration is not an asset license. Generated imagery needs prompt/model provenance and an explicit concept/approved status.

## Outcome and delivery board

Status key: **NOT STARTED**, **IN PROGRESS**, **REVIEW**, **ACCEPTED**, **BLOCKED**. `REVIEW` means the deliverable exists but lacks the plan's acceptance proof. Only mark `ACCEPTED` with linked repository evidence and a dated decision.

| ID | Deliverable and acceptance proof | Status | Evidence / gap |
| --- | --- | --- | --- |
| D1 | Current UI and asset inventory; keep/adapt/create/retire decisions tied to exact paths and marked boards | IN PROGRESS | [`INVENTORY.md`](INVENTORY.md) maps current repo owners and green/red/blue decisions; [`research/REFERO_21ST_REFERENCE_LEDGER.md`](research/REFERO_21ST_REFERENCE_LEDGER.md) records selected external references in [research commit](https://github.com/WGLewis0721/Studigo-ai/commit/43efc233). Need current live captures and visual comparison before D1 acceptance. |
| D2 | Editable art system specimen: exact tokens, materials, type, state matrix, contrast on composited surfaces | IN PROGRESS | Local-only [`/dev/phase3/system`](../../apps/web/app/dev/phase3/system/page.tsx) renders editable color/type/key/mode/rail/ticket/choice/icon specimens from [`system-preview.tsx`](../../apps/web/components/phase3/system-preview.tsx), [`ui.tsx`](../../apps/web/components/phase3/ui.tsx), and [`phase3.css`](../../apps/web/components/phase3/phase3.css). [`COMPONENT_STATES.md`](COMPONENT_STATES.md) records state ownership and flat token contrast; ratios independently recalculated at this audit. Need complete loading/error/pressed specimens, composited contrast, forced-colors/200% zoom and screenshots. |
| D3 | Production identity asset package: icon family and any proposed lettering; license and approval status for each | IN PROGRESS | [Icon/type commit](https://github.com/WGLewis0721/Studigo-ai/commit/7eb1e2ee): [`icons/manifest.json`](icons/manifest.json), [`icons/export.py`](icons/export.py), 16 SVGs, generated React glyphs and specimen form an original proposed action/evidence family. [`typography/TYPOGRAPHY_DECISION.md`](typography/TYPOGRAPHY_DECISION.md) records MyFonts exploration and retains the approved stack; no commercial files copied. [Higgsfield commit](https://github.com/WGLewis0721/Studigo-ai/commit/6c861c44): generated [Snow/Teal ambient plate](generated/README.md) has prompt/model/edit recipe and proposed status. Need field/render/accessibility review, specific asset approval and provenance/right-to-use resolution for ambient publication. |
| D4 | Connected three wide compositions and seven phone states, plus original/partial-source recovery | IN PROGRESS | [`MissionPreview`](../../apps/web/components/phase3/mission-preview.tsx) links entry, brief, show, try, check, completion and source pane using the [synthetic fixture](../../apps/web/components/phase3/fixture.ts). The system specimen now shows static missing/partial/stale recovery cards with inert actions until real adapters exist. Need captured three wide/seven phone states, integrated original/partial/stale recovery and second age-context fixture. |
| D5 | Clickable/coded responsive interaction prototype with real state transitions and no Learn mastery claim | IN PROGRESS | [`/dev/phase3`](../../apps/web/app/dev/phase3/page.tsx) is a local-only design fixture, with no network, durable cursor, grading or actual mic capture. Needs behavior/state matrix and cross-width walkthrough. A static fixture never closes UX S1. |
| D6 | Reproducible integration handoff: source, exports, tokens, icons, fonts, fixture, export/build instructions and React/CSS ownership map | IN PROGRESS | [`README.md`](README.md) inventories source and reproduction commands; [`INVENTORY.md`](INVENTORY.md) maps existing and future owners; [`COMPONENT_STATES.md`](COMPONENT_STATES.md) maps primitives and known interaction boundaries. Need captured preview evidence, asset-specific approval/rights and actual cross-width visual checks. |

| Outcome | Proof still needed |
| --- | --- |
| A · Recognizable identity | Side-by-side phone and wide contact sheet, token map, same control language with logo obscured. |
| B · Clear first action | Five-second novice identification of mode and primary action; no critical action hidden by fold or companion. |
| C · Tangible evidence | Verified fixture, readable passage at 200% zoom, honest missing/stale/OCR-uncertain states. |
| D · Touchable interaction | Normal/pressed/selected/focus/loading/disabled/error states on touch, pointer and keyboard; reduced-motion equivalent. |
| E · Age-flexible warmth | Same visual system on elementary and college fixtures without a replacement character or classroom clip art. |
| F · Responsive fidelity | Compact phone, large phone, tablet and desktop captures with no clipped text or horizontal scroll. |

## UX dependency boundary

The visual foundation may ship as design source and isolated components. It is not the completed Guided Learn UX. The `STUDIGO_V2_PHASE3_UX_IMPLEMENTATION_PLAN.md` gates remain:

| Slice | Current claim | Evidence needed before closing |
| --- | --- | --- |
| S0 baseline/contract | NOT STARTED | Current-state captures, event/state table, component ownership and permission-safe elementary/college fixtures. |
| S1 first flagged mission | NOT STARTED | Start, act, formative feedback, reload/resume, idempotency, verified Find it, zero Learn mastery writes on phone and wide. |
| S2 source/input | NOT STARTED | Verified passage or honest absence, tap-only path, reviewed speech with permission/error/retry paths. |
| S3 support/recovery | NOT STARTED | Hint/read-aloud, existing companion, stale-source recovery, original-file access and topic-preserving handoff. |
| S4 pilot/release | NOT STARTED | Four-width comparison, assistive-tech check, two-cohort observed learning and transfer; fallback retained until acceptance. |

## Decisions and risks

| Date | Decision / risk | Resolution evidence |
| --- | --- | --- |
| 2026-10-14 | Keep existing official type and wordmark in production while alternate specimens are explored. Generated orange/teal lettering is concept-only. | Pending explicit product-owner approval for any replacement. |
| 2026-10-14 | External component libraries and icon references can inform craft but must not override token grammar, accessibility or ownership. | Record license/source in asset manifest before copying code or graphics. |
| 2026-10-14 | Higgsfield output may help mood/visual effects but generated lesson text, citations, mascot redesigns and raster UI lettering cannot be promoted as factual/approved UI. | Store prompt/model, source images, generation date, human edits and usage status. |
| 2026-10-14 | Phase 2 continues in parallel. Avoid changing current production learning behavior on the visual-foundation branch. | Keep any working UI isolated/flagged and record exact dependencies on Phase 2. |
| 2026-10-14 | Preview interaction audit: Pause originally reset immediately; overlays lacked a focus loop; radio choices lacked arrow keys. | Corrected in the design preview: component-local paused state, source/voice Tab loop and Escape return, radio arrow navigation. Durable resume and real microphone remain UX implementation work. |
| 2026-10-14 | Synthetic source ticket originally said “FROM YOUR MATERIAL.” | Corrected to “DESIGN FIXTURE” in the preview. The public fixture remains synthetic. |
| 2026-10-14 | Preview typecheck/build passed, but rendered screenshot QA remains blocked by browser availability. Playwright is installed without Chromium; a browser install attempt returned an invalid 0 MiB CDN archive. | No captures or visual/clipping inspection were made. Use a browser-capable runner or preview deployment for four-width, 200% zoom, focus and reduced-motion acceptance; do not close A–F or D4/D5. |

## Increment log

| Date | Commit / worktree | Scope | Evidence | Acceptance |
| --- | --- | --- | --- | --- |
| 2026-10-14 | [`43efc233`](https://github.com/WGLewis0721/Studigo-ai/commit/43efc233) | Refero and 21st.dev precedent and rights ledger | [`research/REFERO_21ST_REFERENCE_LEDGER.md`](research/REFERO_21ST_REFERENCE_LEDGER.md) | Research recorded; D1 still in progress. |
| 2026-10-14 | [`7eb1e2ee`](https://github.com/WGLewis0721/Studigo-ai/commit/7eb1e2ee) | Original icon exports/React glyph, MyFonts decision and folder handoff | [`icons/`](icons/), [`typography/`](typography/), [`README.md`](README.md) | Proposed; renderer and accessibility review pending. |
| 2026-10-14 | [`6c861c44`](https://github.com/WGLewis0721/Studigo-ai/commit/6c861c44) | One Higgsfield ambient source and deterministic derivatives | [`generated/README.md`](generated/README.md), [`generated/build_ambient.py`](generated/build_ambient.py) | Proposed decorative only; licensing/publication decision pending. |
| 2026-10-15 | [`77dc38c5`](https://github.com/WGLewis0721/Studigo-ai/commit/77dc38c5) | Coded design fixture, system specimen, inventory/state handoff, corrected focus/choice/pause semantics | `apps/web/app/dev/phase3/`, `apps/web/components/phase3/`, [`INVENTORY.md`](INVENTORY.md), [`COMPONENT_STATES.md`](COMPONENT_STATES.md) | Typecheck/build passed; flat contrast ratios recalculated; screenshot QA blocked. D1/D2/D4/D5/D6 remain in progress. |
| 2026-10-15 | [`55f6739f`](https://github.com/WGLewis0721/Studigo-ai/commit/55f6739f) | Static missing/partial/stale source recovery specimens | [`ui.tsx`](../../apps/web/components/phase3/ui.tsx), [`system-preview.tsx`](../../apps/web/components/phase3/system-preview.tsx) | No fake file or retry action; integration and rendered QA pending. |

## Review update format

For every committed increment, append a short line: `date · commit · D# / A–F · created/verified · evidence path · approval status · next gap`. Do not mark a deliverable accepted merely because files exist. Link a capture or runnable path, exact source/license, and the acceptance observation.
