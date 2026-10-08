import React from "react";
import { AbsoluteFill, Easing, Img, random, staticFile } from "remotion";
import { C, DISPLAY, SANS, lift2, lift3 } from "../tokens";
import { Studigo, SState } from "../Studigo";
import { Burst } from "../fx";
import { Arrow, Display, Field, Glow, Mark, Note, Ring, Underline, Write } from "../ink";
import { Chip, Confidence, DocCard, Kicker, Option, Phone, RoomScreen, Spinner, Tap, card } from "../ui/Panels";
import { P, boing, inOut, lerp, out3, ring, snap, sp, squash } from "../motion";

export const LEAD = 10; // frames of overlap before each scene's nominal start (the iris transition lives here)
const bob = (t: number, a = 16, s = 0.42) => Math.abs(Math.sin(t * s)) * a;
const Cam: React.FC<{ f: number; dur: number; to?: number; ox?: number; oy?: number; children: React.ReactNode }> = ({ f, dur, to = 1.035, ox = 50, oy = 55, children }) => (
  <AbsoluteFill style={{ transform: `scale(${1 + (to - 1) * P(f, 0, dur, (x) => x)})`, transformOrigin: `${ox}% ${oy}%` }}>{children}</AbsoluteFill>
);
const BL = (t: number, at: number[]) => { for (const a of at) { const d = Math.floor(t) - a; if (d >= 0 && d < 5) return [0.55, 1, 1, 0.6, 0.2][d]; } return 0; };

/* ───────────────────────── 6:00–9:00  Drop it in. ───────────────────────── */
export const roomTrack = (f: number): SState => {
  const t = f - LEAD, e = P(t, 0, 30, inOut);
  const pose: SState["pose"] = t < 22 ? "read" : t < 28 ? "center" : "right";
  const hop = P(t, 50, 62, (x) => x);
  return { cx: lerp(700, 470, e), gy: lerp(1010, 1030, e), size: lerp(960, 800, e), pose, lift: 38 * Math.abs(Math.sin(hop * Math.PI)),
    ...squash(0.05 * Math.sin(hop * Math.PI) + 0.012 * Math.sin(t * 0.16)), blink: pose === "center" ? BL(t, [24]) : 0 };
};
export const SceneRoom: React.FC<{ f: number }> = ({ f }) => {
  const t = f - LEAD;
  const ph = sp(t, 2, 12, 120), stage = t < 22 ? 0 : t < 46 ? 1 : 2 + P(t, 50, 62);
  const typed = "What is evaporation?", typedN = Math.floor(P(t, 64, 86, (x) => x) * typed.length);
  return <Cam f={f} dur={100} ox={72} oy={60}>
    <Field color={C.tealSoft} f={f} blob="#bdeee9" />
    <Glow x={480} y={640} r={640} o={0.7} />
    <div style={{ position: "absolute", left: 150, top: 78, zIndex: 20 }}>
      <Write p={P(t, 4, 20, out3)}><Display size={142} wdth={84}>Drop it in.</Display></Write>
      <Write p={P(t, 14, 32, out3)} style={{ marginTop: 18 }}><Display size={44} weight={560} wdth={100} color={C.ink2}>Study guide, slides, even photos of handouts.</Display></Write>
    </div>
    <Note x={820} y={176} p={P(t, 40, 56)} rot={-4} size={44}>it reads all of it</Note>
    <Arrow x1={900} y1={250} x2={900} y2={360} bend={-50} p={P(t, 52, 68)} />
    {/* enlarged UI states, so the real strings are readable */}
    <div style={{ position: "absolute", left: 690, top: 380, zIndex: 10, opacity: Math.min(1, sp(t, 12, 12, 130) * 2), transform: `translateX(${(1 - sp(t, 12, 12, 130)) * 160}px) rotate(-1.5deg)` }}>
      <div style={card(640, { padding: "26px 30px", display: "flex", alignItems: "center", gap: 22 })}>
        <span style={{ width: 70, height: 70, borderRadius: 16, background: C.tangerineSoft, color: C.tangerineInk, fontWeight: 800, fontSize: 24, display: "grid", placeItems: "center" }}>PDF</span>
        <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 34, letterSpacing: "-.01em" }}>Science study guide</div>
          <div style={{ fontWeight: 700, fontSize: 25, color: stage >= 2 ? C.tealInk : C.muted, marginTop: 2 }}>{stage < 1 ? "Uploading…" : stage < 2 ? "Reading, OCR'ing, and indexing…" : "Ready to study"}</div></div>
        {stage < 2 ? <Spinner f={f} size={40} /> : <span style={{ width: 44, height: 44, borderRadius: 99, background: C.teal, color: C.ink, display: "grid", placeItems: "center", fontSize: 28, fontWeight: 800 }}>✓</span>}
      </div>
    </div>
    <div style={{ position: "absolute", left: 740, top: 590, zIndex: 10, opacity: P(t, 62, 70), transform: `translateY(${(1 - P(t, 62, 72, out3)) * 30}px) rotate(1deg)` }}>
      <div style={card(600, { padding: "20px 28px", borderRadius: 99, display: "flex", alignItems: "center", boxShadow: `inset 0 0 0 2px ${C.tangerine}, ${lift2}` })}>
        <span style={{ fontSize: 34, fontWeight: 600 }}>{typed.slice(0, typedN) || "Ask Studigo"}</span><i style={{ width: 3, height: 38, background: C.ink, marginLeft: 3, opacity: Math.floor(f / 8) % 2 }} />
      </div>
    </div>
    <div style={{ position: "absolute", left: 1230, top: 96, zIndex: 8, transform: `translateX(${(1 - ph) * 700}px) rotate(${(1 - ph) * 9}deg)`, opacity: Math.min(1, ph * 2.5) }}>
      <Phone w={440}><RoomScreen w={440} f={f} stage={stage} typed={typed.slice(0, typedN)} focus={t >= 64 ? 1 : 0} /></Phone>
    </div>
    {t >= 48 && <Burst x={1230 + 380} y={96 + 280} f={t - 50} n={10} reach={0.8} seed="ready" />}
    <Studigo id="room" track={roomTrack} f={f} z={12} />
  </Cam>;
};

