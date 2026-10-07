import React from "react";
import { Img, staticFile } from "remotion";

export type Pose = "center" | "left" | "right" | "up" | "down" | "up-right" | "down-right" | "wave" | "leap" | "celebrate" | "read";
// All sprites are the approved files from apps/web/public/mascot/companion/full/ (540px). Never redraw him.
export const Sprite: React.FC<{ pose: Pose; opacity?: number }> = ({ pose, opacity = 1 }) => (
  <Img src={staticFile(`sprites/${pose}.webp`)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity }} />
);

/** Studigo rig: positioned by FEET (cx, groundY). size = sprite box edge. Squash/stretch pivots at the feet. */
export const Studigo: React.FC<{
  cx: number; groundY: number; size: number; pose: Pose; poseB?: Pose; mix?: number;
  rotate?: number; sx?: number; sy?: number; mirror?: boolean; lift?: number; shadow?: number; z?: number;
}> = ({ cx, groundY, size, pose, poseB, mix = 0, rotate = 0, sx = 1, sy = 1, mirror = false, lift = 0, shadow = 1, z = 10 }) => {
  const FEET = 0.93; // feet sit ~93% down the sprite box
  const top = groundY - size * FEET - lift;
  const sh = Math.max(0.25, 1 - lift / (size * 0.9));
  return (
    <>
      <div style={{ position: "absolute", left: cx - size * 0.34, top: groundY - size * 0.045, width: size * 0.68, height: size * 0.09, borderRadius: "50%",
        background: "radial-gradient(ellipse at center, rgba(20,27,45,.34), rgba(20,27,45,0) 70%)", transform: `scale(${sh})`, opacity: shadow * sh, zIndex: z - 1 }} />
      <div style={{ position: "absolute", left: cx - size / 2, top, width: size, height: size, zIndex: z,
        transformOrigin: `50% ${FEET * 100}%`, transform: `rotate(${rotate}deg) scale(${(mirror ? -1 : 1) * sx}, ${sy})` }}>
        <Sprite pose={pose} opacity={poseB ? 1 - mix * 0 : 1} />
        {poseB && mix > 0 && <Sprite pose={poseB} opacity={mix} />}
      </div>
    </>
  );
};
