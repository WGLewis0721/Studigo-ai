"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { StudigoMascot, type MascotState } from "@/components/studigo-mascot";

/**
 * The header every Study Room page shares, the same arrangement the Coach chat
 * uses: the mascot, a switch between the page's modes (each with a short line
 * under it), and a chip on the right for the context you can change (a topic,
 * a question count, the test date). Panels fill the chip and the mascot's
 * mood through the slots below instead of drawing their own headings.
 */
export type HeaderMode = { id: string; name: string; sub: string };

type Slots = {
  /** "portal" sends chips up into the page header; "inline" keeps them where they are (nested panels). */
  placement: "portal" | "inline";
  chipHost: HTMLElement | null;
  setMascot: (state: MascotState) => void;
};

const noop = () => {};
export const INLINE_SLOTS: Slots = { placement: "inline", chipHost: null, setMascot: noop };
export const HeaderSlots = createContext<Slots>(INLINE_SLOTS);

/** Renders its children in the page header's chip slot (or in place when nested). */
export function HeaderChip({ children }: { children: ReactNode }) {
  const { placement, chipHost } = useContext(HeaderSlots);
  if (placement === "inline") return <div className="mhInlineChip">{children}</div>;
  return chipHost ? createPortal(children, chipHost) : null;
}

/** Sets the header mascot's mood while this is mounted. */
export function HeaderMascot({ state }: { state: MascotState }) {
  const { setMascot } = useContext(HeaderSlots);
  useEffect(() => {
    setMascot(state);
    return () => setMascot("welcome");
  }, [state, setMascot]);
  return null;
}

/** A chip that opens a native picker: same look as the Coach topic chip. */
export function ChipSelect({
  label,
  ariaLabel,
  value,
  onChange,
  disabled,
  children
}: {
  label: string;
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="chatTopic mhSelect">
      <span className="chatTopicName">{label}</span>
      <span aria-hidden="true">▾</span>
      <select aria-label={ariaLabel} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

export function ChipButton({ children, onClick, label }: { children: ReactNode; onClick: () => void; label?: string }) {
  return (
    <button type="button" className="chatTopic" aria-label={label} onClick={onClick}>
      <span className="chatTopicName">{children}</span>
    </button>
  );
}

/**
 * The five pages, in the order of the page selector. The Studigo rail has one
 * dot for each; the dot for the page you are on is lit. Keep in step with
 * GROUPS in workspace.tsx (each page's tone is its id here).
 */
export const PAGE_TONES = ["coach", "quiz", "mastery", "plan", "materials"] as const;

/**
 * The Studigo rail: a slim band in the page's color that carries the wordmark
 * and five small dots, one per page, with the current page's dot lit. It is
 * the divider between a page's options and its content, and its color says
 * which of the five pages you are on. Purely decorative (the page selector
 * says the same thing in words), so it is hidden from assistive tech.
 */
export function StudigoRail({ tone }: { tone: string }) {
  const step = PAGE_TONES.indexOf(tone as (typeof PAGE_TONES)[number]);
  return (
    <div className="studigoRail" aria-hidden="true">
      <span className="railLed" />
      <span className="railBrand">studigo</span>
      <span className="railDots">
        {PAGE_TONES.map((page, index) => (
          <i key={page} data-lit={index === step ? "true" : undefined} />
        ))}
      </span>
    </div>
  );
}

/** A page's header: its options row (children) with the Studigo rail beneath. */
export function ModeFrame({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <div className="modeFrame" data-tone={tone}>
      {children}
      <StudigoRail tone={tone} />
    </div>
  );
}

export function ModeHeader({
  groupName,
  frameTone,
  modes,
  current,
  onSelect,
  title,
  sub,
  mascot,
  chipRef
}: {
  groupName: string;
  /** Tone of the page the header belongs to (colors the rail). */
  frameTone: string;
  modes: HeaderMode[];
  current: string;
  onSelect: (id: string) => void;
  title: string;
  sub: string;
  mascot: MascotState;
  chipRef: (node: HTMLDivElement | null) => void;
}) {
  return (
    <ModeFrame tone={frameTone}>
      <header className="modeHead" data-tone={current}>
        <span className="chatMascot chatMascotStatic">
          <StudigoMascot state={mascot} size={38} mark />
        </span>
        {modes.length > 1 ? (
          <div className="chatModes" role="group" aria-label={`${groupName} modes`}>
            {modes.map((mode) => (
              <button key={mode.id} type="button" data-tone={mode.id} aria-pressed={mode.id === current} onClick={() => onSelect(mode.id)}>
                <strong>{mode.name}</strong>
                <small>{mode.sub}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="mhTitle">
            <h2>{title}</h2>
            <p>{sub}</p>
          </div>
        )}
        <div className="chatTopicRow mhChipRow" ref={chipRef} />
      </header>
    </ModeFrame>
  );
}
