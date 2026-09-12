import assert from "node:assert/strict";
import test from "node:test";
import { flashcardRatingToScore, scheduleFlashcard } from "./mastery";

test("a missed card comes back within the same session", () => {
  const next = scheduleFlashcard({ rating: 1, ease: 2.5, intervalDays: 10, repetitions: 4 });
  assert.equal(next.intervalDays, 0);
  assert.equal(next.repetitions, 0);
  assert.ok(new Date(next.dueAt).getTime() - Date.now() < 60 * 60 * 1000);
});

test("a known card's interval grows and its ease stays bounded", () => {
  let card = { ease: 2.5, intervalDays: 0, repetitions: 0 };
  const intervals: number[] = [];

  for (let review = 0; review < 5; review += 1) {
    const next = scheduleFlashcard({ rating: 3, ...card });
    intervals.push(next.intervalDays);
    card = { ease: next.ease, intervalDays: next.intervalDays, repetitions: next.repetitions };
  }

  assert.deepEqual(intervals.slice(0, 2), [1, 3]);
  assert.ok(intervals[4] > intervals[3], "intervals keep growing while the learner keeps it right");
  assert.ok(card.ease <= 3.2 && card.ease >= 1.3);
});

test("ease never falls below the floor no matter how often a card is missed", () => {
  let card = { ease: 2.5, intervalDays: 5, repetitions: 3 };
  for (let review = 0; review < 12; review += 1) {
    const next = scheduleFlashcard({ rating: 1, ...card });
    card = { ease: next.ease, intervalDays: next.intervalDays, repetitions: next.repetitions };
  }
  assert.ok(card.ease >= 1.3);
});

test("a hard card is scheduled sooner than one the learner knew", () => {
  const hard = scheduleFlashcard({ rating: 2, ease: 2.5, intervalDays: 6, repetitions: 3 });
  const easy = scheduleFlashcard({ rating: 3, ease: 2.5, intervalDays: 6, repetitions: 3 });
  assert.ok(hard.intervalDays < easy.intervalDays);
});

test("card ratings map to scores that can move mastery in both directions", () => {
  assert.ok(flashcardRatingToScore(3) > flashcardRatingToScore(2));
  assert.ok(flashcardRatingToScore(2) > flashcardRatingToScore(1));
  assert.ok(flashcardRatingToScore(1) < 60, "a missed card must not read as mastery");
});
