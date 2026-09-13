"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type PoseName =
  | "center"
  | "up"
  | "up-left"
  | "up-right"
  | "left-near"
  | "left-far"
  | "right-near"
  | "right-far"
  | "down"
  | "down-left"
  | "down-right-near";

// Gaze-direction anchor for each pose, in the same normalized [-1, 1] space
// the pointer is mapped into by setTargetFromClient. down-right-far was
// dropped from the source set (mismatched export, see
// apps/web/scripts/normalize-mascot-frames.mjs), so that corner is
// synthesized at runtime by blending right-far, down-right-near and down.
const POSE_ANCHORS: Record<PoseName, { x: number; y: number }> = {
  center: { x: 0, y: 0 },
  up: { x: 0, y: -1 },
  "up-left": { x: -0.62, y: -0.78 },
  "up-right": { x: 0.62, y: -0.78 },
  "left-near": { x: -0.48, y: 0 },
  "left-far": { x: -1, y: 0 },
  "right-near": { x: 0.48, y: 0 },
  "right-far": { x: 1, y: 0 },
  down: { x: 0, y: 0.9 },
  "down-left": { x: -0.6, y: 0.82 },
  "down-right-near": { x: 0.55, y: 0.62 }
};

const POSE_NAMES = Object.keys(POSE_ANCHORS) as PoseName[];

// Pose weights come from a Gaussian falloff around the smoothed pointer,
// normalized to sum to 1, rather than a discrete pose switch. Neighboring
// poses fade continuously as the pointer moves between anchors, which gives
// the crossfade for free and avoids flicker without a hysteresis state
// machine. Sigma is deliberately tight: wider values blend so many poses at
// once that the character reads as a ghosted double-exposure.
const FALLOFF_SIGMA = 0.18;
const MIN_VISIBLE_WEIGHT = 0.02;
const MAX_BLENDED_POSES = 3;
const DEAD_ZONE_RADIUS = 0.06;
const SMOOTHING_TAU_MS = 150;
const ASSET_READY_TIMEOUT_MS = 2500;

// The badge is only ~150px, so pointer position is measured against a much
// larger reference radius than the element itself - otherwise the mascot
// slams to full deflection the moment the cursor leaves the badge. Scaling
// off viewport width puts full deflection roughly at the opposite edge of the
// screen, which keeps nuance across the whole hero instead of saturating.
// Matches the badge's rendered size so next/image serves a DPR-appropriate
// frame instead of the full 560px source (11 frames adds up fast).
const MASCOT_SIZES = "(max-width: 480px) 110px, 150px";

const TRACKING_RADIUS_MIN = 400;
const TRACKING_RADIUS_MAX = 900;
const TRACKING_RADIUS_RATIO = 0.5;

