# Semantic grader eval

The scorer is `evals/grading/score.mjs` (`scoreRows(rows)`). It reports macro F1, per-class precision and recall, false-positive "correct", and false negatives.

`evals/grading/fixtures.json` is a scorer fixture. Its reviewer is `fixture-not-a-human`. It is not the 300–500 answer human set. Do not treat its macro F1 as grader quality. The model must not write those labels.

The human set is not collected yet. No live result exists yet, and this document carries no metric numbers on purpose.

Run the scorer tests: `node --test evals/grading/*.test.mjs`

## How to run the human set

**Who labels.** A named person assigns every label and writes their name in `reviewer`. The model never labels, drafts labels, or suggests them. The runner refuses a row whose reviewer is empty, `fixture-not-a-human`, or model-like (gpt, claude, "AI", and similar), and refuses `TEMPLATE-*` ids.

**What to collect.** Target 300–500 answers (E9 in `implementation/ENGINEERING_PLAN.md`), in more than one subject, covering:

- correct
- equivalent wording
- partial
- misconception
- incorrect
- off-topic
- not-sure
- typos
- concise and verbose answers

Start from `evals/grading/labels.template.jsonl` (format in `evals/grading/labels.schema.json`): one JSON object per line with `id`, `subject`, `question`, `reference_answer`, `learner_answer`, `label`, `reviewer`, `notes`. Copy it to a new file; do not label inside the template.

**Command.** It needs a model credential (`OPENAI_API_KEY`, `AI_GATEWAY_API_KEY`, or `OLLAMA_BASE_URL`, as `packages/ai/src/client.ts` resolves them) and `tsx`, because `@studigo/ai` ships TypeScript source:

```
node --import tsx evals/grading/run-live.mjs <labels.jsonl> [--out evals/grading/results/<ts>.json] [--limit N]
```

It validates the labels first, then calls the real `gradeShortAnswer` and the Coach evaluator `respondToSocraticAnswer` from `@studigo/ai`, and writes a result file with the pins (model id, transport, temperature, timestamp, prompt hash if available), per-row predictions, and the `score.mjs` metrics. It never writes to the labels file.

**Score to class mapping.** Derived only from the bands in the `gradeShortAnswer` prompt (`packages/ai/src/study.ts`):

| Grader output | Class |
| --- | --- |
| score 85–100 | correct |
| score 60–84 | partial |
| score 30–59 | partial |
| score 0–29 | incorrect |
| Coach verdict `off_topic` | off_topic |
| Coach verdict `not_sure` | not_sure |

The Coach verdict, when it is `off_topic` or `not_sure`, overrides the score band. Its `understood` and `partial` verdicts are not used; the score decides those.

**Limits of the mapping.**

- `equivalent` and `misconception` cannot be derived from a 0–100 score or from the Coach verdicts. The runner never predicts them. Rows labelled with them are counted, reported as `unmappableLabelRows`, and show up as false negatives; `metricsExcludingUnmappableLabels` gives the same metrics without them. Closing this gap means changing the grader's output, not the mapping.
- The 30–59 band and the 60–84 band both map to partial because the prompt describes both as partly right; the boundary between them is not scored.
- The Coach evaluator is a different prompt, built for explain-back checks, and is given the reference answer as its only excerpt. Its verdicts are a proxy for off-topic and not-sure, not a measurement of the production short-answer path.
- `isCorrect = score >= 85` in `gradeShortAnswer` is the existing cutoff. E9 exists to test it, not to assume it.
- Temperature is not set by `packages/ai`, so the pin records the provider default. The grader prompt is an inline string, not an exported constant, so `promptHash` is `unavailable`; the result records a SHA-256 of `packages/ai/src/study.ts` as a stand-in so a changed prompt is still detectable.

Do not publish a result until the labels have been reviewed.
