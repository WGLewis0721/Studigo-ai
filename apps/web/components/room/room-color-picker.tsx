"use client";

import { useRef, type KeyboardEvent } from "react";
import { ROOM_THEMES, useRoomTheme } from "@/lib/room-theme";

/** The swatches sit in a grid of this many columns; Up and Down move by a row. */
const COLUMNS = 3;

export function RoomColorPicker({ roomId }: { roomId: string }) {
  const [shell, setShell] = useRoomTheme(roomId);
  const swatchRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" ? COLUMNS : event.key === "ArrowUp" ? -COLUMNS : 0;
    if (!step) return;
    event.preventDefault();
    const index = ROOM_THEMES.findIndex((item) => item.id === shell);
    const next = (index + step + ROOM_THEMES.length) % ROOM_THEMES.length;
    setShell(ROOM_THEMES[next].id);
    swatchRefs.current[next]?.focus();
  }

  return (
    <div className="cdPicker">
      <span className="cdPickerLabel" id="coach-shell-label">Room color</span>
      <div className="cdSwatches" role="radiogroup" aria-labelledby="coach-shell-label" onKeyDown={onKey}>
        {ROOM_THEMES.map((item, index) => (
          <button
            key={item.id}
            ref={(node) => {
              swatchRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={shell === item.id}
            tabIndex={shell === item.id ? 0 : -1}
            className="cdSwatch"
            data-tone={item.id}
            onClick={() => setShell(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <small className="cdPickerHint">Tints the whole room. Applies now, saved on this device.</small>
    </div>
  );
}
