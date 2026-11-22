"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { createStudigoController, type StudigoController } from "./studigo-controller";
import { mountStudigoSurface, STUDIGO_STATIC_ASSET, type StudigoSurfaceStatus } from "./studigo-surface";
import type { StudigoState } from "@/lib/studigo-behaviors";
import "./studigo-character.css";

export type StudigoInteraction = "tap" | "pet";
const SIZES = { small: 88, medium: 152, large: 224 } as const;

type Props = {
  state?: StudigoState;
  size?: keyof typeof SIZES | number | "fill";
  interactive?: boolean;
  reducedMotion?: "system" | boolean;
  staticOnly?: boolean;
  label?: string;
  className?: string;
  onInteraction?: (interaction: StudigoInteraction) => void;
};

export const StudigoCharacter = forwardRef<StudigoController, Props>(function StudigoCharacter({
  state = "idle", size = "medium", interactive = false, reducedMotion = "system", staticOnly = false,
  label = "Studigo", className, onInteraction,
}, ref) {
  const [controller] = useState(createStudigoController);
  const canvas = useRef<HTMLCanvasElement>(null);
  const press = useRef<{ x: number; y: number; petted: boolean } | null>(null);
  const [status, setStatus] = useState<StudigoSurfaceStatus>("loading");
  const dimension = size === "fill" ? "100%" : typeof size === "number" ? size : SIZES[size];
  const style = { "--studigo-size": typeof dimension === "number" ? `${Math.max(1, dimension)}px` : dimension } as CSSProperties;
  useImperativeHandle(ref, () => controller, [controller]);

  useEffect(() => () => controller.dispose(), [controller]);
  useEffect(() => { controller.setState(state); }, [controller, state]);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => controller.setReducedMotion(reducedMotion === true || query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [controller, reducedMotion]);
  useEffect(() => {
    if (staticOnly || !canvas.current) return;
    return mountStudigoSurface(canvas.current, controller, setStatus);
  }, [controller, staticOnly]);

  function interact(kind: StudigoInteraction) {
    controller.react(kind === "pet" ? "petting" : "happy");
    onInteraction?.(kind);
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    controller.lookAt({ x: 2 * (event.clientX - rect.left) / rect.width - 1, y: 2 * (event.clientY - rect.top) / rect.height - 1 });
    const held = press.current;
    if (held && !held.petted && Math.hypot(event.clientX - held.x, event.clientY - held.y) > 8) {
      held.petted = true;
      interact("pet");
    }
  }

  const view = staticOnly ? "fallback" : status;
  const classNames = `studigoCharacter${className ? ` ${className}` : ""}`;
  const body = <>
    {/* eslint-disable-next-line @next/next/no-img-element -- loaded immediately as the canvas fallback */}
    <img className="studigoCharacterStill" src={STUDIGO_STATIC_ASSET} alt="" aria-hidden="true" width={540} height={540} draggable={false} />
    {!staticOnly && <canvas className="studigoCharacterCanvas" ref={canvas} aria-hidden="true" />}
  </>;
  return interactive ? (
    <button type="button" className={classNames} style={style} aria-label={label} data-studigo={view}
      onPointerMove={move}
      onPointerDown={(event) => { press.current = { x: event.clientX, y: event.clientY, petted: false }; }}
      onPointerCancel={() => { press.current = null; }}
      onPointerLeave={() => { press.current = null; controller.lookAt({ x: 0, y: 0 }); }}
      onClick={(event) => {
        if (event.detail === 0 || !press.current?.petted) interact("tap");
        press.current = null;
      }}>
      {body}
    </button>
  ) : (
    <span className={classNames} style={style} role="img" aria-label={label} data-studigo={view}>{body}</span>
  );
});