/* ───────────────────────── 9:00–13:00  Every answer shows its page. ───────────────────────── */
export const answerTrack = (f: number): SState => {
  const t = f - LEAD, w = P(t, 12, 42, inOut), out = P(t, 102, 128, Easing.in(Easing.quad)), walking = (t >= 12 && t < 42) || (t >= 102 && t < 130);
  const cx = lerp(470, 1560, w) + out * 480;
  const pose: SState["pose"] = t < 44 ? "right" : t < 98 ? "left" : t < 102 ? "center" : "right";
  const land = t >= 42 ? -0.09 * ring((t - 42) / 30, 2.6, 8) : 0;
  const wind = t >= 5 && t < 12 ? P(t, 5, 12, inOut) : 0;
  return { cx: cx - wind * 14, gy: 1030, size: 800, pose, lift: walking ? bob(t, 22) : 0, rot: walking ? Math.sin(t * 0.42) * 2.4 : -wind * 3,
    ...squash(land + (walking ? 0.02 * Math.sin(t * 0.84) : 0.012 * Math.sin(t * 0.16))), blink: pose === "left" ? BL(t, [60, 118]) : 0, mirror: false };
};
export const SceneAnswer: React.FC<{ f: number }> = ({ f }) => {
  const t = f - LEAD;
  const c = sp(t, 0, 13, 130), words = "Evaporation is when a liquid changes into a gas. Heat gives the water the energy to escape.".split(" ");
  const shown = Math.floor(P(t, 40, 82, (x) => x) * words.length);
  const chip = sp(t, 84, 10, 160), page = sp(t, 70, 12, 120), ringP = P(t, 100, 118), note = P(t, 96, 112);
  return <Cam f={f} dur={130} ox={35} oy={60}>
    <Field color={C.blueberrySoft} f={f} blob="#cddcff" />
    <Glow x={1560} y={640} r={640} o={0.7} />
    <div style={{ position: "absolute", left: 150, top: 70, zIndex: 20 }}>
      <Write p={P(t, 4, 20, out3)}><Display size={104} wdth={84}>Every answer</Display></Write>
      <Write p={P(t, 12, 28, out3)}><Display size={104} wdth={84} style={{ marginTop: -2 }}>shows <Mark p={P(t, 64, 80, out3)} color={C.dandelion}>its page.</Mark></Display></Write>
    </div>
    {/* the page the answer came from, sliding out from behind the card */}
    <div style={{ position: "absolute", left: 980 + page * 120, top: 300 + page * 20, zIndex: 4, transform: `rotate(${5 * page}deg)`, opacity: Math.min(1, page * 3) }}>
      <div style={card(330, { padding: "26px 28px", borderRadius: 18 })}>
        <div style={{ fontWeight: 800, fontSize: 18, color: C.muted, letterSpacing: ".06em", marginBottom: 12 }}>SCIENCE STUDY GUIDE · PAGE 2</div>
        <div style={{ height: 9, background: C.snow3, borderRadius: 5, marginBottom: 11 }} /><div style={{ height: 9, width: "80%", background: C.snow3, borderRadius: 5, marginBottom: 14 }} />
        <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.25, background: `linear-gradient(transparent 52%, ${C.dandelion} 52%)`, display: "inline" }}>Evaporation is when a liquid changes into a gas.</div>
        <div style={{ height: 9, width: "90%", background: C.snow3, borderRadius: 5, margin: "14px 0 11px" }} /><div style={{ height: 9, width: "55%", background: C.snow3, borderRadius: 5 }} />
      </div>
    </div>
    <div style={{ position: "absolute", left: 330, top: 290, zIndex: 6, opacity: Math.min(1, c * 2), transform: `translateY(${(1 - c) * 110}px)` }}>
      <div style={card(900)}>
        <div style={{ padding: "34px 44px 40px" }}>
          <Kicker tone={C.blueberryInk}>LEARN · FROM YOUR MATERIALS</Kicker>
          <div style={{ display: "flex", justifyContent: "flex-end", margin: "20px 0 22px" }}><span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 32, background: C.ink, color: "#fff", padding: "12px 26px", borderRadius: "26px 26px 8px 26px" }}>What is evaporation?</span></div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 46, letterSpacing: "-.025em", lineHeight: 1.12, minHeight: 156 }}>{words.slice(0, shown).join(" ")}</div>
          <div style={{ marginTop: 20, transform: `scale(${0.85 + 0.15 * chip})`, opacity: Math.min(1, chip * 2), transformOrigin: "left center", display: "inline-block" }}><Chip text="Science study guide" page="page 2" /></div>
        </div>
      </div>
    </div>
    <Ring cx={690} cy={790} rx={300} ry={48} p={ringP} seed="chip" />
    <Note x={1200} y={150} p={note} rot={-4} size={46}>page 2.<br />not a guess.</Note>
    <Arrow x1={1290} y1={270} x2={1010} y2={745} bend={110} p={P(t, 104, 124)} />
    <Studigo id="ans" track={answerTrack} f={f} z={f - LEAD < 44 ? 22 : 12} />
    {t >= 44 && t < 70 && <Burst x={1560} y={1010} f={t - 44} n={6} reach={0.5} seed="dust" />}
  </Cam>;
};

