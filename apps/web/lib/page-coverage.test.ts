import assert from "node:assert/strict";
import { test } from "node:test";
import { assessPageCoverage, coverageLimitation, isPageCitable } from "@studigo/documents";

const readable = "The legislative branch makes laws. Citizens elect representatives who debate and write statutes. ";

test("C08 one unreadable page is named and the other pages stay citable", () => {
  const assessed = assessPageCoverage([
    { pageNumber: 1, text: readable.repeat(2) },
    { pageNumber: 2, text: "" },
    { pageNumber: 3, text: readable.repeat(2) }
  ], [], { pdfQuality: true });

  assert.equal(assessed.status, "partial");
  assert.notEqual(assessed.status, "ready");
  assert.deepEqual(assessed.publishable.map((page) => page.pageNumber), [1, 3]);
  assert.equal(assessed.coverage[1]?.state, "unreadable");
  const copy = coverageLimitation(assessed.coverage, "page");
  assert.match(copy ?? "", /Page 2 needs a clearer copy/);
  assert.match(copy ?? "", /Pages 1 and 3 can still be used/);
  assert.equal(isPageCitable(assessed.coverage, 1), true);
  assert.equal(isPageCitable(assessed.coverage, 2), false);
  assert.equal(isPageCitable(assessed.coverage, 3), true);

  const failedScan = assessPageCoverage([
    { pageNumber: 2, text: "this failed transcription must not become evidence" }
  ], [2], { pdfQuality: true });
  assert.equal(failedScan.status, "failed");
  assert.equal(failedScan.publishable.length, 0);
  assert.equal(failedScan.coverage[0]?.reason, "ocr_failed");
  assert.equal(isPageCitable(failedScan.coverage, 2), false);
});
