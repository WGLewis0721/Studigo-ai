import React from "react";
import { AbsoluteFill, Composition, Sequence, useCurrentFrame } from "remotion";
import { C, DISPLAY, FPS, VO } from "./tokens";
import { loadFonts } from "./fonts";
import { Opening } from "./scenes/Opening";
import { SceneAnswer, SceneCoach, SceneEnd, SceneFold, ScenePractice, SceneResult, SceneRoom } from "./scenes/Chapters";
import { clamp } from "./fx";
import { interpolate } from "remotion";

const Caption: React.FC = () => {
  const t = useCurrentFrame() / FPS, v = VO.find((x) => t >= x.s && t <= x.e);
  if (!v) return null;
  return <div style={{ position: "absolute", bottom: 38, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 99 }}>
    <span style={{ fontFamily: '"Figtree"', fontWeight: 800, fontSize: 36, color: "#fff", background: "rgba(20,27,45,.92)", padding: "12px 28px", borderRadius: 99 }}>{v.t}</span></div>;
};
// Scene i nominal start (s). Each Sequence begins 8 frames early with a wipe-in so transitions overlap.
const LEAD = 8;
const SCENES: [number, number, React.FC<{ f: number }>][] = [
  [6, 9, SceneRoom], [9, 13, SceneAnswer], [13, 17, SceneCoach], [17, 21, ScenePractice], [21, 25, SceneResult], [25, 28, SceneFold], [28, 30, SceneEnd],
];
const Wiped: React.FC<{ Comp: React.FC<{ f: number }>; dur: number }> = ({ Comp, dur }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, LEAD + 2], [0, 1], clamp);
  return <AbsoluteFill style={{ clipPath: `inset(0 ${(1 - p) * 100}% 0 0 round ${(1 - p) * 60}px)` }}><Comp f={f} /></AbsoluteFill>;
};
const OpeningScene: React.FC = () => { const f = useCurrentFrame(); return <Opening f={f} />; };

const Master: React.FC<{ captions: boolean }> = ({ captions }) => {
  loadFonts();
  return <AbsoluteFill style={{ background: C.snow, fontFamily: DISPLAY }}>
    <Sequence from={0} durationInFrames={6 * FPS}><OpeningScene /></Sequence>
    {SCENES.map(([s, e, Comp], i) => <Sequence key={i} from={s * FPS - LEAD} durationInFrames={(e - s) * FPS + LEAD}><Wiped Comp={Comp} dur={(e - s) * FPS} /></Sequence>)}
    {captions && <Caption />}
  </AbsoluteFill>;
};
const Proof: React.FC = () => { loadFonts(); return <AbsoluteFill><OpeningScene /><Caption /></AbsoluteFill>; };

export const Root: React.FC = () => (
  <>
    <Composition id="Proof5s" component={Proof} durationInFrames={5 * FPS} fps={FPS} width={1920} height={1080} />
    <Composition id="Master" component={Master} defaultProps={{ captions: true }} durationInFrames={30 * FPS} fps={FPS} width={1920} height={1080} />
  </>
);
