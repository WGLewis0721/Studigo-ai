"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ACCENTS = ["science", "ela", "math", "sun"] as const;

export function RoomRail({ rooms }: { rooms: Array<{ id: string; title: string }> }) {
  const pathname = usePathname();

  return (
    <nav className="railScroll" aria-label="Study rooms">
      <Link
        className={`railItem ${pathname === "/app" ? "active" : ""}`}
        href="/app"
      >
        <span aria-hidden="true">⌂</span> All rooms
      </Link>

      <span className="railLabel">STUDY ROOMS</span>

      {rooms.length === 0 && <p className="railEmpty">No rooms yet.</p>}

      <div className="roomList">
        {rooms.map((room, index) => (
          <Link
            key={room.id}
            className={`roomLink ${pathname.startsWith(`/app/rooms/${room.id}`) ? "selected" : ""}`}
            href={`/app/rooms/${room.id}`}
          >
            <i className={`roomColor ${ACCENTS[index % ACCENTS.length]}`} aria-hidden="true" />
            <span className="roomLinkTitle">{room.title}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
