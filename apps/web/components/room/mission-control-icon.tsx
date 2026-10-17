import type { ReactNode } from "react";

/** Small inline action glyphs for the Guided Learn device controls.
 * One consistent 24px stroke family; no font glyphs, remote icons or new dependencies.
 * Icon is decorative: the owning button must provide its accessible name.
 */
export type MissionControlName = "journal" | "guide" | "back" | "pause" | "check";

export function MissionControlIcon({ name }: { name: MissionControlName }) {
  const paths: Record<MissionControlName, ReactNode> = {
    journal: <>
      <rect x="5" y="4.5" width="14" height="17" rx="2.3" />
      <path d="M9.2 4.5V3.8A1.8 1.8 0 0 1 11 2h2a1.8 1.8 0 0 1 1.8 1.8v.7" />
      <path d="M9 10h6M9 14h6M9 18h4.2" />
    </>,
    guide: <>
      <rect x="5.2" y="3" width="15" height="18" rx="2" />
      <path d="M9.2 3.5v17M12.5 8h4.7M12.5 12h4.7M12.5 16h3.2" />
      <path d="M3.5 7.5h3.1M3.5 12h3.1M3.5 16.5h3.1" />
    </>,
    back: <path d="m14.5 5-7 7 7 7M7.5 12H21" />,
    pause: <><path d="M9 5v14M15 5v14" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m7.7 12.1 3 3 5.8-6" /></>
  };
  return <svg className="learnControlGlyph" aria-hidden="true" focusable="false"
    viewBox="0 0 24 24" width="24" height="24"
    fill="none" stroke="currentColor" strokeWidth="2.15"
    strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
