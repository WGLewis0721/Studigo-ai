"use client";

import { topicEvidenceLabel } from "@/lib/progress-view";
import type { Topic } from "@/lib/rooms";

/**
 * The setup screen's topic list, with the same progress readout on every size.
 * Selection is explicit; generated content uses only the checked room topics.
 * A topic with no saved practice shows an empty bar, never a score.
 */
export function TopicReadout({
  topics,
  selectedIds,
  onToggle,
  onSelectAll,
  disabled = false,
  heading,
  className = "",
}: {
  topics: Topic[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  disabled?: boolean;
  heading: string;
  className?: string;
}) {
  if (!topics.length) return null;
  return (
    <aside className={`topicReadout ${className}`} data-selectable="true" aria-label={heading}>
      <div className="trHeading">
        <span className="tinyLabel">{heading}</span>
        <button type="button" className="trSelectAll" disabled={disabled || selectedIds.length === topics.length} onClick={onSelectAll}>Select all</button>
      </div>
      <p className="trCount" role="status">{selectedIds.length} of {topics.length} topics selected</p>
      <ul>
        {topics.map((topic) => {
          const practiced = Boolean(topic.last_practiced_at);
          const score = Math.round(Number(topic.mastery_score));
          return (
            <li key={topic.id}>
              <label className="trRow trChoice">
                <input type="checkbox" aria-label={`Select ${topic.title}`} checked={selectedIds.includes(topic.id)} disabled={disabled} onChange={() => onToggle(topic.id)} />
                <span className="trName">{topic.title}</span>
                <span className="trMeter" aria-hidden="true" data-state={!practiced ? "new" : topic.status === "mastered" ? "mastered" : "learning"}>
                  <i style={{ width: `${practiced ? Math.max(4, Math.min(100, score)) : 0}%` }} />
                </span>
                <small>{topicEvidenceLabel(topic)}</small>
              </label>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
