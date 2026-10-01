import type { SupabaseClient } from "@supabase/supabase-js";
import { compileCoachPreferences, normalizeCoachPreferences, type CoachPreferences } from "./coach-preferences";

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
  compileCoachPreferences(preferences);
  const { explainLevel, ...choices } = preferences;
  const { data, error } = await supabase.from("study_rooms")
    .update({ coach_preferences: choices, explain_level: explainLevel })
    .eq("id", roomId).eq("owner_id", userId)
    .select("coach_preferences, explain_level").maybeSingle();
  if (error) throw new Error("Could not apply your coaching settings. Please retry.");
  if (!data) throw new Error("Study Room not found.");
  return normalizeCoachPreferences(data.coach_preferences, data.explain_level);
}
