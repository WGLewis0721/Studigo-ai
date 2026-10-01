"use client";

import type { Topic } from "@/lib/rooms";
import type { WeakArea } from "@/lib/study-planning";

/**
 * Wide screens only (CSS hides it elsewhere): the room's own numbers beside the chat.
 * Everything here is read from the room's topics and the practice already saved. It never
 * invents a figure: a topic that has not been practiced says so instead of showing a score.
 */
export function CoachAside({
  topics,
  areas,
  selectedTitle,
  onSelect,
  onAllTopics
}: {
  topics: Topic[];
  areas: WeakArea[];
  selectedTitle: string;
  onSelect: (topic: Topic) => void;
  onAllTopics: () => void;
}) {
  const current = topics.find((topic) => topic.title === selectedTitle);
  if (!current) return null;

  const practiced = Boolean(current.last_practiced_at);
  const score = Math.round(Number(current.mastery_score));
  const next = areas.filter((area) => area.topic.id !== current.id).slice(0, 4);
  const terms = (current.key_terms ?? []).slice(0, 8);

  return (
    <aside className="coachAside" aria-label="Topic overview">
      <section className="asideCard">
        <span className="tinyLabel">CURRENT TOPIC</span>
        <h3>{current.title}</h3>
        {current.objective && current.objective !== current.title && <p>{current.objective}</p>}
        <div className="asideMeter" data-practiced={practiced}>
          <div className="asideMeterBar" aria-hidden="true">
            <span style={{ width: `${practiced ? Math.max(4, Math.min(100, score)) : 0}%` }} />
          </div>
          <small>{practiced ? `${score}% · ${current.status === "mastered" ? "Strong" : "Needs work"}` : "Not practiced yet"}</small>
        </div>
        {terms.length > 0 && (
          <ul className="asideTerms" aria-label="Key terms">
            {terms.map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ul>
        )}
      </section>

      {next.length > 0 && (
        <section className="asideCard">
          <span className="tinyLabel">WORK ON NEXT</span>
          <ul className="asideList">
            {next.map((area) => (
              <li key={area.topic.id}>
                <button type="button" onClick={() => onSelect(area.topic)}>
                  <strong>{area.topic.title}</strong>
                  <small>{area.label}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {topics.length > 1 && (
        <button type="button" className="asideAll" onClick={onAllTopics}>
          All {topics.length} topics <span aria-hidden="true">→</span>
        </button>
      )}
    </aside>
  );
}
