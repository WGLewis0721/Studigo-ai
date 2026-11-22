"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { createStudigoController, type StudigoController } from "./studigo-controller";
import { mountStudigoSurface, STUDIGO_STATIC_ASSET, type StudigoSurfaceStatus } from "./studigo-surface";
import type { StudigoState } from "@/lib/studigo-behaviors";
import { studigoTouchRegion, type StudigoTouchRegion } from "@/lib/studigo-touch";
import type { Outfit } from "@/lib/companion-logic";
import { OUTFIT_TEXTURES } from "@/lib/companion-motion/outfits";
import { growthFraction } from "@/lib/companion-growth";
import { useCompanionGrowth } from "@/lib/companion-growth-store";
import "./studigo-character.css";

export type StudigoInteraction = "tap" | "pet" | "poke" | "hold" | "drag" | "surprise";
type Press = { pointer: number; x: number; y: number; region: StudigoTouchRegion; gesture: "pet" | "drag" | null; held: boolean };
const SIZES = { small: 88, medium: 152, large: 224 } as const;

type Props = {
  /** The rig's growth input, 0 to 1. Defaults to this learner's stored growth. */
  growth?: number;
  state?: StudigoState;
  size?: keyof typeof SIZES | number | "fill";
  interactive?: boolean;
  reducedMotion?: "system" | boolean;
  staticOnly?: boolean;
  label?: string;
  className?: string;
  onInteraction?: (interaction: StudigoInteraction) => void;
  outfit?: Outfit | null;
  flameBoost?: number;
  portrait?: boolean;
};

export const StudigoCharacter = forwardRef<StudigoController, Props>(function StudigoCharacter({
  growth, state = "idle", size = "medium", interactive = false, reducedMotion = "system", staticOnly = false,
  label = "Studigo", className, onInteraction, outfit = null, flameBoost = 1, portrait = false,
}, ref) {
  const [controller] = useState(createStudigoController);
  const canvas = useRef<HTMLCanvasElement>(null);
  const press = useRef<Press | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const previousTap = useRef({ count: 0, time: 0 });
  const [status, setStatus] = useState<StudigoSurfaceStatus>("loading");
  const dimension = size === "fill" ? "100%" : typeof size === "number" ? size : SIZES[size];
  const zoom = portrait ? 1.42 : 1;
  const style = {
    "--studigo-size": typeof dimension === "number" ? `${Math.max(1, dimension)}px` : dimension,
    "--studigo-zoom": zoom,
  } as CSSProperties;
  useImperativeHandle(ref, () => controller, [controller]);

  const stored = useCompanionGrowth();
  const growthValue = growth ?? growthFraction(stored.points);
  useEffect(() => { controller.setGrowth(growthValue); }, [controller, growthValue]);
  useEffect(() => () => controller.dispose(), [controller]);
  useEffect(() => () => clearTimeout(holdTimer.current), []);
  useEffect(() => { controller.setState(state); }, [controller, state]);
  useEffect(() => { controller.setOutfit(outfit); controller.setFlameBoost(flameBoost); }, [controller, outfit, flameBoost]);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => controller.setReducedMotion(reducedMotion === true || query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [controller, reducedMotion]);
  useEffect(() => {
    if (staticOnly || !canvas.current) return;
    return mountStudigoSurface(canvas.current, controller, setStatus, zoom);
  }, [controller, staticOnly, zoom]);

  function interact(kind: StudigoInteraction, region: StudigoTouchRegion = "head") {
    // Each part answers in its own way: a pat on the head, a poke in the belly, a tug on the tail.
    controller.react(
      kind === "pet" ? "petting" : kind === "surprise" ? "surprised"
        : region === "tail" && kind !== "hold" ? "tailTug"
        : region === "belly" && (kind === "poke" || kind === "drag") ? "bellyPoke"
        : kind === "poke" ? "annoyed" : kind === "hold" ? "curious" : kind === "drag" ? "stretch" : "happy");
    onInteraction?.(kind);
  }

  function position(event: PointerEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = 0.5 + ((event.clientX - rect.left) / rect.width - 0.5) / zoom;
    const y = 0.5 + ((event.clientY - rect.top) / rect.height - 0.5) / zoom;
    return { x, y, gaze: { x: 2 * (x - 0.5), y: 2 * (y - 0.34) } };
  }

  function down(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || press.current) return;
    const point = position(event);
    const region = studigoTouchRegion(point.x, point.y);
    if (region === "outside") return;
    controller.lookAt(point.gaze);
    event.currentTarget.setPointerCapture(event.pointerId);
    const contact: Press = { pointer: event.pointerId, x: event.clientX, y: event.clientY, region, gesture: null, held: false };
    press.current = contact;
    holdTimer.current = setTimeout(() => {
      if (press.current !== contact || contact.gesture) return;
      contact.held = true;
      interact("hold");
    }, 460);
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    controller.lookAt(position(event).gaze);
    const held = press.current;
    if (held?.pointer === event.pointerId && !held.gesture && Math.hypot(event.clientX - held.x, event.clientY - held.y) > 8) {
      clearTimeout(holdTimer.current);
      held.gesture = held.region === "head" ? "pet" : "drag";
      interact(held.gesture, held.region);
    }
  }

  function release(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    const held = press.current;
    if (held?.pointer !== event.pointerId) return;
    clearTimeout(holdTimer.current);
    press.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancel && !held.gesture && !held.held) {
      const now = performance.now();
      const streak = now - previousTap.current.time < 850 ? previousTap.current.count + 1 : 1;
      previousTap.current = { time: now, count: streak === 3 ? 0 : streak };
      interact(streak === 3 ? "surprise" : held.region === "head" ? "tap" : "poke", held.region);
    }
    controller.lookAt({ x: 0, y: 0 });
  }

  const view = staticOnly ? "fallback" : status;
  const classNames = `studigoCharacter${className ? ` ${className}` : ""}`;
  const body = <>
    {/* eslint-disable-next-line @next/next/no-img-element -- loaded immediately as the canvas fallback */}
    <img className="studigoCharacterStill" src={outfit ? OUTFIT_TEXTURES[outfit] : STUDIGO_STATIC_ASSET} alt="" aria-hidden="true" width={540} height={540} draggable={false} />
    {!staticOnly && <canvas className="studigoCharacterCanvas" ref={canvas} aria-hidden="true" />}
  </>;
  return interactive ? (
    <button type="button" className={classNames} style={style} aria-label={label} data-studigo={view}
      onPointerMove={move}
      onPointerDown={down} onPointerUp={release}
      onPointerCancel={(event) => release(event, true)}
      onLostPointerCapture={(event) => release(event, true)}
      onPointerLeave={() => { if (!press.current) controller.lookAt({ x: 0, y: 0 }); }}
      onClick={(event) => { if (event.detail === 0) interact("tap"); }}>
      {body}
    </button>
  ) : (
    <span className={classNames} style={style} role="img" aria-label={label} data-studigo={view}>{body}</span>
  );
});
