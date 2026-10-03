"use client";

import Image from "next/image";

const STILL_SRC = "/mascot/tracking/studigo-mascot-center-still.jpg";
const SIZES = "(max-width: 960px) 90vw, 520px";

export function MeetPortrait() {
  return (
    <div className="meetScreen rv" role="img" aria-label="Studigo, an orange dragon in a green vest, looking toward you">
      <Image src={STILL_SRC} width={560} height={560} sizes={SIZES} alt="" draggable={false} />
      <span className="screenSill" aria-hidden="true"><span className="railLed" /><span className="railBrand">studigo</span></span>
    </div>
  );
}
