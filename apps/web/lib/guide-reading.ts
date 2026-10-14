import type { SupabaseClient } from "@supabase/supabase-js";
import { chooseReadingEdition } from "@/lib/source-freshness";

export type LoadedGuideEdition = {
  content: unknown;
  updateAvailable: boolean;
};

/** The open edition stays put. A newer stored edition only raises update available. */
export async function loadReadingGuideEdition(
  supabase: SupabaseClient,
  roomId: string
): Promise<LoadedGuideEdition | { error: string }> {
  const pinned = await supabase.from("study_rooms").select("reading_edition_key").eq("id", roomId).maybeSingle();
  const editions = await supabase
    .from("guide_editions")
    .select("edition_key, content, stale, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });
  if (editions.error) return { error: editions.error.message };
  const rows = (editions.data ?? []) as Array<{ edition_key: string; content: unknown; stale?: boolean | null }>;
  const pinMissing = Boolean(pinned.error) || pinned.data == null || !("reading_edition_key" in pinned.data);
  if (pinMissing) return { content: rows[0]?.content ?? null, updateAvailable: false };
  const readingKey = (pinned.data as { reading_edition_key?: string | null }).reading_edition_key ?? null;
  if (!readingKey) return { content: rows[0]?.content ?? null, updateAvailable: false };
  const chosen = chooseReadingEdition(readingKey, rows.map((row) => ({
    key: row.edition_key,
    content: row.content,
    stale: Boolean(row.stale)
  })));
  if (!chosen) return { content: null, updateAvailable: rows.length > 0 };
  const updateAvailable = Boolean(chosen.stale) || rows.some((row) => row.edition_key !== readingKey);
  return { content: chosen.content, updateAvailable };
}
