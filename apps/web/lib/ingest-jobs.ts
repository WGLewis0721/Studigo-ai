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

export type RunnerJob = {
  id: string;
  stage: "queued" | "running" | "complete" | "failed";
  checkpoint: IngestCheckpoint;
  lease: string | null;
  attempts: number;
  maxAttempts: number;
  published: boolean;
};

/** One worker pass. A live lease owned by someone else is left alone. */
export async function runIngestPass(input: {
  jobs: RunnerJob[];
  worker: string;
  now?: number;
  leases?: Map<string, number>;
  run: (job: RunnerJob, stage: IngestStageName) => Promise<void>;
}): Promise<RunnerJob[]> {
  const leases = input.leases ?? new Map<string, number>();
  const now = input.now ?? Date.now();
  return Promise.all(input.jobs.map(async (job) => {
    if (job.stage === "complete" || job.stage === "failed") return job;
    const heldUntil = job.lease ? leases.get(job.lease) ?? 0 : 0;
    if (job.lease && job.lease !== input.worker && heldUntil > now) return job;
    if (job.attempts >= job.maxAttempts && job.stage !== "queued") {
      return { ...job, stage: "failed" as const, lease: null };
    }
    const step = await advanceIngestJob({
      checkpoint: job.checkpoint,
      alreadyPublished: job.published,
      run: (stage) => input.run(job, stage)
    });
    const published = job.published || step.published;
    const finished = step.checkpoint.completed.includes("publish");
    if (step.published) leases.set(input.worker, now + 1);
    return {
      ...job,
      checkpoint: step.checkpoint,
      stage: finished ? "complete" as const : "running" as const,
      lease: finished ? null : input.worker,
      attempts: job.attempts + (step.yielded ? 1 : 0),
      published
    };
  }));
}
