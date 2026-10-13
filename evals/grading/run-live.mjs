#!/usr/bin/env node
/**
 * E9 live runner. Grades a HUMAN-labelled set with the real @studigo/ai graders and scores it.
 *
 *   node --import tsx evals/grading/run-live.mjs <labels.jsonl> [--out evals/grading/results/<ts>.json] [--limit N]
 *
 * @studigo/ai exports TypeScript source only ("exports": "./src/index.ts"), so Node needs tsx
 * (declared in packages/ai devDependencies). Model calls stay inside packages/ai; this file only
 * imports its public entry. The labels file is read, never written.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NEVER_PREDICTED, SCORE_BANDS, parseLabelsJsonl, predictClass, validateLabelRows } from "./labels.mjs";
import { CLASSES, scoreRows } from "./score.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const aiEntry = resolve(here, "../../packages/ai/src/index.ts");
const studySource = resolve(here, "../../packages/ai/src/study.ts");

function fail(message) {
  console.error(`run-live: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { labels: null, out: null, limit: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--limit") args.limit = Number(argv[++i]);
    else if (argv[i].startsWith("--")) fail(`unknown option ${argv[i]}`);
    else args.labels = argv[i];
  }
  if (!args.labels) fail("usage: node --import tsx evals/grading/run-live.mjs <labels.jsonl> [--out file] [--limit N]");
  if (args.limit !== null && (!Number.isInteger(args.limit) || args.limit < 1)) fail("--limit must be a positive integer");
  return args;
}

/** Same credential order as packages/ai/src/client.ts resolveTransport(). */
function hasCredential() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.OLLAMA_BASE_URL);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // 1. Labels first: refuse anything that is not human-labelled, before any credential or network step.
  let rows;
  try {
    rows = parseLabelsJsonl(await readFile(args.labels, "utf8"));
  } catch (error) {
    fail(`cannot read labels: ${error.message}`);
  }
  const problems = validateLabelRows(rows);
  if (problems.length) {
    fail(`refusing to run, labels are not valid human labels:\n  - ${problems.slice(0, 20).join("\n  - ")}${problems.length > 20 ? `\n  ...and ${problems.length - 20} more` : ""}`);
  }
  if (args.limit) rows = rows.slice(0, args.limit);

  // 2. Credentials: fail fast, never fabricate a result.
  if (!hasCredential()) {
    fail("no model credential. Set OPENAI_API_KEY (direct), AI_GATEWAY_API_KEY, or OLLAMA_BASE_URL, as packages/ai/src/client.ts requires.");
  }

  // 3. Load the real graders through the package entry.
  let ai;
  try {
    ai = await import(pathToFileURL(aiEntry).href);
  } catch (error) {
    fail(`cannot load @studigo/ai source (${error.code ?? error.message}). Run with: node --import tsx evals/grading/run-live.mjs ...`);
  }
  const { gradeShortAnswer, respondToSocraticAnswer, chatModel, currentTransport } = ai;
  const coachUsable = typeof respondToSocraticAnswer === "function";

  const predictions = [];
  for (const row of rows) {
    const entry = { id: row.id, label: row.label, reviewer: row.reviewer };
    try {
      const grade = await gradeShortAnswer({
        question: row.question,
        expectedAnswer: row.reference_answer,
        learnerAnswer: row.learner_answer
      });
      entry.score = grade.score;
      entry.isCorrect = grade.isCorrect;
      entry.feedback = grade.feedback;
      if (coachUsable) {
        // The Coach evaluator wants excerpts; the reference answer is supplied as the single excerpt.
        const coach = await respondToSocraticAnswer({
          topicTitle: row.subject,
          question: row.question,
          learnerAnswer: row.learner_answer,
          chunks: [
            { id: `ref-${row.id}`, documentId: "reference", documentName: "Reference answer", content: row.reference_answer, similarity: 1 }
          ]
        });
        entry.coachVerdict = coach.verdict;
      }
      entry.predicted = predictClass(entry.score, entry.coachVerdict);
    } catch (error) {
      entry.error = String(error?.message ?? error);
      entry.predicted = null;
    }
    predictions.push(entry);
    console.error(`run-live: ${predictions.length}/${rows.length} ${row.id} -> ${entry.predicted ?? "ERROR"}`);
  }

  const scored = predictions.filter((p) => p.predicted);
  const errors = predictions.length - scored.length;
  const mappableOnly = scored.filter((p) => !NEVER_PREDICTED.includes(p.label));
  const labelCounts = Object.fromEntries(CLASSES.map((c) => [c, rows.filter((r) => r.label === c).length]));

  const studyText = await readFile(studySource, "utf8");
  const result = {
    kind: "semantic-grader-live-run",
    note: "Scores a human-labelled set. Not a published number until the set is reviewed. The model was not the labeler.",
    timestamp: new Date().toISOString(),
    pins: {
      model: chatModel(),
      transport: currentTransport(),
      temperature: "not set by packages/ai (provider default)",
      // gradeShortAnswer's prompt is an inline string inside the function, not an exported constant.
      promptHash: "unavailable",
      studyTsSha256: createHash("sha256").update(studyText).digest("hex")
    },
    mapping: {
      scoreBands: SCORE_BANDS,
      coachDirect: { off_topic: "off_topic", not_sure: "not_sure" },
      unmappable: NEVER_PREDICTED,
      coachEvaluatorUsed: coachUsable
    },
    rows: { total: rows.length, scored: scored.length, errors, labelCounts },
    unmappableLabelRows: scored.filter((p) => NEVER_PREDICTED.includes(p.label)).length,
    metrics: scoreRows(scored),
    metricsExcludingUnmappableLabels: scoreRows(mappableOnly),
    predictions
  };

  const out = resolve(args.out ?? `evals/grading/results/${result.timestamp.replace(/[:.]/g, "-")}.json`);
  if (out === resolve(args.labels)) fail("--out must not be the labels file");
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(result, null, 2)}\n`);
  console.error(`run-live: wrote ${out}`);
}

main().catch((error) => fail(error?.stack ?? String(error)));
