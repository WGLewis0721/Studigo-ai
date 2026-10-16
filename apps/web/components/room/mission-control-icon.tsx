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
      <path d="M4 4.6h7.3c1.4 0 2.5.55 3 1.35.5-.8 1.6-1.35 3-1.35H20v15h-2.7c-1.6 0-2.5.4-3 1.25-.5-.85-1.4-1.25-3-1.25H4z" />
      <path d="M14.3 6v14.5M7 9h4.2M7 12.5h4.2M17 9h.01M17 12.5h.01" />
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
