"use client";

import { useRef, type KeyboardEvent } from "react";
import { ROOM_THEMES, useRoomTheme } from "@/lib/room-theme";

export function RoomColorPicker({ roomId }: { roomId: string }) {
  const [shell, setShell] = useRoomTheme(roomId);
  const swatchRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
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
      <small className="cdPickerHint">Tints the whole room. Applies now, saved on this device.</small>
    </div>
  );
}
