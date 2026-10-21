"use client";

import { createContext, useContext, useEffect, useId, useState, type ReactNode, type Ref } from "react";
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
  /** Where chips go on wide screens: the right end of the header row. */
  chipHost: HTMLElement | null;
  /** Where chips go on phones: a line just under the Studigo rail, so the header stays one row. */
  chipBarHost: HTMLElement | null;
  setMascot: (state: MascotState) => void;
};

const noop = () => {};
export const INLINE_SLOTS: Slots = { placement: "inline", chipHost: null, chipBarHost: null, setMascot: noop };
export const HeaderSlots = createContext<Slots>(INLINE_SLOTS);

/**
 * Renders its children in the page header's chip slot (or in place when nested).
 * Wide screens show the header copy and phones show the one under the rail; CSS
 * hides the other, so the layout is right on first paint at either size.
 */
export function HeaderChip({ children }: { children: ReactNode }) {
  const { placement, chipHost, chipBarHost } = useContext(HeaderSlots);
  if (placement === "inline") return <div className="mhInlineChip">{children}</div>;
  return (
    <>
      {chipHost ? createPortal(children, chipHost) : null}
      {chipBarHost ? createPortal(children, chipBarHost) : null}
    </>
  );
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

/**
 * Desktop Study Room drawer: starts open and closes after three idle seconds.
 * Pointer and keyboard interaction with the controls pauses dismissal. Phones
 * keep their fixed, full-size mode controls and never enter this state.
 */
export function ModeFrame({ tone, children, frameRef, accessory }: { tone: string; children: ReactNode; frameRef?: Ref<HTMLDivElement>; accessory?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [activity, setActivity] = useState(0);
  const [focused, setFocused] = useState(false);
  const [pointerInside, setPointerInside] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const controlsId = useId();

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 700px)");
    const handleWidth = () => {
      setDesktop(!mobile.matches);
      if (mobile.matches) {
        setCollapsed(false);
        setFocused(false);
      }
    };
    handleWidth();
    mobile.addEventListener("change", handleWidth);
    return () => mobile.removeEventListener("change", handleWidth);
  }, []);

  // Switching pages makes its controls discoverable, then begins a fresh delay.
  useEffect(() => {
    setCollapsed(false);
    setHasMoved(false);
  }, [tone]);

  useEffect(() => {
    if (!desktop || collapsed || focused || pointerInside) return;
    const timer = window.setTimeout(() => {
      // Opening the drawer removes its handle under the pointer. Browser hover
      // can move to a control without a new enter event on the outer frame.
      if (document.getElementById(controlsId)?.matches(":hover")) {
        setPointerInside(true);
        return;
      }
      setHasMoved(true);
      setCollapsed(true);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [desktop, collapsed, focused, pointerInside, activity, tone, controlsId]);

  function showControls() {
    if (!desktop) return;
    setHasMoved(true);
    setCollapsed(false);
  }

  return (
    <div className="modeFrame" data-tone={tone} data-collapsed={collapsed ? "true" : "false"} data-drawer-animated={hasMoved ? "true" : undefined} ref={frameRef}
      onPointerEnter={(event) => { if (event.pointerType === "mouse" || event.pointerType === "pen") setPointerInside(true); }}
      onPointerLeave={() => setPointerInside(false)}>
      <div
        className="modeStrip"
        id={controlsId}
        aria-hidden={collapsed || undefined}
        inert={collapsed}
        onPointerEnter={(event) => { if (event.pointerType === "mouse" || event.pointerType === "pen") setPointerInside(true); }}
        onPointerMove={(event) => {
          if (event.pointerType === "mouse" || event.pointerType === "pen") setPointerInside(true);
          setActivity((n) => n + 1);
        }}
        onPointerDown={() => setActivity((n) => n + 1)}
        onChangeCapture={() => setFocused(false)}
        // Pointer-selected Coach/Practice tabs keep DOM focus after navigation,
        // but should not suspend the idle drawer indefinitely. Only visible
        // keyboard focus holds it open; pointer activity already resets 3s.
        onFocusCapture={(event) => {
          const target = event.target;
          setFocused(target instanceof HTMLElement && (target.matches(":focus-visible") || target.matches("select")));
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}
      >
        <div className="modeStripInner">{children}</div>
      </div>
      {accessory}
      <StudigoRail tone={tone} />
      {desktop && collapsed && (
        <button
          type="button"
          className="modeCollapseToggle"
          aria-controls={controlsId}
          aria-expanded={false}
          aria-label="Show controls"
          title="Show controls"
          onClick={showControls}
        >
          <span className="modeTabLed" aria-hidden="true" />
          <svg className="modeTabChevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
            <path d="m5 9 7 7 7-7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="modeCollapseText">Show controls</span>
        </button>
      )}
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
  chipRef,
  chipBarRef
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
  chipBarRef: (node: HTMLDivElement | null) => void;
}) {
  const descriptionId = useId();
  return (
    <>
    <ModeFrame tone={frameTone}>
      <header className="modeHead" data-tone={current}>
        <span className="chatMascot chatMascotStatic">
          <StudigoMascot state={mascot} size={38} mark />
        </span>
        {modes.length > 1 ? (
          <div className="chatModes" role="group" aria-label={`${groupName} modes`}>
            {modes.map((mode) => (
              <button key={mode.id} type="button" data-tone={mode.id}
                aria-label={mode.name} title={mode.name}
                aria-describedby={`${descriptionId}-${mode.id}`}
                aria-pressed={mode.id === current} onClick={() => onSelect(mode.id)}>
                <strong>{mode.name}</strong>
                <small id={`${descriptionId}-${mode.id}`}>{mode.sub}</small>
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
    <div className="mhChipBar" data-tone={current} ref={chipBarRef} />
    </>
  );
}
