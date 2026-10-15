"use client";

import { useRef, useState, useTransition, type ReactNode, type Ref, type UIEvent } from "react";
import type { Topic } from "@/lib/rooms";
import { createGestureBook, operationHeaders } from "@/lib/ai-operation-client";
import { CitationChips, type Citation } from "./citations";
import { StudigoMascot } from "@/components/studigo-mascot";
import { RichText } from "./rich-text";
import { learnOutcomeView, readLearnOutcome, type LearnOutcomeView } from "@/lib/learn-outcome-client";
import { requestQuietAcknowledgement, type QuietAcknowledgement, type QuietPhase } from "@/lib/quiet-feedback";
import { mathModelFromPrompt } from "@/lib/math-model";
import { MathModelView } from "./math-model-view";

/** One formative back-and-forth about a topic. Never scored. */
type Check = {
  question: string;
  turns: Array<{ answer: string; feedback: string; understood: boolean }>;
  done: boolean;
};

/** "Lesson 2 of 6", clamped to the cursor's list. A failed load does not change this. */
export function lessonPositionLabel(index: number, count: number): string | null {
  if (!Number.isFinite(count) || count < 1) return null;
  const position = Math.min(count, Math.max(1, Math.floor(index) + 1 || 1));
  return `Lesson ${position} of ${count}`;
}

/** A failed refresh keeps the last successful lesson. A success replaces only that topic. */
export function retainSuccessfulLesson<T>(current: Record<string, T>, topicId: string, kept: T | null, incoming: T | null): Record<string, T> {
  if (incoming) return { ...current, [topicId]: incoming };
  if (current[topicId]) return current;
  if (kept) return { ...current, [topicId]: kept };
  return current;
}

export type LearnSurfaces<L, O, C> = { lesson: L; overview: O; coach: C };

/** Patching one surface returns the other two unchanged. */
export function keepIndependentSurfaces<L, O, C>(current: LearnSurfaces<L, O, C>, patch: Partial<LearnSurfaces<L, O, C>>): LearnSurfaces<L, O, C> {
  return {
    lesson: patch.lesson === undefined ? current.lesson : patch.lesson,
    overview: patch.overview === undefined ? current.overview : patch.overview,
    coach: patch.coach === undefined ? current.coach : patch.coach
  };
}

/**
 * Phone lesson chrome: the cursor label, the reading, wrapping citations, and
 * Clear / Previous / Next. Citations and actions are siblings of the scroller so a full
 * thread cannot clip them.
 */
