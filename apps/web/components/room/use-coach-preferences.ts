"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { compileCoachPreferences, normalizeCoachPreferences, type CoachPreferences } from "@/lib/coach-preferences";
import { DEFAULT_LEARN_PREFERENCES, normalizeLearnPreferences, type LearnPreferences } from "@/lib/learn-preferences";
import type { StudyRoom } from "@/lib/rooms";

export function useCoachPreferences(room: StudyRoom) {
  const [applied, setApplied] = useState(() => normalizeCoachPreferences(room.coach_preferences, room.explain_level));
  const [learnApplied, setLearnApplied] = useState<LearnPreferences>(() => normalizeLearnPreferences(room.learn_preferences));
  const [applying, setApplying] = useState(false);
  const [learnApplying, setLearnApplying] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [learnStatus, setLearnStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [learnError, setLearnError] = useState<string | null>(null);
  const applyingRef = useRef(false);
  const learnApplyingRef = useRef(false);

  useEffect(() => {
    setApplied(normalizeCoachPreferences(room.coach_preferences, room.explain_level));
    setLearnApplied(normalizeLearnPreferences(room.learn_preferences));
  }, [room.id, room.explain_level, room.coach_preferences, room.learn_preferences]);

  useEffect(() => {
    if (room.id !== "fixture") return;
    try {
      const savedCoach = JSON.parse(localStorage.getItem("studigo:fixture:coach") ?? "null");
      const savedLearn = JSON.parse(localStorage.getItem("studigo:fixture:learn") ?? "null");
      if (savedCoach) setApplied(normalizeCoachPreferences(savedCoach, room.explain_level));
      if (savedLearn) setLearnApplied(normalizeLearnPreferences(savedLearn));
    } catch {
      setLearnApplied(DEFAULT_LEARN_PREFERENCES);
    }
  }, [room.id, room.explain_level]);

  const apply = useCallback(async (draft: CoachPreferences) => {
    if (applyingRef.current) return false;
    applyingRef.current = true;
    setApplying(true); setError(null); setStatus("Recalibrating Coach…");
    try {
      let saved = { ...draft, explainLevel: room.explain_level };
      if (room.id === "fixture") {
        compileCoachPreferences(saved);
        localStorage.setItem("studigo:fixture:coach", JSON.stringify(saved));
      } else {
        const response = await fetch("/api/coach/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: room.id, preferences: saved })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not apply your settings.");
        saved = result.preferences;
      }
      setApplied(saved);
      setStatus("Applied to Coach. Coach will recalibrate from the next reply.");
      return true;
    } catch (cause) {
      setStatus(null);
      setError(cause instanceof Error ? cause.message : "Could not apply your settings. Please retry.");
      return false;
    } finally {
      applyingRef.current = false; setApplying(false);
    }
  }, [room.id, room.explain_level]);

  const applyLearn = useCallback(async (preferences: LearnPreferences) => {
    if (learnApplyingRef.current) return false;
    learnApplyingRef.current = true;
    setLearnApplying(true); setLearnError(null); setLearnStatus("Recalibrating Learn…");
    try {
      let saved = normalizeLearnPreferences(preferences);
      if (room.id === "fixture") {
        localStorage.setItem("studigo:fixture:learn", JSON.stringify(saved));
      } else {
        const response = await fetch("/api/learn/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: room.id, preferences: saved })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not apply your Learn settings.");
        saved = result.preferences;
      }
      setLearnApplied(saved);
      setLearnStatus("Applied to Learn. Learn will recalibrate from the next reply.");
      return true;
    } catch (cause) {
      setLearnStatus(null);
      setLearnError(cause instanceof Error ? cause.message : "Could not apply your Learn settings. Please retry.");
      return false;
    } finally {
      learnApplyingRef.current = false; setLearnApplying(false);
    }
  }, [room.id]);

  return {
    applied, applying, status, error, apply,
    learnApplied, learnApplying, learnStatus, learnError, applyLearn
  };
}
