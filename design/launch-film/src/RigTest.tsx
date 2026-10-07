import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Studigo, SState } from "./Studigo";
import { loadFonts } from "./fonts";
export const RigTest: React.FC = () => {
  loadFonts(); const f = useCurrentFrame();
  const track = (g: number): SState => ({ cx: 700 + 500 * Math.sin(g * 0.09), gy: 980, size: 780, pose: "center", lift: Math.abs(Math.sin(g * 0.09)) * 60, blink: g % 40 < 4 ? 1 : 0 });
  return <AbsoluteFill style={{ background: "#f7f8fb" }}><Studigo id="t" track={track} f={f} /></AbsoluteFill>;
};
