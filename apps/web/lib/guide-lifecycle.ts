export type CorpusFile = {
  id: string;
  revision: number;
  status: "ready" | "processing" | "partial" | "queued" | "uploaded" | "failed";
};

export type GuideHold = {
  readingKey: string | null;
  readingSnapshot: string | null;
  candidateKey: string | null;
  candidateSnapshot: string | null;
  updateAvailable: boolean;
  notice: string | null;
};

export function emptyGuideHold(): GuideHold {
  return {
    readingKey: null,
    readingSnapshot: null,
    candidateKey: null,
    candidateSnapshot: null,
    updateAvailable: false,
    notice: null
  };
}

export function corpusSnapshot(files: CorpusFile[]) {
  return files
    .filter((file) => file.status === "ready" || file.status === "partial")
    .map((file) => `${file.id}@${file.revision}`)
    .sort()
    .join("|");
}

export function describeCorpus(files: CorpusFile[]) {
  if (!files.length) return { state: "empty" as const, notice: "Add a file to build a guide." };
  if (files.some((file) => file.status === "processing" || file.status === "queued" || file.status === "uploaded")) {
    return { state: "processing" as const, notice: "Still reading selected files." };
  }
  if (files.some((file) => file.status === "partial")) {
    return { state: "partial" as const, notice: "Some pages are unreadable. Wait, or build from the readable pages." };
  }
  if (files.some((file) => file.status === "failed")) {
    return { state: "failed" as const, notice: "A file needs attention before the guide can be built." };
  }
  return { state: "ready" as const, notice: "Current files are ready." };
}

export function planGuideBuild(input: {
  files: CorpusFile[];
  hold: GuideHold;
  allowLimited?: boolean;
  reason?: "materials" | "typography";
}) {
  if (input.reason === "typography") {
    return { action: "none" as const, snapshot: null, hold: input.hold };
  }
  const corpus = describeCorpus(input.files);
  if (corpus.state === "processing" || corpus.state === "empty" || corpus.state === "failed") {
    return { action: "wait" as const, snapshot: null, hold: { ...input.hold, notice: corpus.notice } };
  }
  if (corpus.state === "partial" && !input.allowLimited) {
    return { action: "wait" as const, snapshot: null, hold: { ...input.hold, notice: corpus.notice } };
  }
  const snapshot = corpusSnapshot(input.files.filter((file) => file.status === "ready" || (input.allowLimited && file.status === "partial")));
  if (!snapshot) return { action: "wait" as const, snapshot: null, hold: { ...input.hold, notice: corpus.notice } };
  if (!input.hold.readingKey) {
    return {
      action: "build" as const,
      snapshot,
      hold: { ...input.hold, notice: "Building the first guide." }
    };
  }
  if (input.hold.readingSnapshot === snapshot) {
    return { action: "none" as const, snapshot, hold: { ...input.hold, updateAvailable: false, notice: null } };
  }
  return {
    action: "build" as const,
    snapshot,
    hold: { ...input.hold, updateAvailable: true, notice: "Update available. You are still reading the current guide." }
  };
}

export function acceptCandidate(hold: GuideHold, snapshot: string, key: string, matches: boolean): GuideHold {
  if (!matches) {
    return { ...hold, notice: "That build is outdated. It was not published.", updateAvailable: hold.readingSnapshot !== snapshot };
  }
  if (!hold.readingKey) {
    return { ...hold, readingKey: key, readingSnapshot: snapshot, updateAvailable: false, notice: null };
  }
  return {
    ...hold,
    candidateKey: key,
    candidateSnapshot: snapshot,
    updateAvailable: true,
    notice: "Update available. You are still reading the current guide."
  };
}

export function switchToCandidate(hold: GuideHold): GuideHold {
  if (!hold.candidateKey) return hold;
  return {
    ...hold,
    readingKey: hold.candidateKey,
    readingSnapshot: hold.candidateSnapshot,
    candidateKey: null,
    candidateSnapshot: null,
    updateAvailable: false,
    notice: null
  };
}

export function keepEditionAfterFailure(hold: GuideHold): GuideHold {
  return { ...hold, notice: "The guide could not be updated. The edition you are reading is unchanged." };
}

const builds = new Map<string, Promise<string>>();

export function dedupedBuild(snapshot: string, build: () => Promise<string>) {
  const existing = builds.get(snapshot);
  if (existing) return existing;
  const pending = build().finally(() => builds.delete(snapshot));
  builds.set(snapshot, pending);
  return pending;
}
