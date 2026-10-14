export type OverviewSection = {
  topicId: string;
  title: string;
  status: "supported" | "gap";
  text: string;
  citation: string | null;
};

export function compactExcerpt(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  let out = "";
  for (const word of words) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > 280) break;
    out = next;
  }
  return out;
}

/** One compact cited section per selected topic. This does not generate a lesson. */
export function composeUnitOverview(input: {
  requestedIds: string[];
  roomTopics: Array<{ id: string; title: string }>;
  retrieve: (topic: { id: string; title: string }) => { text: string; citation: string } | null;
}): { ok: true; sections: OverviewSection[]; providerCalls: 0 } | { ok: false; error: string; providerCalls: 0 } {
  if (input.requestedIds.length === 1) return { ok: false, error: "One topic is a lesson, not an overview.", providerCalls: 0 };
  if (input.requestedIds.length < 2 || input.requestedIds.length > 12) {
    return { ok: false, error: "Choose 2 to 12 topics.", providerCalls: 0 };
  }
  const room = new Map(input.roomTopics.map((topic) => [topic.id, topic]));
  if (input.requestedIds.some((id) => !room.has(id))) {
    return { ok: false, error: "Those topics are not in this room.", providerCalls: 0 };
  }
  const sections = input.requestedIds.map((id) => {
    const topic = room.get(id)!;
    const found = input.retrieve(topic);
    if (!found?.text) {
      return { topicId: id, title: topic.title, status: "gap" as const, text: `${topic.title} needs a source in this room.`, citation: null };
    }
    return { topicId: id, title: topic.title, status: "supported" as const, text: compactExcerpt(found.text), citation: found.citation };
  });
  return { ok: true, sections, providerCalls: 0 };
}
