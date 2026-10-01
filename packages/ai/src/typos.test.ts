import assert from "node:assert/strict";
import test from "node:test";
import { gradeBlankAnswer } from "./study";
import {
  commandWordMatches,
  editDistance,
  repairCommandTypos,
  stripAnswerFiller,
  termMatch,
  typoOfWord,
  wordsMatch
} from "./typos";

test("a swapped pair, a gap or a wrong letter is one edit", () => {
  assert.equal(editDistance("form", "from"), 1);
  assert.equal(editDistance("evaporation", "evaperation"), 1);
  assert.equal(editDistance("cat", "cart"), 1);
  assert.equal(editDistance("abc", "xyz"), 3);
});

test("grading forgives a typo in a real term but never a different term", () => {
  assert.equal(typoOfWord("photosynthisis", "photosynthesis"), true);
  assert.equal(typoOfWord("photosyntehsis", "photosynthesis"), true, "swapped letters");
  assert.equal(typoOfWord("mars", "mass"), false, "short words are exact");
  assert.equal(typoOfWord("1946", "1945"), false, "numbers never bend");
  assert.equal(typoOfWord("h2o", "h2o2"), false);
  // Near-opposites that two edits would otherwise merge.
  assert.equal(typoOfWord("exothermic", "endothermic"), false);
  assert.equal(typoOfWord("hypotonic", "hypertonic"), false);
  // Long terms get two edits when they start the same way.
  assert.equal(typoOfWord("mitochondira", "mitochondria"), true);
  assert.equal(typoOfWord("mitochondrea", "mitochondria"), true);
  assert.equal(typoOfWord("mitchondrea", "mitochondria"), true);
});

test("a multi-word term allows typos word by word, and run-together or split words", () => {
  assert.equal(termMatch("water cycel", "water cycle"), "typo");
  assert.equal(termMatch("law of mation", "law of motion"), "typo");
  assert.equal(termMatch("watercycle", "water cycle"), "exact");
  assert.equal(termMatch("photo synthesis", "photosynthesis"), "exact");
  assert.equal(termMatch("photo synthesys", "photosynthesis"), "typo");
  assert.equal(termMatch("water cycle", "water cycle"), "exact");
  assert.equal(termMatch("rock cycle", "water cycle"), null);
  assert.equal(termMatch("law of motion", "law of gravity"), null);
});

test("filler around an answer is not part of it", () => {
  assert.equal(stripAnswerFiller("its condensation"), "condensation");
  assert.equal(stripAnswerFiller("i think evaporation"), "evaporation");
  assert.equal(stripAnswerFiller("i think its evaporation"), "evaporation");
  assert.equal(stripAnswerFiller("the answer is mass"), "mass");
  assert.equal(stripAnswerFiller("evaporation maybe"), "evaporation");
  assert.equal(stripAnswerFiller("evaporation"), "evaporation");
});

test("a blank answer is read the way a teacher reads it", () => {
  const accepted = ["condensation"];
  assert.deepEqual(gradeBlankAnswer({ learnerAnswer: "Condensation", acceptedAnswers: accepted }), { isCorrect: true, score: 100, matched: "condensation" });
  assert.equal(gradeBlankAnswer({ learnerAnswer: "it's condensation", acceptedAnswers: accepted }).score, 100);
  assert.equal(gradeBlankAnswer({ learnerAnswer: "I think condensation?", acceptedAnswers: accepted }).score, 100);
  assert.equal(gradeBlankAnswer({ learnerAnswer: "condensasion", acceptedAnswers: accepted }).score, 85);
  assert.equal(gradeBlankAnswer({ learnerAnswer: "i think its condensashun", acceptedAnswers: accepted }).isCorrect, false, "three edits is too many");
  assert.equal(gradeBlankAnswer({ learnerAnswer: "evaporation", acceptedAnswers: accepted }).isCorrect, false);
  assert.equal(gradeBlankAnswer({ learnerAnswer: "pizza", acceptedAnswers: accepted }).isCorrect, false);
});

test("a typo earns less than an exact answer, and the exact match wins when both are accepted", () => {
  const grade = gradeBlankAnswer({ learnerAnswer: "condensing", acceptedAnswers: ["condensation", "condensing"] });
  assert.equal(grade.score, 100);
  assert.equal(grade.matched, "condensing");
});

test("a loose word match lets a stem and a misspelling through but not unrelated words", () => {
  assert.equal(wordsMatch("evaporating", "evaporation"), true);
  assert.equal(wordsMatch("vapour", "vapor"), true);
  assert.equal(wordsMatch("ice", "ace"), false);
  assert.equal(wordsMatch("pizza", "precipitation"), false);
});

test("command words are repaired only when the typo is believable", () => {
  assert.equal(commandWordMatches("shwo", "show"), true, "a swapped pair in a short command word");
  assert.equal(commandWordMatches("hnit", "hint"), true);
  assert.equal(commandWordMatches("mint", "hint"), false, "a different short word");
  assert.equal(commandWordMatches("answr", "answer"), true);
  assert.equal(commandWordMatches("simpelr", "simpler"), true);
  assert.equal(commandWordMatches("simple", "simpler"), false, "a real word is never repaired");
  assert.equal(commandWordMatches("struck", "stuck"), false, "a real word is never repaired");
  assert.equal(commandWordMatches("stick", "stuck"), false);
  assert.equal(commandWordMatches("tool", "tell"), false);
});

test("a short message has its command words repaired; a long reply is left alone", () => {
  const vocab = ["show", "answer", "hint", "stuck", "know"];
  assert.equal(repairCommandTypos("shwo me the answr", vocab), "show me the answer");
  assert.equal(repairCommandTypos("hnit please", vocab), "hint please");
  assert.equal(repairCommandTypos("i am stcuk", vocab), "i am stuck");
  assert.equal(repairCommandTypos("the answr to why the ice melts is that heat flows from warm to cold objects", vocab), "the answr to why the ice melts is that heat flows from warm to cold objects");
  assert.equal(repairCommandTypos("evaporation", vocab), "evaporation");
});
