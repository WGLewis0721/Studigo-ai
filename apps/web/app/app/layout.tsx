import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { initialsFor, requireUser } from "@/lib/auth";
import { listRooms } from "@/lib/rooms";
import { signOutAction } from "@/lib/actions/auth";
import { RAIL_COLLAPSED, RAIL_COOKIE } from "@/lib/rail";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const rooms = await listRooms();
  const collapsed = (await cookies()).get(RAIL_COOKIE)?.value === RAIL_COLLAPSED;

  return (
    <AppShell
      initialCollapsed={collapsed}
      rooms={rooms.map(({ id, title }) => ({ id, title }))}
      profile={{ initials: initialsFor(user), label: user.email ?? "Guest session" }}
      signOut={
        user.is_anonymous ? null : (
          <form action={signOutAction}>
            <button className="railSignOut" type="submit">
              Sign out
            </button>
          </form>
        )
      }
    >
      {children}
    </AppShell>
  );
}
