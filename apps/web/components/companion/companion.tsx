"use client";

import "./companion.css";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { OUTFITS, OUTFIT_LABELS, parseOutfit, type CompanionEvent } from "@/lib/companion-logic";
import { growthView, studyTasks, wearableOutfit, type GrowthTrack } from "@/lib/companion-growth";
import { useCompanionGrowth } from "@/lib/companion-growth-store";
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

function LockGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <rect x="2" y="5.5" width="8" height="5.5" rx="1.4" fill="currentColor" />
      <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function TrickRow({ trick }: { trick: GrowthTrack }) {
  return (
    <li data-known={trick.unlocked}>
      {trick.unlocked ? <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2.5 6.2 5 8.6l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : <LockGlyph />}
      <span>{trick.label}</span>
      <small>{trick.unlocked ? "He knows this one" : `Unlocks after ${studyTasks(trick.tasksLeft)}`}</small>
    </li>
  );
}

/** The learner's device asks for less motion. Read after mount, so the first render matches the server. */
function useDeviceReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/** Room Settings: how Studigo behaves in this room. Applies at once, like the room color. */
export function RoomCompanionSettings({ roomId }: { roomId: string }) {
  const [prefs, update] = useCompanionPrefs(roomId);
  const deviceReduced = useDeviceReducedMotion();
  const growth = useCompanionGrowth();
  const view = growthView(growth.points);
  const worn = wearableOutfit(growth.points, prefs.outfit);
  const whereId = useId();
  const growingId = useId();
  const tricksId = useId();
  const outfitId = useId();
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
        <input type="checkbox" checked={deviceReduced || prefs.calm} disabled={deviceReduced} onChange={(event) => update({ calm: event.target.checked })} />
        {deviceReduced ? <small className="cmpNote">Your device asks for less motion.</small> : null}
      </label>
      <div className="cmpChoice">
        <b id={whereId}>Where he sits</b>
        <small>A floating window you can move, or a strip under the menu.</small>
        <div className="cmpSegment" role="group" aria-labelledby={whereId}>
          <button type="button" aria-pressed={prefs.host === "float"} onClick={() => update({ host: "float" })}>Floating window</button>
          <button type="button" aria-pressed={prefs.host === "strip"} onClick={() => update({ host: "strip" })}>Strip under the menu</button>
        </div>
      </div>
      <section className="cmpGrow" aria-labelledby={growingId}>
        <div className="cmpGrowHead">
          <strong id={growingId}>Growing</strong>
          <span>{view.stageLabel}</span>
        </div>
        <div className="cmpBar" role="progressbar" aria-label="Progress to the next unlock" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(view.fill * 100)}>
          <span style={{ width: `${view.fill * 100}%` }} />
        </div>
        <small>{view.line}</small>
        <div className="cmpTricks">
          <strong id={tricksId}>Tricks</strong>
          <ul aria-labelledby={tricksId}>
            {view.tricks.map((trick) => <TrickRow key={trick.value} trick={trick} />)}
          </ul>
        </div>
      </section>
      <fieldset className="cmpOutfits">
        <legend id={outfitId}><b>Outfit</b></legend>
        <small>Cosmetic only. It never changes his progress.</small>
        <div className="cmpOutfitList">
          <label className="cmpOutfitOpt">
            <input type="radio" name={outfitId} value="" checked={worn === null} onChange={(event) => update({ outfit: parseOutfit(event.target.value) })} />
            <span>None</span>
          </label>
          {OUTFITS.map((outfit) => {
            const status = view.outfits[outfit];
            return (
              <label key={outfit} className={`cmpOutfitOpt${status.unlocked ? "" : " locked"}`}>
                <input type="radio" name={outfitId} value={outfit} checked={worn === outfit} disabled={!status.unlocked} onChange={(event) => update({ outfit: parseOutfit(event.target.value) })} />
                <span>{OUTFIT_LABELS[outfit]}</span>
                {status.unlocked ? null : <small><LockGlyph />Unlocks after {studyTasks(status.tasksLeft)}</small>}
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
