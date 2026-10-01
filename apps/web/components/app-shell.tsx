"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { StudigoMascot } from "@/components/studigo-mascot";
import { RAIL_COLLAPSED, RAIL_COOKIE } from "@/lib/rail";
import { RoomRail } from "./room-rail";

/**
 * The signed-in frame: a sidebar with the study room selector, and the page.
 * The sidebar collapses to a slim icon rail, the way Claude and ChatGPT do. The
 * choice is kept in a cookie so the server draws the right state on first paint
 * (no flash from open to collapsed on reload).
 */
export function AppShell({
  initialCollapsed,
  rooms,
  profile,
  signOut,
  children
}: {
  initialCollapsed: boolean;
  rooms: Array<{ id: string; title: string }>;
  profile: { initials: string; label: string };
  /** The sign-out form (a server action), rendered by the layout. */
  signOut?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${RAIL_COOKIE}=${next ? RAIL_COLLAPSED : "open"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="appShell" data-rail={collapsed ? "collapsed" : "open"}>
      <aside className="appRail" id="app-rail">
        <div className="railHead">
          <Link className="miniWordmark" href="/app" aria-label="Studigo home">
            <StudigoMascot size={36} mark />
            <span className="wordmarkText">Studigo</span>
          </Link>
          <button
            className="railToggle"
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-controls="app-rail"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <rect x="2.5" y="3.5" width="15" height="13" rx="3.2" />
              <path d="M7.6 3.8v12.4" />
            </svg>
          </button>
        </div>

        <RoomRail rooms={rooms} />

        <div className="railFooter">
          <div className="profileChip" aria-label="Signed in" title={profile.label}>
            <span>{profile.initials}</span>
            <small>{profile.label}</small>
          </div>
          {signOut}
        </div>
      </aside>

      <div className="appMain">{children}</div>
    </div>
  );
}
