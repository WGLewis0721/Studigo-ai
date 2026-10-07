import React from "react";
import { C, DISPLAY, SANS, lift2, lift3 } from "../tokens";

// UI reconstructions: copy is taken from the live landing page (studigo-ai.vercel.app) and apps/web/app/page.tsx.
// Subject = "Science study guide", change of state. See docs/CLAIM_SHEET.md for per-claim status.
export const card = (w: number, extra: React.CSSProperties = {}): React.CSSProperties => ({
  width: w, background: C.white, borderRadius: 30, boxShadow: `inset 0 0 0 1px ${C.hairline}, ${lift2}`, fontFamily: SANS, color: C.ink, overflow: "hidden", ...extra });

export const Bar: React.FC<{ label: string; tone: string; sub: string }> = ({ label, tone, sub }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 30px", borderBottom: `1px solid ${C.hairline}`, fontSize: 22, fontWeight: 700 }}>
    <span style={{ display: "flex", gap: 7 }}>{[C.berry ?? "#f0457a", C.dandelion, C.kiwi].map((c, i) => <i key={i} style={{ width: 11, height: 11, borderRadius: 9, background: c }} />)}</span>
    <span style={{ color: C.muted, fontWeight: 600 }}>{label} · {sub}</span>
    <i style={{ marginLeft: "auto", width: 16, height: 16, borderRadius: 9, background: tone }} />
  </div>
);

export const Chip: React.FC<{ n?: string; text: string; page: string; glow?: number }> = ({ n = "1", text, page, glow = 0 }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 14, padding: "14px 22px", borderRadius: 16, background: C.tealSoft, color: C.tealInk, fontWeight: 800, fontSize: 28,
    boxShadow: `0 0 0 ${glow * 10}px rgba(31,195,182,${0.35 * glow})` }}>
    <i style={{ fontStyle: "normal", width: 36, height: 36, borderRadius: 18, background: C.teal, color: C.ink, display: "grid", placeItems: "center", fontSize: 22 }}>{n}</i>{text}<b style={{ marginLeft: 8 }}>{page}</b>
  </span>
);

export const DocCard: React.FC<{ w?: number; title?: string; kind?: string; hi?: number }> = ({ w = 420, title = "Science study guide", kind = "PDF", hi = 0 }) => (
  <div style={card(w, { padding: 34, borderRadius: 26, boxShadow: `inset 0 0 0 1px ${C.hairline}, ${lift3}` })}>
    <span style={{ fontSize: 20, fontWeight: 800, color: C.tangerineInk, background: C.tangerineSoft, padding: "6px 12px", borderRadius: 9 }}>{kind}</span>
    <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 40, letterSpacing: "-.03em", margin: "20px 0 4px" }}>{title}</div>
    <div style={{ color: C.muted, fontSize: 24, fontWeight: 600, marginBottom: 22 }}>Changes of state</div>
    {[1, 0.85, 0.92, 0.6].map((x, i) => <div key={i} style={{ height: 12, width: `${x * 100}%`, background: C.snow3 ?? "#e3e7ef", borderRadius: 7, marginBottom: 13 }} />)}
    <div style={{ marginTop: 20, padding: "14px 18px", borderRadius: 14, background: C.tealSoft, color: C.tealInk, fontWeight: 800, fontSize: 24, display: "flex", justifyContent: "space-between",
      boxShadow: hi ? `0 0 0 ${hi * 9}px rgba(31,195,182,${0.4 * hi})` : undefined }}><span>Liquid</span><span>→</span><span>gas</span></div>
  </div>
);

export const Phone: React.FC<{ w: number; children?: React.ReactNode; dark?: boolean }> = ({ w, children, dark }) => {
  const h = w * (876 / 417);
  return <div style={{ width: w, height: h, borderRadius: w * 0.13, background: dark ? "#0d1016" : C.white, boxShadow: `0 0 0 ${w * 0.022}px ${C.ink}, ${lift3}`, overflow: "hidden", position: "relative", fontFamily: SANS }}>
    <div style={{ position: "absolute", top: w * 0.03, left: "50%", width: w * 0.28, height: w * 0.075, marginLeft: -w * 0.14, borderRadius: 99, background: C.ink, zIndex: 3 }} />
    {children}
  </div>;
};

export const RoomScreen: React.FC<{ w: number; guide?: string; ask?: number; stage?: "upload" | "ask" }> = ({ w, ask = 0 }) => {
  const k = w / 417, t = (n: number) => n * k;
  return <div style={{ padding: `${t(60)}px ${t(26)}px`, height: "100%", background: C.snow }}>
    <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: t(30), letterSpacing: "-.03em" }}>Study Room</div>
    <div style={{ color: C.muted, fontWeight: 700, fontSize: t(17), marginBottom: t(18) }}>Science study guide</div>
    <div style={{ display: "flex", gap: t(8), marginBottom: t(18) }}>{[["Learn", C.blueberry], ["Coach", C.tangerine], ["Quiz", C.dandelion], ["Cards", C.grape]].map(([n, c]) =>
      <span key={n} style={{ fontSize: t(15), fontWeight: 800, padding: `${t(7)}px ${t(11)}px`, borderRadius: 99, background: C.white, boxShadow: `inset 0 0 0 1px ${C.hairline}`, display: "flex", alignItems: "center", gap: t(6) }}><i style={{ width: t(9), height: t(9), borderRadius: 9, background: c }} />{n}</span>)}</div>
    <div style={{ background: C.white, borderRadius: t(18), padding: t(18), boxShadow: `inset 0 0 0 1px ${C.hairline}`, fontSize: t(17), fontWeight: 700 }}>
      <div style={{ color: C.tangerineInk, fontSize: t(13), fontWeight: 800, letterSpacing: ".08em" }}>FROM YOUR MATERIALS</div>
      <div style={{ fontFamily: DISPLAY, fontSize: t(27), fontWeight: 800, letterSpacing: "-.03em", margin: `${t(8)}px 0` }}>Liquid turns into a gas.</div>
      <span style={{ fontSize: t(14), color: C.tealInk, background: C.tealSoft, padding: `${t(5)}px ${t(9)}px`, borderRadius: t(8), fontWeight: 800 }}>Science study guide · p. 2</span>
    </div>
    <div style={{ position: "absolute", left: t(26), right: t(26), bottom: t(40), padding: t(16), borderRadius: 99, background: C.white, boxShadow: `inset 0 0 0 1px ${C.hairline}`, fontSize: t(16), color: C.muted, fontWeight: 600, opacity: 0.6 + ask * 0.4 }}>Ask about your material</div>
  </div>;
};

export const Option: React.FC<{ k: string; text: string; on?: number; right?: number }> = ({ k, text, on = 0, right = 0 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "24px 28px", borderRadius: 20, fontSize: 38, fontWeight: 700, background: right ? C.tealSoft : C.snow,
    boxShadow: right ? `inset 0 0 0 4px ${C.teal}` : on ? `inset 0 0 0 4px ${C.blueberry}` : `inset 0 0 0 1px ${C.hairline}`, transform: `scale(${1 + (on || right ? 0.015 : 0)})` }}>
    <i style={{ fontStyle: "normal", width: 48, height: 48, borderRadius: 24, display: "grid", placeItems: "center", fontSize: 24, background: right ? C.teal : C.white, color: right ? C.ink : C.muted, boxShadow: `inset 0 0 0 1px ${C.hairline}` }}>{right ? "✓" : k}</i>{text}
  </div>
);
