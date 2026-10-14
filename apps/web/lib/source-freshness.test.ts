import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyFailedRefresh,
  applySourceDeletion,
  applySuccessfulReplace,
  authenticatedExport,
  awardForPendingChallenge,
  chooseReadingEdition,
  historicalCitation,
  initialCorpus,
  type Fact,
  type GuideReading,
  type LearningEvidence,
  type SearchIndex
} from "./source-freshness";

const fact = (id: string, sourceId: string, sourceRevision: number, text: string): Fact => ({ id, sourceId, sourceRevision, text });

const evidence = (): LearningEvidence => ({
  receipts: ["receipt-kept"],
  mastery: 40,
  messages: [{ id: "m1", text: "Earlier note that mentioned old bravo fact" }]
});

function openReading(facts: Fact[]): { reading: GuideReading; index: SearchIndex } {
  const edition = { key: "edition-1", corpusRevision: 1, facts };
  return {
    reading: { reading: edition, candidate: null, updateAvailable: false, stale: false },
    index: { corpusRevision: 1, facts }
  };
}

test("C24 replacing source B drops old B from lesson, Coach, and guide selections", () => {
  const corpus = initialCorpus(["A", "B", "C"]);
  const kept = evidence();
  const prior = [
    fact("a", "A", 1, "alpha remains"),
    fact("b-old", "B", 1, "old bravo fact"),
    fact("c", "C", 1, "charlie remains")
  ];
  const facts = [...prior, fact("b-new", "B", 2, "new bravo fact")];
  const opened = openReading(prior);
  const next = applySuccessfulReplace({
    corpus,
    sourceId: "B",
    nextRevision: 2,
    facts,
    index: opened.index,
    reading: opened.reading,
    evidence: kept
  });

  assert.equal(next.corpus.revision, 2);
  assert.deepEqual(next.corpus.sources.find((source) => source.id === "B"), { id: "B", revision: 2, present: true });
  assert.equal(next.corpus.sources.find((source) => source.id === "A")?.revision, 1);
  assert.equal(next.corpus.sources.find((source) => source.id === "C")?.revision, 1);
  for (const surface of ["lesson", "coach", "guide"] as const) {
    const texts = next.selections[surface].map((item) => item.text);
    assert.equal(texts.includes("old bravo fact"), false);
    assert.equal(texts.includes("alpha remains"), true);
    assert.equal(texts.includes("charlie remains"), true);
    assert.equal(texts.includes("new bravo fact"), true);
  }
  assert.equal(next.index.facts.some((item) => item.text === "old bravo fact"), false);
  assert.equal(next.reading.reading?.key, "edition-1");
  assert.equal(next.reading.reading?.facts.some((item) => item.text === "old bravo fact"), true);
  assert.equal(next.reading.updateAvailable, true);
  assert.equal(next.reading.stale, true);
  assert.equal(next.reading.candidate?.facts.some((item) => item.text === "old bravo fact"), false);
  assert.equal(chooseReadingEdition("edition-1", [
    { key: "edition-1" },
    { key: next.reading.candidate?.key ?? "edition-2" }
  ])?.key, "edition-1");
  const exported = authenticatedExport(next.corpus, facts);
  assert.equal(exported.allowed.some((item) => item.text === "old bravo fact"), false);
  assert.equal(exported.allowed.some((item) => item.sourceId === "A"), true);
  assert.equal(exported.allowed.some((item) => item.sourceId === "C"), true);
  assert.deepEqual(historicalCitation(next.corpus, prior[1]), { label: "obsolete", canReground: false });
  assert.equal(next.evidence, kept);
  assert.equal(next.evidence.mastery, 40);
  assert.equal(next.evidence.messages[0]?.text.includes("old bravo fact"), true);
});

test("C24 deleting a source denies its export and a stale challenge awards no mastery", () => {
  const corpus = initialCorpus(["A", "B", "C"]);
  const kept = evidence();
  const facts = [
    fact("a", "A", 1, "alpha remains"),
    fact("b-old", "B", 1, "old bravo fact"),
    fact("c", "C", 1, "charlie remains")
  ];
  const opened = openReading(facts);
  const removed = applySourceDeletion({
    corpus,
    sourceId: "B",
    facts,
    index: opened.index,
    reading: opened.reading,
    evidence: kept
  });
  const exported = authenticatedExport(removed.corpus, facts);
  assert.equal(exported.denied.some((item) => item.text === "old bravo fact"), true);
  assert.equal(exported.allowed.some((item) => item.text === "old bravo fact"), false);
  assert.deepEqual(exported.allowed.map((item) => item.sourceId).sort(), ["A", "C"]);
  assert.equal(removed.reading.reading?.key, "edition-1");
  assert.equal(removed.evidence, kept);

  const decision = awardForPendingChallenge({
    corpus: removed.corpus,
    challenge: {
      evidenceRevision: corpus.revision,
      sourceId: "B",
      sourceRevision: 1,
      factText: "old bravo fact"
    },
    currentFacts: removed.selections.coach,
    evidence: kept
  });
  assert.equal(decision.awardMastery, false);
  assert.equal(decision.evidence, kept);
  assert.equal(decision.evidence.mastery, 40);
  assert.deepEqual(decision.evidence.receipts, ["receipt-kept"]);
  assert.equal(decision.evidence.messages.length, 1);
  assert.ok(decision.offer);
  assert.notEqual(decision.offer?.text, "old bravo fact");
  assert.equal(["A", "C"].includes(decision.offer?.sourceId ?? ""), true);
  assert.equal(removed.selections.lesson.some((item) => item.sourceId === "B"), false);
});

test("C24 a failed refresh keeps the previous edition and index", () => {
  const corpus = initialCorpus(["A", "B", "C"]);
  const kept = evidence();
  const facts = [
    fact("a", "A", 1, "alpha remains"),
    fact("b", "B", 1, "current bravo fact"),
    fact("c", "C", 1, "charlie remains")
  ];
  const opened = openReading(facts);
  const state = { corpus, index: opened.index, reading: opened.reading, evidence: kept };
  const failed = applyFailedRefresh(state);

  assert.equal(failed.invalidated, false);
  assert.equal(failed.corpus, corpus);
  assert.equal(failed.corpus.revision, 1);
  assert.equal(failed.index, opened.index);
  assert.deepEqual(failed.index.facts.map((item) => item.text), ["alpha remains", "current bravo fact", "charlie remains"]);
  assert.equal(failed.reading, opened.reading);
  assert.equal(failed.reading.reading?.key, "edition-1");
  assert.equal(failed.reading.stale, false);
  assert.equal(failed.reading.updateAvailable, false);
  assert.equal(failed.reading.candidate, null);
  assert.equal(failed.evidence, kept);
  assert.equal(failed.evidence.mastery, 40);
  assert.equal(chooseReadingEdition(failed.reading.reading?.key ?? null, [
    { key: "edition-1" },
    { key: "edition-failed" }
  ])?.key, "edition-1");
});
