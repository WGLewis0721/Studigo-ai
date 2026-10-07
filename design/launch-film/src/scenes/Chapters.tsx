import React from "react";
import { lean as leanSrc } from "../asset";
import { AbsoluteFill, interpolate, Easing } from "remotion";
import { C, DISPLAY, SANS } from "../tokens";
import { Studigo } from "../Studigo";
import { Burst, Headline, prog, clamp } from "../fx";
import { Bar, Chip, DocCard, Option, Phone, RoomScreen, card } from "../ui/Panels";

const spr = Easing.bezier(0.34, 1.4, 0.5, 1);
const bob = (f: number, a = 10, s = 0.35) => Math.abs(Math.sin(f * s)) * a;
// Every scene's local frame f has 8 frames of wipe-in lead (nominal scene start = f 8).

/** 6:00–9:00 MAKE IT MAKE SENSE. — doc becomes the Study Room; he walks the foreground. */
export const SceneRoom: React.FC<{ f: number }> = ({ f }) => {
  const wk = prog(f, 8, 40, Easing.out(Easing.cubic)), phone = prog(f, 6, 30, spr);
  const walking = f < 46;
  return <AbsoluteFill style={{ background: C.tealSoft }}>
    <div style={{ position: "absolute", left: 90, top: 70, zIndex: 20 }}><Headline words={["MAKE IT", "MAKE SENSE."]} f={f - 8} size={118} color={C.ink} accent={C.tealInk} accentFrom={1} /></div>
    <div style={{ position: "absolute", left: 1220, top: 150, zIndex: 5, transform: `translateY(${(1 - phone) * 200}px) rotate(${(1 - phone) * -8}deg) scale(${0.86 + phone * 0.14})`, opacity: Math.min(1, phone * 2) }}>
      <Phone w={400}><RoomScreen w={400} ask={prog(f, 40, 56)} /></Phone>
    </div>
    <Studigo cx={310 + wk * 330} groundY={1030} size={780} pose={walking ? "right" : "center"} lift={walking ? bob(f) : 0} rotate={walking ? Math.sin(f * 0.35) * 2 : 0} sy={1 + 0.012 * Math.sin(f * 0.16)} />
    {f > 60 && <div style={{ position: "absolute", left: 800, top: 520, zIndex: 8, ...card(330, { padding: "20px 26px", fontSize: 30, fontWeight: 800, borderRadius: 24, opacity: prog(f, 60, 72), transform: `translateY(${(1 - prog(f, 60, 72, spr)) * 40}px)` }) }}>
      <span style={{ color: C.muted, fontSize: 22 }}>Your question</span><br />What is evaporation?</div>}
  </AbsoluteFill>;
};

/** 9:00–13:00 ANSWERS WITH A SOURCE. — the trust moment. */
export const SceneAnswer: React.FC<{ f: number }> = ({ f }) => {
  const c = prog(f, 8, 28, spr), cite = prog(f, 78, 92, spr), glow = 0.5 + 0.5 * Math.sin(f * 0.3) ;
  const words = "Evaporation is when a liquid changes into a gas. Heat gives the water energy to evaporate.".split(" ");
  const shown = Math.floor(prog(f, 28, 78, Easing.linear) * words.length);
  return <AbsoluteFill style={{ background: C.blueberrySoft }}>
    <div style={{ position: "absolute", left: 800, top: 60, zIndex: 20 }}><Headline words={["ANSWERS", "WITH A", "SOURCE."]} f={f - 8} size={92} color={C.ink} accent={C.blueberryInk} accentFrom={2} lineBreakAfter={[0]} /></div>
    <div style={{ position: "absolute", left: 780, top: 400, zIndex: 6, opacity: Math.min(1, c * 2), transform: `translateY(${(1 - c) * 120}px) scale(${0.94 + 0.06 * c})` }}>
      <div style={card(960, {})}>
        <Bar label="Learn" sub="Science study guide" tone={C.blueberry} />
        <div style={{ padding: "34px 44px 40px" }}>
          <div style={{ display: "inline-block", fontWeight: 800, fontSize: 30, color: C.blueberryInk, background: C.blueberrySoft, padding: "10px 22px", borderRadius: 99, marginBottom: 24 }}>What is evaporation?</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 50, letterSpacing: "-.03em", lineHeight: 1.1, minHeight: 170 }}>{words.slice(0, shown).join(" ")}<span style={{ opacity: shown < words.length ? 1 : 0 }}>▍</span></div>
          <div style={{ marginTop: 22, opacity: cite, transform: `translateY(${(1 - cite) * 20}px) scale(${0.9 + 0.1 * cite})`, transformOrigin: "left" }}><Chip text="Science study guide" page="page 2" glow={cite * glow} /></div>
        </div>
      </div>
    </div>
    <Studigo cx={400} groundY={1030} size={800} pose={f < 70 ? "center" : f < 130 ? "right" : "read"} poseB={f >= 66 && f < 76 ? "right" : undefined} mix={prog(f, 66, 76)} sy={1 + 0.012 * Math.sin(f * 0.16)} />
    <Burst x={1230} y={760} f={f - 80} n={10} reach={0.8} seed="cite" />
  </AbsoluteFill>;
};

