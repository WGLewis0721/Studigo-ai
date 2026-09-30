"use client";

import type { Calibration, WeakArea } from "@/lib/study-planning";
import type { RoomReadiness, Topic } from "@/lib/rooms";
import { PageHead } from "./page-head";

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
  onPractice, areas, calibration
}: {
  topics: Topic[];
  areas: WeakArea[];
  readiness: RoomReadiness;
  calibration: Calibration;
  onPractice: (topicId: string) => void;
}) {
  const practiced = readiness.practicedTopicCount > 0;
  const weakest = areas.slice(0, 3);

  // One pass decides each tile's state, so the legend counts and the tiles can never disagree.
  const tiles = topics.map((topic) => {
    const isNew = !topic.last_practiced_at;
    const blind = !isNew && (areas.find((a) => a.topic.id === topic.id)?.blindSpots ?? 0) > 0;
    const state = blind ? "blind" : isNew ? "new" : topic.status === "mastered" ? "mastered" : "learning";
    const score = Math.round(Number(topic.mastery_score));
    const label = blind
      ? `Blind spot · ${score}%`
      : isNew
        ? "Not practiced"
        : `${score}% · ${state === "mastered" ? "Strong" : "Needs work"}`;
    return { topic, state, score, label };
  });
  const count = (state: string) => tiles.filter((tile) => tile.state === state).length;

  return (
    <div className="masteryMode">
      <div className="masteryHero">
        <PageHead
          title="Mastery"
          state="explain"
          sub={
            !topics.length
              ? "Build a topic map first."
              : !practiced
                ? "Practice a topic to start measuring."
                : `${readiness.correctAnswers} of ${readiness.questionsAnswered} practice answers right.`
          }
        />
        <ReadinessRing value={readiness.readiness} practiced={practiced} />
      </div>

      {weakest.length > 0 && (
        <section className="weakSpots">
          <span className="tinyLabel">PRACTICE THIS NEXT</span>
          <ul>
            {weakest.map((area) => (
              <li key={area.topic.id}>
                <div>
                  <strong>
                    {area.topic.title}
                    {area.blindSpots > 0 && <b className="blindSpotTag">BLIND SPOT</b>}
                  </strong>
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

      <section className="masteryDeck" aria-labelledby="mastery-map-title">
        <div className="mdHead">
          <div>
            <span className="tinyLabel" id="mastery-map-title">EVERY TOPIC</span>
            <b>{topics.length ? `${topics.length} topics on the map` : "No topics yet"}</b>
          </div>
          <dl className="mdLegend" aria-label="Tile key">
            <div><dt><i className="lg-mastered" />Strong <span>{count("mastered")}</span></dt></div>
            <div><dt><i className="lg-learning" />Needs work <span>{count("learning")}</span></dt></div>
            <div><dt><i className="lg-blind" />Blind spot <span>{count("blind")}</span></dt></div>
            <div><dt><i className="lg-new" />Not practiced <span>{count("new")}</span></dt></div>
          </dl>
        </div>
        {topics.length > 0 ? (
          <ul className="mdTiles">
            {tiles.map(({ topic, state, score, label }) => (
              <li key={topic.id}>
                <button
                  type="button"
                  className={`mdTile mdTile-${state}`}
                  style={{ ["--v" as string]: `${Math.max(4, score)}%` }}
                  onClick={() => onPractice(topic.id)}
                  aria-label={`${topic.title}: ${label}. Practice this topic.`}
                >
                  {topic.priority >= 90 && <em className="mdPriority">ON THE TEST</em>}
                  <b>{topic.title}</b>
                  <small>{label}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mdEmpty">Upload a study guide so Studigo knows what to measure you against.</p>
        )}
      </section>

      <dl className="statRow">
        <div>
          <dt>Practice responses</dt>
          <dd>{readiness.questionsAnswered}</dd>
        </div>
        <div>
          <dt>Cards due</dt>
          <dd>{readiness.cardsDue}</dd>
        </div>
      </dl>

      <section className={`calibrationCard calibration-${calibration.label.replace(/\s+/g, "-").toLowerCase()}`}>
        <div>
          <span className="tinyLabel">CONFIDENCE VS PERFORMANCE</span>
          <h3>{calibration.label}</h3>
          <p>{calibration.summary}</p>
        </div>
        {calibration.accuracy !== null && (
          <div className="calibrationScore">
            <strong>{calibration.accuracy}%</strong>
            <small>
              self-read accuracy
              <br />
              over {calibration.reported} rated answers
            </small>
          </div>
        )}
      </section>
    </div>
  );
}
