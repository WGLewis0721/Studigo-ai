"use client";

import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * Visual-only effect. The flame lives in document.body instead of inside the
 * clipped mission shell, and follows the advancing tip while the bar eases.
 * This component does not own progress, rewards or learning state.
 */
export function LearnFlamePlume({ targetRef }: { targetRef: RefObject<HTMLDivElement | null> }) {
  const plumeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    const plume = plumeRef.current;
    if (!target || !plume) return;

    let frame = 0;
    const started = performance.now();
    const follow = (now: number) => {
      const rect = target.getBoundingClientRect();
      // Keep the plume over the progress tip even while the 820ms bar
      // transition is travelling, without rerendering the lesson 60fps.
      const x = Math.min(Math.max(rect.right, 49), window.innerWidth - 49);
      plume.style.left = `${x}px`;
      plume.style.top = `${rect.top + rect.height / 2 - 70}px`;
      if (now - started < 1900) frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [targetRef]);

  return createPortal(
    <div className="learnProgressPlume" ref={plumeRef} aria-hidden="true">
      <svg className="learnProgressFlameArtwork" viewBox="0 0 104 124" width="104" height="124"
        focusable="false" aria-hidden="true">
        <defs>
          <linearGradient id="learnFlameOuter" x1="0" y1="1" x2=".75" y2="0">
            <stop offset="0%" stopColor="#E34A10" />
            <stop offset="48%" stopColor="#FF8A3D" />
            <stop offset="100%" stopColor="#FFD23F" />
          </linearGradient>
          <linearGradient id="learnFlameCore" x1="0" y1="1" x2=".65" y2="0">
            <stop offset="0%" stopColor="#FFB22F" />
            <stop offset="72%" stopColor="#FFE273" />
            <stop offset="100%" stopColor="#FFF7CC" />
          </linearGradient>
        </defs>
        <path className="learnFlameSpark learnFlameSparkA" d="M19 29l-3-7M77 22l5-9" stroke="#FF8A3D" strokeWidth="5" strokeLinecap="round" />
        <path className="learnFlameSpark learnFlameSparkB" d="M88 58l7-4M12 61l-6-2" stroke="#FFD23F" strokeWidth="4" strokeLinecap="round" />
        <path className="learnFlameOuter" fill="url(#learnFlameOuter)" stroke="#DE5A19" strokeWidth="2.5" strokeLinejoin="round"
          d="M48 9 C58 28 74 30 71 58 C81 47 82 35 80 27 C101 49 91 78 75 96 C62 112 37 115 21 102 C4 88 4 67 18 47 C22 40 24 30 24 22 C36 30 36 43 39 52 C43 38 42 26 48 9 Z" />
        <path className="learnFlameMiddle" fill="url(#learnFlameCore)"
          d="M50 45 C56 61 67 65 64 82 C74 76 74 66 72 60 C84 78 71 96 58 102 C39 111 21 96 25 80 C27 69 34 62 36 53 C44 60 42 72 45 75 C48 64 46 54 50 45 Z" />
        <path className="learnFlameInner" fill="#FFF9DB"
          d="M49 73 C52 81 60 86 56 94 C51 105 38 102 36 93 C34 86 42 78 43 76 C46 80 44 86 47 89 C50 84 47 79 49 73 Z" />
      </svg>
    </div>,
    document.body
  );
}
