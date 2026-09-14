"use client";

import { useState, useTransition } from "react";
import type { Topic } from "@/lib/rooms";
import { CitationChips, type Citation } from "./citations";

const BLANK_MARKER = "____";

type QuestionKind = "multiple_choice" | "short_answer" | "true_false" | "fill_blank";

type Question = {
  id: string;
  kind: QuestionKind;
  prompt: string;
  choices: string[];
  difficulty: string;
  topic_id: string | null;
};

type Result = {
  isCorrect: boolean;
  score: number;
  feedback: string;
  confidence: number | null;
  correctChoice: number | null;
  expectedAnswer: string | null;
  explanation: string;
  citations: Citation[];
};

type Answered = { score: number; confidence: number | null; isCorrect: boolean };

/**
 * Rating the answer is the submit action, so the confidence signal costs the
 * learner no extra step and Studigo can tell a gap from a blind spot.
 */
const CONFIDENCE_LEVELS = [
  { value: 1 as const, label: "Guessing", hint: "No real idea" },
  { value: 2 as const, label: "Fairly sure", hint: "Think so" },
  { value: 3 as const, label: "Confident", hint: "I know this" }
];

const KIND_LABELS: Record<QuestionKind, string> = {
  multiple_choice: "Multiple choice",
  short_answer: "Short answer",
  true_false: "True or false",
  fill_blank: "Fill in the blank"
};

/** Renders the stem with the blank shown as an inline slot. */
function BlankPrompt({ prompt, filled }: { prompt: string; filled: string }) {
  const [before, after] = prompt.split(BLANK_MARKER);
  return (
    <>
      {before}
      <span className={`inlineBlank ${filled ? "inlineBlankFilled" : ""}`}>{filled || "?"}</span>
      {after}
    </>
  );
}

