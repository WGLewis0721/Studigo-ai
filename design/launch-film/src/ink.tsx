import React from "react";
import { AbsoluteFill, random, staticFile } from "remotion";
import { C, DISPLAY, SANS } from "./tokens";
import { P, lerp, snap, out3 } from "./motion";

/** Study-world marks: highlighter, pen underline, pen circle, pen arrow, written-on text. Imperfect on purpose. */

export const Display: React.FC<{ size: number; weight?: number; wdth?: number; color?: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ size, weight = 760, wdth = 90, color = C.ink, style, children }) => (
  <div style={{ fontFamily: DISPLAY, fontSize: size, fontWeight: weight, fontVariationSettings: `"wdth" ${wdth}, "opsz" 96`, letterSpacing: "-0.028em", lineHeight: 1.02, color, ...style }}>{children}</div>
);

/** Left→right "written on" reveal with a soft leading edge. p: 0..1 */
export const Write: React.FC<{ p: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ p, children, style }) => {
  const e = p * 112 - 6;
  return <div style={{ ...style, WebkitMaskImage: `linear-gradient(90deg,#000 ${e}%,transparent ${e + 7}%)`, maskImage: `linear-gradient(90deg,#000 ${e}%,transparent ${e + 7}%)`, transform: `${style?.transform ?? ""} translateY(${(1 - out3(p)) * 14}px)`, opacity: p > 0 ? 1 : 0 }}>{children}</div>;
};

/** Highlighter swipe behind inline text. */
export const Mark: React.FC<{ p: number; color?: string; tilt?: number; children: React.ReactNode }> = ({ p, color = C.dandelion, tilt = -1.2, children }) => (
  <span style={{ position: "relative", display: "inline-block", padding: "0 .12em" }}>
    <span style={{ position: "absolute", left: "-.04em", right: "-.06em", top: "46%", bottom: "-.02em", background: color, opacity: 0.9, borderRadius: ".12em .3em .16em .34em",
      transform: `scaleX(${p}) rotate(${tilt}deg) skewX(-6deg)`, transformOrigin: "left center" }} />
    <span style={{ position: "relative" }}>{children}</span>
  </span>
);

const wob = (seed: string, i: number, amt: number) => (random(`${seed}${i}`) - 0.5) * amt;

const PenSvg: React.FC<{ w: number; h: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ w, h, style, children }) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", overflow: "visible", ...style }} fill="none" stroke={C.berry} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const draw = (p: number) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - p } as const);

/** Pen underline (two slightly different passes). */
export const Underline: React.FC<{ x: number; y: number; w: number; p: number; seed?: string; color?: string; z?: number }> = ({ x, y, w, p, seed = "u", color = C.berry, z = 30 }) => {
  const a = `M2 ${6 + wob(seed, 0, 4)} C ${w * 0.3} ${wob(seed, 1, 8)}, ${w * 0.65} ${12 + wob(seed, 2, 8)}, ${w - 2} ${4 + wob(seed, 3, 6)}`;
  const b = `M${w * 0.08} ${15 + wob(seed, 4, 4)} C ${w * 0.4} ${9 + wob(seed, 5, 6)}, ${w * 0.7} ${17 + wob(seed, 6, 6)}, ${w * 0.96} ${11 + wob(seed, 7, 5)}`;
  return <PenSvg w={w} h={26} style={{ left: x, top: y, zIndex: z, stroke: color }}><path d={a} {...draw(P(p, 0, 0.65, out3))} /><path d={b} {...draw(P(p, 0.5, 1, out3))} /></PenSvg>;
};

/** Pen circle around something (overshoots its own start). */
export const Ring: React.FC<{ cx: number; cy: number; rx: number; ry: number; p: number; seed?: string; rot?: number; z?: number; color?: string }> = ({ cx, cy, rx, ry, p, seed = "r", rot = -4, z = 30, color = C.berry }) => {
  const pts: string[] = []; const N = 64;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2 * 1.1 + 0.6, grow = 1 + (i / N) * 0.07 + wob(seed, i % 9, 0.03);
    pts.push(`${i ? "L" : "M"}${(rx + 8 + Math.cos(t) * rx * grow).toFixed(1)} ${(ry + 8 + Math.sin(t) * ry * grow).toFixed(1)}`);
  }
  return <PenSvg w={rx * 2 + 16} h={ry * 2 + 16} style={{ left: cx - rx - 8, top: cy - ry - 8, zIndex: z, transform: `rotate(${rot}deg)`, stroke: color }}><path d={pts.join(" ")} {...draw(P(p, 0, 1, Easing3))} /></PenSvg>;
};
const Easing3 = (t: number) => 1 - Math.pow(1 - t, 2.2);

