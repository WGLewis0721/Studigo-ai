"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

const SHELLS = [
  { id: "tangerine", name: "Tangerine" },
  { id: "blueberry", name: "Blueberry" },
  { id: "grape", name: "Grape" },
  { id: "berry", name: "Berry" },
  { id: "kiwi", name: "Kiwi" },
  { id: "dandelion", name: "Dandelion" },
  { id: "teal", name: "Teal" },
  { id: "indigo", name: "Indigo" }
] as const;

type Shell = (typeof SHELLS)[number]["id"];

const STORAGE_KEY = "studigo.coachShell";

function isShell(value: unknown): value is Shell {
  return SHELLS.some((item) => item.id === value);
}

/**
 * The Coach lives inside a personal device, like the homepage hero. The shell
 * color is cosmetic and kept in this browser only. The screen keeps the Coach
 * tone so buttons and states inside do not change meaning when the shell does.
 */
export function CoachDevice({ children }: { children: ReactNode }) {
  const [shell, setShell] = useState<Shell>("tangerine");
  const swatchRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isShell(saved)) setShell(saved);
    } catch {
      /* storage can be blocked; the default shell is fine */
    }
  }, []);

  function choose(next: Shell) {
    setShell(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function onPickerKey(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = SHELLS.findIndex((item) => item.id === shell);
    const next = (index + step + SHELLS.length) % SHELLS.length;
    choose(SHELLS[next].id);
    swatchRefs.current[next]?.focus();
  }

  return (
    <div className="coachDeviceWrap">
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
      <div className="cdPicker">
        <span className="cdPickerLabel" id="coach-shell-label">Pick your Coach color</span>
        <div className="cdSwatches" role="radiogroup" aria-labelledby="coach-shell-label" onKeyDown={onPickerKey}>
          {SHELLS.map((item, index) => (
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
              onClick={() => choose(item.id)}
            >
              <i aria-hidden="true" />
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