export function QuizPanel({
  roomId,
  topics,
  hasMaterials,
  initialTopicId,
  onGraded
}: {
  roomId: string;
  topics: Topic[];
  hasMaterials: boolean;
  initialTopicId: string | null;
  onGraded: () => void;
}) {
  const [topicId, setTopicId] = useState<string>(initialTopicId ?? "");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [written, setWritten] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [loading, setLoading] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const current = questions[index];
  const finished = questions.length > 0 && index >= questions.length;
  const usesChoices = current?.kind === "multiple_choice" || current?.kind === "true_false";
  const hasAnswer = usesChoices ? selected !== null : written.trim().length > 0;

  async function build() {
    setLoading(true);
    setError(null);
    setAnswered([]);
    try {
      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, topicId: topicId || null, count: 5 })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not build a quiz.");

      setQuestions(payload.questions as Question[]);
      setIndex(0);
      setSelected(null);
      setWritten("");
      setResult(null);
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(confidence: 1 | 2 | 3) {
    if (!current || grading || !hasAnswer) return;

    setGrading(true);
    setError(null);
    try {
      const response = await fetch("/api/quiz/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: current.id,
          selectedChoice: usesChoices ? selected : null,
          response: usesChoices ? null : written,
          confidence
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not grade that answer.");

      setResult(payload as Result);
      setAnswered((previous) => [
        ...previous,
        { score: payload.score as number, confidence, isCorrect: Boolean(payload.isCorrect) }
      ]);
      startTransition(onGraded);
    } catch (gradeError) {
      setError(gradeError instanceof Error ? gradeError.message : "Something went wrong.");
    } finally {
      setGrading(false);
    }
  }

  function next() {
    setIndex((value) => value + 1);
    setSelected(null);
    setWritten("");
    setResult(null);
  }

  if (!hasMaterials) {
    return (
      <div className="modeEmpty">
        <h2>Quiz mode needs material to quiz you on.</h2>
        <p>Add and process a document, then Studigo writes questions only from what's in it.</p>
      </div>
    );
  }

  if (!questions.length || finished) {
    const average = answered.length
      ? Math.round(answered.reduce((sum, item) => sum + item.score, 0) / answered.length)
      : null;
    const blindSpots = answered.filter((item) => item.confidence === 3 && !item.isCorrect).length;
    const luckyGuesses = answered.filter((item) => item.confidence === 1 && item.isCorrect).length;

    return (
      <div className="quizSetup">
        {finished && average !== null && (
          <div className="quizScoreCard">
            <span className="tinyLabel">SET COMPLETE</span>
            <strong>{average}%</strong>
            <small>
              {answered.filter((item) => item.isCorrect).length} of {answered.length} right · your
              mastery has been updated
            </small>
            {blindSpots > 0 && (
              <p className="calibrationNote">
                You were confident on {blindSpots} answer{blindSpots === 1 ? "" : "s"} you got
                wrong. Those are blind spots — Weak Areas now ranks them first.
              </p>
            )}
            {blindSpots === 0 && luckyGuesses > 0 && (
              <p className="calibrationNote">
                You guessed right {luckyGuesses} time{luckyGuesses === 1 ? "" : "s"}. Worth another
                pass before you count it as known.
              </p>
            )}
          </div>
        )}

        <span className="tinyLabel">PRACTICE WHAT'S TESTABLE</span>
        <h2>{finished ? "Go again?" : "Build a practice set."}</h2>
        <p>
          Five questions written from this room's materials — multiple choice, true/false, fill in
          the blank, and short answer. Leave the topic on “Where I'm weakest” and Studigo picks the
          one you need most.
        </p>

        <label className="field">
          <span>Topic</span>
          <select value={topicId} onChange={(event) => setTopicId(event.target.value)}>
            <option value="">Where I'm weakest</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title} · {Math.round(topic.mastery_score)}%
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className="formError" role="alert">
            {error}
          </p>
        )}

        <button className="buttonPrimary" type="button" onClick={() => void build()} disabled={loading}>
          {loading ? "Writing questions…" : "Start quiz"} <span aria-hidden="true">→</span>
        </button>
      </div>
    );
  }

  return (
    <div className="quizMode">
      <div className="quizProgress">
        <span className="tinyLabel">
          QUESTION {index + 1} OF {questions.length} · {KIND_LABELS[current.kind]}
        </span>
        <div className="quizBar">
          <i style={{ width: `${(index / questions.length) * 100}%` }} />
        </div>
      </div>

      <h2 className="quizPrompt">
        {current.kind === "fill_blank" ? (
          <BlankPrompt prompt={current.prompt} filled={written.trim()} />
        ) : (
          current.prompt
        )}
      </h2>

      {usesChoices && (
        <div
          className={`choiceList ${current.kind === "true_false" ? "choiceListBinary" : ""}`}
          role="radiogroup"
          aria-label="Answer choices"
        >
          {current.choices.map((choice, choiceIndex) => {
            const state = !result
              ? selected === choiceIndex
                ? "choiceSelected"
                : ""
              : choiceIndex === result.correctChoice
                ? "choiceCorrect"
                : choiceIndex === selected
                  ? "choiceWrong"
                  : "";

            return (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={selected === choiceIndex}
                className={`choiceItem ${state}`}
                disabled={Boolean(result)}
                onClick={() => setSelected(choiceIndex)}
              >
                <i>
                  {current.kind === "true_false"
                    ? choiceIndex === 0
                      ? "T"
                      : "F"
                    : String.fromCharCode(65 + choiceIndex)}
                </i>
                {choice}
              </button>
            );
          })}
        </div>
      )}

      {current.kind === "fill_blank" && (
        <input
          className="blankInput"
          value={written}
          onChange={(event) => setWritten(event.target.value)}
          placeholder="The missing word or phrase…"
          aria-label="Fill in the blank"
          maxLength={120}
          autoComplete="off"
          disabled={Boolean(result)}
        />
      )}

      {current.kind === "short_answer" && (
        <textarea
          className="shortAnswer"
          value={written}
          onChange={(event) => setWritten(event.target.value)}
          placeholder="Answer in a sentence or two…"
          rows={4}
          disabled={Boolean(result)}
        />
      )}

      {error && (
        <p className="formError" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className={`quizFeedback ${result.isCorrect ? "feedbackRight" : "feedbackWrong"}`}>
          <span className="answerKicker">
            {result.isCorrect ? "CORRECT" : "NOT QUITE"} · {result.score}%
          </span>
          {result.confidence === 3 && !result.isCorrect && (
            <p className="blindSpotFlag">
              You were confident here. This is a blind spot worth a second look.
            </p>
          )}
          {result.confidence === 1 && result.isCorrect && (
            <p className="blindSpotFlag">
              You knew that one — you just didn't trust it yet.
            </p>
          )}
          <p>{result.feedback}</p>
          {result.expectedAnswer && !result.isCorrect && (
            <p className="expectedAnswer">
              <strong>Model answer:</strong> {result.expectedAnswer}
            </p>
          )}
          {result.explanation && result.explanation !== result.feedback && (
            <p className="answerText">{result.explanation}</p>
          )}
          <CitationChips citations={result.citations ?? []} />
        </div>
      )}

      <div className="quizActions">
        {result ? (
          <button className="buttonPrimary" type="button" onClick={next}>
            {index + 1 === questions.length ? "See results" : "Next question"}{" "}
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          <div className="confidenceRow">
            <span className="tinyLabel">
              {hasAnswer ? "HOW SURE ARE YOU?" : "ANSWER TO CONTINUE"}
            </span>
            <div className="confidenceButtons">
              {CONFIDENCE_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  className={`confidenceButton confidence-${level.value}`}
                  disabled={grading || !hasAnswer}
                  onClick={() => void submit(level.value)}
                >
                  <strong>{level.label}</strong>
                  <small>{level.hint}</small>
                </button>
              ))}
            </div>
            <small className="hintText">
              {grading ? "Checking…" : "Your answer is checked when you rate it."}
            </small>
          </div>
        )}
      </div>
    </div>
  );
}
