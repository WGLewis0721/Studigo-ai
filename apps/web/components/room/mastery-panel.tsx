"use client";

import type { RoomReadiness, Topic } from "@/lib/rooms";

function ReadinessRing({ value, practiced }: { value: number; practiced: boolean }) {
  return (
    <div className="progressRing" aria-label={`${value} percent test ready`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="ringTrack" cx="60" cy="60" r="49" />
        <circle
          className="ringValue"
          cx="60"
          cy="60"
          r="49"
          pathLength={100}
          style={{ strokeDasharray: `${value} 100` }}
        />
      </svg>
      <div className="ringLabel">
        <strong>{practiced ? `${value}%` : "—"}</strong>
        <span>ready</span>
      </div>
    </div>
  );
}

export function MasteryPanel({
  topics,
  readiness,
  onPractice
}: {
  topics: Topic[];
  readiness: RoomReadiness;
  onPractice: (topicId: string) => void;
}) {
  const practiced = readiness.questionsAnswered > 0;
  const weakest = [...topics]
    .filter((topic) => topic.status !== "mastered")
    .sort((a, b) => Number(a.mastery_score) - Number(b.mastery_score))
    .slice(0, 3);

  return (
    <div className="masteryMode">
      <div className="masteryHero">
        <div>
          <span className="tinyLabel">TEST READINESS</span>
          <h2>
            {!topics.length
              ? "Build a topic map first."
              : !practiced
                ? "Nothing measured yet."
                : readiness.readiness >= 80
                  ? "You're in good shape."
                  : "Keep the streak moving."}
          </h2>
          <p>
            {!practiced
              ? "Readiness is calculated from questions you actually answer — it stays blank until you practice."
              : `Across ${readiness.topicCount} topics, weighted so unpracticed topics count as zero. ${readiness.correctAnswers} of ${readiness.questionsAnswered} answers correct.`}
          </p>
        </div>
        <ReadinessRing value={readiness.readiness} practiced={practiced} />
      </div>

      <dl className="statRow">
        <div>
          <dt>Topics mastered</dt>
          <dd>
            {readiness.masteredCount} / {readiness.topicCount}
          </dd>
        </div>
        <div>
          <dt>Topics practiced</dt>
          <dd>
            {readiness.practicedTopicCount} / {readiness.topicCount}
          </dd>
        </div>
        <div>
          <dt>Questions answered</dt>
          <dd>{readiness.questionsAnswered}</dd>
        </div>
        <div>
          <dt>Cards due</dt>
          <dd>{readiness.cardsDue}</dd>
        </div>
      </dl>

      {weakest.length > 0 && (
        <section className="weakSpots">
          <span className="tinyLabel">PRACTICE THIS NEXT</span>
          <ul>
            {weakest.map((topic) => (
              <li key={topic.id}>
                <div>
                  <strong>{topic.title}</strong>
                  <small>
                    {topic.last_practiced_at
                      ? `${Math.round(topic.mastery_score)}% mastery`
                      : "Not practiced yet"}
                  </small>
                </div>
                <button type="button" onClick={() => onPractice(topic.id)}>
                  Practice →
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="masteryTable">
        <span className="tinyLabel">EVERY TOPIC</span>
        <ul>
          {topics.map((topic) => (
            <li key={topic.id}>
              <div className="masteryTopicName">
                <strong>{topic.title}</strong>
                {topic.priority >= 90 && <b className="priorityTag">ON THE TEST</b>}
              </div>
              <div className="masteryBar">
                <i
                  className={`masteryFill ${topic.status}`}
                  style={{ width: `${Math.max(2, Number(topic.mastery_score))}%` }}
                />
              </div>
              <span className="masteryValue">{Math.round(topic.mastery_score)}%</span>
            </li>
          ))}
          {!topics.length && (
            <li className="emptyState">
              Upload a study guide so Studigo knows what to measure you against.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
