import React from "react";
import { C, DISPLAY, SANS, lift2, lift3 } from "../tokens";
import { P, out3, boing } from "../motion";

// UI reconstructions. Strings are lifted from the app code (materials-panel, quiz-panel, coach-panel, studigo-composer)
// and the landing page; see docs/CLAIM_SHEET.md. The science-guide question/answer is illustrative demo content.

export const card = (w: number, extra: React.CSSProperties = {}): React.CSSProperties => ({
  width: w, background: C.white, borderRadius: 30, boxShadow: `inset 0 0 0 1px ${C.hairline}, ${lift2}`, fontFamily: SANS, color: C.ink, overflow: "hidden", ...extra });

export const Kicker: React.FC<{ tone: string; children: React.ReactNode; size?: number }> = ({ tone, children, size = 22 }) => (
  <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: size, letterSpacing: ".09em", color: tone }}>{children}</div>
);

export const Spinner: React.FC<{ f: number; size?: number; color?: string }> = ({ f, size = 30, color = C.tealInk }) => (
  <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", border: `${size / 7}px solid rgba(9,117,109,.2)`, borderTopColor: color, transform: `rotate(${f * 14}deg)` }} />
);

export const Chip: React.FC<{ n?: string; text: string; page: string; scale?: number }> = ({ n = "1", text, page, scale = 1 }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 14 * scale, padding: `${13 * scale}px ${22 * scale}px`, borderRadius: 16 * scale, background: C.tealSoft, color: C.tealInk, fontWeight: 800, fontSize: 28 * scale, fontFamily: SANS }}>
    <i style={{ fontStyle: "normal", width: 36 * scale, height: 36 * scale, borderRadius: 99, background: C.teal, color: C.ink, display: "grid", placeItems: "center", fontSize: 21 * scale }}>{n}</i>{text}<b style={{ marginLeft: 6 }}>{page}</b>
  </span>
);

/** The study guide as it arrives on the table. */
export const DocCard: React.FC<{ w?: number; glow?: number }> = ({ w = 400, glow = 0 }) => (
  <div style={card(w, { padding: 32, borderRadius: 24, boxShadow: `inset 0 0 0 1px ${C.hairline}, ${lift3}${glow ? `, 0 0 0 ${glow * 10}px rgba(31,195,182,${0.35 * glow})` : ""}` })}>
    <span style={{ fontSize: 19, fontWeight: 800, color: C.tangerineInk, background: C.tangerineSoft, padding: "5px 11px", borderRadius: 8 }}>PDF</span>
    <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 38, letterSpacing: "-.03em", margin: "18px 0 4px", lineHeight: 1.05 }}>Science study guide</div>
    <div style={{ color: C.muted, fontSize: 22, fontWeight: 600, marginBottom: 20 }}>Changes of state</div>
    {[1, 0.86, 0.93, 0.58].map((x, i) => <div key={i} style={{ height: 11, width: `${x * 100}%`, background: C.snow3, borderRadius: 6, marginBottom: 12 }} />)}
  </div>
);

export const Phone: React.FC<{ w: number; children?: React.ReactNode; dark?: boolean }> = ({ w, children, dark }) => {
  const h = w * (876 / 417);
  return <div style={{ width: w, height: h, borderRadius: w * 0.13, background: dark ? "#0d1016" : C.snow, boxShadow: `0 0 0 ${w * 0.024}px ${C.ink}, ${lift3}`, overflow: "hidden", position: "relative", fontFamily: SANS }}>
    <div style={{ position: "absolute", top: w * 0.03, left: "50%", width: w * 0.28, height: w * 0.075, marginLeft: -w * 0.14, borderRadius: 99, background: C.ink, zIndex: 3 }} />
    {children}
  </div>;
};

