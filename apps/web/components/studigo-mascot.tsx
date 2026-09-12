import Image from "next/image";

export type MascotState = "welcome" | "explain" | "sources" | "thinking" | "celebrate";
const labels: Record<MascotState, string> = {
  welcome: "Studigo, your study companion", explain: "Studigo explaining a source",
  sources: "Studigo showing the original source", thinking: "Studigo finding evidence",
  celebrate: "Studigo celebrating your practice"
};

/** One canonical character. State follows real product events, never fake progress. */
export function StudigoMascot({ state = "welcome", size = 96, mark = false, priority = false, decorative = true }: {
  state?: MascotState; size?: number; mark?: boolean; priority?: boolean; decorative?: boolean;
}) {
  return <span className={`studigoMascot ${mark ? "mascotMark" : ""} mascot-${state}`}
    style={{ width: size, height: size }} aria-hidden={decorative || undefined}>
    <Image src="/mascot/studigo-source-paper.png" alt={decorative ? "" : labels[state]}
      width={1254} height={1254} sizes={`${mark ? size * 3 : size}px`} priority={priority} />
  </span>;
}
