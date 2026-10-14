import assert from "node:assert/strict";
import test from "node:test";
import { createBoundedUploadQueue, enqueueUploadBatch } from "./materials-upload-queue";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve));

test("overlapping file selections share three upload slots and keep each batch's source type", async () => {
  const queue = createBoundedUploadQueue(3);
  const gates = new Map(["A", "B", "C", "D", "E"].map((id) => [id, deferred()]));
  const started: Array<{ id: string; sourceType: string }> = [];
  let active = 0;
  let peak = 0;

  function select(ids: string[], sourceType: string) {
    enqueueUploadBatch(queue, ids, sourceType, async (id, batchSourceType) => {
      active += 1;
      peak = Math.max(peak, active);
      started.push({ id, sourceType: batchSourceType });
      try {
        await gates.get(id)!.promise;
      } finally {
        active -= 1;
      }
    });
  }

  select(["A", "B", "C"], "study_guide");
  select(["D", "E"], "notes");
  await nextTurn();
  assert.deepEqual(started.map(({ id }) => id), ["A", "B", "C"]);
  assert.equal(active, 3);

  gates.get("B")!.resolve();
  await nextTurn();
  assert.deepEqual(started.map(({ id }) => id), ["A", "B", "C", "D"]);
  assert.equal(active, 3);

  gates.get("A")!.reject(new Error("Upload A failed"));
  await nextTurn();
  assert.deepEqual(started.map(({ id }) => id), ["A", "B", "C", "D", "E"]);
  assert.equal(peak, 3);
  assert.deepEqual(started.map(({ sourceType }) => sourceType), [
    "study_guide", "study_guide", "study_guide", "notes", "notes"
  ]);

  gates.get("C")!.resolve();
  gates.get("D")!.resolve();
  gates.get("E")!.resolve();
  await nextTurn();
  assert.equal(active, 0);
});
