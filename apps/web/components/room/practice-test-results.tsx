"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PracticeTestPrintSheet } from "./practice-test-print-sheet";
import { AnswerChoices } from "./answer-choices";
import { ReadAloudControl } from "./read-aloud-control";
import { TestQuestionPrompt } from "./test-question-prompt";
import { RichText } from "./rich-text";
import { CitationChips, type Citation } from "./citations";
import { HeaderMascot } from "./mode-header";

type QuestionKind = "multiple_choice" | "true_false" | "fill_blank" | "short_answer";
type Review = {
  id: string;
  kind: QuestionKind;
  prompt: string;
  choices: string[];
  topic_id: string;
  score: number;
  is_correct: boolean;
  feedback: string;
  explanation: string;
  expected_answer: string | null;
  correct_choice: number | null;
  citations: Citation[];
  response: string | null;
  selected_choice: number | null;
};
export type PracticeTestResult = {
  score: number;
  questionCount: number;
  topics: Array<{ topic_id: string; title: string; questions: number; score: number; misses: number }>;
  reviews: Review[];
};

export function PracticeTestResults({ result, createdAt, onReviewTopic, onBack }: {
  result: PracticeTestResult;
  createdAt: string;
  onReviewTopic: (topicId: string) => void;
  onBack: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const [printHost, setPrintHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setPrintHost(document.body); }, []);
  const details = () => Array.from(root.current?.querySelectorAll<HTMLDetailsElement>("details.testReview") ?? []);

  function expandAll(open: boolean) {
    details().forEach((item) => { item.open = open; });
  }
  return <>
    <section id="studigo-test-print" ref={root} className="testResults roomStudioResults">
    <HeaderMascot state={result.score >= 80 ? "celebrate" : "explain"} />
    <div className="testResultsPrintHeading">
      <h2>Studigo · Practice test results</h2>
      <p>Test created {new Date(createdAt).toLocaleDateString()}</p>
    </div>
    <p className="setupLead">{result.score >= 80 ? "A strong rehearsal. Review each miss below." : "Now you know where to focus."}</p>
    <div className="testScore"><strong>{result.score}%</strong><span>{result.questionCount} questions · full test submitted</span></div>
    <div className="testTopicResults" role="group" aria-label="Scores by topic">{result.topics.map((topic) =>
      <button key={topic.topic_id} type="button" className={topic.misses ? "testTopicTile testTopicMissed" : "testTopicTile"}
        style={{ ["--v" as string]: `${topic.score}%` }}
        onClick={() => onReviewTopic(topic.topic_id)}
        aria-label={`${topic.title}: ${topic.score}% on this test, ${topic.misses} missed of ${topic.questions}. Review topic.`}>
        <strong>{topic.title}</strong><b>{topic.score}%</b><span>{topic.misses} missed / {topic.questions} · Review →</span>
      </button>)}</div>
    <div className="testReviewToolbar">
      <h3>Review your answers and sources</h3>
      <div className="testReviewControls" role="group" aria-label="Question review controls">
        <button type="button" onClick={() => expandAll(true)}>Expand all</button>
        <button type="button" onClick={() => expandAll(false)}>Collapse all</button>
        <button type="button" className="buttonPrimary" disabled={!printHost} onClick={() => window.print()}>Print results</button>
      </div>
    </div>
    <div className="testReviewList">{result.reviews.map((question, index) => {
      const choiceQuestion = question.kind === "multiple_choice" || question.kind === "true_false";
      const answer = question.response?.trim() || "Unanswered";
      return <details key={question.id} className={`testReview ${question.is_correct ? "testReviewCorrect" : "testReviewIncorrect"}`} open={!question.is_correct}>
        <summary>
          <div className="testReviewSummaryTitle">
            <strong>Question {index + 1}</strong>
            <div className="testReviewPromptPreview"><RichText text={question.prompt} /></div>
          </div>
          <span className="testReviewSummaryStatus">
            <span aria-hidden="true">{question.is_correct ? "✓" : "✕"}</span>
            {question.is_correct ? "Correct" : "Needs review"} · {question.score}%
          </span>
        </summary>
        <div className="testReviewContent">
          <TestQuestionPrompt prompt={question.prompt} kind={question.kind} />
          {choiceQuestion ?
            <AnswerChoices choices={question.choices ?? []} selected={question.selected_choice} onSelect={() => {}} disabled
              binary={question.kind === "true_false"} result={{ correctChoice: question.correct_choice }} /> :
            <div className="testReviewWritten"><span>Your answer</span>
              <div className={question.kind === "fill_blank" ? "blankInput" : "shortAnswer"} aria-label="Submitted answer">
                <RichText text={answer} />
              </div>
            </div>}
          {choiceQuestion ? <p className="testReviewAnswer"><strong>Your answer:</strong> {question.selected_choice === null ? "Unanswered" : question.choices?.[question.selected_choice] ?? "Unanswered"}</p> : null}
          <div className="testReviewAnswer"><strong>Expected answer:</strong>
            <RichText text={choiceQuestion ? (question.correct_choice === null ? "Not available" : question.choices?.[question.correct_choice] ?? "Not available") : question.expected_answer || "Not available"} />
          </div>
          {question.feedback && <div className="testReviewFeedback"><strong>Feedback</strong><RichText text={question.feedback} /></div>}
          {question.explanation && question.explanation !== question.feedback &&
            <div className="testReviewExplanation"><strong>Explanation</strong><RichText text={question.explanation} /></div>}
          <ReadAloudControl text={[question.feedback, question.explanation].filter(Boolean).join(" ")} label="Read review feedback aloud" />
          <CitationChips citations={question.citations ?? []} />
        </div>
      </details>;
    })}</div>
    <button className="buttonPrimary testReviewBack" type="button" onClick={onBack}>Back to practice tests →</button>
    </section>
    {printHost && createPortal(<PracticeTestPrintSheet result={result} createdAt={createdAt} />, printHost)}
  </>;
}
