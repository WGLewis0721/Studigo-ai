import type { Rive } from "@rive-app/webgl2";
import { version } from "@rive-app/webgl2/package.json";
import type { StudigoController } from "./studigo-controller";
import { emoteDone, emoteIn, emoteOut } from "@/lib/studigo-emote";

const GROWTH_TWEEN_MS = 900;
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
  let springFrame = 0;
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
    cancelAnimationFrame(springFrame);
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
            // `talk` arrived with the lip-sync rig; an older export simply has no mouth to drive.
            const talk = model?.number("talk");
            const growth = model?.number("growth");
            let growthShown: number | undefined;
            let growthTween: { from: number; to: number; start: number } | null = null;
            const choices = OUTFITS.map((outfit) => ({ outfit, binding: model?.number(outfit) }));
            const expressions = STUDIGO_EMOTES.map((name) => ({ name, binding: model?.number(name) }));
            if (!mode || !intent || !gazeX || !gazeY || !flameBoost || [...choices, ...expressions].some(({ binding }) => !binding)) { fail(); return; }
            let equipped: Outfit | null | undefined;
            let emote: StudigoEmote | null | undefined;
            // Emotes pop: the rig scales them from their centre, so a short spring runs here. Reduced motion jumps straight to 1 or 0.
            const springs = expressions.flatMap(({ name, binding }) => binding ? [{ name, binding, shown: false, moving: false, from: 0, start: 0 }] : []);
            const kick = () => {
              if (springFrame || dead) return;
              springFrame = requestAnimationFrame(function step(now) {
                springFrame = 0;
                let again = false;
                if (growth && growthTween) {
                  const x = Math.min(1, (now - growthTween.start) / GROWTH_TWEEN_MS);
                  growth.value = growthTween.from + (growthTween.to - growthTween.from) * (1 - (1 - x) ** 3);
                  if (x < 1) again = true; else growthTween = null;
                }
                for (const spring of springs) {
                  if (!spring.moving) continue;
                  const elapsed = now - spring.start;
                  const direction = spring.shown ? "in" : "out";
                  spring.binding.value = direction === "in" ? emoteIn(elapsed) : emoteOut(spring.from, elapsed);
                  if (emoteDone(direction, elapsed)) { spring.binding.value = spring.shown ? 1 : 0; spring.moving = false; } else again = true;
                }
                if (again && !dead) springFrame = requestAnimationFrame(step);
              });
            };
            unsubscribe = controller.subscribe((frame) => {
              mode.value = frame.mode;
              intent.value = frame.intent;
              gazeX.value = frame.gaze.x;
              gazeY.value = frame.gaze.y;
              flameBoost.value = frame.flameBoost;
              if (talk) talk.value = frame.talk;
              if (growth && growthShown !== frame.growth) {
                // The first value lands at once; a change after that grows him over 900 ms with an ease-out (reduced motion: at once).
                if (growthShown === undefined || frame.mode === 2) { growth.value = frame.growth; growthTween = null; }
                else { growthTween = { from: growth.value, to: frame.growth, start: performance.now() }; kick(); }
                growthShown = frame.growth;
              }
              if (equipped !== frame.outfit) {
                equipped = frame.outfit;
                for (const { outfit, binding } of choices) if (binding) binding.value = outfit === equipped ? 1 : 0;
              }
              if (emote !== frame.emote) {
                emote = frame.emote;
                for (const spring of springs) {
                  const want = spring.name === emote;
                  if (want === spring.shown) continue;
                  spring.shown = want;
                  if (frame.mode === 2) { spring.binding.value = want ? 1 : 0; spring.moving = false; continue; }
                  spring.from = spring.binding.value;
                  spring.start = performance.now();
                  spring.moving = true;
                }
                kick();
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
