"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { roomShellFor } from "@/lib/room-shell";

export function RoomRail({ rooms }: { rooms: Array<{ id: string; title: string }> }) {
  const pathname = usePathname();

  return (
    <nav className="railScroll" aria-label="Study rooms">
      <Link
        className={`railItem ${pathname === "/app" ? "active" : ""}`}
        href="/app"
        aria-current={pathname === "/app" ? "page" : undefined}
      >
        <svg className="modeGlyph" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <rect x="3" y="3" width="6" height="6" rx="1.8" />
          <rect x="11" y="3" width="6" height="6" rx="1.8" />
          <rect x="3" y="11" width="6" height="6" rx="1.8" />
          <rect x="11" y="11" width="6" height="6" rx="1.8" />
        </svg>
        All rooms
      </Link>

      <span className="railLabel">STUDY ROOMS</span>

      {rooms.length === 0 && <p className="railEmpty">No rooms yet.</p>}

      <div className="roomList">
        {rooms.map((room) => {
          const selected = pathname.startsWith(`/app/rooms/${room.id}`);
          return (
            <Link
              key={room.id}
              className={`roomLink ${selected ? "selected" : ""}`}
              href={`/app/rooms/${room.id}`}
              aria-current={selected ? "page" : undefined}
            >
              <i className="roomGem" data-tone={roomShellFor(room.id)} aria-hidden="true" />
              <span className="roomLinkTitle">{room.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
