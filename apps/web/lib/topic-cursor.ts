export type NextTopic =
  | { status: "advanced"; topicId: string; index: number }
  | { status: "last"; topicId: string; index: number }
  | { status: "choose_more" }
  | { status: "removed"; topicId: string };

export function nextTopic(input: { orderedIds: string[]; index: number; knownIds: string[] }): NextTopic {
  if (input.orderedIds.length <= 1) return { status: "choose_more" };
  const current = input.orderedIds[input.index];
  if (!current || !input.knownIds.includes(current)) return { status: "removed", topicId: current ?? "" };
  if (input.index >= input.orderedIds.length - 1) return { status: "last", topicId: current, index: input.index };
  const index = input.index + 1;
  return { status: "advanced", topicId: input.orderedIds[index], index };
}

export function activeTopicId(orderedIds: string[], index: number): string | null {
  return orderedIds[index] ?? orderedIds[0] ?? null;
}

/** Leaving a challenge records nothing. Mastery is unchanged either way. */
export function leavePendingChallenge(input: { pending: boolean; confirmed: boolean; mastery: number }) {
  if (input.pending && !input.confirmed) return { mastery: input.mastery, graded: false, advanced: false };
  return { mastery: input.mastery, graded: false, advanced: true };
}
