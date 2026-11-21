import { EMPTY_GROWTH } from "@/lib/companion-growth";
import { writeGrowth } from "@/lib/companion-growth-store";
import type { CompanionHandle } from "./engine";

/* A tap-only panel for trying Studigo on a phone, where there is no console.
   It exists only in development and on Vercel branch previews, and only with ?lctest=1 in the URL.
   It fires the same events the room sends; nothing here is saved anywhere but this browser. */

export function testPanelAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (!new URLSearchParams(window.location.search).has("lctest")) return false;
  const host = window.location.hostname;
  return process.env.NODE_ENV === "development" || (host.endsWith(".vercel.app") && host.includes("-git-"));
}

const BUTTONS: [label: string, run: (c: CompanionHandle) => void][] = [
  ["Correct", (c) => c.event("correct")],
  ["Wrong", (c) => c.event("wrong")],
  ["Card good", (c) => c.event("cardGood")],
  ["Set done", (c) => c.event("setDone")],
  ["Mission done", (c) => c.event("missionComplete")],
  ["Hint", (c) => c.event("hintOpened")],
  ["Stall 1", (c) => c.event("stall", { level: 1 })],
  ["Stall 2", (c) => c.event("stall", { level: 2 })],
  ["Welcome back", (c) => c.event("sessionReturn")],
  ["Thinking", (c) => { c.thinking(true); window.setTimeout(() => c.thinking(false), 2500); }],
  ["Grow +50", (c) => c.grow(50)],
  ["Grow +500", (c) => c.grow(500)]
];

export function mountTestPanel(companion: CompanionHandle): () => void {
  const panel = document.createElement("div");
  panel.setAttribute("role", "toolbar");
  panel.setAttribute("aria-label", "Studigo test panel");
  panel.style.cssText = "position:fixed;left:8px;bottom:96px;z-index:2147483000;display:flex;flex-wrap:wrap;gap:6px;max-width:min(360px,calc(100vw - 16px));padding:8px;border-radius:12px;background:rgba(20,27,45,.88);font:600 12px/1 system-ui,sans-serif";
  const add = (label: string, run: () => void) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText = "min-height:36px;padding:0 10px;border:0;border-radius:8px;background:#ffd23f;color:#141b2d;font:inherit";
    button.addEventListener("click", run);
    panel.appendChild(button);
  };
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.textContent = "Test";
  toggle.setAttribute("aria-expanded", "false");
  toggle.style.cssText = "min-height:36px;padding:0 12px;border:0;border-radius:8px;background:#fff;color:#141b2d;font:inherit";
  panel.appendChild(toggle);
  const buttons: HTMLElement[] = [];
  const collect = (label: string, run: () => void) => { add(label, run); buttons.push(panel.lastElementChild as HTMLElement); };
  for (const [label, run] of BUTTONS) collect(label, () => run(companion));
  collect("Reset growth", () => writeGrowth(EMPTY_GROWTH));
  collect("Forget me", () => {
    try { ["studigo.companion.met", "studigo.companion.lastSeen"].forEach((key) => window.localStorage.removeItem(key)); } catch { /* storage is optional */ }
  });
  const show = (open: boolean) => {
    buttons.forEach((button) => { button.hidden = !open; });
    toggle.textContent = open ? "Close" : "Test";
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => show(toggle.getAttribute("aria-expanded") !== "true"));
  show(false);
  document.body.appendChild(panel);
  return () => panel.remove();
}
