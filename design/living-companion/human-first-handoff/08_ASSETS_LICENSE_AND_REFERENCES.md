# Assets, dependencies and source rights

## Official Studigo character assets

The authoritative art lives at:

- `docs/brand/mascot/README.md`
- `docs/brand/mascot/reference/` (character bible, 2D guide, pose sheet, profile, crayon tail and icon references)
- `apps/web/public/mascot/companion/` (waist-up WebP sprites)
- `apps/web/public/mascot/companion/full/` (full-body WebP sprites)
- `design/companion-demo/assets/` (source images)

**Preserve:** orange/cream proportions, brown eyes, ivory pointed frills, teal embroidered vest, small paws, crayon-like tail with flame. **Do not add wings.** Approved old sprites remain the visual baseline and fallback. The generated promotional concepts are **not** rig/source artwork.

## What art may actually need generation

The important missing data may be **reusable independent parts**, not dozens of complete emotional poses: eyelids/pupils, brows, mouth/snout, head, left/right forearms and paws, frills, body, clothing foreground/back, tail/flame, local pivots and layering/occlusion metadata. Make the six-expression prototype first; only generate truly missing layers after inspecting original art. Higgsfield can help create reference and transparent parts but not the final animated bones automatically. Identity approval requires comparison against the canonical neutral sprite.

## Copyright and licensing

- Coucou is a **technical reference** for timing, spring physics, UI states and canvas architecture. Its code is MIT-licensed; preserve license notices if copying/adapting code where legally permitted. Its Mochi character identity, artwork, sounds, icons and creative character animation assets are separately reserved. Do not transfer them into Studigo.
- REA is a reverse-engineering analysis tool used on the owner's Coucou fork. An analysis report is not a license for unrelated intellectual property.
- Projects referenced only for inspiration may have different/copyleft licenses (e.g. AGPL-3.0 for Bible Strong Avatar Lab). If a reference is AGPL, take only independently implemented technical ideas unless legal conditions are reviewed. Don't bundle external packages without an explicit licensing review.
- Higgsfield or any image generator should be used with approved character references, current commercial/rights terms and owner review. Don't infer permission to reproduce a separate product's mascot.
- The seven school-subject outfits must be original and appropriate for kids; avoid recognizable costumes belonging to other characters.

## Source status labels

**Approved:** the owner approved the direction or a specific decision. **Verified:** an actual code file, GitHub state or test artifact was inspected. **Proposed:** an engineering recommendation not yet executed. **Unknown/open:** needs inspection or a product decision. **Historical:** prior-state information that may have been superseded.

The current LC knowledge base tracks these distinctions using `LC-DEC` and `LC-SRC` IDs. Always cite the actual file or result when making implementation claims.
