"use client";

import { topicEvidenceLabel, practiceCoverage } from "@/lib/progress-view";
import type { Calibration, WeakArea } from "@/lib/study-planning";
import type { RoomReadiness, Topic } from "@/lib/rooms";
import { HeaderMascot } from "./mode-header";
import "./phase3-rooms.css";

function ReadinessRing({ value, practiced }: { value: number; practiced: boolean }) {
  return (
    <div className="progressRing" role="img" aria-label={practiced ? `${value} percent of topics practiced. This is coverage, not a grade.` : "No topics practiced yet"}>
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
        <strong>{practiced ? `${value}%` : "–"}</strong>
        <span>{practiced ? "practiced" : "not practiced"}</span>
      </div>
    </div>
  );
}

export function MasteryPanel({
  topics,
  readiness,
  onPractice, onOpenMaterials, areas, calibration
}: {
  topics: Topic[];
  areas: WeakArea[];
  readiness: RoomReadiness;
  calibration: Calibration;
  onPractice: (topicId: string) => void;
  onOpenMaterials: () => void;
}) {
  const practiced = readiness.practicedTopicCount > 0;
  const canonical = topics.some(topic=>topic.canonical);
  const weakest = areas.slice(0, 3);

  // One pass decides each tile's state, so the legend counts and the tiles can never disagree.
  const tiles = topics.map((topic) => {
    const isNew = topic.canonical ? topic.canonical.stage === "not_checked" : !topic.last_practiced_at;
    const blind = Boolean(topic.canonical?.needsCheck) || (!isNew && (areas.find((a) => a.topic.id === topic.id)?.blindSpots ?? 0) > 0);
    const state = blind ? "blind" : isNew ? "new" : topic.status === "mastered" ? "mastered" : "learning";
    const score = Math.round(Number(topic.mastery_score));
    const label = topicEvidenceLabel(topic);

    return { topic, state, score, label };
  });
  const count = (state: string) => tiles.filter((tile) => tile.state === state).length;

  return (
    <div className="masteryMode roomEvidence">
      <div className="masteryHero">
        <HeaderMascot state="explain" />
        <div className="masteryHeroText">
          <span className="tinyLabel">PROGRESS / SAVED PRACTICE</span>
          <h2>{practiced ? "What you have practiced" : "Start with one topic"}</h2>
          <p>
            {!topics.length
              ? "Build a topic map first."
              : !practiced
                ? "Practice a topic to start measuring."
                : `${readiness.practicedTopicCount} of ${readiness.topicCount} topics practiced.`}
          </p>

        </div>
        <ReadinessRing value={practiceCoverage(readiness.practicedTopicCount, readiness.topicCount)} practiced={practiced} />
      </div>

      {weakest.length > 0 && (
        <section className="weakSpots">
          <span className="tinyLabel">YOUR NEXT USEFUL ACTION</span>
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
                <button type="button" aria-label={`Practice ${area.topic.title}`} onClick={() => onPractice(area.topic.id)}>
                  Practice topic →
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!topics.length && <button type="button" className="buttonPrimary roomEvidenceStart" onClick={onOpenMaterials}>Add materials →</button>}
      {!practiced && topics.length > 0 && <button type="button" className="buttonPrimary roomEvidenceStart" onClick={() => onPractice(topics[0].id)}>Practice {topics[0].title} <span aria-hidden="true">→</span></button>}

      <section className="masteryDeck" aria-labelledby="mastery-map-title">
        <div className="mdHead">
          <div>
            <span className="tinyLabel" id="mastery-map-title">EVERY TOPIC</span>
            <b>{topics.length ? `${topics.length} topics on the map` : "No topics yet"}</b>
          </div>
          <dl className="mdLegend" aria-label="Tile key">
            <div><dt><i className="lg-mastered" />{canonical?"Applied independently":"Strong"} <span>{count("mastered")}</span></dt></div>
            <div><dt><i className="lg-learning" />{canonical?"Practicing":"Needs work"} <span>{count("learning")}</span></dt></div>
            <div><dt><i className="lg-blind" />{canonical?"Needs check":"Blind spot"} <span>{count("blind")}</span></dt></div>
            <div><dt><i className="lg-new" />{canonical?"Not checked":"Not practiced"} <span>{count("new")}</span></dt></div>
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
                  onClick={() => topic.canonical?.supported === false ? onOpenMaterials() : onPractice(topic.id)}
                  aria-label={`${topic.title}: ${label}. ${topic.canonical?.supported === false ? "Review materials." : "Practice this topic."}`}
                >
                  {topic.priority >= 90 && <em className="mdPriority">HIGH PRIORITY</em>}
                  <b>{topic.title}</b>
                  <small>{label}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mdEmpty">Add a study guide to create the topic map. Once you practice, this view will show earned evidence separately from lesson progress.</p>
        )}
      </section>

      <dl className="statRow">
        <div>
          <dt>Graded quiz answers</dt>
          <dd>{readiness.correctAnswers} / {readiness.questionsAnswered}</dd><small>correct / answered</small>
        </div>
        <div>
          <dt>Cards due</dt>
          <dd>{readiness.cardsDue}</dd>
        </div>
      </dl>

      <details className="evidenceGuide"><summary>Where these numbers come from</summary>
        <p>Topic coverage counts topics with saved practice. It is not a predicted test grade. Reading a lesson does not add mastery.</p>
        <p>Graded quiz answers include submitted quizzes and practice tests. Flashcard ratings are self-reported and are counted separately from correct answers. Cards due comes from your saved review schedule.</p>
        <p>Topic labels show the saved learning stage when available. Older topics show their saved practice score, which can include card self-ratings. Confidence compares rated quiz answers only.</p>
      </details>
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
