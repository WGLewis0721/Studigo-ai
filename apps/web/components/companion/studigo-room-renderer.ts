import { OUTFIT_TEXTURES } from "@/lib/companion-motion/outfits";
import type { CompanionRenderer } from "./renderers";
import { mountStudigoSurface, STUDIGO_STATIC_ASSET } from "./studigo-surface";
import type { StudigoController } from "./studigo-controller";

export function createStudigoRoomRenderer(controller: StudigoController): CompanionRenderer {
  let root: HTMLElement | null = null;
  let dispose: (() => void) | undefined;
  return {
    kind: "rive",
    markup: () => `<div class="cmpRive"><img class="cmpRiveStill" src="${STUDIGO_STATIC_ASSET}" alt="" draggable="false"><canvas aria-hidden="true"></canvas></div>`,
    mount(body) { root = body.querySelector(".cmpRive"); },
    load() {
      const surface = root;
      const canvas = surface?.querySelector("canvas");
      if (surface && canvas && !dispose) {
        dispose = mountStudigoSurface(canvas, controller, (status) => { surface.dataset.studigo = status; }, 1.75);
      }
    },
    setPose() {},
    apply() {},
    setOutfit(outfit) {
      controller.setOutfit(outfit);
      const still = root?.querySelector("img");
      if (still) still.src = outfit ? OUTFIT_TEXTURES[outfit] : STUDIGO_STATIC_ASSET;
      root?.toggleAttribute("data-dressed", outfit !== null);
    },
    destroy() {
      dispose?.();
      controller.dispose();
      root = null;
    },
  };
}
