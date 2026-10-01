"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { compileCoachPreferences, normalizeCoachPreferences, type CoachPreferences } from "@/lib/coach-preferences";
import type { StudyRoom } from "@/lib/rooms";

export function useCoachPreferences(room: StudyRoom) {
  const [applied, setApplied] = useState(() => normalizeCoachPreferences(room.coach_preferences, room.explain_level));
  const [applying, setApplying] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const applyingRef = useRef(false);
  useEffect(() => {
    setApplied(normalizeCoachPreferences(room.coach_preferences, room.explain_level));
  }, [room.id, room.explain_level, room.coach_preferences]);
  useEffect(() => {
    if (room.id !== "fixture") return;
    try {
      const saved = JSON.parse(localStorage.getItem("studigo:fixture:coach") ?? "null");
      if (saved) setApplied(normalizeCoachPreferences(saved, saved.explainLevel));
    } catch { /* Demo storage is optional. Production uses the room row. */ }
  }, [room.id]);

  const apply = useCallback(async (draft: CoachPreferences) => {
    if (applyingRef.current) return false;
    applyingRef.current = true;
    setApplying(true); setError(null); setStatus("Recalibrating Studigo…");
    try {
      let saved = draft;
      if (room.id === "fixture") {
        compileCoachPreferences(draft);
        localStorage.setItem("studigo:fixture:coach", JSON.stringify(draft));
      } else {
        const response = await fetch("/api/coach/preferences", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: room.id, preferences: draft })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not apply your settings.");
        saved = result.preferences;
      }
      setApplied(saved);
      setStatus("Applied. Studigo will use your settings from the next reply.");
      return true;
    } catch (cause) {
      setStatus(null);
      setError(cause instanceof Error ? cause.message : "Could not apply your settings. Please retry.");
      return false;
    } finally {
      applyingRef.current = false; setApplying(false);
    }
  }, [room.id]);
  return { applied, applying, status, error, apply };
}
