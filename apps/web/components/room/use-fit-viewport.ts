"use client";

import { useEffect } from "react";

/**
 * Keeps a full-screen chat above the phone keyboard, and nothing else.
 *
 * iOS Safari does not shrink the page when the keyboard opens. It scrolls the
 * page instead, which drags the header away and makes the message field jump.
 * While a field is focused and the keyboard is up, this mirrors the visual
 * viewport into CSS variables (--vvh height, --vvt offset) and flags
 * <html data-keyboard="open"> so the layout is exactly the visible area.
 *
 * The rest of the time it writes nothing. The chat is anchored to the screen
 * with plain CSS (top and bottom 0), the same box the tab bar uses, so a
 * stale measurement can never leave it short of the screen.
 */
const KEYBOARD_MIN = 120;

function fieldHasFocus() {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  return el.matches("input, textarea, select") || el.isContentEditable;
}

export function useFitViewport(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let frame = 0;
    let settle = 0;

    const clear = () => {
      root.style.removeProperty("--vvh");
      root.style.removeProperty("--vvt");
      delete root.dataset.keyboard;
    };

    const sync = () => {
      frame = 0;
      const layout = Math.max(window.innerHeight, root.clientHeight);
      const covered = layout - viewport.height;
      if (fieldHasFocus() && covered > KEYBOARD_MIN) {
        root.style.setProperty("--vvh", `${Math.round(viewport.height)}px`);
        root.style.setProperty("--vvt", `${Math.round(viewport.offsetTop)}px`);
        root.dataset.keyboard = "open";
      } else {
        clear();
      }
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(sync);
    };
    // iOS can skip the final resize when the keyboard closes, so re-check once
    // the dust settles after focus leaves, and whenever the page comes back.
    const onFocusOut = () => {
      window.clearTimeout(settle);
      settle = window.setTimeout(schedule, 120);
    };
    const onPageShow = () => schedule();

    clear();
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("orientationchange", onPageShow);
    document.addEventListener("visibilitychange", onPageShow);
    return () => {
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("orientationchange", onPageShow);
      document.removeEventListener("visibilitychange", onPageShow);
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      clear();
    };
  }, [active]);
}