/** 13:00–17:00 STUCK? WE WORK THROUGH IT. — he nudges the Coach wall of text aside. */
export const SceneCoach: React.FC<{ f: number }> = ({ f }) => {
  const sx = 1500 - prog(f, 8, 40, Easing.out(Easing.cubic)) * 150; // walks in from the right
  const nudge = prog(f, 40, 62, Easing.bezier(0.5, 0, 0.2, 1)), reveal = prog(f, 56, 82, spr), flip = prog(f, 100, 118, Easing.inOut(Easing.cubic));
  return <AbsoluteFill style={{ background: C.tangerineSoft }}>
    <div style={{ position: "absolute", left: 90, top: 60, zIndex: 20 }}><Headline words={["STUCK?", "WE WORK", "THROUGH IT."]} f={f - 8} size={104} color={C.ink} accent={C.tangerineInk} accentFrom={1} lineBreakAfter={[0]} /></div>
    {/* wall of text, shoved aside */}
    <div style={{ position: "absolute", left: 300, top: 500, zIndex: 4, transform: `translateX(${-nudge * 900}px) rotate(${-nudge * 14}deg)`, opacity: 1 - nudge * 0.9 }}>
      <div style={card(900, { padding: 36, fontSize: 28, lineHeight: 1.35, color: C.muted })}>{"Evaporation occurs when molecules at the surface of a liquid gain enough kinetic energy to overcome intermolecular forces and enter the gas phase, a process distinct from boiling in that it can occur at any temperature below the boiling point…"}</div>
    </div>
    <div style={{ position: "absolute", left: 330, top: 430, zIndex: 6, transform: `translateY(${(1 - reveal) * 80}px) rotateY(${flip * 90}deg)`, opacity: reveal * (1 - flip), perspective: 1200 }}>
      <div style={card(860)}>
        <Bar label="Coach" sub="Practice" tone={C.tangerine} />
        <div style={{ padding: "34px 44px", fontFamily: DISPLAY, fontWeight: 800, fontSize: 50, letterSpacing: "-.03em", lineHeight: 1.12 }}>
          Let’s start with one thing.<br /><span style={{ color: C.tangerineInk }}>Where does the water go?</span>
          <div style={{ marginTop: 22, fontFamily: SANS, fontWeight: 700, fontSize: 28, background: C.tangerineSoft, color: C.tangerineInk, padding: "16px 22px", borderRadius: 16 }}>Hint: think about liquid turning into a gas.</div>
        </div>
      </div>
    </div>
    <div style={{ position: "absolute", left: 330, top: 430, zIndex: 6, opacity: flip, transform: `rotateY(${(1 - flip) * -90}deg)`, perspective: 1200 }}>
      <div style={card(860, { padding: "40px 44px" })}><div style={{ fontWeight: 800, color: C.dandelionInk, fontSize: 24, letterSpacing: ".08em" }}>PRACTICE · QUESTION 1</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 54, letterSpacing: "-.03em", marginTop: 12 }}>A liquid changes into a gas. That is…</div></div>
    </div>
    <Studigo cx={sx} groundY={1030} size={780} mirror={false} pose={f < 40 ? "left" : f < 70 ? "left" : "center"} lift={f < 40 ? bob(f) : 0} sy={1 + 0.012 * Math.sin(f * 0.16)} rotate={-nudge * (1 - reveal) * 5} />
  </AbsoluteFill>;
};