/* ───────────────────────── 13:00–17:00  Stuck? Okay. ───────────────────────── */
const PANEL_X = 560, PANEL_W = 800;
export const coachTrack = (f: number): SState => {
  const t = f - LEAD;
  if (t < 34) { const e = P(t, 0, 34, Easing.out(Easing.quad)); return { cx: lerp(2040, 1575, e), gy: 1030, size: 800, pose: "left", lift: bob(t, 20), rot: Math.sin(t * 0.42) * 2.4, ...squash(0.02 * Math.sin(t * 0.84)) }; }
  if (t < 42) { const c = P(t, 34, 42, inOut); return { cx: 1575 + 12 * c, gy: 1030, size: 800, pose: "left", rot: 5 * c, ...squash(-0.05 * c) }; }
  if (t < 48) { const l = P(t, 42, 48, Easing.in(Easing.cubic)); return { cx: lerp(1587, 1498, l), gy: 1030, size: 800, pose: "left", rot: lerp(5, -5, l), ...squash(0.05 * l) }; }
  const r = P(t, 48, 66, out3);
  return { cx: lerp(1498, 1560, r), gy: 1030, size: 800, pose: t < 66 ? "left" : t < 112 ? "center" : "center", rot: lerp(-5, 0, r), ...squash(-0.12 * ring((t - 48) / 30, 2.8, 8) + 0.012 * Math.sin(t * 0.16)), blink: BL(t, [74, 118]) };
};
export const SceneCoach: React.FC<{ f: number }> = ({ f }) => {
  const t = f - LEAD;
  const shove = P(t, 46, 74, Easing.out(Easing.cubic)), wall = 1 - P(t, 60, 74, (x) => x);
  const hint = sp(t, 66, 11, 130), flip = P(t, 108, 124, inOut);
  return <Cam f={f} dur={130} ox={60} oy={55}>
    <Field color={C.tangerineSoft} f={f} blob="#ffd9bd" />
    <Glow x={1560} y={640} r={640} o={0.6} />
    <div style={{ position: "absolute", left: 150, top: 70, zIndex: 20 }}>
      <Write p={P(t, 4, 18, out3)}><Display size={134} wdth={84}>Stuck? Okay.</Display></Write>
      <Write p={P(t, 14, 30, out3)} style={{ marginTop: 14 }}><Display size={54} weight={560} wdth={100} color={C.ink2}>One step at a time.</Display></Write>
    </div>
    {/* the wall of text: what a lecture looks like. He shoulders it out of the way. */}
    <div style={{ position: "absolute", left: PANEL_X - shove * 1650, top: 330 + shove * 90, zIndex: 8, opacity: wall, transform: `rotate(${-shove * 18}deg)`, transformOrigin: "30% 80%" }}>
      <div style={card(PANEL_W, { padding: "34px 40px", fontSize: 25, lineHeight: 1.38, color: C.ink2, fontWeight: 500 })}>
        <Kicker tone={C.muted} size={18}>EVAPORATION</Kicker>
        <div style={{ marginTop: 14 }}>Evaporation is the process by which molecules at the surface of a liquid gain enough kinetic energy to overcome the intermolecular forces holding them in the liquid phase and enter the gas phase. It differs from boiling in that it occurs at the surface and can happen at any temperature below the boiling point, though the rate depends on temperature, surface area, humidity, and airflow…</div>
      </div>
    </div>
    <Note x={640} y={250} p={P(t, 24, 40)} rot={-3} size={42}>nobody reads this</Note>
    <div style={{ position: "absolute", left: PANEL_X, top: 330, zIndex: 8, perspective: 1400, opacity: Math.min(1, hint * 2), transform: `translateY(${(1 - hint) * 220}px)` }}>
      <div style={{ transform: `rotateY(${flip * 88}deg)` }}>
        <div style={card(PANEL_W)}>
          <div style={{ padding: "34px 44px 40px" }}>
            <Kicker tone={C.tangerineInk}>COACH · PRACTICE</Kicker>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 50, letterSpacing: "-.025em", lineHeight: 1.1, margin: "18px 0 24px" }}>A puddle dries up on a sunny day. Where did the water go?</div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 28, background: C.tangerineSoft, color: C.tangerineInk, padding: "16px 22px", borderRadius: 16 }}>Hint: think about what heat does to a liquid.</div>
          </div>
        </div>
      </div>
    </div>
    <Note x={600} y={880} p={P(t, 86, 102)} rot={-2} size={40}>a nudge, not the whole answer</Note>
    <Studigo id="coach" track={coachTrack} f={f} z={14} />
    {t >= 47 && t < 72 && <Burst x={PANEL_X + PANEL_W + 6} y={760} f={t - 47} n={12} reach={0.9} seed="bump" />}
  </Cam>;
};

