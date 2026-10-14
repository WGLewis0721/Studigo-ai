import assert from "node:assert/strict";
import { test } from "node:test";
import { createProcessGate, runMaterialIntake } from "./material-intake";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("C11 later files upload while the first file is still processing", async () => {
  const events: string[] = [];
  const files = ["A", "B", "C"].map((name) => ({ key: name, name }));
  await runMaterialIntake({
    files,
    sourceType: "worksheet",
    upload: async (file, sourceType) => {
      assert.equal(sourceType, "worksheet");
      events.push(`upload-start:${file.name}`);
      if (file.name !== "A") await wait(25);
      events.push(`upload-end:${file.name}`);
      return { id: file.name };
    },
    processOne: async (id) => {
      events.push(`process-start:${id}`);
      if (id === "A") await wait(50);
      events.push(`process-end:${id}`);
    },
    onStage: () => undefined
  });
  const startA = events.indexOf("process-start:A");
  const endA = events.indexOf("process-end:A");
  assert.ok(events.indexOf("upload-end:B") > startA && events.indexOf("upload-end:B") < endA);
  assert.ok(events.indexOf("upload-end:C") > startA && events.indexOf("upload-end:C") < endA);
  assert.ok(endA < events.indexOf("process-start:B"));
  assert.ok(events.indexOf("process-end:B") < events.indexOf("process-start:C"));
});

test("C11 a failed file does not stop the others, and Retry does not run twice", async () => {
  const processed: string[] = [];
  const stages: string[] = [];
  await runMaterialIntake({
    files: ["A", "B", "C"].map((name) => ({ key: name, name })),
    sourceType: "study_guide",
    upload: async (file) => ({ id: file.name }),
    processOne: async (id) => {
      processed.push(id);
      if (id === "A") throw new Error("A failed");
    },
    onStage: (file, stage) => stages.push(`${file.name}:${stage}`)
  });
  assert.deepEqual(processed, ["A", "B", "C"]);
  assert.equal(stages.includes("A:error"), true);
  assert.equal(stages.includes("B:done"), true);
  assert.equal(stages.includes("C:done"), true);
  assert.equal(stages.includes("A:done"), false);

  const gate = createProcessGate();
  let calls = 0;
  const first = gate("doc", async () => {
    calls += 1;
    await wait(20);
  });
  const second = gate("doc", async () => {
    calls += 1;
  });
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});
