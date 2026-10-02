import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalCoachPreferences, compileCoachPreferences, normalizeCoachPreferences, type CoachPreferences } from "./coach-preferences";
import { normalizeLearnPreferences, type LearnPreferences } from "./learn-preferences";

type RoomPreferenceRow = {
  coach_preferences: unknown;
  learn_preferences: unknown;
  explain_level: "simpler" | "standard" | "deeper";
};

export async function readCoachPreferences(supabase: SupabaseClient, roomId: string) {
  const { data, error } = await supabase.from("study_rooms")
    .select("coach_preferences, learn_preferences, explain_level")
    .eq("id", roomId).maybeSingle();
  if (error) throw new Error("Could not load your coaching settings. Please retry.");
  if (!data) throw new Error("Study Room not found.");
  const row = data as RoomPreferenceRow;
  return normalizeCoachPreferences(row.coach_preferences, row.explain_level);
}

export async function readLearnPreferences(supabase: SupabaseClient, roomId: string) {
  const { data, error } = await supabase.from("study_rooms")
    .select("learn_preferences")
    .eq("id", roomId).maybeSingle();
  if (error) throw new Error("Could not load your Learn settings. Please retry.");
  if (!data) throw new Error("Study Room not found.");
  return normalizeLearnPreferences((data as { learn_preferences: unknown }).learn_preferences);
}

export async function applyCoachPreferences(
  supabase: SupabaseClient,
  roomId: string,
  userId: string,
  preferences: CoachPreferences
) {
  const canonical = canonicalCoachPreferences(preferences);
  compileCoachPreferences(canonical);
  const { style, tradition, practice, coach_mode } = canonical;
  const { data, error } = await supabase.from("study_rooms")
    .update({ coach_preferences: { style, tradition, practice, coach_mode } })
    .eq("id", roomId).eq("owner_id", userId)
    .select("coach_preferences, explain_level").maybeSingle();
  if (error) throw new Error("Could not apply your coaching settings. Please retry.");
  if (!data) throw new Error("Study Room not found.");
  const row = data as Pick<RoomPreferenceRow, "coach_preferences" | "explain_level">;
  return normalizeCoachPreferences(row.coach_preferences, row.explain_level);
}

export async function applyLearnPreferences(
  supabase: SupabaseClient,
  roomId: string,
  userId: string,
  preferences: LearnPreferences
) {
  const normalized = normalizeLearnPreferences(preferences);
  const { data, error } = await supabase.from("study_rooms")
    .update({ learn_preferences: normalized })
    .eq("id", roomId).eq("owner_id", userId)
    .select("learn_preferences").maybeSingle();
  if (error) throw new Error("Could not apply your Learn settings. Please retry.");
  if (!data) throw new Error("Study Room not found.");
  return normalizeLearnPreferences((data as { learn_preferences: unknown }).learn_preferences);
}
