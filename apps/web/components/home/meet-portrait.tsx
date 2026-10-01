"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { MascotVideoTracker } from "@/components/mascot/MascotVideoTracker";

const STILL_SRC = "/mascot/tracking/studigo-mascot-center-still.jpg";
const SIZES = "(max-width: 960px) 90vw, 520px";

/** The big portrait that follows the cursor. The head-turn clip is only fetched once the section is near. */
export function MeetPortrait() {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setNear(true); observer.disconnect(); }
    }, { rootMargin: "400px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="meetScreen rv" ref={ref} role="img" aria-label="Studigo, an orange dragon in a green vest, looking toward you">
      {near
        ? <MascotVideoTracker size={560} sizes={SIZES} />
        : <Image src={STILL_SRC} width={560} height={560} sizes={SIZES} alt="" draggable={false} />}
      <span className="screenSill" aria-hidden="true"><span className="railLed" /><span className="railBrand">studigo</span></span>
    </div>
  );
}