/** Pen arrow along a bent path from (x1,y1) to (x2,y2). */
export const Arrow: React.FC<{ x1: number; y1: number; x2: number; y2: number; bend?: number; p: number; z?: number; color?: string }> = ({ x1, y1, x2, y2, bend = 70, p, z = 30, color = C.berry }) => {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / L) * bend, cy = my + (dx / L) * bend;
  const ang = Math.atan2(y2 - cy, x2 - cx), hp = P(p, 0.8, 1, out3), hs = 26;
  const head = (s: number) => `M${x2} ${y2} L${x2 - Math.cos(ang + s) * hs} ${y2 - Math.sin(ang + s) * hs}`;
  const pad = 40, minx = Math.min(x1, x2, cx) - pad, miny = Math.min(y1, y2, cy) - pad;
  return <PenSvg w={Math.max(x1, x2, cx) - minx + pad} h={Math.max(y1, y2, cy) - miny + pad} style={{ left: minx, top: miny, zIndex: z, stroke: color }}>
    <g transform={`translate(${-minx} ${-miny})`}>
      <path d={`M${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`} {...draw(P(p, 0, 0.85, out3))} />
      <path d={head(0.5)} {...draw(hp)} /><path d={head(-0.5)} {...draw(hp)} />
    </g>
  </PenSvg>;
};

/** A handwritten-feel note. Brand fonts only (Figtree 800), pen colour, slight tilt, written on. */
export const Note: React.FC<{ x: number; y: number; p: number; rot?: number; size?: number; color?: string; z?: number; children: React.ReactNode }> = ({ x, y, p, rot = -3, size = 40, color = C.berry, z = 30, children }) => (
  <div style={{ position: "absolute", left: x, top: y, zIndex: z, transform: `rotate(${rot}deg)`, transformOrigin: "left center", fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1.1, color, letterSpacing: "-0.01em" }}>
    <Write p={p}>{children}</Write>
  </div>
);

/** Colour field with a notebook feel: faint ruling, drifting soft shapes, and paper grain. */
export const Field: React.FC<{ color: string; f: number; ink?: string; ruled?: boolean; dark?: boolean; blob?: string; clean?: boolean }> = ({ color, f, ink = C.ink, ruled = true, dark = false, blob, clean = false }) => (
  <AbsoluteFill style={{ background: color, overflow: "hidden" }}>
    {blob && <>
      <div style={{ position: "absolute", left: -240 + f * 0.25, top: 560, width: 980, height: 980, borderRadius: "50%", background: blob, opacity: 0.55 }} />
      <div style={{ position: "absolute", right: -300 - f * 0.18, top: -380, width: 900, height: 900, borderRadius: "50%", background: blob, opacity: 0.4 }} />
    </>}
    {ruled && <div style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(0deg, transparent 0 69px, ${dark ? "rgba(255,255,255,.045)" : "rgba(20,27,45,.055)"} 69px 70px)` }} />}
    {ruled && <div style={{ position: "absolute", left: 118, top: 0, bottom: 0, width: 2, background: dark ? "rgba(240,69,122,.22)" : "rgba(240,69,122,.2)" }} />}
    <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${staticFile("tex/grain.png")})`, backgroundSize: 512, mixBlendMode: dark ? "screen" : "multiply", opacity: dark ? 0.07 : clean ? 0.07 : 0.2 }} />
  </AbsoluteFill>
);

/** Soft light pooled behind the hero. */
export const Glow: React.FC<{ x: number; y: number; r?: number; color?: string; o?: number }> = ({ x, y, r = 620, color = "#ffffff", o = 0.65 }) => (
  <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", background: `radial-gradient(circle, ${color} 0%, transparent 68%)`, opacity: o }} />
);
export { lerp, snap };