/* ───────────────────────── 17:00–21:00  Your turn. ───────────────────────── */
export const practiceTrack = (f: number): SState => {
  const t = f - LEAD;
  const tense = t >= 88 && t < 104 ? Math.sin(t * 1.9) * 1.6 : 0;
  const pose: SState["pose"] = t >= 40 && t < 52 ? "down" : t >= 78 && t < 90 ? "down" : "left";
  return { cx: 1640, gy: 1030, size: 800, pose, rot: tense + (t > 52 && t < 88 ? -1.5 : 0), ...squash(0.012 * Math.sin(t * 0.16) + (t >= 90 && t < 104 ? -0.02 : 0)), blink: pose === "left" ? BL(t, [20, 64, 108]) : 0 };
};
export const ScenePractice: React.FC<{ f: number }> = ({ f }) => {
  const t = f - LEAD;
  const c = sp(t, 0, 13, 130), pickB = t >= 44, conf = sp(t, 54, 12, 150), submit = t >= 86;
  return <Cam f={f} dur={130} ox={30} oy={60}>
    <Field color={C.dandelionSoft} f={f} blob="#ffe9a3" />
    <Glow x={1560} y={640} r={640} o={0.7} />
    <div style={{ position: "absolute", left: 150, top: 70, zIndex: 20 }}>
      <Write p={P(t, 4, 20, out3)}><Display size={138} wdth={84}>Your turn.</Display></Write>
    </div>
    <div style={{ position: "absolute", left: 150, top: 258, zIndex: 6, opacity: Math.min(1, c * 2), transform: `translateY(${(1 - c) * 100}px)` }}>
      <div style={card(920)}>
        <div style={{ padding: "30px 40px 34px", display: "grid", gap: 14 }}>
          <Kicker tone={C.dandelionInk}>QUIZ · MULTIPLE CHOICE</Kicker>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 44, letterSpacing: "-.025em", lineHeight: 1.1, marginBottom: 4 }}>A liquid changes into a gas. Which change of state is that?</div>
          <Option k="A" text="Melting" /><Option k="B" text="Evaporation" sel={pickB ? P(t, 44, 50) : 0} /><Option k="C" text="Condensation" />
          <div style={{ opacity: Math.min(1, conf * 2), transform: `translateY(${(1 - conf) * 24}px)` }}><Confidence pick={submit ? 1 : 0} pressed={submit ? 1 - P(t, 86, 94) : 0} /></div>
        </div>
      </div>
    </div>
    <Tap x={520} y={640} f={t} at={44} /><Tap x={330} y={930} f={t} at={86} />
    <Note x={1110} y={590} p={P(t, 66, 82)} rot={-4} size={38}>be honest.<br />guessing is<br />allowed.</Note>
    <Studigo id="prac" track={practiceTrack} f={f} z={14} />
  </Cam>;
};

