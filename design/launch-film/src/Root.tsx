import React from "react";
import { AbsoluteFill, Composition, Sequence, useCurrentFrame } from "remotion";
import { C, FPS, VO } from "./tokens";
import { loadFonts } from "./fonts";
import { Opening } from "./scenes/Opening";
import { LEAD, SceneAnswer, SceneCoach, SceneEnd, SceneFold, ScenePractice, SceneResult, SceneRoom } from "./scenes/Chapters";
import { P, out3 } from "./motion";
import { RigTest } from "./RigTest";
import { CameraMotionBlur } from "@remotion/motion-blur";

const Caption: React.FC = () => {
  const t = useCurrentFrame() / FPS, v = VO.find((x) => t >= x.s && t <= x.e);
  if (!v) return null;
  return <div style={{ position: "absolute", bottom: 34, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 99 }}>
    <span style={{ fontFamily: '"Figtree"', fontWeight: 700, fontSize: 34, color: "#fff", background: "rgba(20,27,45,.88)", padding: "10px 26px", borderRadius: 99 }}>{v.t}</span></div>;
};

type Scene = { s: number; e: number; Comp: React.FC<{ f: number }>; at: [number, number]; ring: string };
// Each scene opens as an iris from where the previous action ended; a coloured ring leads the edge.
const SCENES: Scene[] = [
  { s: 6, e: 9, Comp: SceneRoom, at: [700, 690], ring: C.teal },
  { s: 9, e: 13, Comp: SceneAnswer, at: [1450, 960], ring: C.blueberry },
  { s: 13, e: 17, Comp: SceneCoach, at: [700, 790], ring: C.tangerine },
  { s: 17, e: 21, Comp: ScenePractice, at: [960, 560], ring: C.dandelion },
  { s: 21, e: 25, Comp: SceneResult, at: [330, 930], ring: C.teal },
  { s: 25, e: 27.4, Comp: SceneFold, at: [560, 700], ring: C.ink },
  { s: 27.4, e: 30, Comp: SceneEnd, at: [1690, 620], ring: C.ink },
];
const Iris: React.FC<{ sc: Scene }> = ({ sc }) => {
  const f = useCurrentFrame();
  const r = 2700 * P(f, 0, LEAD + 8, out3);
  const circ = (rad: number) => `circle(${Math.max(0, rad)}px at ${sc.at[0]}px ${sc.at[1]}px)`;
  return <AbsoluteFill>
    {f < LEAD + 10 && <AbsoluteFill style={{ background: sc.ring, clipPath: circ(r + 26) }} />}
    <AbsoluteFill style={{ clipPath: circ(r) }}><sc.Comp f={f} /></AbsoluteFill>
  </AbsoluteFill>;
};
const OpeningAt: React.FC<{ off: number }> = ({ off }) => <Opening f={useCurrentFrame() + off} />;
/** The opening, with film-style shutter blur only on the fast moves (leap-in, boundary break). */
const OpeningScene: React.FC = () => (
  <>
    <Sequence from={0} durationInFrames={24}><OpeningAt off={0} /></Sequence>
    <Sequence from={24} durationInFrames={28}><CameraMotionBlur shutterAngle={200} samples={6}><OpeningAt off={24} /></CameraMotionBlur></Sequence>
    <Sequence from={52} durationInFrames={24}><OpeningAt off={52} /></Sequence>
    <Sequence from={76} durationInFrames={32}><CameraMotionBlur shutterAngle={220} samples={7}><OpeningAt off={76} /></CameraMotionBlur></Sequence>
    <Sequence from={108} durationInFrames={72}><OpeningAt off={108} /></Sequence>
  </>
);

const Master: React.FC<{ captions: boolean }> = ({ captions }) => {
  loadFonts();
  return <AbsoluteFill style={{ background: C.snow }}>
    <Sequence from={0} durationInFrames={6 * FPS}><OpeningScene /></Sequence>
    {SCENES.map((sc, i) => <Sequence key={i} from={Math.round(sc.s * FPS) - LEAD} durationInFrames={Math.round((sc.e - sc.s) * FPS) + LEAD}><Iris sc={sc} /></Sequence>)}
    {captions && <Caption />}
  </AbsoluteFill>;
};
const Proof: React.FC = () => { loadFonts(); return <AbsoluteFill><OpeningScene /><Caption /></AbsoluteFill>; };

export const Root: React.FC = () => (
  <>
    <Composition id="Proof5s" component={Proof} durationInFrames={6 * FPS} fps={FPS} width={1920} height={1080} />
    <Composition id="RigTest" component={RigTest} durationInFrames={120} fps={FPS} width={1920} height={1080} />
    <Composition id="Master" component={Master} defaultProps={{ captions: true }} durationInFrames={30 * FPS} fps={FPS} width={1920} height={1080} />
  </>
);
