import type { Rive } from "@rive-app/webgl2";
import { version } from "@rive-app/webgl2/package.json";
import type { StudigoController } from "./studigo-controller";
import { OUTFITS, type Outfit } from "@/lib/companion-logic";
import { STUDIGO_EMOTES, type StudigoEmote } from "@/lib/studigo-behaviors";

export const STUDIGO_RIVE_ASSET = "/mascot/rive/studigo.riv";
export const STUDIGO_STATIC_ASSET = "/mascot/companion/full/center.webp";
export type StudigoSurfaceStatus = "loading" | "ready" | "fallback";

let runtime: ReturnType<typeof loadRuntime> | undefined;
let asset: Promise<ArrayBuffer> | undefined;

async function loadRuntime() {
  const rive = await import("@rive-app/webgl2");
  rive.RuntimeLoader.setWasmUrl(`/mascot/rive/runtime/rive.wasm?v=${version}`);
  rive.RuntimeLoader.setWasmFallbackUrl(`/mascot/rive/runtime/rive_fallback.wasm?v=${version}`);
  return rive;
}

function loadAsset() {
  return asset ??= fetch(STUDIGO_RIVE_ASSET).then((response) => {
    if (!response.ok) throw new Error("Studigo asset unavailable");
    return response.arrayBuffer();
  }).catch((error: unknown) => {
    asset = undefined;
    throw error;
  });
}

export function mountStudigoSurface(
  canvas: HTMLCanvasElement, controller: StudigoController, onStatus: (status: StudigoSurfaceStatus) => void,
  renderScale = 1,
) {
  let rive: Rive | undefined;
  let unsubscribe: (() => void) | undefined;
  let dead = false;
  let started = false;
  let visible = true;
  let ready = false;
  let renderAllowed = true;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const events = new AbortController();

  function resize() {
    if (ready) rive?.resizeDrawingSurfaceToCanvas(Math.min((window.devicePixelRatio || 1) * renderScale, 2));
  }

  function updateVisibility() {
    const next = visible && !document.hidden;
    if (next === renderAllowed || !ready) return;
    renderAllowed = next;
    if (next) rive?.startRendering();
    else rive?.stopRendering();
  }

  function dispose() {
    dead = true;
    clearTimeout(watchdog);
    events.abort();
    visibility?.disconnect();
    dimensions?.disconnect();
    unsubscribe?.();
    rive?.cleanup();
    rive = undefined;
  }

  function fail() {
    if (dead) return;
    dispose();
    onStatus("fallback");
  }

  async function start() {
    if (started || dead) return;
    started = true;
    watchdog = setTimeout(fail, 12_000);
    try {
      runtime ??= loadRuntime().catch((error: unknown) => {
        runtime = undefined;
        throw error;
      });
      const [{ Rive: Player, Layout, Fit, Alignment }, buffer] = await Promise.all([runtime, loadAsset()]);
      if (dead) return;
      rive = new Player({
        canvas, buffer, artboard: "Studigo", stateMachine: "Studigo Motion",
        autoplay: true, autoBind: true, useOffscreenRenderer: true, enableRiveAssetCDN: false,
        layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
        onLoad: () => {
          queueMicrotask(() => {
            if (dead || !rive) return;
            const model = rive.viewModelInstance;
            const mode = model?.number("mode");
            const intent = model?.number("intent");
            const gazeX = model?.number("gazeX");
            const gazeY = model?.number("gazeY");
            const flameBoost = model?.number("flameBoost");
            const choices = OUTFITS.map((outfit) => ({ outfit, binding: model?.number(outfit) }));
            const expressions = STUDIGO_EMOTES.map((name) => ({ name, binding: model?.number(name) }));
            if (!mode || !intent || !gazeX || !gazeY || !flameBoost || [...choices, ...expressions].some(({ binding }) => !binding)) { fail(); return; }
            let equipped: Outfit | null | undefined;
            let emote: StudigoEmote | null | undefined;
            unsubscribe = controller.subscribe((frame) => {
              mode.value = frame.mode;
              intent.value = frame.intent;
              gazeX.value = frame.gaze.x;
              gazeY.value = frame.gaze.y;
              flameBoost.value = frame.flameBoost;
              if (equipped !== frame.outfit) {
                equipped = frame.outfit;
                for (const { outfit, binding } of choices) if (binding) binding.value = outfit === equipped ? 1 : 0;
              }
              if (emote !== frame.emote) {
                emote = frame.emote;
                for (const { name, binding } of expressions) if (binding) binding.value = name === emote ? 1 : 0;
              }
            });
            ready = true;
            resize();
            try {
              // The high-level runtime does not dispatch its declared Draw event.
              // Paint the newly bound artboard before removing the static image.
              rive.drawFrame();
            } catch {
              fail();
              return;
            }
            updateVisibility();
            clearTimeout(watchdog);
            onStatus("ready");
          });
        },
        onLoadError: () => queueMicrotask(fail),
      });
    } catch {
      fail();
    }
  }

  const visibility = typeof IntersectionObserver === "undefined" ? undefined : new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) void start();
    updateVisibility();
  });
  const dimensions = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(resize);
  document.addEventListener("visibilitychange", updateVisibility, { signal: events.signal });
  canvas.addEventListener("webglcontextlost", fail, { signal: events.signal });
  window.addEventListener("resize", resize, { signal: events.signal, passive: true });
  dimensions?.observe(canvas);
  onStatus("loading");
  if (visibility) visibility.observe(canvas);
  else void start();
  return dispose;
}
