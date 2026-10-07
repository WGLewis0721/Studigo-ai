import React from "react";
import { AbsoluteFill, Easing, interpolate, random } from "remotion";
import { C, DISPLAY } from "../tokens";
import { Studigo, SState } from "../Studigo";
import { Burst, } from "../fx";
import { Display, Field, Glow, Mark, Underline, Write } from "../ink";
import { DocCard } from "../ui/Panels";
import { P, clampX, lerp, ring, squash, inOut, out3 } from "../motion";

/**
 * 0:00–6:00. Real intro vocabulary (apps/web/components/home/home-motion.tsx):
 *   phone wakes (introWake) → he leaps in from off-left (fly(): arc, lift, tilt) → lands, sparks, waves →
 *   BREAK: he stops mid-wave, clocks the camera, thinks about it, and bursts out through the phone boundary.
 * Then he's in a clean field: glances at the incoming study guide, catches it, reads it.
 */
const PW = 440, PH = 920, PX = 960 - PW / 2, PY = 80;
const STAND = 540, STAND_GY = PY + PH - 30;
const BIG = 960, BX = 700, BGY = 1010;

export const openingTrack = (f: number): SState => {
  // 0–24 off-screen, 24–50 leap-in
  if (f < 24) return { cx: -600, gy: 800, size: STAND * 0.75, pose: "leap", shadow: 0 };
  if (f < 50) {
    const lt = P(f, 24, 50, (t) => t), e = Easing.inOut(Easing.sin)(lt);
    const sz = lerp(STAND * 0.75, STAND, e);
    return { cx: lerp(154, 960, e), gy: lerp(800, STAND_GY, e), size: sz, pose: "leap", lift: 4 * lt * (1 - lt) * 380,
      rot: interpolate(lt, [0, 0.55, 1], [-4, 9, 2], clampX), ...squash(0.06 * Math.sin(Math.PI * lt)), shadow: f < 26 ? 0 : 1 };
  }
  // 50–66 land + wave
  if (f < 66) {
    const t = (f - 50) / 30, s = -0.17 * ring(t, 2.4, 7);
    return { cx: 960, gy: STAND_GY, size: STAND, pose: f < 52 ? "leap" : "wave", rot: f > 54 ? 2.6 * Math.sin((f - 52) * 0.32) : 0, ...squash(s) };
  }
  // 66–74 FREEZE: "wait, are you watching?" — pose snaps to camera, tiny stretch-up, then a held beat with a blink
  if (f < 74) {
    const t = (f - 66) / 30, s = 0.07 * ring(t, 3.2, 10);
    const bl = f >= 70 && f < 74 ? [0.6, 1, 1, 0.4][Math.floor(f) - 70] ?? 0 : 0;
    return { cx: 960, gy: STAND_GY, size: STAND, pose: "center", ...squash(s), blink: bl };
  }
  // 74–79 anticipation crouch
  if (f < 79) {
    const c = P(f, 74, 79, inOut);
    return { cx: 960, gy: STAND_GY, size: STAND, pose: "center", ...squash(-0.15 * c), rot: -2 * c };
  }
  // 79–100 BREAK through the boundary
  if (f < 100) {
    const bt = P(f, 79, 100, Easing.bezier(0.16, 0.9, 0.2, 1)), env = Math.sin(Math.PI * Math.min(1, bt * 1.25));
    return { cx: lerp(960, BX, bt), gy: lerp(STAND_GY, BGY, bt), size: lerp(STAND, BIG, bt), pose: f < 94 ? "leap" : "center", lift: 4 * bt * (1 - bt) * 200,
      rot: interpolate(bt, [0, 0.45, 1], [0, -6, 0], clampX), ...squash(0.11 * env) };
  }
  // 100+ land, settle, glance, catch the study guide, read
  const t = (f - 100) / 30;
  let pose: SState["pose"] = "center";
  if (f >= 117 && f < 141) pose = "right";
  if (f >= 150) pose = "read";
  const catchPop = f >= 150 ? -0.07 * ring((f - 150) / 30, 2.6, 8) : 0;
  const lookPop = f >= 141 && f < 150 ? 0.04 * Math.sin(P(f, 141, 150, (x) => x) * Math.PI) : 0;
  const bl = f >= 160 && f < 165 ? [0.5, 1, 1, 0.6, 0.2][Math.floor(f) - 160] ?? 0 : f >= 108 && f < 112 ? [0.6, 1, 1, 0.4][Math.floor(f) - 108] ?? 0 : 0;
  return { cx: BX, gy: BGY, size: BIG, pose, ...squash(-0.13 * ring(t, 2.2, 6) + 0.012 * Math.sin((f - 100) * 0.16) + catchPop + lookPop), blink: pose === "center" ? bl : 0, rot: pose === "right" ? 1.2 : 0 };
};

