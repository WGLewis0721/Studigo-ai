import {
  editionKey,
  generateGroundedEdition,
  type GuideBuildResult,
  type GuideSourceBlock,
  type StudyGuideContent
} from "@studigo/ai";

export type GuideEditionStore = {
  get(key: string): Promise<StudyGuideContent | null>;
  put(key: string, content: StudyGuideContent): Promise<StudyGuideContent>;
};

const inflight = new Map<string, Promise<GuideBuildResult & { reused?: boolean }>>();

export async function buildPersistedEdition(input: {
  roomId: string;
  level: string;
  topicIds: string[];
  blocks: GuideSourceBlock[];
  store: GuideEditionStore;
  generate?: Parameters<typeof generateGroundedEdition>[0]["generate"];
}): Promise<GuideBuildResult & { reused?: boolean }> {
  const key = editionKey(input);
  const pending = inflight.get(key);
  if (pending) return pending;
  const work = (async () => {
    const saved = await input.store.get(key);
    if (saved) return { status: "ready" as const, content: saved, reused: true };
    const built = await generateGroundedEdition(input);
    if (built.status !== "ready") return built;
    const stored = await input.store.put(key, built.content);
    return { status: "ready" as const, content: stored, reused: false };
  })().finally(() => inflight.delete(key));
  inflight.set(key, work);
  return work;
}
