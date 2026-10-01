"use client";

import "./companion.css";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { MIRRORED, STAGE_POSES, dirPose, type GazePose, type StagePose } from "@/lib/companion-logic";
import { SPRITES } from "./engine";

/* Studigo full body, standing in the page: on Home, in first-run setup and on
   the sign-in pages. He looks toward the pointer, can be poked and petted, and
   can leap to a spot on the page (into a room card when one is opened). */

export type StageHandle = {
  /** A pose he holds until told otherwise (waving on a welcome, reading a file). */
  hold(pose: StagePose): void;
  /** A reaction that outranks gaze and idle until it runs out. */
  react(pose: StagePose, ms: number): void;
  celebrate(): void;
  /** One leap from where he stands to a box on the page (viewport pixels). Resolves when he has landed. */
  leapTo(target: { left: number; top: number; width: number; height: number }): Promise<void>;
};

const SPARK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0c.6 4.2 3.8 7.4 8 8-4.2.6-7.4 3.8-8 8-.6-4.2-3.8-7.4-8-8 4.2-.6 7.4-3.8 8-8Z"/></svg>';
const HEART = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 14.2 2.6 8.9a3.5 3.5 0 0 1 5-4.9l.4.4.4-.4a3.5 3.5 0 0 1 5 4.9Z"/></svg>';
const now = () => performance.now();

