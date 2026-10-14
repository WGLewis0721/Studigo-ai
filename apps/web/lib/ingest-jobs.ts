/** Off unless an operator turns it on together with the C14 runner. */
export function durableIngestEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.STUDIGO_DURABLE_INGEST === "1";
}

export function visibleIngestStage(stage: string): "queued" | "processing" | "done" | "error" {
  if (stage === "complete") return "done";
  if (stage === "failed") return "error";
  if (stage === "running") return "processing";
  return "queued";
}

export type IngestCheckpoint = {
  completed: string[];
  revision?: number;
};

export const INGEST_STAGES = ["extract", "ocr", "embed", "publish"] as const;
export type IngestStageName = (typeof INGEST_STAGES)[number];

/**
 * Runs at most one unfinished stage, then returns. A restart continues from
 * the checkpoint and does not repeat a completed stage.
 */
export async function advanceIngestJob(input: {
  checkpoint: IngestCheckpoint;
  run: (stage: IngestStageName) => Promise<void>;
  alreadyPublished?: boolean;
}): Promise<{ checkpoint: IngestCheckpoint; yielded: boolean; published: boolean }> {
  const completed = new Set(input.checkpoint.completed);
  if (input.alreadyPublished && completed.has("publish")) {
    return { checkpoint: { ...input.checkpoint, completed: [...completed] }, yielded: false, published: true };
  }
  const next = INGEST_STAGES.find((stage) => !completed.has(stage));
  if (!next) {
    return { checkpoint: input.checkpoint, yielded: false, published: completed.has("publish") };
  }
  await input.run(next);
  completed.add(next);
  return {
    checkpoint: { ...input.checkpoint, completed: INGEST_STAGES.filter((stage) => completed.has(stage)) },
    yielded: true,
    published: next === "publish"
  };
}
