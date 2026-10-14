import assert from "node:assert/strict";
import test from "node:test";
import { composeUnitOverview } from "./unit-overview";

const titles = ["Legislative", "Executive", "Judicial", "Voting", "Rights", "Federalism"];
const ids = titles.map((title, index) => `topic-${index + 1}`);
const roomTopics = ids.map((id, index) => ({ id, title: titles[index] }));

test("C06 overview keeps six ordered sections and names a gap", () => {
  const result = composeUnitOverview({
    requestedIds: ids,
    roomTopics,
    retrieve: (topic) => topic.id === "topic-6" ? null : { text: `The ${topic.title} section is in the study guide.`, citation: "Guide, p. 1" }
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.providerCalls, 0);
  assert.deepEqual(result.sections.map((section) => section.topicId), ids);
  assert.equal(result.sections.filter((section) => section.status === "supported").length, 5);
  assert.equal(result.sections[5]?.status, "gap");
  assert.match(result.sections[0]?.text ?? "", /Legislative/);
  assert.notEqual(result.sections[0]?.text, result.sections[1]?.text);
});

test("C06 a foreign or single topic does not retrieve or generate", () => {
  let calls = 0;
  const retrieve = () => {
    calls += 1;
    return { text: "unused", citation: "unused" };
  };
  const foreign = composeUnitOverview({
    requestedIds: ["topic-1", "outside"],
    roomTopics,
    retrieve
  });
  const single = composeUnitOverview({ requestedIds: ["topic-1"], roomTopics, retrieve });
  assert.equal(foreign.ok, false);
  assert.equal(single.ok, false);
  assert.equal(foreign.providerCalls, 0);
  assert.equal(calls, 0);
});
