# Semantic grader eval

The scorer is `evals/grading/score.mjs`. It reports macro F1, per-class precision and recall, false-positive "correct", and false negatives.

`evals/grading/fixtures.json` is a scorer fixture. Its reviewer is `fixture-not-a-human`. It is not the 300–500 answer human set. Do not treat its macro F1 as grader quality. The model must not write those labels.

The human set is not collected yet. It still needs a named person, and it still needs to cover correct, equivalent wording, partial, misconception, incorrect, off-topic, not-sure, typos, concise and verbose answers, and more than one subject.

Run: `node --test evals/grading/*.test.mjs`
