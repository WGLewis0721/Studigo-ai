import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { scoreGrades } from "./score.mjs";

test("a predicted correct on a wrong label counts as a false positive correct", () => {
  const report = scoreGrades([
    { label: "incorrect", predicted: "correct" },
    { label: "correct", predicted: "correct" }
  ]);
  assert.equal(report.falsePositiveCorrect, 1);
  assert.equal(report.perClass.correct.tp, 1);
});

test("fixture labels are scored and are not a human benchmark", async () => {
  const fixture = JSON.parse(await readFile(new URL("./fixtures.json", import.meta.url), "utf8"));
  assert.equal(fixture.reviewer, "fixture-not-a-human");
  assert.ok(fixture.rows.length >= 8);
  const report = scoreGrades(fixture.rows);
  assert.equal(report.rows, fixture.rows.length);
  assert.ok(report.macroF1 > 0.9);
});
