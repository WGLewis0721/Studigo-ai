/** Macro metrics for a labelled short-answer set. The judge must not be the labeler. */

export const CLASSES = ["correct", "equivalent", "partial", "misconception", "incorrect", "off_topic", "not_sure"];

export function scoreGrades(rows) {
  const labels = new Set(CLASSES);
  const byClass = Object.fromEntries(CLASSES.map((name) => [name, { tp: 0, fp: 0, fn: 0 }]));
  let used = 0;
  for (const row of rows) {
    if (!labels.has(row.label) || !labels.has(row.predicted)) continue;
    used += 1;
    if (row.predicted === row.label) byClass[row.label].tp += 1;
    else {
      byClass[row.predicted].fp += 1;
      byClass[row.label].fn += 1;
    }
  }
  const perClass = {};
  let f1Sum = 0;
  let falsePositiveCorrect = 0;
  let falseNegative = 0;
  for (const name of CLASSES) {
    const { tp, fp, fn } = byClass[name];
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    perClass[name] = { precision, recall, f1, tp, fp, fn };
    f1Sum += f1;
    falseNegative += fn;
    if (name === "correct") falsePositiveCorrect = fp;
  }
  return {
    rows: used,
    macroF1: f1Sum / CLASSES.length,
    falsePositiveCorrect,
    falseNegative,
    perClass
  };
}