export const Opening: React.FC<{ f: number }> = ({ f }) => {
  // phone
  const wake = P(f, 5, 26, Easing.bezier(0.34, 1.4, 0.5, 1));
  const wakeS = interpolate(wake, [0, 0.3, 1], [0.06, 0.1, 1], clampX);
  const radius = interpolate(wake, [0, 0.3, 1], [PW / 2, PW / 2, 56], clampX);
  const pb = P(f, 79, 112, Easing.bezier(0.5, 0, 0.8, 0.4));
  const phoneOpacity = 1 - P(f, 92, 112, (t) => t);
  const rv = P(f, 82, 108, Easing.bezier(0.5, 0, 0.2, 1));
  // camera: slow dolly in on the phone, punch back out on the break, shake on impact
  const cam = 1 + 0.05 * P(f, 0, 78, (t) => t) - 0.05 * P(f, 79, 100, out3);
  const shake = f >= 99 && f < 110 ? Math.sin(f * 5.3) * 6 * (1 - (f - 99) / 11) : 0;
  const flash = f >= 79 && f < 83 ? [0.0, 0.5, 0.35, 0.12][Math.floor(f) - 79] ?? 0 : 0;
  // study-guide flight (f117→149): arcs in from the lower right to his hands, shrinks into the paper
  const dp = P(f, 117, 149, Easing.bezier(0.3, 0, 0.2, 1));
  const chest = { x: BX + 2, y: BGY - BIG * (521 / 540) + BIG * (315 / 540) };
  const dx = lerp(2150, chest.x, dp), dy = lerp(860, chest.y, dp) - 260 * Math.sin(Math.PI * dp) * (1 - dp * 0.4);
  const dScale = lerp(1, 0.2, P(f, 128, 149, (t) => t * t));
  const dOpacity = f < 117 ? 0 : 1 - P(f, 144, 151, (t) => t);
  const docRot = lerp(14, -4, dp) + (1 - dp) * 20 * Math.sin(dp * 6);
  // type
  const hf = f - 108;
  const t1 = P(hf, 0, 14, out3), t2 = P(hf, 8, 22, out3), t3 = P(hf, 30, 44, out3);
  const mk = P(f, 150, 166, out3), ul = P(f, 160, 176, out3);
  const chips = ["Study guides", "Slides", "Your notes"];
  return (
    <AbsoluteFill style={{ transform: `translate(${shake}px, ${shake * 0.6}px) scale(${cam})`, transformOrigin: "50% 55%" }}>
      <Field color={C.snow} f={f} ruled={false} clean />
      {/* cream field that the break reveals */}
      <div style={{ position: "absolute", inset: -40, clipPath: `circle(${rv * 2000}px at 900px 720px)` }}>
        <Field color={C.tangerineSoft} f={f} blob="#ffd9bd" />
        <Glow x={BX + 40} y={560} r={700} o={0.7} />
      </div>
      {/* phone */}
      <div style={{ position: "absolute", left: PX, top: PY, width: PW, height: PH, opacity: phoneOpacity, zIndex: 2,
        transform: `translate(${pb * 420}px, ${pb * 40}px) scale(${wakeS * (1 - pb * 0.38)}) rotate(${pb * 7}deg)`, filter: `blur(${pb * 7}px)` }}>
        <div style={{ width: "100%", height: "100%", borderRadius: radius, background: C.white, boxShadow: `inset 0 0 0 1px ${C.hairline}, 0 40px 80px -30px rgba(20,27,45,.32), 0 12px 16px rgba(20,27,45,.08)`, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", bottom: 22, width: "100%", textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, letterSpacing: "-.04em", fontSize: 24, color: C.ink, opacity: P(f, 22, 34, (t) => t) }}>studigo</div>
        </div>
      </div>
      {/* screen shards: the phone's glass breaking outward */}
      {f >= 80 && Array.from({ length: 16 }).map((_, i) => {
        const t = f - 80 - i * 0.2; if (t < 0 || t > 26) return null;
        const a = random(`sh${i}`) * Math.PI * 2, v = 14 + random(`sv${i}`) * 22, w = 34 + random(`sw${i}`) * 80, h = 22 + random(`sh${i}`) * 44;
        const x = 960 + Math.cos(a) * v * t * 1.2, y = 760 + Math.sin(a) * v * t * 0.9 + 0.55 * t * t;
        return <div key={i} style={{ position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: 10, background: "#fff", boxShadow: `inset 0 0 0 1px ${C.hairline}, 0 6px 14px rgba(20,27,45,.12)`,
          opacity: 1 - P(t, 14, 26, (x) => x), transform: `rotate(${(random(`sr${i}`) - 0.5) * 360 * (t / 26)}deg)`, zIndex: 15 }} />;
      })}
      {f >= 24 && <Burst x={960} y={STAND_GY - 60} f={f - 50} n={14} reach={1.1} seed="land" />}
      <Studigo id="open" track={openingTrack} f={f} z={f >= 79 ? 20 : 6} />
      {f >= 99 && <Burst x={BX} y={800} f={f - 99} n={18} reach={1.7} seed="break" />}
      {/* study guide flying to him */}
      {f >= 117 && <div style={{ position: "absolute", left: dx - 200, top: dy - 150, zIndex: f >= 140 ? 24 : 8, opacity: dOpacity, transform: `rotate(${docRot}deg) scale(${dScale})` }}><DocCard w={400} /></div>}

      {/* type: plain sentence, written on; the key phrase gets highlighted like a student would */}
      {f >= 108 && <div style={{ position: "absolute", left: 1090, top: 96, zIndex: 30, width: 760 }}>
        <Write p={t1}><Display size={124} wdth={86}>Got a test</Display></Write>
        <Write p={t2}><Display size={124} wdth={86} style={{ marginTop: -4 }}>coming up?</Display></Write>
        <Write p={t3} style={{ marginTop: 26 }}><Display size={58} weight={560} wdth={100} color={C.ink2}>Bring the <Mark p={mk}>study guide.</Mark></Display></Write>
      </div>}
      {f >= 160 && <Underline x={1226} y={440} w={330} p={ul} seed="sg" color={C.tangerineInk} />}
      {f >= 132 && <div style={{ position: "absolute", left: 1090, top: 580, display: "flex", gap: 14, zIndex: 9 }}>
        {chips.map((c, i) => { const p = P(f, 132 + i * 4, 144 + i * 4, out3);
          return <span key={c} style={{ fontFamily: DISPLAY, fontWeight: 650, fontSize: 30, padding: "10px 24px", borderRadius: 99, background: C.white, color: C.ink2, boxShadow: `inset 0 0 0 1px ${C.hairline}`, opacity: p, transform: `translateY(${(1 - p) * 20}px) rotate(${(i - 1) * 1.5}deg)` }}>{c}</span>; })}
      </div>}
      <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash, zIndex: 60 }} />
    </AbsoluteFill>
  );
};
