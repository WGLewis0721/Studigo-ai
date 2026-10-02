import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalCoachPreferences, compileCoachPreferences, normalizeCoachPreferences, type CoachPreferences } from "./coach-preferences";

export async function readCoachPreferences(supabase: SupabaseClient, roomId: string) {
  const { data, error } = await supabase.from("study_rooms")
    .select("coach_preferences, explain_level").eq("id", roomId).maybeSingle();
  if (error) throw new Error("Could not load your coaching settings. Please retry.");
  if (!data) throw new Error("Study Room not found.");
  return normalizeCoachPreferences(data.coach_preferences, data.explain_level);
}

export async function applyCoachPreferences(supabase: SupabaseClient, roomId: string, userId: string, preferences: CoachPreferences) {
  // Compile before committing. Returning the actual saved row prevents an RLS
  // zero-row update from being presented as a successful Apply.
  const canonical = canonicalCoachPreferences(preferences);
  compileCoachPreferences(canonical);
  // Explanation level is a room setting (Room Settings); Coach setup never writes it.
  // Legacy fields stay only to satisfy the current DB constraint. Their values are
  // canonicalized from the V3 mode so hidden historical choices cannot keep steering replies.
  const { style, tradition, practice, coach_mode } = canonical;
  const { data, error } = await supabase.from("study_rooms")
    .update({ coach_preferences: { style, tradition, practice, coach_mode } })
    .eq("id", roomId).eq("owner_id", userId)
    .select("coach_preferences, explain_level").maybeSingle();
  if (error) throw new Error("Could not apply your coaching settings. Please retry.");
  if (!data) throw new Error("Study Room not found.");
  return normalizeCoachPreferences(data.coach_preferences, data.explain_level);
}
