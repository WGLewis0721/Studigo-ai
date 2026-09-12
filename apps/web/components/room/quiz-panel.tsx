"use client";

import { useState, useTransition } from "react";
import type { Topic } from "@/lib/rooms";
import { CitationChips, type Citation } from "./citations";

type Question = {
  id: string;
  kind: "multiple_choice" | "short_answer";
  prompt: string;
  choices: string[];
  difficulty: string;
  topic_id: string | null;
};

type Result = {
  isCorrect: boolean;
  score: number;
  feedback: string;
  correctChoice: number | null;
  expectedAnswer: string | null;
  explanation: string;
  citations: Citation[];
};

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
  const [scores, setScores] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const current = questions[index];
  const finished = questions.length > 0 && index >= questions.length;

  async function build() {
    setLoading(true);
    setError(null);
    setScores([]);
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

  async function submit() {
    if (!current || grading) return;
    if (current.kind === "multiple_choice" && selected === null) return;
    if (current.kind === "short_answer" && !written.trim()) return;

    setGrading(true);
    setError(null);
    try {
      const response = await fetch("/api/quiz/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: current.id,
          selectedChoice: current.kind === "multiple_choice" ? selected : null,
          response: current.kind === "short_answer" ? written : null
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not grade that answer.");

      setResult(payload as Result);
      setScores((previous) => [...previous, payload.score as number]);
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
    const average = scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null;

    return (
      <div className="quizSetup">
        {finished && average !== null && (
          <div className="quizScoreCard">
            <span className="tinyLabel">SET COMPLETE</span>
            <strong>{average}%</strong>
            <small>
              {scores.filter((score) => score >= 60).length} of {scores.length} right · your mastery
              has been updated
            </small>
          </div>
        )}

        <span className="tinyLabel">PRACTICE WHAT'S TESTABLE</span>
        <h2>{finished ? "Go again?" : "Build a practice set."}</h2>
        <p>
          Five questions written from this room's materials. Leave the topic on “Where I'm weakest”
          and Studigo picks the one you need most.
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
          QUESTION {index + 1} OF {questions.length}
        </span>
        <div className="quizBar">
          <i style={{ width: `${(index / questions.length) * 100}%` }} />
        </div>
      </div>

      <h2 className="quizPrompt">{current.prompt}</h2>

      {current.kind === "multiple_choice" ? (
        <div className="choiceList" role="radiogroup" aria-label="Answer choices">
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
                <i>{String.fromCharCode(65 + choiceIndex)}</i>
                {choice}
              </button>
            );
          })}
        </div>
      ) : (
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
          <button
            className="buttonPrimary"
            type="button"
            onClick={() => void submit()}
            disabled={
              grading ||
              (current.kind === "multiple_choice" ? selected === null : !written.trim())
            }
          >
            {grading ? "Checking…" : "Check answer"} <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  );
}
