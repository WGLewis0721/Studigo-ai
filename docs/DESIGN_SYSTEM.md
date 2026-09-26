# Studigo Design System — Personal Learning Device (V2)

> Supersedes **WebForge V1** ("living study field guide"). V1's product rules —
> product before marketing, tangible citations, spatial mastery, a subordinate
> companion, recognizable provider sign-in — carry forward unchanged. Its
> paper-and-ink *look* is retired. See [What changed from V1](#what-changed-from-v1).

## Thesis

Studigo is a **personal learning device**.

Picture the translucent, colorful consumer technology of 1998–2004 — molded
shells you chose by color, pocket companions with a tiny persistent character,
glossy tactile controls, TV brands that could change shape and stay themselves —
continuing to evolve for twenty-five years, and then being disciplined by modern
product design: ruthless hierarchy, large product presentation, generous space,
excellent type, purposeful motion.

It should read **colorful before nostalgic, modern before retro, useful before
decorative**. No single reference should be recognizable; none of their
trademarks, characters, layouts or branded shapes are used.

Design from roughly age 14 outward: an 8-year-old should think *"this looks fun
and I know what to press"*; an 18-year-old should think *"this looks cool"* and
never *"this is for little kids."*

## Principles

1. **Neutral room, concentrated color.** Snow and ink carry structure. Color is
   concentrated in the product: shells, keys, mode identity, state. Never spread
   every color evenly across a page.
2. **Color is identity and navigation.** Every study mode has a named color;
   every Study Room has a shell color. Color helps you know where you are and
   remember what you did there.
3. **Every material has a reason.** A surface looks deliberately manufactured
   from one material (below). No random blurred rectangles.
4. **Reading surfaces stay calm.** Explanations, answers and documents sit on
   plain white with ink text. Translucency and gloss are for navigation,
   controls and special surfaces — never under long-form text.
5. **Never color alone.** Correct/incorrect, confidence, status and priority
   always have text or shape as well as color.
6. **The product is the hero.** On the marketing site the interface itself is
   presented as the desirable object.

## Color

### Neutrals

| Token | Value | Role |
| --- | --- | --- |
| `--snow` | `#F7F8FB` | App and marketing canvas |
| `--snow-2` | `#EEF1F6` | Recessed wells, secondary fills |
| `--snow-3` | `#E3E7EF` | Deeper wells, inactive fills |
| `--white` | `#FFFFFF` | Reading surfaces, keys |
| `--ink` | `#141B2D` | Primary text, neutral primary key |
| `--ink-2` | `#39435A` | Body text |
| `--muted` | `#5D6780` | Labels, hints (AA on white, snow and snow-2) |
| `--graphite` / `--graphite-2` | `#1D2433` / `#2B3346` | Dark "screen" surfaces, student bubbles, Practice test |

### Shell colors

Each color has a **base** (fills, shells, glows), an **-ink** (text on white,
WCAG AA), a **-soft** tint (selected wells), and a **key** shade when it is a
filled control carrying text.

| Name | Base | -ink | -soft | Text on a filled key |
| --- | --- | --- | --- | --- |
| Blueberry | `#3C7CFF` | `#1D5BDB` | `#E7EFFF` | white on `#2B69F0` |
| Grape | `#7A5AF0` | `#5A3BD0` | `#EFEBFE` | white |
| Berry | `#F0457A` | `#C01D52` | `#FFE8EF` | white on `#D42D63` |
| Tangerine | `#FF8A3D` | `#B24A0A` | `#FFEFE2` | ink |
| Kiwi | `#93D93F` | `#3A7010` | `#EEF9DF` | ink |
| Dandelion | `#FFD23F` | `#7A5800` | `#FFF6D4` | ink |
| Teal | `#1FC3B6` | `#09756D` | `#DDF6F3` | ink |
| Indigo | `#4A55C8` | `#3440A8` | `#E8EAFB` | white |

Tangerine is also the companion's own color (the orange scholar), which is why
it belongs to Coach.

### Mode colors

Set with `data-tone="<mode id>"`; the workspace root carries the current mode,
so the whole room re-tints (the `--tone` custom property is registered with
`@property` so the change animates).

| Mode | Color | Why |
| --- | --- | --- |
| Learn | Blueberry | Calm, explanatory, trustworthy |
| Ask, Materials | Teal | "Your material speaking" — the source color; citations are teal everywhere |
| Coach, Cram | Tangerine | The companion's color; warmth and energy |
| Quiz | Dandelion | Attention, a focused challenge |
| Flashcards | Grape | The collectible, physical deck |
| Practice test | Graphite | The serious full rehearsal |
| Mastery | Kiwi | Growth, earned progress |
| Weak areas | Berry | What needs you next |
| Study plan | Indigo | Steady, time-based structure |

State colors are separate from mode colors: **kiwi = strong/correct**,
**dandelion = learning/needs work**, **berry = wrong/blind spot/destructive**,
**teal = grounded in your sources**, **tangerine-ink = not in your sources**.

### Room shells

Every Study Room is shown in one of Blueberry, Tangerine, Grape, Kiwi, Berry or
Teal, derived deterministically from the room id (`lib/room-shell.ts`). It is
cosmetic — it never encodes state and needs no schema. It appears as a glossy
"gem" in the rail and topbar and as the molded shell of the room card.

## Materials

| Material | Look | Used for |
| --- | --- | --- |
| **Matte white** | White, hairline edge, top edge highlight, soft lift | All reading surfaces, cards, answers, documents |
| **Recessed well** | Snow-2, inner shadow | Inputs' context, progress tracks, examples, meters, the Socratic check |
| **Molded key** | Solid color, subtle top gloss, darker bottom lip, presses down 1px | Primary actions, send, confidence and rating keys |
| **Translucent polycarbonate** | Tinted gradient, bright top highlight, colored inner depth, colored cast shadow | Room cards, the hero device shell, score cards |
| **Frosted plastic** | Blurred translucent white | Navigation only: topbar, marketing nav, mobile rail |
| **Dark screen** | Graphite with a faint colored glow | Readouts: mastery ring, cram timer, practice-test score, student bubbles |
| **Clear tray** | Translucent white over a color field | The source bay on the marketing page |

Tokens: `--edge`, `--recess`, `--gloss`, `--gloss-key`, `--lift-1/2/3`.

## Geometry

- Radii: `8 · 12 · 16 · 22 · 30 · 40`. Nest concentrically (inner = outer − padding).
- Keys are **chunky rounded rectangles** (14–17px radius, 44–58px tall).
- Pills only where the object is semantically a chip: source-type chips, topic
  chips, tags, the shell picker.
- The mode dial is a **segmented control** (groups) above **mode keys** with a
  colored keycap glyph. Glyphs come from `components/mode-glyph.tsx` — one
  stroke weight, one grid, always paired with a text label.
- Circular physical references: the readiness ring, the companion's screen
  bezel, the concentric dial on the marketing CTA.

## Typography

| Role | Face | Notes |
| --- | --- | --- |
| Display | **Bricolage Grotesque** (700–800, optical size axis) | Headlines, room titles, card faces, big numbers. Personality lives here. Tracking −0.03 to −0.035em. |
| UI / body | **Figtree** (400–800) | Everything you read and press. Geometric, friendly, very legible; not childish, not enterprise. |
| Readout | **JetBrains Mono** (500–600) | Page numbers, citation markers, counts, timers, percentages in tiles — the "device readout" voice. Use sparingly. |

Fonts are self-hosted through `next/font/google` in `app/layout.tsx` (a remote
CSS `@import` is dropped by the build pipeline and was never loading).
Small labels are uppercase, 0.7rem, 700, +0.08em — the printing on a device.

## Motion

Motion communicates state or character. One choreographed load sequence beats
many unrelated animations.

- **Marketing load:** headline lines rise in sequence → the device lifts → source
  objects drift in → the citation ticket lands. Shell-color changes crossfade.
- **Scroll:** where `animation-timeline: view()` is supported, cartridges, tiles
  and cards rise as they enter. Progressive enhancement only.
- **Workspace:** the room re-tints over 0.5s when the mode changes; each mode's
  content enters with a 6px rise. Keys press down.
- **Flashcards:** a real 3D flip.
- **Companion:** "thinking" breathes the bezel; "celebrate" lands once.
- **`prefers-reduced-motion`:** animations, delays and transitions are removed;
  the flashcard swaps faces without rotation; nothing waits on motion to appear.

## The companion

The canonical companion is the orange scholar with a cream belly, green vest,
crayon/writing tail and small flame. Preserve the asset library in
`docs/brand/mascot/` and `apps/web/public/mascot/`. Do not replace it.

The world around it is what changed: the companion now **lives in a small screen
set into a bezel of the current tone** — the device it inhabits. The cream of
the source art becomes the screen material, so it reads as intended rather than
as a pasted square.

`StudigoMascot` is the one component. Its state follows real events: `welcome`,
`explain`, `thinking` (while retrieving/streaming), `sources`, `celebrate`
(a finished deck, a strong test). Sizes: 28–40px in identity and answer labels,
56–96px in empty/completion states, at most ~150px beside the marketing product
view. The full figure is never cropped except in the circular `mark`. No
fullscreen mascot, no mascot-led readiness, no reward economy.

Use it for: greeting, thinking, explanation, source retrieval, encouragement,
meaningful success, and empty states.

## Surfaces

### Marketing (`app/page.tsx`, `app/home.css`)

A product launch, in this order: floating frosted nav → **hero device** (the
Study Room as a translucent colored device, with a working shell-color picker)
→ the five-step loop as keys → **Sources** teal color field (priority as
cartridges in a tray) → **Modes** showcase (tabs, each an oversized mode view in
its color) → **Mastery** graphite field with a kiwi readout → **Receipts**
(answer, ticket, the cited page) → questions → Tangerine closing field.
All example progress is labeled illustrative.

### Study Room

- **Topbar** (frosted): room gem, crumb, title; sources-ready chip, Download
  study guide, settings.
- **Mode dial**: groups as a segmented control; modes as keys with a colored
  keycap. The dial area is tinted by the current mode.
- **Reading surfaces** are matte white. Teal citation **tickets** (numbered
  stub + document + mono page + open arrow) open the learner's original file.
- **Materials**: the upload dropzone is a **media bay** with a slot that lights
  when a file is dragged over; documents are **cartridges** whose colored spine
  says the source type (study guide = tangerine, handouts = blueberry,
  worksheets = dandelion, slides = grape, notes = kiwi, textbook = teal).
  Each has a text status (Ready / Reading / Queued / Needs attention).
- **Ask/Coach**: graphite student bubbles, white answers with a teal
  "from your materials" or tangerine "not in your materials" label, a capsule
  composer with a round send key.
- **Quiz**: one question on a white stage; answers are keys with letter caps;
  confidence keys carry a 1–3 bar meter; after grading, choices say
  "✓ Correct answer" / "✕ Your answer" in text.
- **Flashcards**: a card with a deck beneath it and a real flip.
- **Mastery**: a dark readout (ring), stat wells, calibration, next practice,
  and every topic as a **tile map** with a fill level.

### Authentication

Calm and minimal: form on snow, a blueberry polycarbonate panel with the
companion and three promises. **Provider buttons keep the provider's look** —
no Studigo color, gloss or novelty shadow; name and logo obvious; full width on
phones. Launch order: Google, Apple, Microsoft, then email under a divider.

### Loading, empty and error states

- `app/app/loading.tsx`: the companion thinking and a sweeping key-color bar.
- `app/app/error.tsx`: says nothing saved was lost; Try again / All rooms.
- Every mode's empty state pairs the companion with one clear next action.
- First run (no rooms) is a three-step onboarding card, not a blank grid.

## Responsive

- **Desktop:** frosted rail + workspace.
- **Tablet:** rail remains; multi-column sections collapse to one.
- **Phone:** the rail becomes a frosted top bar with a scrolling room strip; the
  mode dial fits without sideways scrolling (segmented groups on one row, mode
  keys as equal columns with the icon above the label); marketing floats
  reposition inside the device; shell-picker names collapse to swatches
  (accessible names kept).

## Accessibility

- Text pairs meet WCAG AA (see the table above; filled blueberry/berry keys use
  a darker key shade for white text).
- Visible `:focus-visible` ring in the current tone's ink everywhere.
- Radio groups (shell picker) and tabs (mode showcase) support arrow keys with
  roving tabindex.
- Decorative product mock-ups are exposed as a single labeled image.

## Guardrails

Avoid: generic AI purple gradients, generic glassmorphism, Web3 gloss, beige
minimalism, corporate education dashboards, classroom clip art, notebook-paper
UI, maximalist Y2K chrome, cyberpunk, vaporwave, retro OS parody, CRT
scanlines, pixel fonts as primary type, copied brands, a mascot on every
screen, meaningless gradients, badge clutter, endless identical card grids.

Colorful is not chaotic. Minimal is not colorless. Premium is not beige.
Youthful is not childish.

Implementation rules carried from V1: no framework migration for visual work;
preserve backend/API/auth contracts; validate rendered responsiveness,
accessibility and build health on every major pass.

## What changed from V1

| V1 (WebForge, field guide) | V2 (Personal Learning Device) | Why |
| --- | --- | --- |
| Warm paper `#F4EFE4` with a 32px grid | Snow `#F7F8FB`, no texture | Paper read as "school"; snow lets color lead |
| Fraunces serif + Nunito Sans | Bricolage Grotesque + Figtree + JetBrains Mono | Consumer technology, not an editorial field guide |
| Hard offset "print" shadows, square corners | Soft lift, edge highlights, molded rounded keys | Tactile, not paper cut-outs |
| Moss / volt / lavender / coral / sun | Eight named shell colors with ink/soft/key variants | Color as identity and navigation |
| One lime active state for everything | A color per mode, a shell per room | Places you can recognize |
| Mascot on a paper square | Mascot in a screen with a tone bezel | The companion lives in the device |

Kept from V1: product before marketing, tangible citations, spatial mastery,
the companion used sparingly and truthfully, recognizable provider sign-in,
motion only for state or character.
