"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { compileCoachPreferences, normalizeCoachPreferences, type CoachPreferences } from "@/lib/coach-preferences";
import type { StudyRoom } from "@/lib/rooms";
import type { ExplainLevel } from "@studigo/learning";

export function useCoachPreferences(room: StudyRoom) {
  const coachLevel = room.coach_explain_level ?? room.explain_level;
  const learnInitial = room.learn_explain_level ?? room.explain_level;
  const [applied, setApplied] = useState(() => normalizeCoachPreferences(room.coach_preferences, coachLevel));
  const [learnLevel, setLearnLevel] = useState<ExplainLevel>(learnInitial);
  const [applying, setApplying] = useState(false);
  const [learnApplying, setLearnApplying] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [learnStatus, setLearnStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [learnError, setLearnError] = useState<string | null>(null);
  const applyingRef = useRef(false);
  const learnApplyingRef = useRef(false);

  useEffect(() => {
    setApplied(normalizeCoachPreferences(room.coach_preferences, room.coach_explain_level ?? room.explain_level));
    setLearnLevel(room.learn_explain_level ?? room.explain_level);
  }, [room.id, room.explain_level, room.coach_explain_level, room.learn_explain_level, room.coach_preferences]);

  useEffect(() => {
    if (room.id !== "fixture") return;
    try {
      const saved = JSON.parse(localStorage.getItem("studigo:fixture:coach") ?? "null");
      const savedLearn = localStorage.getItem("studigo:fixture:learn-level");
      if (saved) setApplied(normalizeCoachPreferences(saved, saved.explainLevel));
      if (savedLearn === "simpler" || savedLearn === "standard" || savedLearn === "deeper") setLearnLevel(savedLearn);
    } catch { /* Demo storage is optional. Production uses the room row. */ }
  }, [room.id]);

  const apply = useCallback(async (draft: CoachPreferences, applyToBoth = false) => {
    if (applyingRef.current) return false;
    applyingRef.current = true;
    setApplying(true); setError(null); setStatus("Recalibrating Coach…");
    try {
      let saved = draft;
      let nextLearn = learnLevel;
      if (room.id === "fixture") {
        compileCoachPreferences(draft);
        localStorage.setItem("studigo:fixture:coach", JSON.stringify(draft));
        if (applyToBoth) {
          localStorage.setItem("studigo:fixture:learn-level", draft.explainLevel);
          nextLearn = draft.explainLevel;
        }
      } else {
        const response = await fetch("/api/coach/preferences", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: room.id, preferences: draft, applyToBoth })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not apply your settings.");
        saved = result.preferences;
        nextLearn = result.learnExplainLevel ?? nextLearn;
      }
      setApplied(saved);
      if (applyToBoth) setLearnLevel(nextLearn);
      setStatus(applyToBoth
        ? "Applied to Coach and Learn. Both will recalibrate from the next reply."
        : "Applied to Coach. Coach will recalibrate from the next reply.");
      return true;
    } catch (cause) {
      setStatus(null);
      setError(cause instanceof Error ? cause.message : "Could not apply your settings. Please retry.");
      return false;
    } finally {
      applyingRef.current = false; setApplying(false);
    }
  }, [room.id, learnLevel]);

  const applyLearn = useCallback(async (level: ExplainLevel, applyToBoth = false) => {
    if (learnApplyingRef.current) return false;
    learnApplyingRef.current = true;
    setLearnApplying(true); setLearnError(null); setLearnStatus("Recalibrating Learn…");
    try {
      let nextCoach = applied;
      if (room.id === "fixture") {
        localStorage.setItem("studigo:fixture:learn-level", level);
        if (applyToBoth) {
          nextCoach = { ...applied, explainLevel: level };
          localStorage.setItem("studigo:fixture:coach", JSON.stringify(nextCoach));
        }
      } else {
        const response = await fetch("/api/learn/preferences", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: room.id, explainLevel: level, applyToBoth })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not apply your Learn settings.");
        nextCoach = result.coachPreferences ?? nextCoach;
      }
      setLearnLevel(level);
      if (applyToBoth) setApplied(nextCoach);
      setLearnStatus(applyToBoth
        ? "Applied to Learn and Coach. Both will recalibrate from the next reply."
        : "Applied to Learn. Learn will recalibrate from the next reply.");
      return true;
    } catch (cause) {
      setLearnStatus(null);
      setLearnError(cause instanceof Error ? cause.message : "Could not apply your Learn settings. Please retry.");
      return false;
    } finally {
      learnApplyingRef.current = false; setLearnApplying(false);
    }
  }, [room.id, applied]);

  return {
    applied, applying, status, error, apply,
    learnLevel, learnApplying, learnStatus, learnError, applyLearn
  };
}
