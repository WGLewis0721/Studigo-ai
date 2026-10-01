"use client";

import "./companion.css";
import { createContext, useContext, useEffect, useMemo, useRef, type RefObject } from "react";
import type { CompanionEvent } from "@/lib/companion-logic";
import { readCompanionPrefs, useCompanionPrefs } from "@/lib/companion-prefs";
import { createCompanion, type CompanionHandle } from "./engine";

/** Set on Home when a room is opened, so he lands in his window instead of just appearing. */
export const LEAP_KEY = "studigo.leap";

type CompanionApi = {
  /** Tell him about something that already happened (an answer graded, a card rated). */
  event(name: CompanionEvent): void;
  thinking(on: boolean): void;
};

const SILENT: CompanionApi = { event() {}, thinking() {} };
export const CompanionContext = createContext<CompanionApi>(SILENT);

/** For the room's panels. Outside a room (or if his window failed to start) the calls do nothing. */
export function useCompanion() {
  return useContext(CompanionContext);
}

/**
 * Studigo's window for one Study Room. Render the returned `hostRef` on an empty
 * element inside the workspace and provide `api` through CompanionContext.
 * If the engine cannot start, the room carries on without him.
 */
export function useCompanionWindow({ roomId, workspaceRef, tone, hasJob }: {
  roomId: string;
  workspaceRef: RefObject<HTMLElement | null>;
  tone: string;
  hasJob: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handle = useRef<CompanionHandle | null>(null);
  const latest = useRef({ tone, hasJob });
  const [prefs, updatePrefs] = useCompanionPrefs(roomId);

  useEffect(() => { latest.current = { tone, hasJob }; });

  useEffect(() => {
    // A switch for launch day: set NEXT_PUBLIC_STUDIGO_COMPANION=off to ship the room without him.
    if (process.env.NEXT_PUBLIC_STUDIGO_COMPANION === "off") return;
    const workspace = workspaceRef.current, host = hostRef.current;
    if (!workspace || !host) return;
    let arriving = false;
    try {
      arriving = window.sessionStorage.getItem(LEAP_KEY) === "1";
      window.sessionStorage.removeItem(LEAP_KEY);
    } catch { /* storage is optional */ }
    try {
      const created = createCompanion(workspace, host, { prefs: readCompanionPrefs(roomId), onPrefs: updatePrefs, arriving });
      created.setTone(latest.current.tone);
      created.setJob(latest.current.hasJob);
      handle.current = created;
      // Local fixtures have no grading API, so this is how his reactions are exercised by hand.
      if (process.env.NODE_ENV === "development") (window as unknown as { studigoCompanion?: CompanionHandle }).studigoCompanion = created;
    } catch (error) {
      console.error("Studigo's window could not start.", error);
      host.innerHTML = "";
    }
    return () => { handle.current?.destroy(); handle.current = null; };
  }, [roomId, workspaceRef, updatePrefs]);

  useEffect(() => { handle.current?.setTone(tone); }, [tone]);
  useEffect(() => { handle.current?.setJob(hasJob); }, [hasJob]);
  useEffect(() => { handle.current?.setPrefs(prefs); }, [prefs]);

  const api = useMemo<CompanionApi>(() => ({
    event: (name) => handle.current?.event(name),
    thinking: (on) => handle.current?.thinking(on)
  }), []);

  return { hostRef, api };
}

/** Room Settings: how Studigo behaves in this room. Applies at once, like the room color. */
export function RoomCompanionSettings({ roomId }: { roomId: string }) {
  const [prefs, update] = useCompanionPrefs(roomId);
  return (
    <div className="companionSettings">
      <span className="tinyLabel">STUDIGO IN THIS ROOM</span>
      <label className="cmpToggle">
        <b>Speech <small>(whole room)</small></b>
        <small>Studigo says a short line now and then. Off until you turn it on.</small>
        <input type="checkbox" checked={prefs.speech} onChange={(event) => update({ speech: event.target.checked })} />
      </label>
      <label className="cmpToggle">
        <b>His window</b>
        <small>He sits beside your work in Coach and Practice. Off keeps him in his seat.</small>
        <input type="checkbox" checked={!prefs.seated} onChange={(event) => update({ seated: !event.target.checked })} />
      </label>
    </div>
  );
}
