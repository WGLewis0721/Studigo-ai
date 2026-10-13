import type { SupabaseClient } from "@supabase/supabase-js";

/** What a Study Room is called until the learner names it or the first study guide does. */
export const DEFAULT_ROOM_TITLE = "My Study Room";

const MAX_INFERRED_TITLE = 60;

/** A title the learner typed wins; the default only fills in when nothing (or only spaces) was typed. */
export function roomTitleOrDefault(typed: string | null | undefined): string {
  return typed?.trim() || DEFAULT_ROOM_TITLE;
}

const length = (value: string) => Array.from(value).length;

/** Topic titles come from an uploaded file, so they are data: reduced to short plain text before they become a title. */
function plainLabel(value: string) {
  return value
    .replace(/<\/?[a-z!?][^>]*(?:>|$)/gi, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\bhttps?:\/\/\S+/gi, " ")
    .replace(/[<>*`~]/g, " ")
    .replace(/\p{C}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:#+\s*|[-•]\s+|\d+[.)]\s+)/, "")
    .replace(/[\s.:;,]+$/, "");
}

function clip(value: string) {
  if (length(value) <= MAX_INFERRED_TITLE) return value;
  const cut = Array.from(value).slice(0, MAX_INFERRED_TITLE - 1).join("");
  const space = cut.lastIndexOf(" ");
  return `${(space > 20 ? cut.slice(0, space) : cut).replace(/[\s.:;,]+$/, "")}…`;
}

/**
 * A starting name for a room, from the two most testable topics the first
 * study guide produced. Null when nothing usable came out, so the room keeps
 * its default. It is only a suggestion: the learner renames it in room settings.
 */
export function inferRoomTitle(topics: ReadonlyArray<{ title: string; priority: number }>): string | null {
  const labels = [...topics]
    .sort((a, b) => b.priority - a.priority)
    .map((topic) => plainLabel(topic.title))
    .filter((label) => /[\p{L}\p{N}]/u.test(label) && label.toLowerCase() !== DEFAULT_ROOM_TITLE.toLowerCase());

  const first = labels[0];
  if (!first) return null;
  const second = labels.find((label) => label.toLowerCase() !== first.toLowerCase());
  const pair = second ? `${first}, ${second}` : first;
  return clip(length(pair) <= MAX_INFERRED_TITLE ? pair : first);
}

/**
 * Names a room that still wears the default title with no subject, from the
 * topics just extracted. The guard is part of the UPDATE, not a prior read, so
 * a title or subject the learner typed, even a moment ago, is never overwritten.
 *
 * Authorization is the caller's: `roomId` and `ownerId` must come from a row
 * already proven to belong to that owner (ingest takes them from the owner-scoped
 * document row), and the write is scoped to both again here.
 */
export async function nameRoomFromTopics(
  db: Pick<SupabaseClient, "from">,
  args: { roomId: string; ownerId: string; topics: ReadonlyArray<{ title: string; priority: number }> }
): Promise<void> {
  const title = inferRoomTitle(args.topics);
  if (!title) return;
  await db
    .from("study_rooms")
    .update({ title })
    .eq("id", args.roomId)
    .eq("owner_id", args.ownerId)
    .eq("title", DEFAULT_ROOM_TITLE)
    .is("subject", null);
}
