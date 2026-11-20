"use client";

import "./companion.css";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, type RefObject } from "react";
import { OUTFITS, OUTFIT_LABELS, parseOutfit, type CompanionEvent } from "@/lib/companion-logic";
import { readCompanionPrefs, useCompanionPrefs } from "@/lib/companion-prefs";
import { createCompanion, type CompanionEventPayload, type CompanionHandle } from "./engine";

/** Set on Home when a room is opened, so he lands in his window instead of just appearing. */
export const LEAP_KEY = "studigo.leap";

type CompanionApi = {
  /** Tell him about something that already happened (an answer graded, a card rated). */
  event(name: CompanionEvent, payload?: CompanionEventPayload): void;
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
export function useCompanionWindow({ roomId, workspaceRef, tone }: {
  roomId: string;
  workspaceRef: RefObject<HTMLElement | null>;
  tone: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handle = useRef<CompanionHandle | null>(null);
  const latest = useRef({ tone });
  // Read once per visit to the room, not once per effect run (React runs effects twice in development).
  const arriving = useRef<boolean | null>(null);
  const [prefs, updatePrefs] = useCompanionPrefs(roomId);

  useEffect(() => { latest.current = { tone }; });

  /** He is an extra. If anything in his window throws, he is switched off and the room carries on. */
  const safely = useCallback((use: (companion: CompanionHandle) => void) => {
    const companion = handle.current;
    if (!companion) return;
    try {
      use(companion);
    } catch (error) {
      console.error("Studigo's window stopped.", error);
      handle.current = null;
      try { companion.destroy(); } catch { /* already broken */ }
    }
  }, []);

  useEffect(() => {
    // A switch for launch day: set NEXT_PUBLIC_STUDIGO_COMPANION=off to ship the room without him.
    if (process.env.NEXT_PUBLIC_STUDIGO_COMPANION === "off") return;
    const workspace = workspaceRef.current, host = hostRef.current;
    if (!workspace || !host) return;
    if (arriving.current === null) {
      arriving.current = false;
      try {
        arriving.current = window.sessionStorage.getItem(LEAP_KEY) === "1";
        window.sessionStorage.removeItem(LEAP_KEY);
      } catch { /* storage is optional */ }
    }
    try {
      const created = createCompanion(workspace, host, { prefs: readCompanionPrefs(roomId), onPrefs: updatePrefs, arriving: arriving.current });
      created.setTone(latest.current.tone);
      handle.current = created;
      // Local fixtures have no grading API, so this is how his reactions are exercised by hand.
      if (process.env.NODE_ENV === "development") (window as unknown as { studigoCompanion?: CompanionHandle }).studigoCompanion = created;
    } catch (error) {
      console.error("Studigo's window could not start.", error);
      host.innerHTML = "";
    }
    return () => {
      const companion = handle.current;
      handle.current = null;
      try { companion?.destroy(); } catch { /* nothing left to clean up */ }
    };
  }, [roomId, workspaceRef, updatePrefs]);

  useEffect(() => { safely((companion) => companion.setTone(tone)); }, [tone, safely]);
  useEffect(() => { safely((companion) => companion.setPrefs(prefs)); }, [prefs, safely]);

  const api = useMemo<CompanionApi>(() => ({
    event: (name, payload) => safely((companion) => companion.event(name, payload)),
    thinking: (on) => safely((companion) => companion.thinking(on))
  }), [safely]);

  return { hostRef, api };
}

/** Room Settings: how Studigo behaves in this room. Applies at once, like the room color. */
export function RoomCompanionSettings({ roomId }: { roomId: string }) {
  const [prefs, update] = useCompanionPrefs(roomId);
  const whereId = useId();
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
        <small>He sits in a corner of every page of this room. Off keeps him in his seat.</small>
        <input type="checkbox" checked={!prefs.seated} onChange={(event) => update({ seated: !event.target.checked })} />
      </label>
      <label className="cmpToggle">
        <b>Calm mode</b>
        <small>Gentler, slower movement. No hops, spins or sparkles.</small>
        <input type="checkbox" checked={prefs.calm} onChange={(event) => update({ calm: event.target.checked })} />
      </label>
      <div className="cmpChoice">
        <b id={whereId}>Where he sits</b>
        <small>A floating window you can move, or a strip under the menu.</small>
        <div className="cmpSegment" role="group" aria-labelledby={whereId}>
          <button type="button" aria-pressed={prefs.host === "float"} onClick={() => update({ host: "float" })}>Floating window</button>
          <button type="button" aria-pressed={prefs.host === "strip"} onClick={() => update({ host: "strip" })}>Strip under the menu</button>
        </div>
      </div>
      <label className="cmpChoice">
        <b>Outfit</b>
        <small>Cosmetic only. It never changes his progress.</small>
        <select aria-label="Studigo's outfit" value={prefs.outfit ?? ""} onChange={(event) => update({ outfit: parseOutfit(event.target.value) })}>
          <option value="">None</option>
          {OUTFITS.map((outfit) => <option key={outfit} value={outfit}>{OUTFIT_LABELS[outfit]}</option>)}
        </select>
      </label>
    </div>
  );
}
