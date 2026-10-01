const SPRITES = "/mascot/companion";

/** Studigo full body, as a still. For completion and empty states, at 96px or less. */
export function StudigoFigure({ pose, size = 88, label }: { pose: "celebrate" | "wave" | "read" | "center"; size?: number; label?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a small, pre-sized sprite; the image optimizer adds nothing here
  return <img className="studigoFigure" src={`${SPRITES}/full/${pose}.webp`} width={size} height={size} alt={label ?? ""} decoding="async" />;
}
