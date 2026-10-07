import React from "react";
import { AbsoluteFill, interpolate, Easing } from "remotion";
import { C, DISPLAY } from "../tokens";
import { Studigo, Pose } from "../Studigo";
import { Burst, Headline, ease, prog, clamp } from "../fx";
import { DocCard } from "../ui/Panels";

/**
 * 0:00–6:00. Real intro vocabulary from apps/web/components/home/home-motion.tsx:
 *  device wakes (introWake, spring scale .06→1, round→56px) → he leaps in from off-left (fly(): 880ms arc, lift, rotate)
 *  → lands, spark burst, wave → [BREAK: notices camera, doesn't finish the routine] → bursts through the phone boundary.
 * Compressed from the app's ~4s to ~2.6s so the break lands at ~0:03.
 */
const PW = 440, PH = 920, PX = 960 - PW / 2, PY = 80;

export const Opening: React.FC<{ f: number }> = ({ f }) => {
  // ---- phone wake
  const wake = prog(f, 5, 26, Easing.bezier(0.34, 1.4, 0.5, 1));
  const wakeS = interpolate(wake, [0, 0.3, 1], [0.06, 0.1, 1], clamp);
  const radius = interpolate(wake, [0, 0.3, 1], [PW / 2, PW / 2, 56], clamp);
  // ---- leap-in (f24→50)
  const lt = prog(f, 24, 50, Easing.linear);
  const standSize = PW * 1.18, standX = 960, standGround = PY + PH - 30;
  const startSize = standSize * 0.75, startX = 960 - 1920 * 0.42, startGround = 1080 * 0.74;
  const e = Easing.inOut(Easing.quad)(lt);
  let size = startSize + (standSize - startSize) * e, cx = startX + (standX - startX) * e;
  let ground = startGround + (standGround - startGround) * e;
  let lift = 4 * lt * (1 - lt) * 380, rot = f < 50 ? interpolate(lt, [0, 0.55, 1], [-4, 9, 2], clamp) : 0;
  let pose: Pose = "leap", poseB: Pose | undefined, mix = 0, sx = 1, sy = 1;
  if (f < 24) { cx = startX; size = startSize; ground = startGround; lift = 0; sy = 0.001; }
  // land squash + wave
  if (f >= 50 && f < 76) {
    const s = Math.max(0, 1 - (f - 50) / 6); sy = 1 - 0.13 * s; sx = 1 + 0.09 * s;
    pose = "leap"; poseB = "wave"; mix = prog(f, 50, 54, Easing.linear); rot = Math.sin((f - 52) * 0.45) * 2.6 * (f > 54 ? 1 : 0);
    if (f >= 54) { pose = "wave"; poseB = undefined; }
  }
  // notice camera (f66→76): wave → center, small double-take hop
  if (f >= 66 && f < 76) {
    pose = "wave"; poseB = "center"; mix = prog(f, 66, 70, Easing.linear);
    rot = 0; sy = 1 + 0.035 * Math.sin(prog(f, 66, 76, Easing.linear) * Math.PI); lift = 12 * Math.sin(prog(f, 66, 74, Easing.linear) * Math.PI);
  }
  // anticipation crouch f74→79
  if (f >= 74 && f < 79) { pose = "center"; poseB = undefined; sy = 1 - 0.14 * prog(f, 74, 79); sx = 1 + 0.08 * prog(f, 74, 79); }
  // ---- BREAK f79→100: burst toward camera, past the phone edge
  const bt = prog(f, 79, 100, Easing.bezier(0.16, 0.9, 0.2, 1));
  const BIG = 980, bx = 700, bground = 1010;
  if (f >= 79) {
    pose = f < 94 ? "leap" : "center"; poseB = undefined; mix = 0;
    size = standSize + (BIG - standSize) * bt; cx = 960 + (bx - 960) * bt; ground = standGround + (bground - standGround) * bt;
    lift = 4 * bt * (1 - bt) * 160; rot = interpolate(bt, [0, 0.5, 1], [0, -5, 0], clamp);
    sy = f >= 98 ? 1 - 0.1 * Math.max(0, 1 - (f - 98) / 6) : 1; sx = f >= 98 ? 1 + 0.07 * Math.max(0, 1 - (f - 98) / 6) : 1;
  }
  // settle: breathing + gaze
  let shadowOn = f < 24 ? 0 : 1;
  if (f >= 100) {
    pose = "center"; poseB = undefined; mix = 0;
    const g = f >= 118 && f < 142 ? "right" : null;
    if (g) { pose = "center"; poseB = "right"; mix = Math.min(prog(f, 118, 120, Easing.linear), 1 - prog(f, 140, 142, Easing.linear)); }
    sy = 1 + 0.012 * Math.sin((f - 100) * 0.16); sx = 1 + 0.006 * Math.sin((f - 100) * 0.16);
    // little "okay, look at THAT" pop when the doc lands
    const pop = Math.sin(prog(f, 138, 152, Easing.linear) * Math.PI); sy += pop * 0.035; sx -= pop * 0.012;
  }
  const shake = f >= 99 && f < 108 ? Math.sin(f * 5) * 5 * (1 - (f - 99) / 9) : 0;

  // ---- phone recedes on the break
  const pb = prog(f, 79, 112, Easing.bezier(0.5, 0, 0.8, 0.4));
  const phoneOpacity = 1 - prog(f, 92, 112, Easing.linear);
  // ---- cream field reveal (circle expanding from his chest)
  const rv = prog(f, 82, 108, Easing.bezier(0.5, 0, 0.2, 1));
  const R = rv * 1900;

  // ---- scene 2 content
  const hf = f - 108;
  const docIn = prog(f, 112, 134, Easing.bezier(0.34, 1.35, 0.5, 1));
  const docGrow = prog(f, 154, 176, Easing.bezier(0.5, 0, 0.2, 1));
  const chips = ["Study guides", "Slides", "Your notes"];

  return (
    <AbsoluteFill style={{ background: C.snow, overflow: "hidden", transform: `translate(${shake}px, ${shake * 0.6}px)` }}>
      {/* ring flash on break */}
      <div style={{ position: "absolute", inset: 0, background: C.tangerineSoft, clipPath: `circle(${R}px at ${960 + (bx - 960) * 0.3}px 720px)` }} />
      {/* phone */}
      <div style={{ position: "absolute", left: PX, top: PY, width: PW, height: PH, opacity: phoneOpacity, zIndex: 2,
        transform: `translate(${pb * 420}px, ${pb * 40}px) scale(${wakeS * (1 - pb * 0.38)}) rotate(${pb * 7}deg)`, filter: `blur(${pb * 7}px)` }}>
        <div style={{ width: "100%", height: "100%", borderRadius: radius, background: C.white, boxShadow: `inset 0 0 0 1px ${C.hairline}, 0 40px 80px -30px rgba(20,27,45,.32), 0 12px 16px rgba(20,27,45,.08)`, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", bottom: 20, width: "100%", textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, letterSpacing: "-.04em", fontSize: 22, color: C.ink, opacity: prog(f, 22, 34, Easing.linear) }}>studigo</div>
        </div>
      </div>
      {f >= 24 && <Burst x={960} y={standGround - 60} f={f - 50} n={14} reach={1.1} seed="land" />}
      <Studigo cx={cx} groundY={ground} size={size} pose={pose} poseB={poseB} mix={mix} rotate={rot} sx={sx} sy={sy} lift={lift} shadow={shadowOn} z={f >= 79 ? 20 : 6} />
      {f >= 99 && <Burst x={bx} y={780} f={f - 99} n={18} reach={1.7} seed="break" />}

      {/* scene 2 — YOUR MATERIAL. */}
      {f >= 106 && <div style={{ position: "absolute", left: 1090, top: 90, zIndex: 30 }}>
        <Headline words={["YOUR", "MATERIAL."]} f={hf} size={150} color={C.ink} accent={C.tangerineInk} accentFrom={1} lineBreakAfter={[0]} />
      </div>}
      {f >= 112 && <div style={{ position: "absolute", left: 1210, top: 420, zIndex: 8,
        transform: `translate(${(1 - docIn) * 520}px, ${(1 - docIn) * 60}px) rotate(${(1 - docIn) * 10 - 3}deg) scale(${1 + docGrow * 0.12})`, opacity: Math.min(1, docIn * 2) }}>
        <DocCard w={440} hi={prog(f, 140, 150, Easing.linear)} />
      </div>}
      {f >= 134 && <div style={{ position: "absolute", left: 1090, top: 960, display: "flex", gap: 14, zIndex: 9 }}>
        {chips.map((c, i) => <span key={c} style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 28, padding: "10px 22px", borderRadius: 99, background: C.white, color: C.ink2,
          boxShadow: `inset 0 0 0 1px ${C.hairline}`, opacity: prog(f, 134 + i * 4, 144 + i * 4), transform: `translateY(${(1 - prog(f, 134 + i * 4, 144 + i * 4)) * 20}px)` }}>{c}</span>)}
      </div>}
    </AbsoluteFill>
  );
};
