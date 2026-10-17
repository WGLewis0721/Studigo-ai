"use client";

import { useEffect, type RefObject } from "react";

/**
 * A bottom tab bar that shrinks as you scroll down and grows back as you scroll
 * up, the way Safari's address bar does.
 *
 * The hook only produces a number. It writes `--tb` on the bar (0 is full size,
 * 1 is compact) and the stylesheet turns that one number into the bar's height,
 * width, padding and label. Scrolling moves it directly, a little at a time, so
 * the bar follows the finger. When scrolling stops it finishes the move in the
 * direction you were going and lets CSS ease the last part (`data-state`).
 *
 * Rules, all borrowed from how Safari behaves:
 * - Back at the top of the page the bar is always full size.
 * - Only a page that really scrolls counts. Short pages and small inner
 *   scrollers (a text box, a chip row) never move the bar.
 * - Rubber-banding past either end changes nothing, because positions are
 *   clamped to the real scroll range.
 * - The Coach chat is left alone. Its composer is docked to the bar, so a bar
 *   that changed height would shove the field around while you read.
 * - Switching pages, tapping the bar, or tabbing into it brings it back to full size.
 * - Reduced-motion users keep the full-size bar rather than tracking scroll.
 * - Keyboard-covered input fields hide the bar until the viewport clears.
 * - Dialog/sheet scrolling must not collapse the primary navigation.
 *
 * It only runs on the phone layout, where the bar is fixed to the screen. On
 * wide screens the same links live in the top bar and nothing here applies.
 */
const PHONE = "(max-width: 700px)";
/** Pixels of scrolling that take the bar from full size to compact. */
const TRAVEL = 90;
/** A page must scroll at least this far before it can collapse the bar. */
const MIN_SCROLLABLE = 120;
/** Quiet time after the last scroll event before the bar settles. */
const SETTLE_MS = 140;
/** Past this share of the way, a pause finishes the move instead of undoing it. */
const COMMIT = 0.2;

type BarState = "full" | "compact" | "moving";

export function useCollapsingTabBar(ref: RefObject<HTMLElement | null>, pageKey: string) {
  useEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    const phone = window.matchMedia(PHONE);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const viewport = window.visualViewport;

    let progress = 0;
    let direction: 1 | -1 = 1;
    let frame = 0;
    let settleTimer = 0;
    let lastTop = new WeakMap<Element, number>();
    let keyboardTimer = 0;
    let keyboardOpen = false;

    const editableFocused = () => {
      const node = document.activeElement;
      if (!(node instanceof HTMLElement)) return false;
      if (node.isContentEditable || node.matches("textarea, select")) return true;
      if (!(node instanceof HTMLInputElement)) return false;
      return !["button", "checkbox", "radio", "range", "file", "submit", "reset", "hidden"].includes(node.type);
    };

    const paint = (state: BarState) => {
      frame = 0;
      bar.style.setProperty("--tb", progress.toFixed(3));
      bar.dataset.state = state;
    };
    const queuePaint = () => {
      if (!frame) frame = window.requestAnimationFrame(() => paint("moving"));
    };
    const rest = (to: 0 | 1) => {
      window.clearTimeout(settleTimer);
      if (frame) window.cancelAnimationFrame(frame);
      progress = to;
      paint(to ? "compact" : "full");
    };
    const settle = () => {
      if (progress <= 0) return rest(0);
      if (progress >= 1) return rest(1);
      if (direction > 0) rest(progress >= COMMIT ? 1 : 0);
      else rest(progress <= 1 - COMMIT ? 0 : 1);
    };

    const onScroll = (event: Event) => {
      if (!phone.matches || reducedMotion.matches || keyboardOpen || document.querySelector('[aria-modal="true"]')) return;
      const target = event.target;
      const el =
        target === document || target === document.documentElement || target === document.body
          ? document.scrollingElement
          : target;
      if (!(el instanceof HTMLElement)) return;
      if (bar.contains(el) || el.closest('.coachChat, [role="dialog"], .roomSettings, .coachSettings, .studyGroups')) return;

      const max = el.scrollHeight - el.clientHeight;
      if (max < MIN_SCROLLABLE) return;

      const top = Math.min(Math.max(el.scrollTop, 0), max);
      const before = lastTop.get(el);
      lastTop.set(el, top);
      if (before === undefined) return;

      const delta = top - before;
      if (Math.abs(delta) < 1) return;
      direction = delta > 0 ? 1 : -1;
      progress = top <= 0 ? 0 : Math.min(1, Math.max(0, progress + delta / TRAVEL));

      queuePaint();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(settle, SETTLE_MS);
    };

    const expand = () => rest(0);
    const updateKeyboard = () => {
      // visualViewport shrinks under the iOS/Android software keyboard, but
      // can also shrink for browser zoom. A focused text field and scale ≈ 1
      // are both required before hiding a meaningful navigation affordance.
      const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
      const occlusion = viewport ? layoutHeight - viewport.height : 0;
      const covered = phone.matches && editableFocused() &&
        (viewport?.scale ?? 1) < 1.05 && occlusion > 120;
      keyboardOpen = covered;
      if (covered) {
        rest(0);
        bar.dataset.keyboard = "open";
      } else {
        delete bar.dataset.keyboard;
      }
    };
    const onFocus = () => {
      expand();
      updateKeyboard();
    };
    const onBlur = () => {
      window.clearTimeout(keyboardTimer);
      keyboardTimer = window.setTimeout(updateKeyboard, 140);
    };
    const onReducedMotionChange = () => {
      if (reducedMotion.matches) rest(0);
    };
    const onPhoneChange = () => {
      updateKeyboard();
      if (!phone.matches) {
        window.clearTimeout(settleTimer);
        if (frame) window.cancelAnimationFrame(frame);
        progress = 0;
        bar.style.removeProperty("--tb");
        delete bar.dataset.state;
      } else {
        rest(0);
      }
    };

    // A new page has its own scroll positions, so forget the old ones and start full size.
    lastTop = new WeakMap();
    if (document.scrollingElement) lastTop.set(document.scrollingElement, document.scrollingElement.scrollTop);
    if (phone.matches) rest(0);
    updateKeyboard();

    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    bar.addEventListener("click", expand);
    bar.addEventListener("focusin", expand);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    viewport?.addEventListener("resize", updateKeyboard);
    viewport?.addEventListener("scroll", updateKeyboard);
    reducedMotion.addEventListener("change", onReducedMotionChange);
    phone.addEventListener("change", onPhoneChange);
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      bar.removeEventListener("click", expand);
      bar.removeEventListener("focusin", expand);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      viewport?.removeEventListener("resize", updateKeyboard);
      viewport?.removeEventListener("scroll", updateKeyboard);
      reducedMotion.removeEventListener("change", onReducedMotionChange);
      phone.removeEventListener("change", onPhoneChange);
      window.clearTimeout(keyboardTimer);
      keyboardOpen = false;
      delete bar.dataset.keyboard;
      window.clearTimeout(settleTimer);
      if (frame) window.cancelAnimationFrame(frame);
      bar.style.removeProperty("--tb");
      delete bar.dataset.state;
    };
  }, [ref, pageKey]);
}