export function MascotCursorTracker({ size = 150, priority = false }: { size?: number; priority?: boolean }) {
  const stageRef = useRef<HTMLSpanElement>(null);
  const imgRefs = useRef<Partial<Record<PoseName, HTMLImageElement>>>({});
  const originRef = useRef({ x: 0, y: 0, radius: TRACKING_RADIUS_MIN });
  const targetRef = useRef({ x: 0, y: 0 });
  const smoothedRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const loadedCountRef = useRef(0);

  const [assetsReady, setAssetsReady] = useState(false);
  // Starts false on both server and first client render (no window during
  // SSR) so hydration always matches, then flips once we know a real mouse is
  // present. Until then only the "center" frame is mounted, so touch and
  // reduced-motion visitors never fetch the other 10 pose PNGs at all.
  const [trackingCapable, setTrackingCapable] = useState(false);

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerFineQuery = window.matchMedia("(pointer: fine)");
    const evaluate = () => setTrackingCapable(!reducedMotionQuery.matches && pointerFineQuery.matches);
    evaluate();
    reducedMotionQuery.addEventListener("change", evaluate);
    pointerFineQuery.addEventListener("change", evaluate);
    return () => {
      reducedMotionQuery.removeEventListener("change", evaluate);
      pointerFineQuery.removeEventListener("change", evaluate);
    };
  }, []);

  // Cache the badge centre and tracking radius so pointer handling never
  // triggers a layout read; only resize/scroll refresh them.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateOrigin = () => {
      const r = stage.getBoundingClientRect();
      const radius = Math.max(
        TRACKING_RADIUS_MIN,
        Math.min(window.innerWidth * TRACKING_RADIUS_RATIO, TRACKING_RADIUS_MAX)
      );
      originRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, radius };
    };
    updateOrigin();
    const observer = new ResizeObserver(updateOrigin);
    observer.observe(stage);
    window.addEventListener("scroll", updateOrigin, { passive: true });
    window.addEventListener("resize", updateOrigin);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateOrigin);
      window.removeEventListener("resize", updateOrigin);
    };
  }, []);

  // When trackingCapable flips on, 10 more <img> elements mount alongside the
  // already-loaded "center" one. That element won't fire onLoad again since it
  // isn't remounted, so seed the counter from frames that are already complete
  // instead of assuming zero.
  useLayoutEffect(() => {
    if (!trackingCapable) return;
    let loaded = 0;
    for (const name of POSE_NAMES) {
      if (imgRefs.current[name]?.complete) loaded++;
    }
    loadedCountRef.current = loaded;
    setAssetsReady(loaded >= POSE_NAMES.length);
  }, [trackingCapable]);

  useEffect(() => {
    if (assetsReady) return;
    const timeout = window.setTimeout(() => setAssetsReady(true), ASSET_READY_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [assetsReady]);

  useEffect(() => {
    if (!assetsReady || !trackingCapable) return; // static centre pose, no listeners, no rAF

    function setTargetFromClient(clientX: number, clientY: number) {
      const origin = originRef.current;
      let x = (clientX - origin.x) / origin.radius;
      let y = (clientY - origin.y) / origin.radius;
      x = Math.max(-1, Math.min(1, x));
      y = Math.max(-1, Math.min(1, y));
      if (Math.hypot(x, y) < DEAD_ZONE_RADIUS) {
        x = 0;
        y = 0;
      }
      targetRef.current = { x, y };
    }

    function handlePointerMove(e: PointerEvent) {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      setTargetFromClient(e.clientX, e.clientY);
    }

    function handleWindowMouseOut(e: MouseEvent) {
      if (e.relatedTarget === null) targetRef.current = { x: 0, y: 0 };
    }

    function handleBlur() {
      targetRef.current = { x: 0, y: 0 };
    }

    function applyWeights(x: number, y: number) {
      let total = 0;
      const raw: number[] = new Array(POSE_NAMES.length);
      for (let i = 0; i < POSE_NAMES.length; i++) {
        const anchor = POSE_ANCHORS[POSE_NAMES[i]];
        const dx = x - anchor.x;
        const dy = y - anchor.y;
        const w = Math.exp(-(dx * dx + dy * dy) / (2 * FALLOFF_SIGMA * FALLOFF_SIGMA));
        raw[i] = w;
        total += w;
      }
      if (total <= 0) raw[POSE_NAMES.indexOf("center")] = total = 1;

      // Keep only the strongest few poses. The far tail contributes nothing
      // recognisable but muddies the silhouette with extra part-opaque heads.
      let cutoff = 0;
      if (POSE_NAMES.length > MAX_BLENDED_POSES) {
        const sorted = raw.slice().sort((a, b) => b - a);
        cutoff = sorted[MAX_BLENDED_POSES];
      }

      // Frames are stacked, so painter's algorithm applies: setting each layer
      // to its own weight would let the badge background show through wherever
      // two poses blend. Dividing by the running total instead makes the
      // lowest visible layer opaque and each layer above it blend exactly its
      // share, so the crossfade never washes the character out.
      let cumulative = 0;
      for (let i = 0; i < POSE_NAMES.length; i++) {
        const el = imgRefs.current[POSE_NAMES[i]];
        if (!el) continue;
        const w = raw[i] / total;
        if (w <= cutoff || w < MIN_VISIBLE_WEIGHT) {
          el.style.opacity = "0";
          continue;
        }
        cumulative += w;
        el.style.opacity = (w / cumulative).toFixed(3);
      }
    }

    function tick(now: number) {
      if (lastFrameTimeRef.current === null) lastFrameTimeRef.current = now;
      const dt = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;
      // Framerate-independent damping, so the lag feels the same at 60 and 120Hz.
      const ease = 1 - Math.exp(-dt / SMOOTHING_TAU_MS);
      smoothedRef.current.x += (targetRef.current.x - smoothedRef.current.x) * ease;
      smoothedRef.current.y += (targetRef.current.y - smoothedRef.current.y) * ease;
      applyWeights(smoothedRef.current.x, smoothedRef.current.y);
      rafRef.current = requestAnimationFrame(tick);
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      } else if (rafRef.current === null) {
        lastFrameTimeRef.current = null;
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("mouseout", handleWindowMouseOut);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("mouseout", handleWindowMouseOut);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [assetsReady, trackingCapable]);

  const framesToRender = trackingCapable ? POSE_NAMES : (["center"] as PoseName[]);

  function handleFrameLoad() {
    loadedCountRef.current += 1;
    if (loadedCountRef.current >= framesToRender.length) setAssetsReady(true);
  }

  return (
    <span
      ref={stageRef}
      className="studigoMascot mascotTracker"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {framesToRender.map((name) => (
        <Image
          key={name}
          ref={(el) => {
            if (el) imgRefs.current[name] = el;
            else delete imgRefs.current[name];
          }}
          src={`/mascot/cursor-tracking/${name}.png`}
          width={560}
          height={560}
          sizes={MASCOT_SIZES}
          alt=""
          draggable={false}
          priority={name === "center" && priority}
          loading="eager"
          className="mascotFrame"
          style={{ opacity: name === "center" ? 1 : 0 }}
          onLoad={handleFrameLoad}
          onError={handleFrameLoad}
        />
      ))}
    </span>
  );
}