export function LessonMobileFrame({
  mode,
  label,
  topicTitle,
  text,
  citations,
  status,
  onRetry,
  onClear,
  onPrevious,
  onNext,
  actionsDisabled,
  threadRef,
  onScroll,
  children
}: {
  mode: "learn" | "coach";
  label: string | null;
  topicTitle: string;
  text: string | null;
  citations: Citation[];
  status?: string | null;
  onRetry?: () => void;
  onClear: () => void;
  onPrevious?: () => void;
  onNext: () => void;
  actionsDisabled?: boolean;
  threadRef: Ref<HTMLDivElement>;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  const modeName = mode === "learn" ? "Learn" : "Coach";
  const nextName = mode === "learn" ? "lesson" : "topic";
  return (
    <>
      {mode === "learn" && label ? (
        <p className="lessonPosition" data-lesson-label>
          <span className="lessonPositionIndex">{label}</span>
          <span className="lessonPositionTopic">{topicTitle}</span>
        </p>
      ) : null}
      <div className="chatThread" role="log" aria-live="polite" aria-label="Messages" ref={threadRef} onScroll={onScroll}>
        <div className="lessonReading" data-learn-surface={mode === "learn" ? "lesson" : "practice"} aria-label={`${modeName}, ${topicTitle}`}>
          {mode === "learn" && text && <span className="learningPhaseEyebrow">FROM THIS STUDY ROOM</span>}
          {status ? <p className="lessonStatus" role="status">{status}</p> : null}
          {text && mathModelFromPrompt(text) ? <MathModelView model={mathModelFromPrompt(text)!} /> : null}
          {text ? <RichText className="lessonText" text={text} /> : null}
          {onRetry ? <button className="ghostButton" type="button" onClick={onRetry} disabled={actionsDisabled}>Try again</button> : null}
        </div>
        {children}
        <div className="threadEnd" aria-hidden="true" />
      </div>
      {citations.length > 0 ? (
        <div className="lessonCitations">
          <CitationChips citations={citations} />
        </div>
      ) : null}
      <div className="lessonActions" data-lesson-actions role="group" aria-label={`${modeName} actions for ${topicTitle}`}>
        <button className="ghostButton" type="button" disabled={actionsDisabled} aria-label={`Clear ${modeName} for ${topicTitle}`} onClick={onClear}>Clear</button>
        <button className="ghostButton" type="button" disabled={actionsDisabled || !onPrevious} aria-label={`Previous ${nextName} for ${topicTitle}`} onClick={onPrevious}>Previous</button>
        <button className="ghostButton" type="button" disabled={actionsDisabled} aria-label={`Next ${nextName} for ${topicTitle}`} onClick={onNext}>Next</button>
      </div>
    </>
  );
}

export function LearnPanel({
  roomId,
  topics,
  hasMaterials,
  onChanged,
  embedded = false,
  onCoachTopic,
  onOpenMaterials,
  lessonCursor = null
}: {
  roomId: string;
  topics: Topic[];
  hasMaterials: boolean;
  onChanged: () => void;
  /** Inside Coach the page heading belongs to Coach, not to this panel. */
  embedded?: boolean;
  /** Hand a topic to the Coach chat. */
  onCoachTopic?: (topic: Topic) => void;
  onOpenMaterials?: () => void;
  /** Existing Learn cursor. Management does not move it. */
  lessonCursor?: { index: number; count: number; title: string } | null;
}) {
  const [openTopicId, setOpenTopicId] = useState<string | null>(null);
  const [lessons, setLessons] = useState<Record<string, { text: string; citations: Citation[]; notice: LearnOutcomeView | null }>>({});
  const [lessonOutcomes, setLessonOutcomes] = useState<Record<string, LearnOutcomeView>>({});
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
  const [lessonQuiet, setLessonQuiet] = useState<{ eventKey: string; acknowledgement: Exclude<QuietAcknowledgement, "none">; status: string } | null>(null);
  const gestures = useRef(createGestureBook());
  const [, startTransition] = useTransition();

  function settleLesson(topicId: string, phase: QuietPhase) {
    const eventKey = `lesson-open:${roomId}:${topicId}`;
    const decision = requestQuietAcknowledgement({ phase, kind: "lesson-open", eventKey });
    if (phase !== "success" || decision.acknowledgement === "none" || !decision.status) {
      setLessonQuiet(null);
      return;
    }
    setLessonQuiet({ eventKey, acknowledgement: decision.acknowledgement, status: decision.status });
  }

  async function open(topic: Topic) {
    const next = openTopicId === topic.id ? null : topic.id;
    setOpenTopicId(next);
    if (!next) {
      setLessonQuiet(null);
      return;
    }
    if (lessons[topic.id]) return;

    await loadLesson(topic);
  }

  async function loadLesson(topic: Topic) {
    const keptLesson = lessons[topic.id] ?? null;
    const body = JSON.stringify({ roomId, topicId: topic.id });
    const attempt = gestures.current.begin(`learn:${topic.id}`, body);
    if (!attempt.started) return;
    setLoadingId(topic.id);
    setError(null);
    settleLesson(topic.id, "loading");
    setLessonOutcomes((current) => {
      const next = { ...current };
      delete next[topic.id];
      return next;
    });
    try {
      const response = await fetch("/api/learn", { method: "POST", headers: operationHeaders(attempt.id), body });
      gestures.current.finish(`learn:${topic.id}`, response.status);
      const payload = await response.json();
      const outcome = readLearnOutcome(payload?.outcome);
      if (outcome && outcome.kind !== "ready" && outcome.kind !== "partial_coverage") {
        const view = learnOutcomeView(outcome);
        if (view) setLessonOutcomes((current) => ({ ...current, [topic.id]: view }));
        setLessons((current) => retainSuccessfulLesson(current, topic.id, keptLesson, null));
        settleLesson(topic.id, "error");
        return;
      }
      if (response.status === 202 || response.status === 409 || !response.ok) {
        throw new Error(payload.error || "Could not build that lesson.");
      }
      if (typeof payload.explanation !== "string" || !payload.explanation.trim()) {
        throw new Error("Could not build that lesson. Please try again.");
      }
      setLessons((current) => retainSuccessfulLesson(current, topic.id, keptLesson, {
        text: payload.explanation,
        citations: Array.isArray(payload.citations) ? payload.citations : [],
        notice: typeof payload.coverageLimitation === "string" && payload.coverageLimitation.trim()
          ? { title: "Some pages need attention", message: payload.coverageLimitation, action: "materials" }
          : outcome ? learnOutcomeView(outcome) : null
      }));
      settleLesson(topic.id, "success");
    } catch (learnError) {
      gestures.current.abort(`learn:${topic.id}`);
      setLessons((current) => retainSuccessfulLesson(current, topic.id, keptLesson, null));
      setError(learnError instanceof Error ? learnError.message : "Something went wrong.");
      settleLesson(topic.id, "error");
    } finally {
      setLoadingId(null);
    }
  }

  async function startCheck(topic: Topic) {
    const body = JSON.stringify({ roomId, topicId: topic.id });
    const attempt = gestures.current.begin(`check-start:${topic.id}`, body);
    if (!attempt.started) return;
    setChecking(true);
    setError(null);
    setCheckDraft("");
    try {
      const response = await fetch("/api/learn/check", { method: "POST", headers: operationHeaders(attempt.id), body });
      gestures.current.finish(`check-start:${topic.id}`, response.status);
      const payload = await response.json();
      if (response.status === 202 || response.status === 409 || !response.ok) {
        throw new Error(payload.error || "Could not start a check.");
      }
      setChecks((current) => ({
        ...current,
        [topic.id]: { question: payload.question as string, turns: [], done: false }
      }));
    } catch (checkError) {
      gestures.current.abort(`check-start:${topic.id}`);
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
    const body = JSON.stringify({ roomId, topicId: topic.id, question: check.question, answer });
    const attempt = gestures.current.begin(`check-answer:${topic.id}`, body);
    if (!attempt.started) return;

    setChecking(true);
    setError(null);
    try {
      const response = await fetch("/api/learn/check", { method: "POST", headers: operationHeaders(attempt.id), body });
      gestures.current.finish(`check-answer:${topic.id}`, response.status);
      const payload = await response.json();
      if (response.status === 202 || response.status === 409 || !response.ok) {
        throw new Error(payload.error || "Could not check that answer.");
      }

      setChecks((current) => ({
        ...current,
        [topic.id]: {
          question: (payload.followUp as string | null) ?? check.question,
          turns: [
            ...check.turns,
            { answer, feedback: payload.feedback as string, understood: Boolean(payload.understood) }
          ],
          // The check only ends when the learner has shown they have the idea. Any other reply
          // (a half answer, "not sure", something unrelated) keeps a question open.
          done: Boolean(payload.understood)
        }
      }));
      setCheckDraft("");
    } catch (answerError) {
      gestures.current.abort(`check-answer:${topic.id}`);
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
    const body = JSON.stringify({ roomId });
    const attempt = gestures.current.begin("topic-regenerate", body);
    if (!attempt.started) return;
    setBuilding(true);
    setError(null);
    try {
      const response = await fetch("/api/topics", { method: "POST", headers: operationHeaders(attempt.id), body });
      gestures.current.finish("topic-regenerate", response.status);
      const payload = await response.json();
      if (response.status === 202 || response.status === 409 || !response.ok) {
        throw new Error(payload.error || "Could not build the topic map.");
      }
      startTransition(onChanged);
    } catch (buildError) {
      gestures.current.abort("topic-regenerate");
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
      <div className="modeEmpty learningTopicsEmpty">
        <span className="learningPhaseEyebrow">YOUR LEARNING MAP</span>
        <h2>Start with what you have.</h2>
        <p>Upload a teacher study guide and Studigo reads what it says you need to know. With only notes and textbook pages, it can build the map from those instead.</p>
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
        {!hasMaterials && onOpenMaterials && <button className="ghostButton" type="button" onClick={onOpenMaterials}>Open Materials</button>}
      </div>
    );
  }

  const cursorLabel = lessonCursor ? lessonPositionLabel(lessonCursor.index, lessonCursor.count) : null;

  return (
    <div className="learnMode">
      <div className="learningTopicsIntro">
        <span className="learningPhaseEyebrow">YOUR LEARNING MAP / {String(topics.length).padStart(2, "0")} {topics.length === 1 ? "TOPIC" : "TOPICS"}</span>
        <h2>Choose a thread to follow.</h2>
        <p>Open a topic for a source-based lesson. Adjust the map if your guide missed something.</p>
      </div>
      {cursorLabel && (
        <p className="lessonPosition" data-lesson-label>
          <span className="lessonPositionIndex">{cursorLabel}</span>
          <span className="lessonPositionTopic">{lessonCursor?.title}</span>
        </p>
      )}
      <div className="learnHeader">
        <p className="phSub topicsLead">{topics.length} {topics.length === 1 ? "topic" : "topics"} from your study guide.{embedded ? " Manage them here. The lesson cursor stays in Learn." : ""}</p>
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
          const lessonOutcome = lessonOutcomes[topic.id];
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
                  <span className="masteryPill">{topic.last_practiced_at ? `${Math.round(topic.mastery_score)}% practiced` : "Not practiced"}</span>
                  <span className="learningTopicArrow" aria-hidden="true">{isOpen ? "−" : "+"}</span>
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

                  {lessonQuiet?.eventKey === `lesson-open:${roomId}:${topic.id}` && lessonQuiet.status && (
                    <div className="lessonProgressRow" data-quiet={lessonQuiet.acknowledgement}>
                      <p className="quietStatus" role="status">{lessonQuiet.status}</p>
                    </div>
                  )}

                  {lessonOutcome && (
                    <div className="formNotice" role="status">
                      <strong>{lessonOutcome.title}</strong>
                      <p>{lessonOutcome.message}</p>
                      {lessonOutcome.action === "retry" && (
                        <button className="ghostButton" type="button" onClick={() => void loadLesson(topic)} disabled={loadingId === topic.id}>Try again</button>
                      )}
                      {lessonOutcome.action === "see_topics" && (
                        <button className="ghostButton" type="button" onClick={() => setOpenTopicId(null)}>See topics</button>
                      )}
                      {lessonOutcome.action === "materials" && onOpenMaterials && (
                        <button className="ghostButton" type="button" onClick={onOpenMaterials}>Open Materials</button>
                      )}
                    </div>
                  )}

                  {lesson && (
                    <>
                      <span className="learningPhaseEyebrow">YOUR MATERIALS / LESSON</span>
                      {lesson.notice && (
                        <div className="formNotice" role="status">
                          <strong>{lesson.notice.title}</strong>
                          <p>{lesson.notice.message}</p>
                          {onOpenMaterials && <button className="ghostButton" type="button" onClick={onOpenMaterials}>Open Materials</button>}
                        </div>
                      )}
                      <RichText className="lessonText" text={lesson.text} />
                      <div className="lessonCitations">
                        <CitationChips citations={lesson.citations} />
                      </div>
                      {onCoachTopic && (
                        <button className="buttonPrimary coachThisTopic" type="button" onClick={() => onCoachTopic(topic)}>
                          Coach me on this <span aria-hidden="true">→</span>
                        </button>
                      )}

                      <section className="socraticCheck">
                        <span className="tinyLabel">CHECK YOUR UNDERSTANDING</span>
                        {!check ? (
                          <>
                            <p className="hintText">
                              Explain it back in your own words. This is practice, not a test. It
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
