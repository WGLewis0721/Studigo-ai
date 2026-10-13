/** What a Study Room is called until the learner names it or the first study guide does. */
export const DEFAULT_ROOM_TITLE = "My Study Room";

const MAX_INFERRED_TITLE = 60;

/** Topic titles come from an uploaded file, so they are data: reduced to short plain text before they become a title. */
function plainLabel(value: string) {
  return value
    .replace(/\p{C}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:[-•*]\s+|\d+[.)]\s+)/, "")
    .replace(/[\s.:;,]+$/, "");
}

function clip(value: string) {
  if (value.length <= MAX_INFERRED_TITLE) return value;
  const cut = value.slice(0, MAX_INFERRED_TITLE - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 20 ? cut.slice(0, space) : cut).trimEnd()}…`;
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
    .filter((label) => label && label.toLowerCase() !== DEFAULT_ROOM_TITLE.toLowerCase());

  const first = labels[0];
  if (!first) return null;
  const second = labels.find((label) => label.toLowerCase() !== first.toLowerCase());
  const pair = second ? `${first}, ${second}` : first;
  return clip(pair.length <= MAX_INFERRED_TITLE ? pair : first);
}
