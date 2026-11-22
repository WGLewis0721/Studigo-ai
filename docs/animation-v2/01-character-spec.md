# Phase 1 — Character specification

**PASS · 2026-11-21.** The visual reference and supported range are locked. Gate 2 will validate the actual rig against them.

The [canonical brand bible](../brand/mascot/README.md) defines the identity. Use the approved 540 × 540 `apps/web/public/mascot/companion/full/center.webp` as the full-body bind reference. The 400 × 400 window art is a crop-scale reference for the dock. Preserve the full-body source pixels wherever possible.

| Feature | Rig reference |
| --- | --- |
| Silhouette | Wingless, orange, oversized round head over a compact pear-shaped body. One central spike and ivory swept frills. The tail stays on viewer-left in neutral. |
| Face | Round warm-brown eyes, dark pupils, bright highlights and warm lids. Two nostrils on a short broad snout, softly defined lower jaw and a small upturned mouth. Eye spacing, eye volume and the nose-to-mouth distance stay stable through the look. |
| Head details | Frills attach behind the cheeks and follow the skull. Spine spike follows the forehead. The nose, jaw and brows follow the head with smaller local adjustments. |
| Torso and feet | Orange limbs, cream throat and segmented belly, bottom-heavy stance. Both feet plant on the same floor line. Weight shifts into the hips before the feet move. |
| Vest | Teal with gold edging and embroidery. Keep the painted shading, stitching and dark separation from the cream belly. |
| Tail | Continuous taper into the banded orange crayon tip. The small yellow and white flame follows the tip, then changes shape on its own. |
| Paint | Warm orange midtones, peach and ivory highlights, saturated teal vest and warm brown shadows. Use the source texels as the palette and silhouette reference. |

## Orientation envelope

The [reference sheet](evidence/phase1/canonical-views.jpg) registers the approved production images at the same canvas and scale. Top row is front, three-quarter left, three-quarter right. Bottom row is up, down and up-right. The [brand profile sheet](../brand/mascot/reference/studigo-profile-reference.jpg) gives the side contour and tail placement. Full profile is an anatomy reference for left/right volume. The v2 rig supports front through shallow three-quarter in either direction and small up/down pitch. It preserves the torso and tail handedness during yaw. Match motion with local eye aim, snout parallax, near/far frill depth and small head rotation. Reserve the stronger asset angles for reference. Do not mirror or swap those portraits into the rig.

Start the rig at a 540 × 540 artboard. Anchor the floor at the original soles, the torso at the pelvis, the head at the collar, the arm pivots underneath the vest shoulders, the tail at its root and the flame at the crayon nib. Use a stable relative pivot for each eye. Document the calibrated pixel coordinates and range in Gate 2.

`puppet/body.webp` is already armless but closes at the waist-up crop boundary and differs slightly at the flame and vest. Its matching arm cutouts provide original separated shoulder and paw art. Compare them at the full-body scale before choosing between these cutouts and direct separation from the full-body neutral. Preserve their provenance either way.

**Visual check:** the six approved views and brand profile share the teal/gold vest, cream belly, wingless outline, ivory frills, central spike and flame tail. The strong downward and upward art foreshortens the face substantially. Use the reduced range above to preserve the eyes and the head silhouette during live movement.
