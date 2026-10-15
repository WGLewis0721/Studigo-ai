# Phase 3 generated visual material

These are **proposed decorative assets**, not approved product identity or factual lesson content. They do not replace the official brand board, canonical mascot, typography, icons, or citation UI. Keep all text and controls in code on opaque reading surfaces.

## Ambient Snow / Teal plate

| Item | Value |
| --- | --- |
| Source | `ambient-snow-teal-source.png` (1344 × 768), generated 2026-10-15 UTC through Higgsfield |
| Model | `recraft_v4_1`, standard, 1k, 16:9 |
| Job ID | `378e9083-2fe2-4103-913a-1bb6b4d0ee2c` |
| Cost | 1.25 Higgsfield credits preflight; one job submitted |
| Status | Proposed; review in context before runtime use |
| Usage | Optional edge lighting behind the home/room entry composition; never behind lesson body copy, documents, or source passages |
| Source license | Original generation in the user's Higgsfield workspace; verify applicable Higgsfield output rights before publication |

Prompt (verbatim):

> Original abstract atmospheric background plate for Studigo learning app home entry. Spacious Snow-white #F7F8FB field with very subtle translucent teal #1FC3B6 polycarbonate caustics and a faint blueberry #3C7CFF edge glow flowing in from the far right and upper corners. Material feeling: modern translucent colored plastic, premium restrained lighting, calm 2D/3D hybrid. Center and left 65 percent remain almost entirely clear Snow-white negative space for overlaid interface and readable text. No objects, no device, no controls, no mascot, no characters, no books, no letters, no symbols, no brand logo, no texture noise, no strong patterns. Suitable as an optional decorative backdrop behind matte reading panels; not a UI mockup. Wide landscape composition.

The raw render has a dark teal corner stronger than the design system permits at full opacity. `build_ambient.py` composites it over official Snow (`#F7F8FB`) at 17% on wide and 12% on compact. Run `python build_ambient.py` with Pillow installed. Outputs are `exports/ambient-snow-teal-wide.webp` and `exports/ambient-snow-teal-compact.webp`. The script is the reproducible edit source; do not silently promote the raw render.

For UI integration, position the export at the far edge of a **decorative** container with `aria-hidden="true"` and `pointer-events: none`; keep foreground cards opaque. Use CSS tokens and gradients for control, rail, citation, and key states. If the art asset cannot survive an actual responsive composition, omit it. The UI remains complete without the image.
