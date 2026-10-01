"use client";

import type { Topic } from "@/lib/rooms";

/**
 * A wide-screen companion to a setup screen: every topic with the mastery it has really
 * earned, and a tap to aim the next set at one. CSS shows it only when the page is wide.
 * A topic with no saved practice says "Not practiced" and shows an empty bar, never a score.
 */
export function TopicReadout({
  topics,
  selectedId,
  onSelect,
  heading,
  allLabel,
  allHint
}: {
  topics: Topic[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  heading: string;
  allLabel?: string;
  allHint?: string;
}) {
  if (!topics.length) return null;
  // With no onSelect the list is a read-only summary (the practice test's scope).
  const interactive = Boolean(onSelect);
  const Row = interactive ? "button" : "div";
  return (
    <aside className="topicReadout" aria-label={heading}>
      <span className="tinyLabel">{heading}</span>
      <ul>
        {interactive && allLabel && (
          <li>
            <button type="button" className="trRow trRowAll" aria-pressed={selectedId === ""} onClick={() => onSelect?.("")}>
              <span className="trName">{allLabel}</span>
              <small>{allHint}</small>
            </button>
          </li>
        )}
        {topics.map((topic) => {
          const practiced = Boolean(topic.last_practiced_at);
          const score = Math.round(Number(topic.mastery_score));
          return (
            <li key={topic.id}>
              <Row {...(interactive ? { type: "button" as const, "aria-pressed": selectedId === topic.id, onClick: () => onSelect?.(topic.id) } : {})} className="trRow">
                <span className="trName">{topic.title}</span>
                <span className="trMeter" aria-hidden="true" data-state={!practiced ? "new" : topic.status === "mastered" ? "mastered" : "learning"}>
                  <i style={{ width: `${practiced ? Math.max(4, Math.min(100, score)) : 0}%` }} />
                </span>
                <small>{practiced ? `${score}%` : "Not practiced"}</small>
              </Row>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
