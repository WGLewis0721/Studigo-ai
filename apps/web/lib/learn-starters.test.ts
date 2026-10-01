import assert from "node:assert/strict";
import test from "node:test";
import { LEARN_GUIDE_TEXT, learnStarters } from "./coach-route-selection";
import { parseRichText } from "./rich-text";

test("Learn has four starters, each with its own label, and only the how-it-works one is answered locally", () => {
  const starters = learnStarters("Phase changes");
  assert.equal(starters.length, 4);
  assert.equal(new Set(starters.map((starter) => starter.label)).size, 4);
  assert.deepEqual(starters.filter((starter) => starter.local).map((starter) => starter.id), ["how"]);
  assert.match(starters[1].text, /Phase changes/, "the explain starter follows the selected topic");
});

test("the how-it-works copy says what Learn does, how Coach differs, and renders as an outline", () => {
  assert.match(LEARN_GUIDE_TEXT, /Never grades you and never changes your mastery/);
  assert.match(LEARN_GUIDE_TEXT, /Coach asks you questions/);
  assert.doesNotMatch(LEARN_GUIDE_TEXT, /—/, "no em dashes");
  const types = parseRichText(LEARN_GUIDE_TEXT).map((block) => block.type);
  assert.deepEqual(types, ["paragraph", "heading", "list", "heading", "list"]);
});
