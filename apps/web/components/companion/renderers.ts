import { MIRRORED, WINDOW_POSES, type GazePose, type WindowPose } from "@/lib/companion-logic";
import type { MotionFrame } from "@/lib/companion-motion/director";

/* How Studigo is drawn inside his window. The engine owns the window, its
   controls and where it sits; a renderer owns only what is inside .cmpBody. */

export const SPRITES = "/mascot/companion";

export interface CompanionRenderer {
  readonly kind: "sprite" | "rig";
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
  destroy(): void;
}

const spriteFor = (pose: string) => `${SPRITES}/${MIRRORED[pose as GazePose] ?? pose}.webp`;

/** The original companion: fifteen stacked drawings and a pair of CSS eyelids. Kept exactly as it was. */
export function createSpriteRenderer(): CompanionRenderer {
  const poseEls = new Map<string, HTMLImageElement>();
  let loaded = false;
  return {
    kind: "sprite",
    markup: () => `${WINDOW_POSES.map((pose) => `<img class="cmpPose${pose === "center" ? " on" : ""}" data-pose="${pose}" ${MIRRORED[pose as GazePose] ? "data-flip" : ""} alt="" draggable="false" decoding="async">`).join("")}<i class="cmpLid l"></i><i class="cmpLid r"></i>`,
    mount(body) {
      body.querySelectorAll<HTMLImageElement>(".cmpPose").forEach((img) => poseEls.set(img.dataset.pose ?? "", img));
      poseEls.get("center")!.src = spriteFor("center");
    },
    load() {
      if (loaded) return;
      loaded = true;
      poseEls.forEach((img, pose) => { if (!img.getAttribute("src")) img.src = spriteFor(pose); });
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
