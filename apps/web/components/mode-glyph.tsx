/**
 * One small, consistent icon per study mode. Drawn on a 20px grid with a single
 * stroke weight so the mode dial reads as one manufactured set. Always paired
 * with a text label; the glyph is never the only way to identify a mode.
 */
export type GlyphName =
  | "materials" | "ask" | "coach" | "learn" | "quiz" | "cards"
  | "weak" | "test" | "plan" | "cram" | "mastery";

const PATHS: Record<GlyphName, React.ReactNode> = {
  materials: <><rect x="3.5" y="4.5" width="10" height="13" rx="2" /><path d="M6.5 2.5h8a2 2 0 0 1 2 2V14" /><path d="M6.5 9h4M6.5 12h4" /></>,
  ask: <><path d="M5.5 3.5h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9.5L6 16.5v-3h-.5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z" /><path d="M8.6 6.7a1.5 1.5 0 1 1 2 1.4c-.4.2-.6.5-.6.9v.2" /><circle cx="10" cy="11" r=".25" /></>,
  coach: <><circle cx="10" cy="8" r="4.5" /><path d="M3.5 17.5c1.2-2.6 3.6-4 6.5-4s5.3 1.4 6.5 4" /><path d="M8.3 7.4h.01M11.7 7.4h.01" /></>,
  learn: <><path d="M10 5.2C8.4 4 6.2 3.6 3.5 3.8v11c2.7-.2 4.9.2 6.5 1.4 1.6-1.2 3.8-1.6 6.5-1.4v-11c-2.7-.2-4.9.2-6.5 1.4Z" /><path d="M10 5.2v11" /></>,
  quiz: <><circle cx="10" cy="10" r="6.5" /><path d="m7.2 10.2 1.9 1.9 3.8-4" /></>,
  cards: <><rect x="3" y="6" width="11" height="10" rx="2" /><path d="M6.5 3.8h8.2a2 2 0 0 1 2 2V13" /></>,
  weak: <><path d="M10 3.5 17 16H3Z" /><path d="M10 8.3v3.4" /><circle cx="10" cy="13.7" r=".2" /></>,
  test: <><rect x="4" y="3" width="12" height="14.5" rx="2" /><path d="M7.5 7h5M7.5 10h5M7.5 13h3" /></>,
  plan: <><rect x="3.5" y="4.5" width="13" height="12" rx="2" /><path d="M3.5 8.5h13M7 3v3M13 3v3" /><path d="M7 12h2" /></>,
  cram: <><circle cx="10" cy="11" r="6" /><path d="M10 8v3l2 1.5M8.5 2.8h3" /></>,
  mastery: <><path d="M3.5 16.5h13" /><path d="M5.5 16.5V11M10 16.5V6.5M14.5 16.5V9" /></>
};

export function ModeGlyph({ name, size = 18 }: { name: GlyphName; size?: number }) {
  return (
    <svg
      className="modeGlyph"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
