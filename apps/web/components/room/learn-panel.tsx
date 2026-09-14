"use client";

import { useState, useTransition } from "react";
import type { Topic } from "@/lib/rooms";
import { CitationChips, type Citation } from "./citations";

/** One formative back-and-forth about a topic. Never scored. */
type Check = {
  question: string;
  turns: Array<{ answer: string; feedback: string; understood: boolean }>;
  done: boolean;
};

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", objective: "", priority: 60 });
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [checkDraft, setCheckDraft] = useState("");
  const [checking, setChecking] = useState(false);
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

  async function startCheck(topic: Topic) {
    setChecking(true);
    setError(null);
    setCheckDraft("");
    try {
      const response = await fetch("/api/learn/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, topicId: topic.id })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not start a check.");
      setChecks((current) => ({
        ...current,
        [topic.id]: { question: payload.question as string, turns: [], done: false }
      }));
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Something went wrong.");
    } finally {
      setChecking(false);
    }
  }

  /** Formative only: this never records an attempt and never moves mastery. */
  async function answerCheck(topic: Topic) {
    const check = checks[topic.id];
    const answer = checkDraft.trim();
    if (!check || !answer || checking) return;

    setChecking(true);
    setError(null);
    try {
      const response = await fetch("/api/learn/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, topicId: topic.id, question: check.question, answer })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not check that answer.");

      setChecks((current) => ({
        ...current,
        [topic.id]: {
          question: (payload.followUp as string | null) ?? check.question,
          turns: [
            ...check.turns,
            { answer, feedback: payload.feedback as string, understood: Boolean(payload.understood) }
          ],
          done: Boolean(payload.understood) || !payload.followUp
        }
      }));
      setCheckDraft("");
    } catch (answerError) {
      setError(answerError instanceof Error ? answerError.message : "Something went wrong.");
    } finally {
      setChecking(false);
    }
  }

  function startEdit(topic: Topic) {
    setEditingId(topic.id);
    setAdding(false);
    setError(null);
    setDraft({ title: topic.title, objective: topic.objective ?? "", priority: topic.priority });
  }

  /** The learner's wording wins, and survives the guide being re-ingested. */
  async function saveTopic() {
    if (!editingId || saving) return;
    if (!draft.title.trim()) {
      setError("A topic needs a title.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/topics/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draft.title, objective: draft.objective, priority: draft.priority })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "That change could not be saved.");
      setEditingId(null);
      startTransition(onChanged);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "That change could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTopic(topic: Topic) {
    if (saving) return;
    if (!window.confirm(`Remove “${topic.title}” from your study scope? Practice history is kept.`)) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/topics/${topic.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "That topic could not be removed.");
      }
      setEditingId(null);
      startTransition(onChanged);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "That topic could not be removed.");
    } finally {
      setSaving(false);
    }
  }

  /** For something the teacher mentioned that the guide never wrote down. */
  async function addTopic() {
    if (saving) return;
    if (!draft.title.trim()) {
      setError("Give the topic a title.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId, intent: "create",
          title: draft.title, objective: draft.objective, priority: draft.priority
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "That topic could not be added.");
      setAdding(false);
      setDraft({ title: "", objective: "", priority: 60 });
      startTransition(onChanged);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "That topic could not be added.");
    } finally {
      setSaving(false);
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


  const topicEditor = (
    <div className="topicEditor">
      <label className="field">
        <span>Title</span>
        <input
          value={draft.title}
          onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
          maxLength={160}
          autoFocus
        />
      </label>
      <label className="field">
        <span>What you need to be able to do</span>
        <textarea
          value={draft.objective}
          onChange={(event) => setDraft((value) => ({ ...value, objective: event.target.value }))}
          rows={2}
          maxLength={600}
        />
      </label>
      <label className="field">
        <span>Priority · {draft.priority >= 90 ? "on the test" : draft.priority >= 60 ? "should know" : "background"}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={draft.priority}
          onChange={(event) => setDraft((value) => ({ ...value, priority: Number(event.target.value) }))}
        />
      </label>
    </div>
  );

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
        <div className="learnHeaderActions">
          <button
            className="ghostButton"
            type="button"
            onClick={() => {
              setAdding((value) => !value);
              setEditingId(null);
              setDraft({ title: "", objective: "", priority: 60 });
            }}
          >
            {adding ? "Cancel" : "Add a topic"}
          </button>
          <button className="ghostButton" type="button" onClick={() => void buildTopicMap()} disabled={building}>
            {building ? "Rebuilding…" : "Rebuild from materials"}
          </button>
        </div>
      </div>

      {error && (
        <p className="formError" role="alert">
          {error}
        </p>
      )}

      {adding && (
        <div className="topicAddCard">
          <span className="tinyLabel">ADD WHAT THE GUIDE MISSED</span>
          {topicEditor}
          <button className="buttonPrimary" type="button" onClick={() => void addTopic()} disabled={saving}>
            {saving ? "Adding…" : "Add topic"}
          </button>
        </div>
      )}

      <ol className="topicList">
        {topics.map((topic, index) => {
          const isOpen = openTopicId === topic.id;
          const lesson = lessons[topic.id];
          const check = checks[topic.id];

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
                  {editingId === topic.id ? (
                    <>
                      {topicEditor}
                      <div className="topicEditorActions">
                        <button className="buttonPrimary" type="button" onClick={() => void saveTopic()} disabled={saving}>
                          {saving ? "Saving…" : "Save topic"}
                        </button>
                        <button className="ghostButton" type="button" onClick={() => setEditingId(null)} disabled={saving}>
                          Cancel
                        </button>
                        <button className="danger" type="button" onClick={() => void removeTopic(topic)} disabled={saving}>
                          Remove from scope
                        </button>
                      </div>
                    </>
                  ) : (
                    <button className="topicEditLink" type="button" onClick={() => startEdit(topic)}>
                      {topic.learner_edited ? "Edited by you · change again" : "Studigo read this from your guide · fix it"}
                    </button>
                  )}

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

                      <section className="socraticCheck">
                        <span className="tinyLabel">CHECK YOUR UNDERSTANDING</span>
                        {!check ? (
                          <>
                            <p className="hintText">
                              Explain it back in your own words. This is practice, not a test — it
                              is never scored and never changes your mastery.
                            </p>
                            <button
                              className="ghostButton"
                              type="button"
                              onClick={() => void startCheck(topic)}
                              disabled={checking}
                            >
                              {checking ? "Thinking…" : "Ask me a question"}
                            </button>
                          </>
                        ) : (
                          <>
                            {check.turns.map((turn, turnIndex) => (
                              <div className="socraticTurn" key={turnIndex}>
                                <p className="socraticAnswer">{turn.answer}</p>
                                <p className={`socraticFeedback ${turn.understood ? "socraticGot" : ""}`}>
                                  {turn.feedback}
                                </p>
                              </div>
                            ))}

                            {check.done ? (
                              <div className="socraticDone">
                                <strong>You explained it.</strong>
                                <button
                                  className="ghostButton"
                                  type="button"
                                  onClick={() => void startCheck(topic)}
                                  disabled={checking}
                                >
                                  Ask another
                                </button>
                              </div>
                            ) : (
                              <>
                                <p className="socraticQuestion">{check.question}</p>
                                <textarea
                                  className="shortAnswer"
                                  value={checkDraft}
                                  onChange={(event) => setCheckDraft(event.target.value)}
                                  placeholder="In your own words…"
                                  rows={3}
                                  disabled={checking}
                                />
                                <button
                                  className="buttonPrimary"
                                  type="button"
                                  onClick={() => void answerCheck(topic)}
                                  disabled={checking || !checkDraft.trim()}
                                >
                                  {checking ? "Reading your answer…" : "Send"}{" "}
                                  <span aria-hidden="true">→</span>
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </section>
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
