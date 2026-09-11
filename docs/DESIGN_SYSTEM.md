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

## Authentication surfaces

Authentication is part of the Studigo product experience, but it has a different trust requirement from marketing and study surfaces.

### Login shell

Use the Studigo WebForge visual language around the sign-in controls:

- warm paper background or restrained field-guide texture
- strong editorial hierarchy
- compact Studigo wordmark
- optional companion pose used lightly
- short, useful copy such as `Welcome to Studigo` / `Your study companion is ready.`
- generous breathing room and a single obvious path forward

Do not turn login into another marketing page.

### Social provider buttons

Launch order in the UI:

1. Continue with Google
2. Continue with Apple
3. Continue with Microsoft
4. Email fallback below a visible divider
5. Facebook only if/when it is enabled later

Provider buttons are an exception to some of the more expressive WebForge styling rules. They should remain recognizable, accessible, and trustworthy.

- Keep provider name and icon obvious.
- Follow provider brand requirements where applicable.
- Do not replace provider identity with Studigo colors.
- Do not use offset novelty shadows that make a provider button look unofficial.
- Do not hide all social providers behind a generic `Continue` menu.
- Maintain clear keyboard focus and screen-reader labels.

The surrounding layout may use Studigo paper, ink, lavender, coral, and companion elements; the provider controls should optimize for familiarity.

### Auth states

Design all auth states intentionally:

- default sign-in
- signing in / redirecting
- callback processing
- provider error
- email fallback
- first-login onboarding
- expired session
- signed-out confirmation when useful

Never leave a user on a blank callback screen with no Studigo context.

### Onboarding

Onboarding should feel like the first page of the field guide, not a lengthy account questionnaire.

Prioritize only information needed to improve the study experience. A new user should be able to reach `Create Study Room` quickly.

## Original Studigo companion

The V1 companion is an original inline SVG: lavender body, paper-like belly, book/page ear shapes, and an open-book motif. It is intentionally simple enough to evolve later without locking the product into an external character asset or copyrighted visual language.

Future companion work may create poses for:

- Ready to study
- Thinking / retrieving sources
- Correct answer / mastery gain
- Needs review
- Cram mode
- Uploading / reading material
- Welcome / authentication
- First Study Room onboarding

All future assets must be original to Studigo.

## Motion

Motion must communicate state or character.

- Companion idle float: slow and subtle.
- Buttons: small physical offset, not glow-heavy animation.
- Learning trail: future implementation should animate state changes, not continuously pulse everything.
- Auth redirects/callbacks: use subtle progress feedback; never animate in a way that makes provider redirects feel suspicious or slow.
- Respect `prefers-reduced-motion`.

## Responsive behavior

Desktop and mobile are different compositions, not simple scale-downs.

- Desktop: full study-room rail + two-column mastery/tutor workspace.
- Tablet: study-room rail remains, tutor stacks beneath mastery.
- Mobile: rail disappears, trail and tutor become sequential, modes become a vertical action list, hero notes reposition around the companion.
- Auth: keep provider controls full-width and thumb-friendly on small screens; avoid two-column provider layouts on mobile.

## Product UI hierarchy

The primary student loop is:

1. Enter Study Room
2. See what matters next
3. Learn / ask / quiz
4. See evidence/source
5. Update mastery
6. Continue

The first-run loop is:

1. Sign in with a familiar provider
2. Complete minimal onboarding
3. Create first Study Room
4. Upload class material
5. Start studying

Design should make both loops faster than opening multiple files, tabs, or apps.

## WebForge guardrails

- Reference-driven, never reference-cloned.
- No stock imagery as visual identity.
- No unrelated dashboard metrics.
- No decorative motion that delays reading.
- No gratuitous icons or pills.
- No framework migration for visual work alone.
- Preserve backend/API/auth contracts while the frontend evolves.
- Social sign-in controls prioritize trust and provider recognition over novelty.
- Validate rendered responsiveness, accessibility, and build health on every major pass.
