"use client";

import { useEffect } from "react";

/**
 * The marketing hero borrows the SAME live companion visible in the synthetic
 * Study Room. Keep the established intro, page-scroll leap and shell picker
 * protocol when using RoomWorkspace instead of the old scripted phone.
 */
export function PublicDemoBridge() {
  useEffect(() => {
    if (window.parent === window) return;
    const allowed = new Set(["teal", "blueberry", "grape", "kiwi", "berry"]);
    const handle = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== window.location.origin) return;
      const message = event.data as { type?: string; id?: number; tone?: string } | null;
      if (!message || typeof message.type !== "string") return;
      const companion = document.querySelector<HTMLElement>(".roomWorkspace .cmp");
      if (message.type === "studigo:leave") {
        const area = companion?.getBoundingClientRect();
        const rect = area
          ? { x: area.left, y: area.top, w: area.width, h: area.height }
          : { x: window.innerWidth * 0.66, y: window.innerHeight * 0.72, w: 78, h: 90 };
        document.body.setAttribute("data-home-borrowed", "");
        window.parent.postMessage({ type: "studigo:left", id: message.id, rect }, event.origin);
      }
      if (message.type === "studigo:return") document.body.removeAttribute("data-home-borrowed");
      if (message.type === "studigo:tone" && message.tone && allowed.has(message.tone)) {
        document.querySelector(".roomDevice")?.setAttribute("data-shell", message.tone);
      }
    };
    window.addEventListener("message", handle);
    window.parent.postMessage({ type: "studigo:ready" }, window.location.origin);
    return () => window.removeEventListener("message", handle);
  }, []);
  return <style>{`body[data-home-borrowed] .roomWorkspace .cmp,
    body[data-home-borrowed] .roomWorkspace .cmpTab { visibility: hidden !important; }`}</style>;
}
