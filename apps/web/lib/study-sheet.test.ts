import assert from "node:assert/strict";
import test from "node:test";
import { layoutStudySheet } from "./study-guide-pdf";

test("a dash definition becomes vocabulary", () => {
  const sheet = layoutStudySheet({
    title: "Community",
    subject: "Civics",
    lines: ["citizen — a member of a community"]
  });
  const entry = sheet.pages.flatMap((page) => page.vocabulary).find((item) => item.term === "citizen");
  assert.ok(entry);
  assert.equal(entry.term, "citizen");
  assert.match(entry.definition, /member/);
});

test("a short heading starts a section for the following line", () => {
  const sheet = layoutStudySheet({
    title: "Government",
    lines: ["Three Branches", "Congress makes the laws"]
  });
  const section = sheet.pages.flatMap((page) => page.sections).find((item) => item.title === "Three Branches");
  assert.ok(section);
  assert.equal(section.bullets.includes("Congress makes the laws"), true);
});

test("a fact not in the source lines is absent", () => {
  const sheet = layoutStudySheet({
    title: "Rivers",
    subject: "Geography",
    lines: ["The Nile flows through Africa"]
  });
  assert.equal(JSON.stringify(sheet).includes("invented river"), false);
});
