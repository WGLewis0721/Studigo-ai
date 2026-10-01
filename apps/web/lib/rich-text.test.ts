import assert from "node:assert/strict";
import test from "node:test";
import { parseInline, parseRichText } from "./rich-text";

test("headings, bullets and paragraphs become blocks, not raw symbols", () => {
  const blocks = parseRichText("## What it is\nAir pressure [1].\n\n- Falls before storms\n- Rises with clear skies\n\n1. First\n2. Second");
  assert.deepEqual(blocks.map((block) => block.type), ["heading", "paragraph", "list", "list"]);
  assert.equal(blocks[2].type === "list" && blocks[2].ordered, false);
  assert.equal(blocks[3].type === "list" && blocks[3].ordered, true);
  assert.equal(blocks[2].type === "list" && blocks[2].items.length, 2);
});

test("inline bold, italic, code and citation markers are split out", () => {
  assert.deepEqual(parseInline("A **front** is *where* air [1, 2] meets `x`"), [
    { type: "text", value: "A " },
    { type: "bold", value: "front" },
    { type: "text", value: " is " },
    { type: "italic", value: "where" },
    { type: "text", value: " air " },
    { type: "cite", value: "1,2" },
    { type: "text", value: " meets " },
    { type: "code", value: "x" }
  ]);
});

test("soft-wrapped lines join into one paragraph and html stays plain text", () => {
  const blocks = parseRichText("line one\nline two <b>x</b>");
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0].type === "paragraph" && blocks[0].inline, [{ type: "text", value: "line one line two <b>x</b>" }]);
});

test("an outline keeps its structure: bold answer line, headings, bullets and a nested detail", () => {
  const blocks = parseRichText(
    [
      "**Short answer:** Water changes state with heat [1].",
      "",
      "## The three states",
      "- **Solid**: ice [1]",
      "- **Liquid**: water [1]",
      "  - Takes the shape of its container [2]",
      "  - Flows freely [2]",
      "- **Gas**: vapor [2]",
      "",
      "## What drives it",
      "- Heat added or removed [3]"
    ].join("\n")
  );
  assert.deepEqual(blocks.map((block) => block.type), ["paragraph", "heading", "list", "heading", "list"]);

  const states = blocks[2];
  assert.ok(states.type === "list");
  assert.equal(states.items.length, 3, "nested bullets do not become top-level items");
  assert.equal(states.items[0].sublist, null);
  assert.equal(states.items[1].sublist?.items.length, 2);
  assert.equal(states.items[1].sublist?.ordered, false);
  assert.equal(states.items[2].sublist, null);
});

test("nesting follows indent order, so tabs and different widths still nest and un-nest", () => {
  const blocks = parseRichText("- a\n    - b\n        - c\n    - d\n- e\n\t- f");
  const list = blocks[0];
  assert.ok(list.type === "list");
  assert.deepEqual(list.items.map((item) => item.sublist?.items.length ?? 0), [2, 1]);
  assert.equal(list.items[0].sublist?.items[0].sublist?.items.length, 1);
});

test("numbered steps with bulleted details nest, and switching list style at the top level starts a new list", () => {
  const nested = parseRichText("1. Evaporation\n   - Heat lifts vapor [1]\n2. Condensation");
  assert.ok(nested[0].type === "list" && nested[0].ordered);
  assert.equal(nested[0].type === "list" && nested[0].items[0].sublist?.ordered, false);

  const switched = parseRichText("- one\n- two\n1. first\n2. second");
  assert.deepEqual(switched.map((block) => block.type), ["list", "list"]);
});

test("an indented line with no bullet continues the item above instead of becoming a paragraph", () => {
  const blocks = parseRichText("- A long fact that wraps\n  onto a second line [1]\n- Next");
  assert.equal(blocks.length, 1);
  assert.ok(blocks[0].type === "list");
  assert.equal(blocks[0].items.length, 2);
  assert.deepEqual(blocks[0].items[0].inline.map((part) => part.type), ["text", "cite"]);
});
