"use client";

import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * Visual-only progress glow. Follows the saved lesson phase's animated bar tip
 * without being clipped by the room shell. It never changes learner progress.
 */
export function LearnProgressGlow({ targetRef }: { targetRef: RefObject<HTMLDivElement | null> }) {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    const glow = glowRef.current;
    if (!target || !glow) return;

    // The bar's current heat is the exact source for the burst color.
    // The overlay is portaled to body, so it cannot inherit this CSS variable.
    const color = getComputedStyle(target).getPropertyValue("--progress-heat").trim();
    glow.style.setProperty("--learn-glow-color", color || "var(--tangerine)");

    let frame = 0;
    const started = performance.now();
    const follow = (now: number) => {
      const rect = target.getBoundingClientRect();
      const inset = glow.offsetWidth / 2 + 4;
      const x = Math.min(Math.max(rect.right, inset), window.innerWidth - inset);
      glow.style.left = `${x}px`;
      // Center the glow directly on the progress bar's advancing edge.
      glow.style.top = `${rect.top + rect.height / 2}px`;
      if (now - started < 1250) frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [targetRef]);

  return createPortal(
    <span className="learnProgressGlowOverlay" ref={glowRef} aria-hidden="true">
      <span className="learnProgressGlowBurst" />
    </span>,
    document.body
  );
}
