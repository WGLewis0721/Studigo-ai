# Studigo Mascot Assets

## Canonical mascot

The orange Studigo scholar/companion creature is the official Studigo mascot.

## Character identity

The reference sheets in `reference/` are the authoritative visual guidance for:

- face
- head/frill shape
- orange/cream body
- scholar vest
- body proportions
- crayon-tail design
- flame tip
- expression style

## Production assets

The images under:

`apps/web/public/mascot/`

are intended for use in the product and marketing UI.

- `studigo-hero-options.jpg` - approved homepage hero pose concepts
- `studigo-looking-right.jpg` - right-facing hero or directional layout use
- `studigo-showing-source.jpg` - source/citation/grounded-answer state
- `studigo-asking.jpg` - question/tutor interaction state
- `studigo-pointing.jpg` - explanatory or CTA state
- `studigo-hugging.jpg` - friendly/welcome/celebration state

## Design rule

Do not casually regenerate or reinterpret the character.
These references should be treated as canonical brand guidance.

## Companion sprites

`apps/web/public/mascot/companion/` holds the poses the companion uses: waist-up
for his window, and `full/` for his stage. Fourteen are crops and resizes of the
existing cursor-tracking frames. Ten were generated from the canonical centre
frame for the companion work (waist-up: celebrate, support, pet, poke, lean,
sleep; full body: wave, leap, celebrate, read). William approved the generated
poses as product art on October 1, 2026.

The folder is built, not edited: the sources are in
`design/companion-demo/assets/` and `design/companion-demo/build_public_demo.py`
writes the shipped copies.

The site icons (`apps/web/app/icon.png`, `apple-icon.png`, `favicon.ico`, and
`public/icons/`) are crops and resizes of the canonical portrait
`tracking/studigo-mascot-center-still.jpg`.
