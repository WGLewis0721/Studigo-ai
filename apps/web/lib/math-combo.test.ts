import assert from "node:assert/strict";
import test from "node:test";
import { comboFromQuestion, formatCombo, parseComboBlock } from "./math-combo";

function notesOk(combo: NonNullable<ReturnType<typeof comboFromQuestion>>): boolean {
  return combo.columns.every((column) => column.steps.length >= 1 && column.steps.length <= 6 && column.steps.every((step) => step.note.split(/\s+/).length <= 8));
}

test("1/2 + 1/4 is two changing lines and a fraction bar", () => {
  const combo = comboFromQuestion("What is 1/2 + 1/4?");

  assert.ok(combo);
  assert.equal(combo.picture?.kind, "fraction-bar");
  assert.equal(combo.columns.length, 1);
  assert.deepEqual(combo.columns[0].steps.map((step) => step.result), ["2/4", "3/4"]);
  assert.equal(notesOk(combo), true);
  assert.equal(combo.columns[0].steps.some((step) => step.move === "1/4 = 1/4"), false);
});

test("two groupings are two columns that meet at the same answer", () => {
  const text = "Look at the example where Rama multiplies 4, 6, and 2 in two different ways, changing the order and grouping: (2 x 4) x 6 and 4 x (6 x 2). Why is the first easier?";
  const combo = comboFromQuestion(text, { hideLast: true });

  assert.ok(combo);
  assert.equal(combo.columns.length, 2);
  assert.equal(combo.columns[0].steps.at(-1)?.result, "48");
  assert.equal(combo.columns[1].steps.at(-1)?.result, "48");
  assert.equal(combo.columns[1].steps.at(-1)?.note, "same answer");
  assert.equal(combo.hideLast, true);
  assert.equal(notesOk(combo), true);
  const played = parseComboBlock(formatCombo(combo, text));
  assert.equal(played?.columns.length, 2);
  assert.match(formatCombo(combo, text), /Your turn: Why is the first easier\?/);
  assert.doesNotMatch(formatCombo(combo, text), /acceptable answer/i);
});

test("regrouping lands on 35, and a known fact stays one line", () => {
  const difference = comboFromQuestion("52 - 17");
  const fact = comboFromQuestion("What is 7 x 8?");

  assert.ok(difference);
  assert.equal(difference.picture?.kind, "place-value");
  assert.equal(difference.columns[0].steps.at(-1)?.result, "35");
  assert.equal(notesOk(difference), true);
  assert.ok(fact);
  assert.equal(fact.columns.length, 1);
  assert.equal(fact.columns[0].steps.length, 1);
  assert.equal(fact.columns[0].steps[0].result, "56");
});
