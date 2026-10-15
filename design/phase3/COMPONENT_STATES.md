# Phase 3 component and state handoff

The editable specimen is `/dev/phase3/system`; the connected synthetic journey is `/dev/phase3`. Both return 404 in a production build. Source: `apps/web/components/phase3/`. The approved token definitions remain in `apps/web/app/globals.css`; the scoped preview compositions live in `phase3.css`. This is a visual foundation, not a live lesson.

| Primitive | Normal | Interaction and selected state | Disabled / unavailable | Owner |
| --- | --- | --- | --- | --- |
| Tactile key | 48px minimum; solid Teal, Blueberry, Dandelion, Tangerine or quiet matte | CSS hover lift and press depth; visible `:focus-visible` outline; label and glyph | Native `disabled`, still legible in context; pending state needs a future async contract | `ui.tsx` `Phase3Key`, `phase3.css` |
| Mode switch | Learn / Coach / Practice, words and existing glyphs | `aria-pressed`; active fill follows role; keyboard buttons | Actual routing and topic retention belong to room owner | `ui.tsx` `ModeSwitch` |
| Objective rail | Brief → Show → Try → Check | Current `aria-current="step"`, previous complete, upcoming muted | No fake completion on an unavailable step | `ui.tsx` `ObjectiveRail` |
| Choice key | Radio label and large target | Arrow keys move focus and choice; selected uses filled radio and border | Submit key stays disabled until choice or reviewed example transcript | `ui.tsx` `ChoiceKeys`, `mission-preview.tsx` |
| Evidence ticket | Title, page and fixture/source label | Opens source pane with close/Escape and trigger return in preview | Future missing/partial/stale sources need explicit unavailable and retry states; never fabricate a page | `ui.tsx` `EvidenceTicket` and `SourceSpotlight` |
| Read aloud | Labeled button | Browser speech synthesis starts/stops example explanation | Device unsupported/error path needs production handling | `mission-preview.tsx` |
| Voice review | Labeled example text box | Review/edit before using transcript in fixture | No mic access; production permission, silence and retry flows remain pending | `mission-preview.tsx` |

## Contrast measurements

WCAG relative luminance calculation from the flat brand tokens, rounded to two decimals. These are **token pair checks**, not a rendered audit of translucent layers, focus ring adjacency, gradients, browser font rasterization, or 200% zoom.

| Foreground / surface | Ratio | Intended use |
| --- | ---: | --- |
| Ink `#141B2D` / White `#FFFFFF` | 17.15:1 | Reading on lesson card |
| Ink 2 `#39435A` / White | 9.88:1 | Supporting copy |
| Teal Ink `#09756D` / White | 5.56:1 | Link/action text |
| Teal Ink / Teal Soft `#DDF6F3` | 4.91:1 | Selected text |
| Ink / Teal `#1FC3B6` | 7.79:1 | Learn key label |
| Ink / Dandelion `#FFD23F` | 11.88:1 | Hint key label |
| Ink / Tangerine `#FF8A3D` | 7.31:1 | Coach/speech key label |
| White / Blueberry Ink `#1D5BDB` | 5.88:1 | Blueberry key (uses darker fill, not base Blueberry) |

`#FFFFFF` on base Blueberry `#3C7CFF` is only 3.80:1, so the white-label key uses Blueberry Ink and a darker lower stop. Generated ambient art stays outside reading panels. Full composited contrast, forced colors and assistive technology review remain acceptance work.

## Source and state boundary

The fixture content in `fixture.ts` is original synthetic copy. It is explicitly marked **DESIGN FIXTURE** in the card, ticket, pane, and sidebar. It demonstrates the physical source relationship without asserting an uploaded material or authorized citation. The production mapping requires a real `EvidenceRef`, a verified page/block, and honest missing, stale, OCR-uncertain or access-denied recovery. Nothing in this package writes Learn mastery or grades an answer.

## Reproduction and review

Run `corepack pnpm --filter @studigo/web dev`, then inspect `/dev/phase3/system` and `/dev/phase3` at compact phone, large phone, tablet, and desktop widths. Activate each key with pointer and keyboard, tab through the dialog, zoom to 200%, enable reduced motion, and verify source text on matte white. Capture those results before accepting D2/D4 or visual outcomes A–F. The CSS and components are reviewable source now; no screenshot QA is claimed here.