/* ───────────────────────── 21:00–25:00  You knew that one. ───────────────────────── */
const LEAN_S = 560;
export const celebrateTrack = (f: number): SState => {
  const t = f - LEAD, hop = Math.abs(Math.sin(P(t, 0, 20, (x) => x) * Math.PI * 2)) * 70;
  const duck = P(t, 22, 30, Easing.in(Easing.cubic));
  return { cx: 1380, gy: 1030 + duck * 330, size: 1000, pose: "celebrate", lift: t < 20 ? hop : 0, ...squash(t < 20 ? 0.04 * Math.sin(t * 0.7) : 0), shadow: 0 };
};
export const SceneResult: React.FC<{ f: number }> = ({ f }) => {
  const t = f - LEAD, c = sp(t, 2, 13, 130);
  const CARD_TOP = 560;
  const pop = sp(t, 30, 9, 150, 0.7), settle = P(t, 40, 120, (x) => x);
  const bobY = Math.sin(t * 0.075) * 5, tilt = Math.sin(t * 0.05) * 1.6;
  return <Cam f={f} dur={130} ox={65} oy={55}>
    <Field color={C.tealSoft} f={f} blob="#bdeee9" />
    <Glow x={1380} y={420} r={620} o={0.75} />
    <div style={{ position: "absolute", left: 150, top: 70, zIndex: 20 }}>
      <Write p={P(t, 14, 30, out3)}><Display size={118} wdth={84}>You knew</Display></Write>
      <Write p={P(t, 22, 38, out3)}><Display size={118} wdth={84} style={{ marginTop: -2 }}>that <Mark p={P(t, 50, 68, out3)} color={C.dandelion}>one.</Mark></Display></Write>
      <Write p={P(t, 44, 62, out3)} style={{ marginTop: 22 }}><Display size={46} weight={560} wdth={100} color={C.ink2}>You just didn’t trust it yet.</Display></Write>
    </div>
    {t < 34 && <Studigo id="cel" track={celebrateTrack} f={f} z={5} castShadow={false} />}
    {t >= 2 && t < 20 && <Burst x={1380} y={420} f={t - 2} n={14} reach={1.2} seed="yay" />}
    {t >= 29 && <Img src={staticFile("sprites/lean.png")} style={{ position: "absolute", left: 1320 - LEAN_S / 2, top: CARD_TOP - (348 / 400) * LEAN_S + 8 + (1 - pop) * 330 + bobY * settle, width: LEAN_S, height: LEAN_S, zIndex: 5, transform: `rotate(${tilt * settle}deg) scale(${1 + (pop - 1) * 0.04})`, transformOrigin: "50% 90%", filter: "drop-shadow(0 20px 18px rgba(20,27,45,.2))" }} />}
    <div style={{ position: "absolute", left: 560, top: CARD_TOP, zIndex: 8, opacity: Math.min(1, c * 2), transform: `translateY(${(1 - c) * 140}px)` }}>
      <div style={card(1200)}>
        <div style={{ padding: "30px 44px 34px" }}>
          <Kicker tone={C.tealInk}>CORRECT</Kicker>
          <div style={{ marginTop: 14 }}><Option k="B" text="Evaporation" right={1} verdict="✓ Your answer" /></div>
          <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 32, color: C.ink2, margin: "18px 0 14px", lineHeight: 1.25 }}>Evaporation is liquid changing into gas.</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><Chip text="Science study guide" page="page 2" scale={0.8} />
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 28, background: C.ink, color: "#fff", padding: "14px 28px", borderRadius: 16 }}>Next question →</span></div>
        </div>
      </div>
    </div>
  </Cam>;
};

