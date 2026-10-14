import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptCandidate,
  corpusSnapshot,
  dedupedBuild,
  emptyGuideHold,
  keepEditionAfterFailure,
  planGuideBuild,
  type CorpusFile
} from "./guide-lifecycle";

const file = (id: string, revision: number, status: CorpusFile["status"]): CorpusFile => ({ id, revision, status });

test("C16 three ready files become one edition and a newer file does not replace it", () => {
  const hold = emptyGuideHold();
  const waiting = planGuideBuild({
    files: [file("A", 1, "ready"), file("B", 1, "ready"), file("C", 1, "processing")],
    hold
  });
  assert.equal(waiting.action, "wait");
  assert.match(waiting.hold.notice ?? "", /Still reading/);
  assert.equal(waiting.hold.readingKey, null);

  const ready = planGuideBuild({
    files: [file("A", 1, "ready"), file("B", 1, "ready"), file("C", 1, "ready")],
    hold: waiting.hold
  });
  assert.equal(ready.action, "build");
  const snapshot = corpusSnapshot([file("A", 1, "ready"), file("B", 1, "ready"), file("C", 1, "ready")]);
  const published = acceptCandidate(ready.hold, snapshot, "edition-1", true);
  assert.equal(published.readingKey, "edition-1");
  assert.equal(published.updateAvailable, false);

  const changed = planGuideBuild({
    files: [file("A", 1, "ready"), file("B", 2, "ready"), file("C", 1, "ready")],
    hold: published
  });
  assert.equal(changed.action, "build");
  assert.equal(changed.hold.readingKey, "edition-1");
  assert.equal(changed.hold.updateAvailable, true);
  const candidate = acceptCandidate(changed.hold, changed.snapshot!, "edition-2", true);
  assert.equal(candidate.readingKey, "edition-1");
  assert.equal(candidate.candidateKey, "edition-2");
});

test("C16 a stale or failed build keeps the current edition and runs once", async () => {
  const snapshot = corpusSnapshot([file("A", 1, "ready"), file("B", 1, "ready"), file("C", 1, "ready")]);
  const reading = acceptCandidate(emptyGuideHold(), snapshot, "edition-1", true);
  const stale = acceptCandidate(reading, "A@2|B@1|C@1", "edition-stale", false);
  assert.equal(stale.readingKey, "edition-1");
  assert.match(stale.notice ?? "", /outdated/);

  const failed = keepEditionAfterFailure(reading);
  assert.equal(failed.readingKey, "edition-1");
  assert.match(failed.notice ?? "", /unchanged/);

  const style = planGuideBuild({ files: [file("A", 1, "ready")], hold: reading, reason: "typography" });
  assert.equal(style.action, "none");

  let calls = 0;
  const build = () => {
    calls += 1;
    return Promise.resolve("edition-1");
  };
  const [first, second] = await Promise.all([dedupedBuild(snapshot, build), dedupedBuild(snapshot, build)]);
  assert.equal(first, second);
  assert.equal(calls, 1);
  const rebuild = await dedupedBuild(snapshot, build);
  assert.equal(rebuild, "edition-1");
  assert.equal(calls, 2);
});
