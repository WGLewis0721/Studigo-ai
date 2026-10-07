import assert from "node:assert/strict";
import test from "node:test";
import { rerankByOverlap } from "./rerank";

test("overlap rerank prefers the chunk that shares the query words", () => {
  const ranked = rerankByOverlap("photosynthesis sunlight", [
    { id: "a", content: "Gravity pulls objects together." },
    { id: "b", content: "Photosynthesis uses sunlight to make sugar." }
  ]);
  assert.equal(ranked[0]?.id, "b");
});
