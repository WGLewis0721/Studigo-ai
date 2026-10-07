import React from "react";
import { Img, staticFile } from "remotion";
import { follow } from "./motion";
import { MAP_SHEAR, MAP_TAIL } from "./maps";

export type Pose = "center" | "left" | "right" | "up" | "down" | "up-right" | "down-right" | "wave" | "leap" | "celebrate" | "read";
// Approved sprites only (apps/web/public/mascot/companion/full/). Never redraw him.
export const Sprite: React.FC<{ pose: Pose; opacity?: number }> = ({ pose, opacity = 1 }) => (
  <Img src={staticFile(`sprites/${pose}.webp`)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity }} />
);

/** One frame of performance. cx/gy are the FEET; size is the sprite box edge (character ≈ 80% of that tall). */
export type SState = {
  cx: number; gy: number; size: number; pose: Pose; poseB?: Pose; mix?: number;
  rot?: number; sx?: number; sy?: number; lift?: number; mirror?: boolean; shadow?: number; blink?: number; flame?: number;
};
const FEET = 521 / 540; // feet row inside the 540px sprite
const EYES: Partial<Record<Pose, [number, number][]>> = { center: [[222, 192], [312, 191]] }; // measured; blink only where measured

/**
 * Studigo rig v2. The sprites are flat, so the "animation film" feel comes from three things:
 *  1. squash/stretch with volume kept, pivoting at the feet (set by the track),
 *  2. overlapping action: crest/frills lag the body and the tail+flame whip after it (spring-simulated from the
 *     track's own history, applied through two displacement-map filters), and
 *  3. a blink. Nothing here changes his shape, colour or face.
 * `track(f)` must be pure in f so the sim is deterministic for rendering.
 */
export const Studigo: React.FC<{ id: string; track: (f: number) => SState; f: number; z?: number; castShadow?: boolean; drop?: boolean }> = ({ id, track, f, z = 10, castShadow = true, drop = true }) => {
  const s = track(f);
  const size = s.size, k = size / 780;
  // --- secondary motion (px at size 780, scaled by k)
  const px = follow((g) => track(g).cx, f, 0.17, 0.2);
  const py = follow((g) => track(g).gy - (track(g).lift ?? 0), f, 0.1, 0.13);
  const lagX = Math.max(-46, Math.min(46, (px - s.cx) * 0.55)) * k;                    // head/crest lags opposite to travel
  const flickIdle = (7 * Math.sin(f * 0.19) + 3.5 * Math.sin(f * 0.43 + 1)) * k;       // tail never stops
  const tailY = Math.max(-70, Math.min(70, (py - (s.gy - (s.lift ?? 0))) * 0.9)) * k + flickIdle;
  const shearScale = -2 * lagX, tailScale = -2 * tailY;
  const top = s.gy - size * FEET - (s.lift ?? 0);
  const sh = Math.max(0.25, 1 - (s.lift ?? 0) / (size * 0.9));
  const eyes = EYES[s.pose];
  const blinkT = s.blink ?? 0; // 0..1 (1 = shut), supplied by the scene via blinkAt()
  const fid = `rig-${id}`;
  const E = (cx: number, cy: number, i: number) => (
    <div key={i} style={{ position: "absolute", left: (cx - 18) / 540 * size, top: (cy - 23) / 540 * size, width: 36 / 540 * size, height: (46 / 540 * size) * blinkT,
      borderRadius: "46% 46% 50% 50% / 30% 30% 60% 60%", background: "linear-gradient(#f59a52, #ec8741 60%, #e57c39)",
      borderBottom: `${Math.max(2, size / 300)}px solid rgba(120,52,18,.55)`, boxShadow: "0 1px 0 rgba(255,190,130,.35)" }} />
  );
  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id={fid} x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB" filterUnits="objectBoundingBox">
          <feImage href={MAP_SHEAR} x="0" y="0" width={size} height={size} preserveAspectRatio="none" result="m1" />
          <feDisplacementMap in="SourceGraphic" in2="m1" scale={shearScale} xChannelSelector="R" yChannelSelector="B" result="d1" />
          <feImage href={MAP_TAIL} x="0" y="0" width={size} height={size} preserveAspectRatio="none" result="m2" />
          <feDisplacementMap in="d1" in2="m2" scale={tailScale} xChannelSelector="B" yChannelSelector="G" />
        </filter>
      </svg>
      {castShadow && <div style={{ position: "absolute", left: s.cx - size * 0.3, top: s.gy - size * 0.03, width: size * 0.6, height: size * 0.075, borderRadius: "50%",
        background: "radial-gradient(ellipse at center, rgba(20,27,45,.38), rgba(20,27,45,0) 70%)", transform: `scale(${sh})`, opacity: (s.shadow ?? 1) * sh, zIndex: z - 1 }} />}
      <div style={{ position: "absolute", left: s.cx - size / 2, top, width: size, height: size, zIndex: z,
        transformOrigin: `50% ${FEET * 100}%`, transform: `rotate(${s.rot ?? 0}deg) scale(${(s.mirror ? -1 : 1) * (s.sx ?? 1)}, ${s.sy ?? 1})` }}>
        <div style={{ position: "absolute", inset: 0, filter: `url(#${fid})${drop ? " drop-shadow(0 26px 22px rgba(20,27,45,.22))" : ""}` }}>
          <Sprite pose={s.pose} />
          {s.poseB && (s.mix ?? 0) > 0 && <Sprite pose={s.poseB} opacity={s.mix} />}
          {eyes && blinkT > 0.02 && !s.poseB && eyes.map(([x, y], i) => E(x, y, i))}
        </div>
      </div>
    </>
  );
};

/** Blink schedule: returns 0..1. Irregular gaps so it doesn't metronome; never during a hold the scene marks. */
export const blinkAt = (f: number, seed = 0): number => {
  const times = [38, 112, 171, 229, 302, 361, 440, 497, 571].map((t) => t + ((seed * 7) % 13));
  for (const t of times) { const d = f - t; if (d >= 0 && d < 5) return [0.55, 1, 1, 0.6, 0.2][d]; }
  return 0;
};
