import type { Outfit } from "../companion-logic";

/* Cosmetic outfits. Each one is a second drawing of him in the same 400 x 400
   framing as center.webp, wearing that item. The rig swaps its texture to the
   drawing, so the outfit bends and turns with his head, and the menu shows the
   same drawing as its thumbnail. */

export const OUTFIT_TEXTURES: Record<Outfit, string> = {
  goggles: "/mascot/companion/dressed/goggles.webp",
  explorer: "/mascot/companion/dressed/explorer.webp",
  visor: "/mascot/companion/dressed/visor.webp",
  reader: "/mascot/companion/dressed/reader.webp",
  beret: "/mascot/companion/dressed/beret.webp",
  headphones: "/mascot/companion/dressed/headphones.webp",
  sash: "/mascot/companion/dressed/sash.webp"
};
