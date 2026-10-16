"use client";

import { TopicReadout } from "./topic-readout";
import { useRef, useState, useTransition } from "react";
import type { Topic } from "@/lib/rooms";
import { createGestureBook, operationHeaders } from "@/lib/ai-operation-client";
import { CitationChips, type Citation } from "./citations";
import { StudigoMascot } from "@/components/studigo-mascot";
import { ChipSelect, HeaderChip, HeaderMascot } from "./mode-header";
import { useCompanion } from "@/components/companion/companion";
import { StudigoFigure } from "@/components/companion/figure";
import "./phase3-rooms.css";

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
 * Confidence is collected alongside an answer. Phase 3 uses a separate submit
 * action; the legacy presentation keeps confidence-as-submit for rollback.
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
  onGraded,
  phase3Ui
}: {
  roomId: string;
  topics: Topic[];
  hasMaterials: boolean;
  initialTopicId: string | null;
  onGraded: () => void;
  phase3Ui?: boolean;
}) {
  const [topicId, setTopicId] = useState<string>(initialTopicId ?? "");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [confidenceDraft, setConfidenceDraft] = useState<1 | 2 | 3 | null>(null);
  const [written, setWritten] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [loading, setLoading] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gestures = useRef(createGestureBook());
  const [, startTransition] = useTransition();
  const companion = useCompanion();

  const current = questions[index];
  const finished = questions.length > 0 && index >= questions.length;
  const usesChoices = current?.kind === "multiple_choice" || current?.kind === "true_false";
  const hasAnswer = usesChoices ? selected !== null : written.trim().length > 0;
  const phase3 = phase3Ui ?? process.env.NEXT_PUBLIC_STUDIGO_PHASE3_FOUNDATION_UI === "1";

  async function build() {
    const body = JSON.stringify({ roomId, topicId: topicId || null, count: 5 });
    const attempt = gestures.current.begin("quiz-build", body);
    if (!attempt.started) return;
    setLoading(true);
    setError(null);
    setAnswered([]);
    try {
      const response = await fetch("/api/quiz", { method: "POST", headers: operationHeaders(attempt.id), body });
      gestures.current.finish("quiz-build", response.status);
      const payload = await response.json();
      if (response.status === 202 || response.status === 409 || !response.ok) {
        throw new Error(payload.error || "Could not build a quiz.");
      }

      setQuestions(payload.questions as Question[]);
      setIndex(0);
      setSelected(null);
      setConfidenceDraft(null);
      setWritten("");
      setResult(null);
    } catch (buildError) {
      gestures.current.abort("quiz-build");
      setError(buildError instanceof Error ? buildError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(confidence: 1 | 2 | 3) {
    if (!current || grading || !hasAnswer) return;
    const body = JSON.stringify({
      questionId: current.id,
      selectedChoice: usesChoices ? selected : null,
      response: usesChoices ? null : written,
      confidence
    });
    const attempt = gestures.current.begin(`quiz-grade:${current.id}`, body);
    if (!attempt.started) return;

    setGrading(true);
    setError(null);
    try {
      const response = await fetch("/api/quiz/attempt", { method: "POST", headers: operationHeaders(attempt.id), body });
      gestures.current.finish(`quiz-grade:${current.id}`, response.status);
      const payload = await response.json();
      if (response.status === 202 || response.status === 409 || !response.ok) {
        throw new Error(payload.error || "Could not grade that answer.");
      }

      setResult(payload as Result);
      setAnswered((previous) => [
        ...previous,
        { score: payload.score as number, confidence, isCorrect: Boolean(payload.isCorrect) }
      ]);
      companion.event(payload.isCorrect ? "correct" : confidence === 3 ? "blindspot" : "wrong");
      startTransition(onGraded);
    } catch (gradeError) {
      gestures.current.abort(`quiz-grade:${current.id}`);
      setError(gradeError instanceof Error ? gradeError.message : "Something went wrong.");
    } finally {
      setGrading(false);
    }
  }

  function next() {
    if (index + 1 >= questions.length) companion.event("setDone");
    setIndex((value) => value + 1);
    setSelected(null);
    setConfidenceDraft(null);
    setWritten("");
    setResult(null);
  }

  if (!hasMaterials) {
    return (
      <div className="modeEmpty">
        <HeaderMascot state="sources" />
        <h3>Nothing to quiz on yet.</h3>
        <p>Add and process a document, then Studigo writes questions only from what&apos;s in it.</p>
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
      <div className="quizSetup roomStudioSetup">
        <div className="setupMain">
        {finished && average !== null && (
          <div className="quizScoreCard">
            <StudigoFigure pose="celebrate" label="Studigo celebrating" />
            <span className="tinyLabel">SET COMPLETE</span>
            <strong>{average}%</strong>
            <small>
              {answered.filter((item) => item.isCorrect).length} of {answered.length} right · your
              mastery has been updated
            </small>
            {blindSpots > 0 && (
              <p className="calibrationNote">
                You were confident on {blindSpots} answer{blindSpots === 1 ? "" : "s"} you got
                wrong. Those are blind spots. Weak Areas now ranks them first.
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

        <HeaderChip>
          <ChipSelect
            label={topicId ? (topics.find((topic) => topic.id === topicId)?.title ?? "Topic") : "Where I'm weakest"}
            ariaLabel="Quiz topic"
            value={topicId}
            onChange={setTopicId}
            disabled={loading}
          >
            <option value="">Where I&apos;m weakest</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title} · {Math.round(topic.mastery_score)}%
              </option>
            ))}
          </ChipSelect>
        </HeaderChip>

        <div className="setupHeading">
          <span className="tinyLabel">PRACTICE STUDIO / INDEPENDENT RECALL</span>
          <h3>{topicId ? (topics.find((topic) => topic.id === topicId)?.title ?? "Topic") : "Where you\u2019re weakest"}</h3>
        </div>
        <p className="setupLead">{finished ? "Go again with a new set." : "Five questions from your materials. Your answers are checked only after you submit each one."}</p>

        {error && (
          <p className="formError" role="alert">
            {error}
          </p>
        )}

        <button className="buttonPrimary" type="button" onClick={() => void build()} disabled={loading}>
          {loading ? "Writing questions…" : "Start quiz"} <span aria-hidden="true">→</span>
        </button>
        </div>
        <TopicReadout topics={topics} selectedId={topicId} onSelect={setTopicId} heading="TOPICS AND MASTERY" allLabel="Where I'm weakest" allHint="Studigo picks" />
      </div>
    );
  }

  return (
    <div className="quizMode roomStudioAttempt">
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
      {phase3 && !result && <p className="roomStudioInstruction">{usesChoices ? "Choose one answer. You can change it until you submit." : "Write your answer, then choose how sure you feel before submitting."}</p>}

      {usesChoices && (
        <div
          className={`choiceList ${current.kind === "true_false" ? "choiceListBinary" : ""}`}
          role={phase3 ? "group" : "radiogroup"}
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
                role={phase3 ? undefined : "radio"}
                aria-checked={phase3 ? undefined : selected === choiceIndex}
                aria-pressed={phase3 ? selected === choiceIndex : undefined}
                className={`choiceItem ${state}`}
                disabled={Boolean(result) || grading}
                onClick={() => setSelected(choiceIndex)}
              >
                <i>
                  {current.kind === "true_false"
                    ? choiceIndex === 0
                      ? "T"
                      : "F"
                    : String.fromCharCode(65 + choiceIndex)}
                </i>
                <span>{choice}</span>
                {result && choiceIndex === result.correctChoice && (
                  <b className="choiceVerdict">
                    {choiceIndex === selected ? "✓ Your answer" : "✓ Correct answer"}
                  </b>
                )}
                {result && choiceIndex === selected && choiceIndex !== result.correctChoice && (
                  <b className="choiceVerdict">✕ Your answer</b>
                )}
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
          disabled={Boolean(result) || grading}
        />
      )}

      {current.kind === "short_answer" && (
        <textarea
          className="shortAnswer"
          aria-label="Your answer"
          value={written}
          onChange={(event) => setWritten(event.target.value)}
          placeholder="Answer in a sentence or two…"
          rows={4}
          disabled={Boolean(result) || grading}
        />
      )}

      {error && (
        <p className="formError" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className={`quizFeedback ${result.isCorrect ? "feedbackRight" : "feedbackWrong"}`} role="status">
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
              A correct guess is a good start. Try this idea again to check your recall.
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
            <div className="confidenceButtons" role={phase3 ? "group" : undefined} aria-label={phase3 ? "How sure are you?" : undefined}>
              {CONFIDENCE_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  className={`confidenceButton confidence-${level.value}`}
                  disabled={grading || !hasAnswer}
                  aria-pressed={phase3 ? confidenceDraft === level.value : undefined}
                  onClick={() => phase3 ? setConfidenceDraft(level.value) : void submit(level.value)}
                >
                  <strong>{level.label}</strong>
                  <small>{level.hint}</small>
                </button>
              ))}
            </div>
            {phase3 && <button className="buttonPrimary roomStudioSubmit" type="button" disabled={grading || !hasAnswer || confidenceDraft === null} onClick={() => { if (confidenceDraft !== null) void submit(confidenceDraft); }}>
              {grading ? "Checking your answer…" : "Submit answer"} <span aria-hidden="true">→</span>
            </button>}
            <small className="hintText">
              {grading ? "Checking…" : phase3 ? "Your selection is not graded until you press Submit answer." : "Your answer is checked when you rate it."}
            </small>
          </div>
        )}
      </div>
    </div>
  );
}
