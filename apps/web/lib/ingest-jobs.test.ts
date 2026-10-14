import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceIngestJob, runIngestPass, type RunnerJob } from "./ingest-jobs";

const job = (): RunnerJob => ({
  id: "job-1",
  stage: "queued",
  checkpoint: { completed: [] },
  lease: null,
  attempts: 0,
  maxAttempts: 3,
  published: false
});

test("C14 a restarted worker continues after extract and does not repeat it", async () => {
  const calls: string[] = [];
  const run = async (_job: RunnerJob, stage: string) => {
    calls.push(stage);
  };
  const first = await advanceIngestJob({ checkpoint: { completed: [] }, run: (stage) => run(job(), stage) });
  assert.deepEqual(first.checkpoint.completed, ["extract"]);
  const second = await advanceIngestJob({ checkpoint: first.checkpoint, run: (stage) => run(job(), stage) });
  assert.deepEqual(calls, ["extract", "ocr"]);
  assert.deepEqual(second.checkpoint.completed, ["extract", "ocr"]);
});

test("C14 two workers publish one revision", async () => {
  const leases = new Map<string, number>();
  let publishes = 0;
  const run = async (_job: RunnerJob, stage: string) => {
    if (stage === "publish") publishes += 1;
  };
  const started = await runIngestPass({
    jobs: [{ ...job(), checkpoint: { completed: ["extract", "ocr", "embed"] } }],
    worker: "worker-a",
    now: 10,
    leases,
    run
  });
  assert.equal(started[0].published, true);
  const raced = await runIngestPass({
    jobs: [{ ...started[0], lease: "worker-a", published: true, stage: "running" }],
    worker: "worker-b",
    now: 10,
    leases,
    run
  });
  assert.equal(publishes, 1);
  assert.equal(raced[0].published, true);
  assert.equal(raced[0].lease, "worker-a");
});
