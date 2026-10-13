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

test("runner refuses empty, fixture and model-like reviewers and template rows", async () => {
  const { validateLabelRows, parseLabelsJsonl, predictClass } = await import("./labels.mjs");
  const base = { id: "r1", subject: "science", question: "q", reference_answer: "a", learner_answer: "b", label: "correct" };
  assert.deepEqual(validateLabelRows([{ ...base, reviewer: "Dana Whitfield" }]), []);
  for (const reviewer of ["", "  ", "fixture-not-a-human", "gpt-4.1-mini", "Claude", "AI"]) {
    assert.ok(validateLabelRows([{ ...base, reviewer }]).length > 0, `should refuse reviewer ${JSON.stringify(reviewer)}`);
  }
  const template = await readFile(new URL("./labels.template.jsonl", import.meta.url), "utf8");
  const rows = parseLabelsJsonl(template);
  assert.equal(rows.length, 3);
  assert.ok(validateLabelRows(rows).length >= 3);
  assert.equal(predictClass(90), "correct");
  assert.equal(predictClass(60), "partial");
  assert.equal(predictClass(30), "partial");
  assert.equal(predictClass(29), "incorrect");
  assert.equal(predictClass(95, "off_topic"), "off_topic");
});