/** 17:00–21:00 THEN YOU TRY. */
export const ScenePractice: React.FC<{ f: number }> = ({ f }) => {
  const c = prog(f, 6, 26, spr), pick = prog(f, 62, 70, spr), right = prog(f, 78, 90, spr);
  return <AbsoluteFill style={{ background: C.dandelionSoft }}>
    <div style={{ position: "absolute", left: 800, top: 60, zIndex: 20 }}><Headline words={["THEN", "YOU TRY."]} f={f - 8} size={128} color={C.ink} accent={C.dandelionInk} accentFrom={1} lineBreakAfter={[0]} /></div>
    <div style={{ position: "absolute", left: 760, top: 400, zIndex: 6, opacity: Math.min(1, c * 2), transform: `translateY(${(1 - c) * 120}px)` }}>
      <div style={card(1000)}>
        <Bar label="Quiz" sub="Question 1" tone={C.dandelion} />
        <div style={{ padding: "34px 44px 40px", display: "grid", gap: 16 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 50, letterSpacing: "-.03em", marginBottom: 6 }}>A liquid changes into a gas. That is…</div>
          <Option k="A" text="Melting" /><Option k="B" text="Evaporation" on={pick * (1 - right)} right={right} /><Option k="C" text="Condensation" />
        </div>
      </div>
    </div>
    <Studigo cx={380} groundY={1030} size={780} pose={f < 60 ? "up" : f < 76 ? "center" : "celebrate"} poseB={undefined}
      lift={f >= 78 ? Math.abs(Math.sin(prog(f, 78, 104, Easing.linear) * Math.PI * 2)) * 36 : 0} sy={1 + 0.012 * Math.sin(f * 0.16)} />
    <Burst x={1560} y={720} f={f - 80} n={12} reach={0.9} seed="right" />
  </AbsoluteFill>;
};

/** 21:00–25:00 THAT'S YOU GETTING IT. — slow down; he leans on the result panel. Uses the app's own waist-up `lean` sprite. */
export const SceneResult: React.FC<{ f: number }> = ({ f }) => {
  const c = prog(f, 8, 34, spr), lean = prog(f, 40, 66, Easing.out(Easing.cubic));
  return <AbsoluteFill style={{ background: C.tealSoft }}>
    <div style={{ position: "absolute", left: 90, top: 60, zIndex: 20 }}><Headline words={["THAT’S YOU", "GETTING IT."]} f={f - 8} size={118} color={C.ink} accent={C.tealInk} accentFrom={1} lineBreakAfter={[0]} /></div>
    <div style={{ position: "absolute", left: 640, top: 470, zIndex: 6, opacity: Math.min(1, c * 2), transform: `translateY(${(1 - c) * 100}px)` }}>
      <div style={card(960, { padding: "38px 46px" })}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: DISPLAY, fontWeight: 800, fontSize: 56, letterSpacing: "-.03em" }}><span style={{ width: 54, height: 54, borderRadius: 27, background: C.tealSoft, color: C.tealInk, display: "grid", placeItems: "center", fontSize: 34 }}>✓</span>Exactly.</div>
        <div style={{ fontSize: 36, fontWeight: 600, marginTop: 14, color: C.ink2 }}>Evaporation is liquid changing into gas.</div>
        <div style={{ marginTop: 20 }}><Chip text="Science study guide" page="page 2" /></div>
      </div>
    </div>
    <img src={leanSrc} style={{ position: "absolute", left: 40 + lean * 30, top: 400 - lean * 30, width: 620, zIndex: 10, transform: `rotate(${lean * -3}deg)`, transformOrigin: "50% 100%" }} />
  </AbsoluteFill>;
};

