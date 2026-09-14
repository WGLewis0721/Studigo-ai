import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExplainLevel } from "@studigo/ai";

const LEVELS = new Set<ExplainLevel>(["simpler", "standard", "deeper"]);

/**
 * The room's chosen explanation level. It changes how an idea is pitched, never
 * which facts are cited, so an unreadable value simply falls back to standard.
 */
export async function readExplainLevel(
  supabase: SupabaseClient,
  roomId: string
): Promise<ExplainLevel> {
  const { data } = await supabase
    .from("study_rooms")
    .select("explain_level")
    .eq("id", roomId)
    .maybeSingle();

  const level = data?.explain_level as ExplainLevel | undefined;
  return level && LEVELS.has(level) ? level : "standard";
}
