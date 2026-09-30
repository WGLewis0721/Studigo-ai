"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { COACH_SHELLS, useCoachShell } from "@/lib/coach-shell";

/**
 * The Coach lives inside a personal device, like the homepage hero. The shell
 * color is chosen in Room Settings. The screen keeps the Coach tone so buttons
 * and states inside do not change meaning when the shell does.
 */
export function CoachDevice({ roomId, children }: { roomId: string; children: ReactNode }) {
  const [shell] = useCoachShell(roomId);
  return (
    <div className="coachDevice" data-tone={shell}>
      <span className="cdHandle" aria-hidden="true" />
      <div className="cdShell">
        <div className="cdScreen" data-tone="coach">
          {children}
        </div>
        <div className="cdChin" aria-hidden="true">
          <span className="cdLed" />
          <span className="cdBrand">studigo</span>
          <span className="cdGrille" />
        </div>
      </div>
    </div>
  );
}

export function CoachShellPicker({ roomId }: { roomId: string }) {
  const [shell, setShell] = useCoachShell(roomId);
  const swatchRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = COACH_SHELLS.findIndex((item) => item.id === shell);
    const next = (index + step + COACH_SHELLS.length) % COACH_SHELLS.length;
    setShell(COACH_SHELLS[next].id);
    swatchRefs.current[next]?.focus();
  }

  return (
    <div className="cdPicker">
      <span className="cdPickerLabel" id="coach-shell-label">Coach color</span>
      <div className="cdSwatches" role="radiogroup" aria-labelledby="coach-shell-label" onKeyDown={onKey}>
        {COACH_SHELLS.map((item, index) => (
          <button
            key={item.id}
            ref={(node) => {
              swatchRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={shell === item.id}
            aria-label={item.name}
            tabIndex={shell === item.id ? 0 : -1}
            className="cdSwatch"
            data-tone={item.id}
            onClick={() => setShell(item.id)}
          >
            <i aria-hidden="true" />
            <span>{item.name}</span>
          </button>
        ))}
      </div>
      <small className="cdPickerHint">Colors the Coach device. Saved on this device.</small>
    </div>
  );
}