/** 25:00–28:00 LEARN YOUR STUFF. — every panel folds into the phone behind him. */
export const SceneFold: React.FC<{ f: number }> = ({ f }) => {
  const fold = prog(f, 8, 44, Easing.bezier(0.5, 0, 0.2, 1));
  const items = [["Your material", C.tangerine], ["Answer + source", C.blueberry], ["Coach", C.tangerine], ["Practice", C.dandelion]];
  return <AbsoluteFill style={{ background: C.ink }}>
    <div style={{ position: "absolute", left: 1010, top: 70, zIndex: 20 }}><Headline words={["LEARN", "YOUR", "STUFF."]} f={f - 30} size={120} color="#fff" accent={C.teal} accentFrom={2} lineBreakAfter={[1]} /></div>
    <div style={{ position: "absolute", left: 1200, top: 330, zIndex: 3, opacity: prog(f, 20, 40), transform: `scale(${0.8 + 0.2 * prog(f, 20, 44, spr)})` }}><Phone w={360} dark><RoomScreen w={360} /></Phone></div>
    {items.map(([t, col], i) => {
      const x0 = 120 + (i % 2) * 520, y0 = 140 + Math.floor(i / 2) * 340;
      return <div key={t} style={{ position: "absolute", left: 0, top: 0, zIndex: 4, transform: `translate(${x0 + (1380 - x0) * fold}px, ${y0 + (560 - y0) * fold}px) scale(${1 - fold * 0.7}) rotate(${fold * (i % 2 ? 12 : -12)}deg)`, opacity: 1 - prog(f, 38, 46, Easing.linear) }}>
        <div style={card(440, { padding: "34px 36px", fontFamily: DISPLAY, fontWeight: 800, fontSize: 44, letterSpacing: "-.03em" })}><i style={{ display: "block", width: 18, height: 18, borderRadius: 9, background: col as string, marginBottom: 16 }} />{t}</div></div>;
    })}
    <Studigo cx={600} groundY={1060} size={960} pose={f < 40 ? "right" : "wave"} poseB={f >= 36 && f < 44 ? "wave" : undefined} mix={prog(f, 36, 44)} rotate={f >= 44 ? Math.sin((f - 44) * 0.3) * 2.2 : 0} sy={1 + 0.012 * Math.sin(f * 0.16)} />
  </AbsoluteFill>;
};

/** 28:00–30:00 STUDIGO / Learn your stuff. — he springs into the phone, last look, logo lands. */
export const SceneEnd: React.FC<{ f: number }> = ({ f }) => {
  const j = prog(f, 6, 24, Easing.inOut(Easing.cubic)), look = prog(f, 26, 34, spr), logo = prog(f, 24, 44, spr);
  const PHX = 1420, PHW = 380;
  const size = 960 + (PHW * 0.84 - 960) * j, cx = 600 + (PHX + PHW / 2 - 600) * j, gy = 1060 + (PHW * 2.1 * 0.62 + 140 - 1060) * j;
  return <AbsoluteFill style={{ background: C.snow }}>
    <div style={{ position: "absolute", left: PHX, top: 170, zIndex: 2 }}><Phone w={PHW}><div style={{ height: "100%", background: C.snow }} /></Phone></div>
    <Studigo cx={cx} groundY={gy} size={size} pose={f < 24 ? "leap" : "center"} poseB={f >= 20 && f < 28 ? "center" : undefined} mix={prog(f, 20, 28)} lift={4 * j * (1 - j) * 220} z={f < 22 ? 12 : 4} />
    <div style={{ position: "absolute", left: 140, top: 380, zIndex: 8 }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 250, letterSpacing: "-.055em", lineHeight: 0.9, color: C.ink, opacity: Math.min(1, logo * 2), transform: `translateY(${(1 - logo) * 120}px) scale(${0.92 + 0.08 * logo})`, transformOrigin: "left" }}>Studigo</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 72, letterSpacing: "-.03em", color: C.tealInk, marginTop: 18, opacity: prog(f, 36, 48, Easing.linear), transform: `translateY(${(1 - prog(f, 36, 48)) * 30}px)` }}>Learn your stuff.</div>
    </div>
    <Burst x={1610} y={620} f={f - 24} n={12} reach={0.9} seed="end" />
  </AbsoluteFill>;
};
