"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ROOM_THEMES, useRoomTheme } from "@/lib/room-theme";

/** A room card in the room's chosen color; children stay server-rendered. */
export function RoomCardLink({ roomId, href, children }: { roomId: string; href: string; children: ReactNode }) {
  const [theme] = useRoomTheme(roomId);
  const name = ROOM_THEMES.find((item) => item.id === theme)?.name ?? "";
  return (
    <Link className="roomCard" href={href} data-tone={theme}>
      <span className="roomCardShell" aria-hidden="true">{name.toUpperCase()}</span>
      {children}
    </Link>
  );
}
