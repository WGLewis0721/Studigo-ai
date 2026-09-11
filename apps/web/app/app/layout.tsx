import Link from "next/link";
import type { ReactNode } from "react";
import { initialsFor, requireUser } from "@/lib/auth";
import { listRooms } from "@/lib/rooms";
import { signOutAction } from "@/lib/actions/auth";
import { RoomRail } from "@/components/room-rail";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const rooms = await listRooms();

  return (
    <div className="appShell">
      <aside className="appRail">
        <Link className="miniWordmark" href="/app" aria-label="Studigo home">
          <span>S✦</span>
        </Link>

        <RoomRail rooms={rooms.map(({ id, title }) => ({ id, title }))} />

        <div className="railFooter">
          <div className="profileChip" aria-label="Signed in">
            <span>{initialsFor(user)}</span>
            <small>{user.email}</small>
          </div>
          <form action={signOutAction}>
            <button className="railSignOut" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="appMain">{children}</div>
    </div>
  );
}
