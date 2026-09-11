# Studigo Design System — WebForge V1

## Product character

Studigo should feel like a **living study field guide with a companion inside it**, not an education SaaS dashboard and not a children's game. The interface is playful enough to be memorable, structured enough to trust for schoolwork, and grounded enough to keep the student's material—not generic AI—at the center.

## Core visual idea

**Study quest / living field guide**

- Warm paper and notebook surfaces instead of default white SaaS canvas.
- Deep ink blue provides structure and trust.
- Lavender belongs to the Studigo companion.
- Acid-lime is used for progress, active learning, and earned momentum.
- Coral is used for emphasis and key moments, never as a generic gradient accent.
- Visible borders, offset shadows, paper overlaps, and small hand-made irregularities make the product feel tactile.
- No generic glassmorphism, floating gradient blobs, repetitive rounded card grids, or excessive pills.

## Typography

- Display: **Fraunces** — expressive, academic, warm, used for headlines and key narrative moments.
- UI/body: **Nunito Sans** — friendly without becoming childish.
- Labels use compact uppercase tracking to create field-guide/navigation rhythm.

## Color tokens

| Token | Value | Role |
| --- | --- | --- |
| Paper | `#F4EFE4` | Primary canvas |
| Bright paper | `#FFFDF7` | Reading surfaces |
| Ink | `#1D2944` | Navigation, structure, primary text |
| Moss | `#76977A` | Grounded/complete state |
| Volt | `#D7EF78` | Active progress, momentum |
| Lavender | `#B9B5EF` | Studigo companion identity |
| Coral | `#EF7E62` | Editorial emphasis/action |
| Sun | `#F0C75E` | Secondary highlight |

## Composition rules

1. The product experience should be visible before generic feature marketing.
2. Sections should change rhythm: editorial hero, dark statement strip, application frame, source-priority table, physical paper composition.
3. Cards are allowed only when the content is genuinely card-like. Do not turn every concept into a rounded rectangle.
4. Mastery/progress should be spatial and actionable, not reduced to a decorative percent bar.
5. Source citations should look tangible and traceable.
6. The Studigo companion may appear in onboarding, empty states, learning feedback, and active tutoring—but should not overwhelm serious study moments.

## Original Studigo companion

The V1 companion is an original inline SVG: lavender body, paper-like belly, book/page ear shapes, and an open-book motif. It is intentionally simple enough to evolve later without locking the product into an external character asset or copyrighted visual language.

Future companion work may create poses for:

- Ready to study
- Thinking / retrieving sources
- Correct answer / mastery gain
- Needs review
- Cram mode
- Uploading / reading material

All future assets must be original to Studigo.

## Motion

Motion must communicate state or character.

- Companion idle float: slow and subtle.
- Buttons: small physical offset, not glow-heavy animation.
- Learning trail: future implementation should animate state changes, not continuously pulse everything.
- Respect `prefers-reduced-motion`.

## Responsive behavior

Desktop and mobile are different compositions, not simple scale-downs.

- Desktop: full study-room rail + two-column mastery/tutor workspace.
- Tablet: study-room rail remains, tutor stacks beneath mastery.
- Mobile: rail disappears, trail and tutor become sequential, modes become a vertical action list, hero notes reposition around the companion.

## Product UI hierarchy

The primary student loop is:

1. Enter Study Room
2. See what matters next
3. Learn / ask / quiz
4. See evidence/source
5. Update mastery
6. Continue

Design should make this loop faster than opening multiple files, tabs, or apps.

## WebForge guardrails

- Reference-driven, never reference-cloned.
- No stock imagery as visual identity.
- No unrelated dashboard metrics.
- No decorative motion that delays reading.
- No gratuitous icons or pills.
- No framework migration for visual work alone.
- Preserve backend/API contracts while the frontend evolves.
- Validate rendered responsiveness, accessibility, and build health on every major pass.
