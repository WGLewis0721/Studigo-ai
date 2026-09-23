import assert from "node:assert/strict";
import { test } from "node:test";
import { coachMaterialLabel, coachMaterialState } from "./coach-material-state";

test("grounded Coach content keeps the grounded label", () => {
  assert.equal(
    coachMaterialLabel({ content: "Gravity pulls objects toward Earth [1].", grounded: true }),
    "GROUNDED IN YOUR MATERIALS"
  );
});

test("a valid uncited Socratic question is coaching, not insufficient material", () => {
  const input = {
    content: "How would you explain the difference between a solid and a liquid?",
    grounded: false
  };
  assert.equal(coachMaterialState(input), "coaching");
  assert.equal(coachMaterialLabel(input), "COACHING FROM YOUR MATERIALS");
});

test("actual retrieval insufficiency still shows NEEDS MORE MATERIAL", () => {
  assert.equal(
    coachMaterialLabel({
      content: "There isn't enough processed material on \"Magnetism\" yet. Add the source that covers it and ask me again.",
      grounded: false
    }),
    "NEEDS MORE MATERIAL"
  );
});

test("source-loss text still shows NEEDS MORE MATERIAL", () => {
  assert.equal(
    coachMaterialLabel({
      content: "The material behind that question isn't available anymore, so I can't grade it fairly. Let's pick a fresh topic.",
      grounded: false
    }),
    "NEEDS MORE MATERIAL"
  );
});
