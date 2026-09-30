"use client";

import { useEffect } from "react";

/**
 * Pins a full-screen chat to what the phone is actually showing.
 *
 * iOS Safari does not shrink the page when the keyboard opens. It scrolls the
 * page instead, which drags the header away and makes the message field jump.
 * This mirrors the visual viewport into CSS variables (--vvh height, --vvt
 * offset) so the layout is exactly the visible area, and flags an open
 * keyboard on <html data-keyboard="open"> so the tab bar can step aside.
 * Nothing here changes layout on its own; the CSS opts in on phones only.
 */
export function useFitViewport(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let tallest = viewport.height;
    let width = viewport.width;
    let frame = 0;

    const sync = () => {
      frame = 0;
      if (Math.abs(viewport.width - width) > 1) {
        // Rotation or resize: forget the old keyboard-free height.
        width = viewport.width;
        tallest = viewport.height;
      }
      tallest = Math.max(tallest, viewport.height);
      root.style.setProperty("--vvh", `${Math.round(viewport.height)}px`);
      root.style.setProperty("--vvt", `${Math.round(viewport.offsetTop)}px`);
      if (tallest - viewport.height > 120) root.dataset.keyboard = "open";
      else delete root.dataset.keyboard;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(sync);
    };

    sync();
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    return () => {
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      if (frame) window.cancelAnimationFrame(frame);
      root.style.removeProperty("--vvh");
      root.style.removeProperty("--vvt");
      delete root.dataset.keyboard;
    };
  }, [active]);
}
