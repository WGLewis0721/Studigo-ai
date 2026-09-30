"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { ROOM_THEMES, useRoomTheme } from "@/lib/room-theme";

/**
 * The Coach lives inside a personal device, like the homepage hero. On wide
 * screens the device wears the room color chosen in Room Settings; on phones
 * the device is flat and the room color shows in the chat itself. The screen
 * keeps the Coach tone so buttons and states do not change meaning.
 */
export function CoachDevice({ roomId, children }: { roomId: string; children: ReactNode }) {
  const [shell] = useRoomTheme(roomId);
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
