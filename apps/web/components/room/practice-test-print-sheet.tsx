import { RichText } from "./rich-text";
import type { PracticeTestResult } from "./practice-test-results";

/**
 * This report is rendered in a portal directly under <body>, outside the
 * Study Room's scrolling and clipping layout. It never depends on the
 * on-screen <details> state, so every submitted answer is always printable.
 */
export function PracticeTestPrintSheet({
  result,
  createdAt
}: {
  result: PracticeTestResult;
  createdAt: string;
}) {
  return <article id="studigo-print-sheet" className="studigoPrintSheet">
    <header className="studigoPrintHeader">
      <h1>Studigo · Practice test results</h1>
      <p>Test created {new Date(createdAt).toLocaleDateString()}</p>
      <p><strong>Overall score: {result.score}%</strong> · {result.questionCount} questions</p>
    </header>
    {result.topics.length > 0 && <section className="studigoPrintTopics">
      <h2>Topics</h2>
      {result.topics.map((topic) => <p key={topic.topic_id}>
        <strong>{topic.title}</strong>: {topic.score}% · {topic.misses} missed of {topic.questions}
      </p>)}
    </section>}
    <h2>Question review</h2>
    {result.reviews.map((question, index) => {
      const choiceQuestion = question.kind === "multiple_choice" || question.kind === "true_false";
      const chosen = question.selected_choice;
      const correct = question.correct_choice;
      const selectedText = choiceQuestion
        ? chosen === null ? "Unanswered" : question.choices?.[chosen] ?? "Unanswered"
        : question.response?.trim() || "Unanswered";
      const expectedText = choiceQuestion
        ? correct === null ? "Not available" : question.choices?.[correct] ?? "Not available"
        : question.expected_answer || "Not available";
      return <section key={question.id} className="studigoPrintQuestion">
        <div className="studigoPrintQuestionHeading">
          <h3>Question {index + 1}</h3>
          <strong>{question.is_correct ? "Correct" : "Needs review"} · {question.score}%</strong>
        </div>
        <RichText text={question.kind === "fill_blank" ? question.prompt.replace("____", "______") : question.prompt} />
        {choiceQuestion && <ol type="A" className="studigoPrintChoices">
          {(question.choices ?? []).map((choice, i) => <li key={i}>
            {choice}
            {i === correct && <strong> (Correct answer{chosen === i ? "; your answer" : ""})</strong>}
            {i === chosen && i !== correct && <strong> (Your answer)</strong>}
          </li>)}
        </ol>}
        <div className="studigoPrintResponse"><strong>Your answer:</strong> <RichText text={selectedText} /></div>
        <div className="studigoPrintResponse"><strong>Expected answer:</strong> <RichText text={expectedText} /></div>
        {question.feedback && <div className="studigoPrintExplanation"><strong>Feedback</strong><RichText text={question.feedback} /></div>}
        {question.explanation && question.explanation !== question.feedback &&
          <div className="studigoPrintExplanation"><strong>Explanation</strong><RichText text={question.explanation} /></div>}
        {(question.citations ?? []).length > 0 && <p className="studigoPrintSources">
          <strong>Sources:</strong> {question.citations.map((source) =>
            [source.documentName, source.pageNumber ? `page ${source.pageNumber}` : null].filter(Boolean).join(", ")
          ).join("; ")}
        </p>}
      </section>;
    })}
  </article>;
}
