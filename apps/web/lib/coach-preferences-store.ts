import type { SupabaseClient } from "@supabase/supabase-js";
import { isExplainLevel, type ExplainLevel } from "@studigo/learning";
import { canonicalCoachPreferences, compileCoachPreferences, normalizeCoachPreferences, type CoachPreferences } from "./coach-preferences";

export type ResponseSurface = "coach" | "learn";

type RoomPreferenceRow = {
  coach_preferences: unknown;
  explain_level: ExplainLevel;
  coach_explain_level: ExplainLevel | null;
  learn_explain_level: ExplainLevel | null;
};

function effectiveLevel(row: RoomPreferenceRow, surface: ResponseSurface): ExplainLevel {
  return surface === "coach"
    ? row.coach_explain_level ?? row.explain_level
    : row.learn_explain_level ?? row.explain_level;
}

export async function readCoachPreferences(supabase: SupabaseClient, roomId: string, surface: ResponseSurface = "coach") {
  const { data, error } = await supabase.from("study_rooms")
    .select("coach_preferences, explain_level, coach_explain_level, learn_explain_level")
    .eq("id", roomId).maybeSingle();
  if (error) throw new Error("Could not load your coaching settings. Please retry.");
  if (!data) throw new Error("Study Room not found.");
  const row = data as RoomPreferenceRow;
  return normalizeCoachPreferences(row.coach_preferences, effectiveLevel(row, surface));
}

export async function applyCoachPreferences(
  supabase: SupabaseClient,
  roomId: string,
  userId: string,
  preferences: CoachPreferences,
  applyToBoth = false
) {
  const canonical = canonicalCoachPreferences(preferences);
  compileCoachPreferences(canonical);
  const { style, tradition, practice, coach_mode } = canonical;
  const update: Record<string, unknown> = {
    coach_preferences: { style, tradition, practice, coach_mode },
    coach_explain_level: canonical.explainLevel
  };
  if (applyToBoth) {
    update.learn_explain_level = canonical.explainLevel;
    update.explain_level = canonical.explainLevel;
  }
  const { data, error } = await supabase.from("study_rooms")
    .update(update)
    .eq("id", roomId).eq("owner_id", userId)
    .select("coach_preferences, explain_level, coach_explain_level, learn_explain_level").maybeSingle();
  if (error) throw new Error("Could not apply your coaching settings. Please retry.");
  if (!data) throw new Error("Study Room not found.");
  const row = data as RoomPreferenceRow;
  return {
    preferences: normalizeCoachPreferences(row.coach_preferences, effectiveLevel(row, "coach")),
    learnExplainLevel: effectiveLevel(row, "learn")
  };
}

export async function applyLearnPreferences(
  supabase: SupabaseClient,
  roomId: string,
  userId: string,
  explainLevel: ExplainLevel,
  applyToBoth = false
) {
  if (!isExplainLevel(explainLevel)) throw new Error("Choose a valid explanation level.");
  const update: Record<string, unknown> = { learn_explain_level: explainLevel };
  if (applyToBoth) {
    update.coach_explain_level = explainLevel;
    update.explain_level = explainLevel;
  }
  const { data, error } = await supabase.from("study_rooms")
    .update(update)
    .eq("id", roomId).eq("owner_id", userId)
    .select("coach_preferences, explain_level, coach_explain_level, learn_explain_level").maybeSingle();
  if (error) throw new Error("Could not apply your Learn settings. Please retry.");
  if (!data) throw new Error("Study Room not found.");
  const row = data as RoomPreferenceRow;
  return {
    learnExplainLevel: effectiveLevel(row, "learn"),
    coachPreferences: normalizeCoachPreferences(row.coach_preferences, effectiveLevel(row, "coach"))
  };
}
