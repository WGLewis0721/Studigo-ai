import React from "react";
import { random, interpolate, Easing } from "remotion";
import { C } from "./tokens";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
export const prog = (f: number, a: number, b: number, e = ease) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });

/** Deterministic sparkle burst: matches the app's `burst("spark")` vocabulary. */
export const Burst: React.FC<{ x: number; y: number; f: number; n?: number; reach?: number; seed?: string }> = ({ x, y, f, n = 14, reach = 1, seed = "b" }) => {
  const cols = [C.tangerine, C.dandelion, C.teal, C.blueberry, C.kiwi];
  return <>{Array.from({ length: n }).map((_, i) => {
    const a = random(`${seed}a${i}`) * Math.PI * 2, d = (90 + random(`${seed}d${i}`) * 170) * reach, life = 22 + random(`${seed}l${i}`) * 12;
    const t = f - i * 0.5; if (t < 0 || t > life) return null;
    const p = Easing.out(Easing.cubic)(t / life), s = (0.7 + random(`${seed}s${i}`) * 0.9) * (1 - p * 0.6);
    return <div key={i} style={{ position: "absolute", left: x + Math.cos(a) * d * p - 9, top: y + Math.sin(a) * d * p - 14 * p - 9, width: 18, height: 18, zIndex: 40,
      opacity: p < 0.15 ? p / 0.15 : 1 - p, transform: `scale(${s}) rotate(${a * 40 + p * 160}deg)`, color: cols[i % cols.length] }}>
      <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z" fill="currentColor" /></svg>
    </div>;
  })}</>;
};

/** Word-by-word kinetic headline. Words spring up with overshoot, staggered. */
export const Headline: React.FC<{ words: string[]; f: number; size: number; color?: string; accent?: string; accentFrom?: number; align?: "left" | "center"; stagger?: number; lineBreakAfter?: number[] }> = ({
  words, f, size, color = C.ink, accent, accentFrom = 99, align = "left", stagger = 3, lineBreakAfter = [] }) => (
  <div style={{ fontFamily: '"Bricolage Grotesque"', fontWeight: 800, fontSize: size, lineHeight: 0.92, letterSpacing: "-0.04em", textAlign: align, textTransform: "uppercase" }}>
    {words.map((w, i) => {
      const p = prog(f, i * stagger, i * stagger + 14, Easing.bezier(0.34, 1.5, 0.5, 1));
      return <React.Fragment key={i}><span style={{ display: "inline-block", marginRight: size * 0.22, color: i >= accentFrom && accent ? accent : color,
        opacity: Math.min(1, p * 2.2), transform: `translateY(${(1 - p) * size * 0.55}px) rotate(${(1 - p) * 5}deg) scale(${0.9 + 0.1 * p})` }}>{w}</span>{lineBreakAfter.includes(i) && <br />}</React.Fragment>;
    })}
  </div>
);