export const StudigoStage = forwardRef<StageHandle, {
  /** Width and height in CSS pixels. */
  size?: number;
  rest?: StagePose;
  onTouch?: (kind: "poke" | "pet") => void;
  label?: string;
}>(function StudigoStage({ size = 200, rest = "center", onTouch, label = "Studigo. Tap to play, stroke to pet." }, ref) {
  const nodeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLSpanElement>(null);
  const fxRef = useRef<HTMLSpanElement>(null);
  const touchRef = useRef(onTouch);
  const api = useRef<StageHandle | null>(null);
  const restRef = useRef(rest);

  useEffect(() => { touchRef.current = onTouch; });
  useEffect(() => { restRef.current = rest; api.current?.hold(rest); }, [rest]);

  useEffect(() => {
    const node = nodeRef.current, body = bodyRef.current, fx = fxRef.current;
    if (!node || !body || !fx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const lifetime = new AbortController();
    const { signal } = lifetime;
    let dead = false;
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => { const id = window.setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms); timers.add(id); };

    const imgs = new Map<string, HTMLImageElement>();
    body.innerHTML = STAGE_POSES.map((pose) => `<img class="stgPose" data-pose="${pose}" ${MIRRORED[pose as GazePose] ? "data-flip" : ""} alt="" draggable="false" decoding="async">`).join("");
    body.querySelectorAll<HTMLImageElement>("img").forEach((img) => imgs.set(img.dataset.pose ?? "", img));
    const src = (pose: string) => `${SPRITES}/full/${MIRRORED[pose as GazePose] ?? pose}.webp`;
    // What he is standing in first; the rest of the poses follow once the page has settled.
    for (const pose of ["center", restRef.current]) imgs.get(pose)!.src = src(pose);
    later(() => imgs.forEach((img, pose) => { if (!img.getAttribute("src")) img.src = src(pose); }), 700);

    let pose: StagePose | "" = "", holding: StagePose = restRef.current, busyUntil = 0, gazeUntil = 0, gazing = false, next = now() + 3500, flying = false;
    let press: { x: number; y: number; mode: "press" | "pet"; last: number } | null = null;
    const set = (name: StagePose) => {
      if (pose === name) return;
      pose = name;
      imgs.forEach((img, key) => img.classList.toggle("on", key === name));
      if (node.dataset.pose === name) { node.dataset.pose = ""; void node.offsetWidth; }
      node.dataset.pose = name;
    };
    const react = (name: StagePose, ms: number) => { busyUntil = now() + ms; gazing = false; pose = ""; set(name); };
    const burst = (shape: string, count: number, colors: string[]) => {
      if (reduced) count = Math.min(count, 2);
      for (let i = 0; i < count; i += 1) {
        const dot = document.createElement("span");
        dot.className = "fx";
        dot.style.cssText = `--fx:${30 + Math.random() * 40}%;--fy:${18 + Math.random() * 30}%;--dx:${(Math.random() - 0.5) * 220}px;--dy:${-60 - Math.random() * 110}px;--s:${1 + Math.random() * 0.9};--r:${(Math.random() - 0.5) * 120}deg;--t:${0.8 + Math.random() * 0.5}s;--c:${colors[Math.floor(Math.random() * colors.length)]};animation-delay:${i * 35}ms`;
        dot.innerHTML = shape;
        dot.addEventListener("animationend", () => dot.remove());
        fx.appendChild(dot);
      }
    };
    const sparks = (count: number) => burst(SPARK, count, ["var(--dandelion)", "var(--kiwi)", "var(--tangerine)", "var(--teal)"]);
    const poke = () => { react("celebrate", 950); sparks(7); touchRef.current?.("poke"); };

    node.addEventListener("pointerdown", (event) => {
      if (flying) return;
      press = { x: event.clientX, y: event.clientY, mode: "press", last: 0 };
      node.setPointerCapture(event.pointerId);
    }, { signal });
    node.addEventListener("pointermove", (event) => {
      if (!press) return;
      if (press.mode === "press" && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) { press.mode = "pet"; set("up"); node.classList.add("petting"); }
      if (press.mode === "pet" && now() - press.last > 280) { press.last = now(); burst(HEART, 1, ["var(--berry)", "#ff7aa2"]); }
    }, { signal });
    const release = () => {
      const was = press;
      if (!was) return;
      press = null; node.classList.remove("petting");
      if (was.mode === "pet") { react("up", 700); touchRef.current?.("pet"); } else poke();
    };
    node.addEventListener("pointerup", release, { signal });
    node.addEventListener("pointercancel", release, { signal });
    // The pointer handlers above already cover a click; this is for the keyboard.
    node.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); poke(); } }, { signal });

    const look = (x: number, y: number, hold: number) => {
      if (flying || press || now() < busyUntil || holding !== "center") return;
      const r = node.getBoundingClientRect();
      set(dirPose(x - (r.left + r.width / 2), y - (r.top + r.height * 0.3), r.width * 0.3));
      gazing = true; gazeUntil = now() + hold;
    };
    window.addEventListener("pointermove", (event) => { if (fine) look(event.clientX, event.clientY, 1800); }, { signal, passive: true });
    window.addEventListener("pointerdown", (event) => { if (!node.contains(event.target as Node)) look(event.clientX, event.clientY, 1500); }, { signal, passive: true });
    // He reads along: typing anywhere on the page draws his eye to the field.
    document.addEventListener("input", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
      const r = input.getBoundingClientRect();
      look(r.left + Math.min(r.width, 16 + input.value.length * 8.4), r.top + r.height / 2, 1500);
    }, { signal });

    const heartbeat = window.setInterval(() => {
      const t = now();
      if (flying || press || t < busyUntil || t < gazeUntil) return;
      if (gazing || pose !== holding) { gazing = false; set(holding); next = t + 3500; return; }
      if (holding === "center" && t > next) {
        next = t + 4200 + Math.random() * 3800;
        const move = (["left", "right", "up", "sway"] as const)[Math.floor(Math.random() * 4)];
        if (move === "sway") { node.classList.add("sway"); later(() => node.classList.remove("sway"), 1600); }
        else { set(move); gazing = true; gazeUntil = t + 850; }
      }
    }, 320);

    set(restRef.current);
    api.current = {
      hold(name) { holding = name; if (now() >= busyUntil && !flying) { pose = ""; set(name); } },
      react,
      celebrate() { react("celebrate", 1300); sparks(10); },
      leapTo(target) {
        if (reduced || flying) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const from = node.getBoundingClientRect();
          const scale = Math.max(0.28, Math.min(0.6, (target.width * 0.5) / from.width));
          const dx = target.left + target.width / 2 - (from.left + from.width / 2), dy = target.top + target.height / 2 - (from.top + from.height / 2);
          const mirror = dx < 0;
          flying = true;
          node.classList.toggle("mirror", mirror); node.classList.add("flying");
          node.parentElement?.classList.add("leaping");
          pose = ""; set("leap");
          const at = (x: number, y: number, s: number, r: number) => `translate(${x}px, ${y}px) scale(${s}) rotate(${mirror ? -r : r}deg)`;
          let ended = false;
          const flight = node.animate([
            { transform: at(0, 0, 1, 0), easing: "cubic-bezier(.4,0,.6,1)" },
            { transform: at(0, 14, 1.05, -8), offset: 0.16, easing: "cubic-bezier(.2,.7,.3,1)" },
            { transform: at(dx * 0.42, dy * 0.3 - 110, 1 - (1 - scale) * 0.35, 10), offset: 0.56, easing: "cubic-bezier(.5,0,.8,.6)" },
            { transform: at(dx, dy, scale, 4), opacity: 1, offset: 0.92 },
            { transform: at(dx, dy, scale * 0.8, 4), opacity: 0 }
          ], { duration: 820, fill: "forwards" });
          const land = () => { if (ended) return; ended = true; resolve(); };
          // A tab that is not being painted stalls the animation clock; resolve anyway.
          flight.finished.then(land, land);
          later(land, 1000);
        });
      }
    };

    return () => {
      dead = true;
      lifetime.abort();
      window.clearInterval(heartbeat);
      timers.forEach((id) => window.clearTimeout(id));
      api.current = null;
      body.innerHTML = ""; fx.innerHTML = "";
    };
  }, []);

  useImperativeHandle(ref, () => ({
    hold: (pose) => api.current?.hold(pose),
    react: (pose, ms) => api.current?.react(pose, ms),
    celebrate: () => api.current?.celebrate(),
    leapTo: (target) => api.current?.leapTo(target) ?? Promise.resolve()
  }), []);

  return (
    <button ref={nodeRef} type="button" className="stg" data-pose={rest} aria-label={label} style={{ ["--stage-size" as string]: `${size}px` }}>
      <span className="stgShadow" aria-hidden="true" />
      <span className="stgBody" ref={bodyRef} aria-hidden="true" />
      <span className="cmpFx" ref={fxRef} aria-hidden="true" />
    </button>
  );
});