/** Study Room on the phone: the upload goes Uploading → Reading → Ready, then the five pages light up. */
export const RoomScreen: React.FC<{ w: number; f: number; stage: number; typed?: string; focus?: number }> = ({ w, f, stage, typed = "", focus = 0 }) => {
  const k = w / 417, t = (n: number) => n * k;
  const label = stage < 1 ? "Uploading…" : stage < 2 ? "Reading, OCR'ing, and indexing…" : "Ready to study";
  return <div style={{ padding: `${t(64)}px ${t(24)}px`, height: "100%", boxSizing: "border-box", position: "relative" }}>
    <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: t(30), letterSpacing: "-.03em" }}>Science</div>
    <div style={{ color: C.muted, fontWeight: 700, fontSize: t(15), marginBottom: t(20) }}>Study Room</div>
    <div style={{ background: C.white, borderRadius: t(18), padding: t(16), boxShadow: `inset 0 0 0 1px ${C.hairline}`, display: "flex", alignItems: "center", gap: t(14) }}>
      <span style={{ width: t(40), height: t(40), borderRadius: t(10), background: C.tangerineSoft, color: C.tangerineInk, fontWeight: 800, fontSize: t(13), display: "grid", placeItems: "center" }}>PDF</span>
      <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: t(17) }}>Science study guide</div><div style={{ fontSize: t(14), fontWeight: 700, color: stage >= 2 ? C.tealInk : C.muted }}>{label}</div></div>
      {stage < 2 ? <Spinner f={f} size={t(24)} /> : <span style={{ width: t(26), height: t(26), borderRadius: 99, background: C.teal, color: C.ink, display: "grid", placeItems: "center", fontSize: t(16), fontWeight: 800 }}>✓</span>}
    </div>
    <div style={{ position: "absolute", left: t(24), right: t(24), bottom: t(96), opacity: P(stage, 2, 2.6) }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: t(8) }}>{["Coach", "Practice", "Progress", "Plan", "Materials"].map((n, i) =>
        <span key={n} style={{ fontSize: t(15), fontWeight: 800, padding: `${t(8)}px ${t(13)}px`, borderRadius: 99, background: i === 0 ? C.ink : C.white, color: i === 0 ? "#fff" : C.ink2, boxShadow: `inset 0 0 0 1px ${C.hairline}` }}>{n}</span>)}</div>
    </div>
    <div style={{ position: "absolute", left: t(24), right: t(24), bottom: t(32), height: t(52), borderRadius: 99, background: C.white, boxShadow: `inset 0 0 0 ${focus ? 2 : 1}px ${focus ? C.tangerine : C.hairline}`, display: "flex", alignItems: "center", padding: `0 ${t(20)}px`, fontSize: t(17), fontWeight: 600, color: typed ? C.ink : C.muted }}>
      {typed || "Ask Studigo"}{focus > 0 && <i style={{ width: 2, height: t(24), background: C.ink, marginLeft: 2, opacity: Math.floor(f / 8) % 2 }} />}
    </div>
  </div>;
};

export const Option: React.FC<{ k: string; text: string; sel?: number; verdict?: string; right?: number }> = ({ k, text, sel = 0, verdict, right = 0 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "22px 28px", borderRadius: 20, fontSize: 38, fontWeight: 700, fontFamily: SANS, background: right ? C.tealSoft : sel ? C.blueberrySoft : C.snow,
    boxShadow: right ? `inset 0 0 0 4px ${C.teal}` : sel ? `inset 0 0 0 4px ${C.blueberry}` : `inset 0 0 0 1px ${C.hairline}` }}>
    <i style={{ fontStyle: "normal", width: 48, height: 48, borderRadius: 24, display: "grid", placeItems: "center", fontSize: 24, background: C.white, color: C.muted, boxShadow: `inset 0 0 0 1px ${C.hairline}` }}>{k}</i>
    <span style={{ flex: 1 }}>{text}</span>
    {verdict && <b style={{ fontSize: 24, color: C.tealInk }}>{verdict}</b>}
  </div>
);

export const Confidence: React.FC<{ pick?: number; pressed?: number }> = ({ pick = 0, pressed = 0 }) => {
  const L = [["Guessing", "No real idea"], ["Fairly sure", "Think so"], ["Confident", "I know this"]];
  return <div style={{ display: "flex", gap: 14 }}>{L.map(([a, b], i) => (
    <div key={a} style={{ flex: 1, padding: "16px 18px", borderRadius: 18, background: pick === i + 1 ? C.ink : C.white, color: pick === i + 1 ? "#fff" : C.ink, boxShadow: `inset 0 0 0 1px ${C.hairline}`, transform: `scale(${pick === i + 1 ? 1 - pressed * 0.04 : 1})` }}>
      <div style={{ fontWeight: 800, fontSize: 28 }}>{a}</div><div style={{ fontWeight: 600, fontSize: 20, opacity: 0.7 }}>{b}</div></div>))}</div>;
};

/** Touch ripple where a learner taps. */
export const Tap: React.FC<{ x: number; y: number; f: number; at: number }> = ({ x, y, f, at }) => {
  const t = f - at; if (t < 0 || t > 16) return null;
  const p = t / 16;
  return <>
    <div style={{ position: "absolute", left: x - 34, top: y - 34, width: 68, height: 68, borderRadius: "50%", border: `5px solid ${C.ink}`, opacity: (1 - p) * 0.55, transform: `scale(${0.4 + p * 1.4})`, zIndex: 50 }} />
    <div style={{ position: "absolute", left: x - 14, top: y - 14, width: 28, height: 28, borderRadius: "50%", background: C.ink, opacity: Math.max(0, 0.5 - p), zIndex: 50 }} />
  </>;
};
export { P, out3, boing };
