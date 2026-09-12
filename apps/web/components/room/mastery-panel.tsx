"use client";

import type { WeakArea } from "@/lib/study-planning";
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
  onPractice, areas
}: {
  topics: Topic[];
  areas: WeakArea[];
  readiness: RoomReadiness;
  onPractice: (topicId: string) => void;
}) {
  const practiced = readiness.practicedTopicCount > 0;
  const weakest = areas.slice(0, 3);

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
                  : "Here is what holds readiness back."}
          </h2>
          <p>
            {!practiced
              ? "Readiness comes from saved quiz answers and flashcard recall — it stays blank until you practice a topic."
              : `Across ${readiness.topicCount} topics, weighted so unpracticed topics count as zero. ${readiness.correctAnswers} of ${readiness.questionsAnswered} saved practice responses successful.`}
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
          <dt>Practice responses</dt>
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
            {weakest.map((area) => (
              <li key={area.topic.id}>
                <div>
                  <strong>{area.topic.title}</strong>
                  <small>{area.reasons.slice(0, 2).join(" ")}</small>
                </div>
                <button type="button" onClick={() => onPractice(area.topic.id)}>
                  Practice →
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="readinessBreakdown">
        {[{name:"Strong",items:topics.filter(t=>t.status==="mastered")},{name:"Needs work",items:topics.filter(t=>t.last_practiced_at&&t.status!=="mastered")},{name:"Not practiced",items:topics.filter(t=>!t.last_practiced_at)}].map(group=><section key={group.name}><h3>{group.name} <span>{group.items.length}</span></h3><ul>{group.items.map(t=><li key={t.id}><button onClick={()=>onPractice(t.id)}>{t.title} →</button></li>)}</ul>{!group.items.length&&<p>None here.</p>}</section>)}
      </div>
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
