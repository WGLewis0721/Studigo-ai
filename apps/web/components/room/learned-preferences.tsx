"use client";

import { useEffect, useRef, useState } from "react";
import type { CoachMode } from "@studigo/learning";
import { COACH_MODE_OPTIONS, DEFAULT_COACH_PREFERENCES, describeCoaching } from "@/lib/coach-preferences";
import { DEFAULT_LEARN_PREFERENCES, LEARN_MODE_OPTIONS, type LearnMode } from "@/lib/learn-preferences";
import { describeStoredPreferences, type LearnedPreferenceId } from "@/lib/learned-preferences";
import type { StudyRoom } from "@/lib/rooms";
import { useCoachPreferences } from "./use-coach-preferences";

type Surface = "coach" | "learn";

export function LearnedPreferences({ room, onChangeLevel, onUseStandardLevel }: {
  room: StudyRoom;
  onChangeLevel: () => void;
  onUseStandardLevel: () => void;
}) {
  const coaching = useCoachPreferences(room);
  const [choosing, setChoosing] = useState<LearnedPreferenceId | null>(null);
  const [lastWrite, setLastWrite] = useState<Surface | null>(null);
  const [levelNote, setLevelNote] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pending = coaching.applying || coaching.learnApplying;

  useEffect(() => { setLevelNote(null); }, [room.explain_level]);

  const items = describeStoredPreferences({
    coach: coaching.applied,
    learn: coaching.learnApplied,
    explainLevel: room.explain_level
  });
  const coachNow = describeCoaching(coaching.applied).mode;
  const learnNow = coaching.learnApplied.mode;
  const status = levelNote ?? (lastWrite === "coach" ? coaching.status : lastWrite === "learn" ? coaching.learnStatus : null);
  const error = lastWrite === "coach" ? coaching.error : lastWrite === "learn" ? coaching.learnError : null;

  async function write(surface: Surface, save: () => Promise<boolean>) {
    setLastWrite(surface);
    setLevelNote(null);
    if (await save()) {
      setChoosing(null);
      headingRef.current?.focus();
    }
  }

  function change(id: LearnedPreferenceId) {
    if (id === "explanation-level") onChangeLevel();
    else setChoosing((current) => (current === id ? null : id));
  }

  function backToStandard(id: LearnedPreferenceId) {
    if (id === "coach-mode") {
      void write("coach", () => coaching.apply({ ...DEFAULT_COACH_PREFERENCES, explainLevel: room.explain_level }));
    } else if (id === "learn-mode") {
      void write("learn", () => coaching.applyLearn(DEFAULT_LEARN_PREFERENCES));
    } else {
      onUseStandardLevel();
      setLevelNote("Standard is selected in Explanation level above. Choose Apply to save it.");
    }
  }

  function chooseCoach(mode: CoachMode) {
    if (mode === coachNow) { setChoosing(null); return; }
    void write("coach", () => coaching.apply({ ...coaching.applied, coach_mode: mode }));
  }

  function chooseLearn(mode: LearnMode) {
    if (mode === learnNow) { setChoosing(null); return; }
    void write("learn", () => coaching.applyLearn({ mode }));
  }

  return (
    <section className="learnedPrefs" aria-labelledby="learned-prefs-title">
      <div>
        <h3 id="learned-prefs-title" ref={headingRef} tabIndex={-1}>What Studigo has saved for this room</h3>
        <p className={items.length ? "learnedIntro" : "learnedEmpty"}>
          {items.length
            ? "These choices change how Coach and Learn explain things here. You can change or clear any of them."
            : "Nothing saved yet. Studigo is using its standard way of helping here. If you change how Coach or Learn works, it will show up here."}
        </p>
      </div>

      {items.length > 0 && (
        <ul className="learnedList">
          {items.map((item) => (
            <li className="learnedItem" key={item.id}>
              <div>
                <span className="tinyLabel">{item.title}</span>
                <p className="learnedSentence">{item.sentence}</p>
                <small className="learnedMeta">{item.applies} {item.origin}</small>
              </div>
              <div className="learnedActions">
                <button
                  className="ghostButton"
                  type="button"
                  disabled={pending}
                  aria-expanded={item.id === "explanation-level" ? undefined : choosing === item.id}
                  onClick={() => change(item.id)}
                >
                  Change<span className="srOnly"> {item.title}</span>
                </button>
                <button className="ghostButton" type="button" disabled={pending} onClick={() => backToStandard(item.id)}>
                  Back to standard<span className="srOnly"> for {item.title}</span>
                </button>
              </div>
              {item.id === "coach-mode" && choosing === "coach-mode" && (
                <div className="learnedOptions" role="group" aria-label="Choose a Coach mode">
                  {COACH_MODE_OPTIONS.map((option) => (
                    <button key={option.id} className="learnedOption" type="button" disabled={pending} aria-pressed={option.id === coachNow} onClick={() => chooseCoach(option.id)}>
                      <strong>{option.name}</strong>
                      <span>{option.expect}</span>
                    </button>
                  ))}
                </div>
              )}
              {item.id === "learn-mode" && choosing === "learn-mode" && (
                <div className="learnedOptions" role="group" aria-label="Choose a Learn mode">
                  {LEARN_MODE_OPTIONS.map((option) => (
                    <button key={option.id} className="learnedOption" type="button" disabled={pending} aria-pressed={option.id === learnNow} onClick={() => chooseLearn(option.id)}>
                      <strong>{option.name}</strong>
                      <span>{option.expect}</span>
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="formError" role="alert">{error}</p>}
      <p className="learnedStatus" role="status">{status}</p>
    </section>
  );
}
