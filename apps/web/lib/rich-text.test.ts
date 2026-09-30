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
