import { MIRRORED, WINDOW_POSES, type GazePose, type Outfit, type WindowPose } from "@/lib/companion-logic";
import type { MotionFrame } from "@/lib/companion-motion/director";

/* How Studigo is drawn inside his window. The engine owns the window, its
   controls and where it sits; a renderer owns only what is inside .cmpBody. */

export const SPRITES = "/mascot/companion";

export interface CompanionRenderer {
  readonly kind: "sprite" | "rig" | "rive";
  /** The markup that goes inside .cmpBody. */
  markup(): string;
  /** Called once that markup is in the page. Throws if it cannot draw. */
  mount(body: HTMLElement): void;
  /** Fetch whatever is only needed once he is out in his window. */
  load(): void;
  /** The legacy command: show one of the fixed drawings. The rig ignores it. */
  setPose(pose: WindowPose): void;
  /** One frame from the motion director. The sprite renderer ignores it. */
  apply(frame: MotionFrame): void;
  /** Dress him in a cosmetic outfit, or take it off. The original drawings are not dressed. */
  setOutfit?(outfit: Outfit | null): void;
  destroy(): void;
}

/** A pose's drawing: the original, or the outfit's dressed version of it. A mirrored diagonal reuses its right-facing file. */
export function drawingUrl(pose: string, outfit: Outfit | null): string {
  const file = MIRRORED[pose as GazePose] ?? pose;
  return outfit === null ? `${SPRITES}/${file}.webp` : `${SPRITES}/dressed/${outfit}/${file}.webp`;
}

/** The stacked drawings as markup, one per pose. Only `shown` starts visible. */
export function spriteImages(shown: WindowPose | null = "center"): string {
  return WINDOW_POSES.map((pose) => `<img class="cmpPose${pose === shown ? " on" : ""}" data-pose="${pose}" ${MIRRORED[pose as GazePose] ? "data-flip" : ""} alt="" draggable="false" decoding="async">`).join("");
}

/** The drawings inside a body, by pose. */
export function spriteElements(body: HTMLElement): Map<string, HTMLImageElement> {
  const images = new Map<string, HTMLImageElement>();
  body.querySelectorAll<HTMLImageElement>(".cmpPose").forEach((img) => images.set(img.dataset.pose ?? "", img));
  return images;
}

/** Points each drawing at its file. One that already has a source is left alone, so calling this again is free. */
export function loadSprites(images: Map<string, HTMLImageElement>) {
  images.forEach((img, pose) => { if (!img.getAttribute("src")) img.src = drawingUrl(pose, null); });
}

/** The original companion: fifteen stacked drawings and a pair of CSS eyelids. Kept exactly as it was. */
export function createSpriteRenderer(): CompanionRenderer {
  let poseEls = new Map<string, HTMLImageElement>();
  let loaded = false;
  return {
    kind: "sprite",
    markup: () => `${spriteImages()}<i class="cmpLid l"></i><i class="cmpLid r"></i>`,
    mount(body) {
      poseEls = spriteElements(body);
      poseEls.get("center")!.src = drawingUrl("center", null);
    },
    load() {
      if (loaded) return;
      loaded = true;
      loadSprites(poseEls);
    },
    setPose(name) { poseEls.forEach((img, key) => img.classList.toggle("on", key === name)); },
    apply() {},
    destroy() { poseEls.clear(); }
  };
}

/**
 * The switch for the living companion. On unless NEXT_PUBLIC_STUDIGO_COMPANION_MOTION
 * is "off", which brings back the original drawings. A browser that cannot run the
 * rig falls back to them on its own.
 */
export function motionEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STUDIGO_COMPANION_MOTION !== "off";
}
