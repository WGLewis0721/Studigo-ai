"use client";

import { useRoomTheme } from "@/lib/room-theme";

/** A room's gem in the room's chosen color (falls back to the color its card started with). */
export function RoomGem({ roomId }: { roomId: string }) {
  const [theme] = useRoomTheme(roomId);
  return <i className="roomGem" data-tone={theme} aria-hidden="true" />;
}
