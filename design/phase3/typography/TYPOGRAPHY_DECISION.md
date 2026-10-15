# Phase 3 typography decision

**Current approved stack:** Bricolage Grotesque for display, Figtree for UI/body, JetBrains Mono for small source/readout metadata. This is specified in `docs/DESIGN_SYSTEM.md` and loaded in `apps/web/app/layout.tsx` through `next/font/google`. The Phase 3 UI fixture uses those existing CSS variables, including fallbacks.

The user requested MyFonts research. A MyFonts creative search surfaced commercial display candidates including **Vitali Neue**, **Mariné**, and **Intro**. The green-marked board also shows a Poppins/Inter sample, while another blue-marked board shows the current stack. Those are **explorations**, not approval or licenses. The generated image's type labels cannot identify actual font files reliably.

**Decision:** Keep the approved stack for the UI assets. Improve scale, weight, optical sizing, line length and spacing first. The existing stack covers a young learner and a college learner without a new dependency or inconsistent brand. Do not package a MyFonts file without a verified license for web embedding, distribution and app use. Do not fake a specimen by naming a font in CSS when its file is unavailable.

## Specimen requirements for any later type change

Set the same copy in the proposed and current faces: a two-line mission heading, long college vocabulary, a 44px key label, source document names, page readout, choice card, 200% zoom and a narrow phone. Check capitals, numerals, punctuation, accents and fallback layout shift. If one custom glyph or wordmark is needed, draw original vector lettering with an explicit display-only scope; it does not justify replacing body type. Record exact family/version, foundry, license, WOFF2 source and fallback before any runtime change.

The icon family and tactile keys in this folder are font-independent SVG/CSS. They are usable without buying a typeface.
