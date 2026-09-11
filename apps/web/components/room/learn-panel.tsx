"use client";

import { useState, useTransition } from "react";
import type { Topic } from "@/lib/rooms";
import { CitationChips, type Citation } from "./citations";

export function LearnPanel({
  roomId,
  topics,
  hasMaterials,
  onChanged
}: {
  roomId: string;
  topics: Topic[];
  hasMaterials: boolean;
  onChanged: () => void;
}) {
  const [openTopicId, setOpenTopicId] = useState<string | null>(null);
  const [lessons, setLessons] = useState<Record<string, { text: string; citations: Citation[] }>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function open(topic: Topic) {
    const next = openTopicId === topic.id ? null : topic.id;
    setOpenTopicId(next);
    if (!next || lessons[topic.id]) return;

    setLoadingId(topic.id);
    setError(null);
    try {
      const response = await fetch("/api/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, topicId: topic.id })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not build that lesson.");
      setLessons((current) => ({
        ...current,
        [topic.id]: { text: payload.explanation, citations: payload.citations ?? [] }
      }));
    } catch (learnError) {
      setError(learnError instanceof Error ? learnError.message : "Something went wrong.");
    } finally {
      setLoadingId(null);
    }
  }

  async function buildTopicMap() {
    setBuilding(true);
    setError(null);
    try {
      const response = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not build the topic map.");
      startTransition(onChanged);
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : "Something went wrong.");
    } finally {
      setBuilding(false);
    }
  }

  if (!topics.length) {
    return (
      <div className="modeEmpty">
        <h2>No topic map yet.</h2>
        <p>
          Upload a teacher study guide and Studigo reads what it says you need to know. If all you
          have is notes and textbook pages, it can build the map from those instead.
        </p>
        {error && (
          <p className="formError" role="alert">
            {error}
          </p>
        )}
        <button
          className="buttonPrimary"
          type="button"
          disabled={!hasMaterials || building}
          onClick={() => void buildTopicMap()}
        >
          {building ? "Reading your materials…" : "Build the topic map"}{" "}
          <span aria-hidden="true">→</span>
        </button>
        {!hasMaterials && <small className="hintText">Add and process a document first.</small>}
      </div>
    );
  }

  return (
    <div className="learnMode">
      <div className="learnHeader">
        <div>
          <span className="tinyLabel">WHAT THE TEACHER SAYS TO KNOW</span>
          <h2>{topics.length} topics on the map.</h2>
        </div>
        <button className="ghostButton" type="button" onClick={() => void buildTopicMap()} disabled={building}>
          {building ? "Rebuilding…" : "Rebuild from materials"}
        </button>
      </div>

      {error && (
        <p className="formError" role="alert">
          {error}
        </p>
      )}

      <ol className="topicList">
        {topics.map((topic, index) => {
          const isOpen = openTopicId === topic.id;
          const lesson = lessons[topic.id];

          return (
            <li className={`topicItem ${isOpen ? "topicItemOpen" : ""}`} key={topic.id}>
              <button className="topicHead" type="button" onClick={() => void open(topic)} aria-expanded={isOpen}>
                <span className={`topicMarker ${topic.status}`}>
                  {topic.status === "mastered" ? "✓" : index + 1}
                </span>
                <span className="topicCopy">
                  <strong>{topic.title}</strong>
                  {topic.objective && <small>{topic.objective}</small>}
                </span>
                <span className="topicMeta">
                  {topic.priority >= 90 && <b className="priorityTag">ON THE TEST</b>}
                  <span className="masteryPill">{Math.round(topic.mastery_score)}%</span>
                </span>
              </button>

              {isOpen && (
                <div className="topicBody">
                  {topic.key_terms.length > 0 && (
                    <div className="termRow">
                      {topic.key_terms.map((term) => (
                        <span className="termChip" key={term}>
                          {term}
                        </span>
                      ))}
                    </div>
                  )}

                  {loadingId === topic.id && <p className="hintText">Reading your materials…</p>}

                  {lesson && (
                    <>
                      <p className="answerText">{lesson.text}</p>
                      <CitationChips citations={lesson.citations} />
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
