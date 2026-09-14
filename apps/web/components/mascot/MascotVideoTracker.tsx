"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const VIDEO_SRC = "/mascot/tracking/studigo-mascot-horizontal-track.mp4";
// Pulled from the video's own mid-frame, so the poster and the first painted
// video frame are identical - no background pop while the video loads.
const STILL_SRC = "/mascot/tracking/studigo-mascot-center-still.jpg";
const STILL_SIZES = "(max-width: 480px) 110px, 150px";

// The badge is small, so pointer X is measured against a much larger reference
// than the element itself - otherwise the head slams to full deflection the
// moment the cursor leaves the badge. Scaling off viewport width puts a full
// turn roughly at the opposite edge of the screen.
const TRACKING_RADIUS_MIN = 400;
const TRACKING_RADIUS_MAX = 900;
const TRACKING_RADIUS_RATIO = 0.5;

const SMOOTHING_TAU_MS = 150;
const DEAD_ZONE = 0.04;
// Seeking costs more than a style write, so ignore sub-frame movements.
const MIN_SEEK_DELTA_S = 0.008;
// Never seek to exactly 0 or duration; both can stall or show a blank frame.
const TIMELINE_EPSILON = 0.03;

export function MascotVideoTracker({ size = 150, priority = false }: { size?: number; priority?: boolean }) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const originRef = useRef({ x: 0, radius: TRACKING_RADIUS_MIN });
  const targetRef = useRef(0); // normalized -1 (left) .. +1 (right)
  const smoothedRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastSeekRef = useRef(-1);

  // Starts false on both server and first client render (no window during SSR)
  // so hydration matches, then flips once we know a real mouse is present.
  // Until then the <video> is never mounted, so touch and reduced-motion
  // visitors never download it.
  const [trackingCapable, setTrackingCapable] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerFine = window.matchMedia("(pointer: fine)");
    const evaluate = () => setTrackingCapable(!reducedMotion.matches && pointerFine.matches);
    evaluate();
    reducedMotion.addEventListener("change", evaluate);
    pointerFine.addEventListener("change", evaluate);
    return () => {
      reducedMotion.removeEventListener("change", evaluate);
      pointerFine.removeEventListener("change", evaluate);
    };
  }, []);

  // Cache the badge centre so pointer handling never triggers a layout read.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const updateOrigin = () => {
      const r = wrapper.getBoundingClientRect();
      const radius = Math.max(
        TRACKING_RADIUS_MIN,
        Math.min(window.innerWidth * TRACKING_RADIUS_RATIO, TRACKING_RADIUS_MAX)
      );
      originRef.current = { x: r.left + r.width / 2, radius };
    };
    updateOrigin();
    const observer = new ResizeObserver(updateOrigin);
    observer.observe(wrapper);
    window.addEventListener("scroll", updateOrigin, { passive: true });
    window.addEventListener("resize", updateOrigin);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateOrigin);
      window.removeEventListener("resize", updateOrigin);
    };
  }, []);

  const showVideo = trackingCapable && !videoFailed;

  useEffect(() => {
    if (!showVideo) return;

    function setTargetFromClient(clientX: number) {
      const { x: originX, radius } = originRef.current;
      let x = (clientX - originX) / radius;
      x = Math.max(-1, Math.min(1, x));
      if (Math.abs(x) < DEAD_ZONE) x = 0;
      targetRef.current = x;
    }

    function handlePointerMove(e: PointerEvent) {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      setTargetFromClient(e.clientX);
    }

    function handleWindowMouseOut(e: MouseEvent) {
      if (e.relatedTarget === null) targetRef.current = 0;
    }

    function handleBlur() {
      targetRef.current = 0;
    }

    function tick(now: number) {
      rafRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;

      if (lastFrameTimeRef.current === null) lastFrameTimeRef.current = now;
      const dt = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      // Framerate-independent damping, so the lag feels the same at 60 and 120Hz.
      const ease = 1 - Math.exp(-dt / SMOOTHING_TAU_MS);
      smoothedRef.current += (targetRef.current - smoothedRef.current) * ease;

      if (!video) return;
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      // Letting seeks queue up behind an in-flight one is what makes scrubbing
      // feel rubber-bandy; skipping the frame instead self-throttles to the
      // decoder and keeps the head on the cursor.
      if (video.seeking) return;

      const usable = Math.max(duration - TIMELINE_EPSILON * 2, 0);
      const time = TIMELINE_EPSILON + ((smoothedRef.current + 1) / 2) * usable;
      if (Math.abs(time - lastSeekRef.current) < MIN_SEEK_DELTA_S) return;
      lastSeekRef.current = time;
      video.currentTime = time;
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
      rafRef.current = null;
    };
  }, [showVideo]);

  // The video is a scrub surface, never a playing clip: park it mid-timeline
  // (the forward-facing pose) and leave it paused for its whole life.
  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    const mid = video.duration / 2;
    if (Number.isFinite(mid)) {
      video.currentTime = mid;
      lastSeekRef.current = mid;
    }
  }

  return (
    <span ref={wrapperRef} className="studigoMascot mascotTracker" style={{ width: size, height: size }} aria-hidden>
      {showVideo ? (
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          poster={STILL_SRC}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          className="mascotTrackVideo"
          onLoadedMetadata={handleLoadedMetadata}
          onError={() => setVideoFailed(true)}
        />
      ) : (
        <Image
          src={STILL_SRC}
          width={560}
          height={560}
          sizes={STILL_SIZES}
          alt=""
          draggable={false}
          priority={priority}
        />
      )}
    </span>
  );
}
