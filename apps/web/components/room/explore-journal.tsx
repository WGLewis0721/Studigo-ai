"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExploreCursor, ExploreGuide, ExploreTopic } from "@/lib/explore-journal";
import { buildExploreChapters, canSwitchExploreQuest, exploreStatus } from "@/lib/explore-journal";
import "./explore-journal.css";

type Props = {
  roomId: string;
  /** Synthetic visual fixture only. Never a real learner or persisted source. */
  fixture?: boolean;
  topics: ExploreTopic[];
  cursor: ExploreCursor | null;
  sourceCurrent?: boolean;
  busy: boolean;
  error: string | null;
  onStart: (topicId: string) => Promise<boolean>;
  onContinue: () => Promise<boolean>;
  onOpenLesson: () => void;
  onOpenMaterials: () => void;
};

/**
 * A journal, not a grading surface. It can display the current durable cursor
 * but never reconstructs historical quest completion from topic mastery.
 */
export function ExploreJournal({
  roomId, fixture = false, topics, cursor, sourceCurrent, busy, error,
  onStart, onContinue, onOpenLesson, onOpenMaterials
}: Props) {
  const [guide, setGuide] = useState<ExploreGuide | null>(null);
  const [selected, setSelected] = useState<string | null>(cursor?.topic_id ?? topics[0]?.id ?? null);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    if (!cursor?.topic_id) return;
    setSelected(cursor.topic_id);
  }, [cursor?.topic_id]);

  useEffect(() => {
    if (fixture) return;
    const controller = new AbortController();
    // This authorized API only returns the learner's actual persisted guide.
    // A stale edition is not authority for chapter-to-quest membership.
    void fetch(`/api/guides/edition?roomId=${encodeURIComponent(roomId)}`, {
      cache: "no-store", signal: controller.signal
    }).then(async (response) => {
      if (!response.ok) return null;
      return await response.json() as { edition?: ExploreGuide | null; updateAvailable?: boolean };
    }).then((payload) => {
      if (!controller.signal.aborted) setGuide(payload && !payload.updateAvailable ? payload.edition ?? null : null);
    }).catch(() => {
      if (!controller.signal.aborted) setGuide(null);
    });
    return () => controller.abort();
  }, [roomId, fixture]);

  const chapters = useMemo(() => buildExploreChapters(topics, guide), [topics, guide]);
  const activeTopic = topics.find((topic) => topic.id === selected) ?? topics[0] ?? null;
  const status = activeTopic ? exploreStatus(activeTopic.id, cursor, sourceCurrent) : "available";
  const blocked = Boolean(activeTopic && !canSwitchExploreQuest(activeTopic.id, cursor));
  const isCurrent = Boolean(activeTopic && cursor?.topic_id === activeTopic.id);
  const disabled = busy || working;
  const recommendedNext = cursor?.phase === "done" ? [...topics]
    .sort((a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id))
    .find((topic) => topic.order_index > (topics.find((item) => item.id === cursor.topic_id)?.order_index ?? Infinity)) ?? null : null;

  const enter = async () => {
    if (!activeTopic || disabled || blocked || status === "source_changed") return;
    if (isCurrent) {
      if (cursor?.paused) {
        setWorking(true);
        try { if (await onContinue()) onOpenLesson(); }
        finally { setWorking(false); }
      } else onOpenLesson();
      return;
    }
    setWorking(true);
    try { if (await onStart(activeTopic.id)) onOpenLesson(); }
    finally { setWorking(false); }
  };

  return <section className="exploreJournal" aria-label="Explore quest journal">
    {fixture && <p className="learnMissionFixture">Synthetic Explore visual fixture · no saved progress or real source evidence.</p>}
    <header className="exploreJournalHead">
      <div>
        <p className="tinyLabel">LEARN · EXPLORE</p>
        <h2>Quest journal</h2>
        <p>Choose a topic from your materials. Each quest is a guided reading, not a graded test.</p>
      </div>
    </header>
    {error && <p className="formError" role="alert">{error}</p>}
    {topics.length === 0 ? <div className="learnInvitation">
      <h3>No guide topics yet</h3>
      <p>Prepare your study material before starting a learning quest.</p>
      <button className="buttonPrimary" type="button" onClick={onOpenMaterials}>Open Materials</button>
    </div> : <div className="exploreJournalLayout">
      <div className="exploreJournalChapters" aria-label="Chapters and quests">
        {chapters.map((chapter, index) => {
          const closed = collapsed.includes(chapter.id);
          return <section className="exploreJournalChapter" key={chapter.id}>
            <button type="button" className="exploreJournalChapterKey"
              aria-expanded={!closed}
              aria-controls={`explore-chapter-${index}`}
              onClick={() => setCollapsed((old) => closed ? old.filter((id) => id !== chapter.id) : [...old, chapter.id])}>
              <span>{chapter.title}</span><span aria-hidden="true">{closed ? "+" : "−"}</span>
            </button>
            <div id={`explore-chapter-${index}`} hidden={closed}>
              {chapter.quests.map((topic) => {
                const state = exploreStatus(topic.id, cursor, sourceCurrent);
                return <button key={topic.id} type="button"
                  className="exploreJournalQuest"
                  aria-pressed={activeTopic?.id === topic.id}
                  onClick={() => setSelected(topic.id)}>
                  <span className="exploreJournalQuestName">{topic.title}</span>
                  <small>{state === "reading_complete" ? "Reading complete" : state === "in_progress"
                    ? (cursor?.paused ? "Paused" : "In progress") : state === "source_changed" ? "Source changed" : "Available"}</small>
                </button>;
              })}
            </div>
          </section>;
        })}
      </div>
      <div className="exploreJournalDetail">
        <span className="tinyLabel">QUEST DETAILS</span>
        <h3>{activeTopic?.title ?? "Choose a topic"}</h3>
        <p>{activeTopic?.objective || "Learn about this topic using your uploaded study material."}</p>
        <div className="exploreJournalEvidence">
          {status === "source_changed" ? "Your source changed. Review Materials before continuing."
            : isCurrent && sourceCurrent === true ? "Current lesson source verified"
              : "Source evidence is checked when you begin"}
        </div>
        {blocked && <p className="exploreJournalNotice" role="status">
          Your current quest is unfinished. Continue it first; switching now would replace its saved position.
        </p>}
        {status === "reading_complete" && <p className="exploreJournalNotice">
          Guided reading complete. This is not evidence of independent mastery.
        </p>}
        {status === "reading_complete" && recommendedNext && isCurrent && (
          <button type="button" className="ghostButton" onClick={() => setSelected(recommendedNext.id)}>
            Next suggested quest: {recommendedNext.title} →
          </button>
        )}
        <div className="exploreJournalActions">
          {status === "source_changed" ? <button className="buttonPrimary" type="button" onClick={onOpenMaterials}>Open Materials</button>
            : <button className="buttonPrimary" type="button" disabled={disabled || blocked || !activeTopic} onClick={() => void enter()}>
              {disabled ? "Opening…" : isCurrent ? (cursor?.paused ? "Resume quest →" : status === "reading_complete" ? "View completion →" : "Continue quest →") : "Start quest →"}
            </button>}
          <button className="ghostButton" type="button" onClick={onOpenMaterials}>View materials</button>
        </div>
      </div>
    </div>}
  </section>;
}