/* ───────────────────────── 25:00–28:00  Built from your class. ───────────────────────── */
export const foldTrack = (f: number): SState => {
  const t = f - LEAD, wave = t >= 34;
  return { cx: 560, gy: 1060, size: 960, pose: wave ? "wave" : "center", rot: wave ? 2.4 * Math.sin((t - 34) * 0.32) : 0, ...squash(0.012 * Math.sin(t * 0.16) + (t === 34 ? 0.05 : 0)), blink: !wave ? BL(t, [14, 28]) : 0 };
};
export const SceneFold: React.FC<{ f: number }> = ({ f }) => {
  const t = f - LEAD, fold = P(t, 6, 40, Easing.bezier(0.5, 0, 0.2, 1));
  const items: [string, string][] = [["Science study guide", C.tangerine], ["Answer + page 2", C.blueberry], ["Coach", C.tangerine], ["Quiz", C.dandelion]];
  const ph = sp(t, 14, 12, 130);
  return <Cam f={f} dur={100} ox={50} oy={55}>
    <Field color={C.ink} f={f} dark ruled={false} blob="#1d2840" />
    <Glow x={560} y={520} r={760} color="#2b3a5c" o={0.9} />
    <div style={{ position: "absolute", left: 1010, top: 66, zIndex: 20 }}>
      <Write p={P(t, 14, 28, out3)}><Display size={112} wdth={84} color="#fff">Built from</Display></Write>
      <Write p={P(t, 22, 36, out3)}><Display size={112} wdth={84} color="#fff" style={{ marginTop: -2 }}><span style={{ color: C.teal }}>your class.</span></Display></Write>
      <Underline x={1018} y={196} w={440} p={P(t, 40, 56)} seed="yc" color={C.dandelion} />
    </div>
    <div style={{ position: "absolute", left: 1320, top: 330, zIndex: 3, opacity: Math.min(1, ph * 2), transform: `translateY(${(1 - ph) * 160}px) scale(${0.9 + 0.1 * ph})` }}><Phone w={380}><RoomScreen w={380} f={f} stage={3} /></Phone></div>
    {items.map(([name, col], i) => {
      const x0 = 780 + (i % 2) * 330, y0 = 330 + Math.floor(i / 2) * 250;
      return <div key={name} style={{ position: "absolute", left: 0, top: 0, zIndex: 4, transform: `translate(${lerp(x0, 1510, fold)}px, ${lerp(y0, 640, fold)}px) scale(${1 - fold * 0.72}) rotate(${fold * (i % 2 ? 14 : -14)}deg)`, opacity: 1 - P(t, 38, 46, (x) => x) }}>
        <div style={card(300, { padding: "26px 28px", fontFamily: DISPLAY, fontWeight: 760, fontSize: 36, letterSpacing: "-.025em", lineHeight: 1.05 })}><i style={{ display: "block", width: 16, height: 16, borderRadius: 9, background: col, marginBottom: 14 }} />{name}</div></div>;
    })}
    <Studigo id="fold" track={foldTrack} f={f} z={14} />
  </Cam>;
};

