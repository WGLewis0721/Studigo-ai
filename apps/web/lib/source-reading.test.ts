import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseSourceReading } from "./source-reading";
import { SourceReading } from "../components/room/source-reading";

const government = [
  "GOVERNMENT / STUDY MATERIALS",
  "Page 2",
  "Our Government Study Buddy",
  "The Constitution",
  "• Important document",
  "• A written plan for government",
  "• Set up our country as a democracy",
  "• Set up the government for our country - 3 Branches of Government",
  "• Protects the rights of all citizens",
  "Our Government",
  "• a group of people who make decisions about our country, state, or city"
].join("\n");

test("Guided Learn displays exact source ideas as headings and discrete bullets", () => {
  const parsed = parseSourceReading(government, "The Constitution");
  assert.deepEqual(parsed, [
    { kind: "fact", text: "Important document" },
    { kind: "fact", text: "A written plan for government" },
    { kind: "fact", text: "Set up our country as a democracy" },
    { kind: "fact", text: "Set up the government for our country - 3 Branches of Government" },
    { kind: "fact", text: "Protects the rights of all citizens" },
    { kind: "heading", text: "Our Government" },
    { kind: "fact", text: "a group of people who make decisions about our country, state, or city" }
  ]);
  assert.equal(parsed.some(({ text }) => /STUDY MATERIALS|Page 2|Study Buddy/.test(text)), false);
  const html = renderToStaticMarkup(createElement(SourceReading, { text: government, topic: "The Constitution" }));
  assert.match(html, /<ul class="learnSourceFacts">/);
  assert.match(html, /<h3 class="learnSourceSubheading">Our Government<\/h3>/);
  assert.match(html, /Set up our country as a democracy/);
  assert.doesNotMatch(html, /STUDY MATERIALS|Our Government Study Buddy/);
});

test("Source inspector can display section title as source text and preserve original facts", () => {
  const parsed = parseSourceReading(government);
  assert.equal(parsed[0].kind, "heading");
  assert.equal(parsed[0].text, "The Constitution");
  assert.equal(parsed.filter(({ kind }) => kind === "fact").length, 6);
});

test("Source-faithful formatting handles OCR bullets on one line, ordinary prose and missing bullets", () => {
  assert.deepEqual(parseSourceReading("The Constitution • Important document • A written plan"), [
    { kind: "heading", text: "The Constitution" },
    { kind: "fact", text: "Important document" },
    { kind: "fact", text: "A written plan" }
  ]);
  assert.deepEqual(parseSourceReading("The executive branch enforces laws."), [
    { kind: "paragraph", text: "The executive branch enforces laws." }
  ]);
  assert.deepEqual(parseSourceReading(""), []);
  assert.deepEqual(parseSourceReading("The Constitution\nA written plan for government"), [
    { kind: "paragraph", text: "The Constitution" },
    { kind: "paragraph", text: "A written plan for government" }
  ]);
});

test("Unrelated course headers are preserved; formatter does not invent teaching content", () => {
  const exact = "Mammals\n• feed their young\n• have hair";
  const parsed = parseSourceReading(exact);
  assert.deepEqual(parsed.map(({text})=>text), ["Mammals","feed their young","have hair"]);
  assert.equal(parsed.every(({text})=>exact.includes(text)),true);
  assert.equal(parseSourceReading("Page 3\nCells\n• Have membranes")[0].text, "Cells");
});