/* ───────────────────────── 28:00–30:00  Learn your stuff. ───────────────────────── */
export const endTrack = (f: number): SState => {
  const t = f - LEAD, j = P(t, 4, 24, inOut), PHX = 1500 + 190, S = 350;
  const gy = lerp(1060, 140 + 876 * (380 / 417) - 36, j);
  return { cx: lerp(560, PHX, j), gy: j >= 1 ? 140 + 876 * (380 / 417) - 36 : lerp(1060, 140 + 876 * (380 / 417) - 36, j) + 0 * gy, size: lerp(960, S, j), pose: t < 22 ? "leap" : "center", lift: 4 * j * (1 - j) * 330,
    rot: t < 22 ? lerp(-6, 8, j) : 0, ...squash(t < 22 ? 0.07 * Math.sin(Math.PI * j) : -0.12 * ring((t - 24) / 30, 2.6, 7)), blink: t >= 34 ? BL(t, [40, 52]) : 0 };
};
export const SceneEnd: React.FC<{ f: number }> = ({ f }) => {
  const t = f - LEAD, logo = sp(t, 22, 12, 120), tag = P(t, 36, 50, out3);
  return <Cam f={f} dur={80} to={1.02} ox={35} oy={50}>
    <Field color={C.snow} f={f} ruled={false} clean />
    <Glow x={560} y={500} r={700} o={0.9} />
    <div style={{ position: "absolute", left: 1500, top: 140, zIndex: 2 }}>
      <Phone w={380}><div style={{ height: "100%", background: C.white, position: "relative" }}><div style={{ position: "absolute", bottom: 14, width: "100%", textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, letterSpacing: "-.04em" }}>studigo</div></div></Phone>
    </div>
    <div style={{ position: "absolute", left: 170, top: 330, zIndex: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 34, opacity: Math.min(1, logo * 2), transform: `translateY(${(1 - logo) * 110}px) scale(${0.94 + 0.06 * logo})`, transformOrigin: "left" }}>
        <i style={{ width: 56, height: 56, borderRadius: "50%", background: C.tangerine, boxShadow: `0 0 0 14px ${C.tangerineSoft}` }} />
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 250, letterSpacing: "-.045em", lineHeight: 0.9, color: C.ink }}>Studigo</div>
      </div>
      <Write p={tag} style={{ marginTop: 26, marginLeft: 90 }}><Display size={78} wdth={90} weight={700} color={C.tealInk}>Learn <Mark p={P(t, 48, 62, out3)} color={C.dandelion}>your stuff.</Mark></Display></Write>
    </div>
    <Studigo id="end" track={endTrack} f={f} z={t < 22 ? 14 : 6} />
    {t >= 24 && t < 44 && <Burst x={1690} y={640} f={t - 24} n={12} reach={0.8} seed="end" />}
  </Cam>;
};
export { lift2, lift3, snap, boing, random };
