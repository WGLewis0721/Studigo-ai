"use client";

import { ActivityProgress } from "./activity-progress";
import { StudyRoomEmptyState } from "./study-room-empty-state";
import { TopicReadout } from "./topic-readout";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { Topic } from "@/lib/rooms";
import { CitationChips, type Citation } from "./citations";
import { HeaderMascot } from "./mode-header";
import { useCompanion } from "@/components/companion/companion";
import { createGestureBook, operationHeaders } from "@/lib/ai-operation-client";
import { StudigoFigure } from "@/components/companion/figure";
import "./phase3-rooms.css";

type Card = {
  id: string;
  front: string;
  back: string;
  citations: Citation[];
  repetitions: number;
  topic_id: string | null;
  learner_edited?: boolean;
};

const RATINGS = [
  { value: 1 as const, label: "Missed it", hint: "See it again shortly" },
  { value: 2 as const, label: "Hard", hint: "Soon" },
  { value: 3 as const, label: "Got it", hint: "Later" }
];

export function CardsPanel({
  roomId,
  topics,
  hasMaterials,
  onReviewed,
  initialTopicId = null
}: {
  roomId: string;
  topics: Topic[];
  hasMaterials: boolean;
  onReviewed: () => void;
  initialTopicId?: string | null;
}) {
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>(() => initialTopicId && topics.some((topic) => topic.id === initialTopicId)
    ? [initialTopicId] : topics.map((topic) => topic.id));
  const topicIds = topics.filter((topic) => selectedTopicIds.includes(topic.id)).map((topic) => topic.id);
  const topicKey = topicIds.join(",");
  const initialTopicKey = useRef(topicKey);
  const cardCount = Math.min(20, Math.max(10, topicIds.length));
  const [showSetup, setShowSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const reviewRef = useRef<{ cardId: string; requestId: string; rating: 1 | 2 | 3 } | null>(null);
  const savingRef = useRef(false);
  const gestures = useRef(createGestureBook());
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ front: "", back: "" });
  const [, startTransition] = useTransition();
  const companion = useCompanion();
  const topicSelector = (className: string) => <TopicReadout topics={topics} selectedIds={topicIds} heading="TOPICS AND PRACTICE" className={className} disabled={generating}
    onToggle={(id) => { setShowSetup(true); setSelectedTopicIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]); }}
    onSelectAll={() => { setShowSetup(true); setSelectedTopicIds(topics.map((topic) => topic.id)); }} />;

  const loadDue = useCallback(async (scopeKey: string) => {
    setLoading(true);
    setError(null);
    try {
      if (topics.length && !scopeKey) { setCards([]); setIndex(0); return; }
      const scope = scopeKey && scopeKey.split(",").length !== topics.length ? `&topicIds=${encodeURIComponent(scopeKey)}` : "";
      const response = await fetch(`/api/flashcards?roomId=${encodeURIComponent(roomId)}${scope}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load your cards.");
      setCards(payload.cards as Card[]);
      setIndex(0);
      setFlipped(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [roomId, topics.length]);

  useEffect(() => {
    void loadDue(initialTopicKey.current);
  }, [loadDue]);

  async function generate() {
    if (!topicIds.length) return;
    const body = JSON.stringify({ roomId, topicIds, count: cardCount });
    const attempt = gestures.current.begin("flashcards-generate", body);
    if (!attempt.started) return;
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/flashcards", { method: "POST", headers: operationHeaders(attempt.id), body });
      gestures.current.finish("flashcards-generate", response.status);
      const payload = await response.json();
      if (response.status === 202 || response.status === 409 || !response.ok) {
        throw new Error(payload.error || "Could not build cards.");
      }
      if (!payload.cards?.length) { setError(payload.note || "No new cards could be made from those topics."); return; }
      setCards(payload.cards as Card[]);
      setIndex(0);
      setFlipped(false);
      setShowSetup(false);
      startTransition(onReviewed);
    } catch (generateError) {
      gestures.current.abort("flashcards-generate");
      setError(generateError instanceof Error ? generateError.message : "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  /** Saves the learner's wording without touching the review schedule. */
  async function saveEdit() {
    const card = cards[index];
    if (!card || saving) return;
    const front = draft.front.trim();
    const back = draft.back.trim();
    if (!front || !back) {
      setError("A card needs both a front and a back.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/flashcards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front, back })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "That card could not be saved.");
      setCards((current) =>
        current.map((item) => (item.id === card.id ? { ...item, front, back, learner_edited: true } : item))
      );
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "That card could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCard() {
    const card = cards[index];
    if (!card || saving) return;
    if (!window.confirm("Delete this card? Its review history goes with it.")) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/flashcards/${card.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "That card could not be deleted.");
      }
      // Drop it from the queue in place; the next card slides into this index.
      setCards((current) => current.filter((item) => item.id !== card.id));
      setEditing(false);
      setFlipped(false);
      startTransition(onReviewed);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "That card could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  async function rate(rating: 1 | 2 | 3) {
    const card = cards[index];
    if (!card || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    if (reviewRef.current?.cardId !== card.id) reviewRef.current = { cardId: card.id, requestId: crypto.randomUUID(), rating };

    try {
      const response = await fetch("/api/flashcards/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewRef.current)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Review did not save.");
      reviewRef.current = null;
      if (index + 1 >= cards.length) companion.event("setDone");
      else if (rating === 3) companion.event("cardGood");
      else if (rating === 1) companion.event("cardMiss");
      setFlipped(false);
      setEditing(false);
      setIndex((value) => value + 1);
      startTransition(onReviewed);
    } catch {
      setError("That review didn't save. Check your connection and retry.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const card = cards[index];
  const done = !loading && cards.length > 0 && index >= cards.length;

  if (!hasMaterials) {
    return (
      <>
        <HeaderMascot state="sources" />
        <StudyRoomEmptyState
          title="Nothing to drill yet."
          description="Add and process a document first, then Studigo can find terms to review."
        />
      </>
    );
  }

  if (loading) return <div className="roomStudioState" role="status"><span className="tinyLabel">PRACTICE STUDIO / CARDS</span><h3>Finding cards due now…</h3><p>Your review schedule is loading.</p></div>;

  if (!cards.length || done || showSetup) {
    return (
      <div className="quizSetup roomStudioSetup">
        <div className="setupMain">
        {done && (
          <div className="quizScoreCard">
            <StudigoFigure pose="celebrate" label="Studigo celebrating" />
            <span className="tinyLabel">DECK CLEAR</span>
            <strong>{cards.length}</strong>
            <small>cards reviewed · they'll come back when they're due</small>
          </div>
        )}

        <div className="setupHeading">
          <span className="tinyLabel">PRACTICE STUDIO / SPACED REVIEW</span>
          <h3>{topicIds.length === 1 ? topics.find((topic) => topic.id === topicIds[0])?.title : `${topicIds.length} topics selected`}</h3>
        </div>
        <p className="setupLead">{done && !showSetup ? "Nothing else due right now." : `Add ${cardCount} cards covering up to ${Math.min(cardCount, topicIds.length)} selected topics.`}</p>
        {topicSelector("topicReadoutMobile")}

        {error && (
          <p className="formError" role="alert">
            {error}
          </p>
        )}

        {error && <button className="ghostButton" type="button" onClick={() => void loadDue(topicKey)} disabled={generating}>Retry loading due cards</button>}
        {showSetup && cards.length > 0 && !done && <button className="ghostButton" type="button" onClick={() => setShowSetup(false)}>Resume current deck</button>}
        <button className="buttonPrimary" type="button" onClick={() => void generate()} disabled={generating || topicIds.length === 0}>
          {generating ? "Writing cards…" : `Add ${cardCount} cards`} <span aria-hidden="true">→</span>
        </button>
        </div>
        {topicSelector("topicReadoutDesktop")}
      </div>
    );
  }

  return (
    <div className="cardsMode roomStudioCards">
      <button className="ghostButton" type="button" onClick={() => setShowSetup(true)}>Choose topics or add cards</button>
      <ActivityProgress current={index+1} total={cards.length} label="Card"/>
      <p className="roomStudioInstruction">Recall the answer first. Flip to check it, then rate how it went to schedule your next review.</p>

      {editing ? (
        <div className="cardEditor">
          <label className="field">
            <span>Front</span>
            <input
              value={draft.front}
              onChange={(event) => setDraft((value) => ({ ...value, front: event.target.value }))}
              maxLength={500}
              autoFocus
            />
          </label>
          <label className="field">
            <span>Back</span>
            <textarea
              value={draft.back}
              onChange={(event) => setDraft((value) => ({ ...value, back: event.target.value }))}
              rows={4}
              maxLength={2000}
            />
          </label>
          <small className="hintText">
            Your wording is kept when new cards are generated, and your review schedule is not reset.
          </small>
          <div className="cardEditorActions">
            <button className="buttonPrimary" type="button" onClick={() => void saveEdit()} disabled={saving}>
              {saving ? "Saving…" : "Save card"}
            </button>
            <button className="ghostButton" type="button" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button className="danger" type="button" onClick={() => void removeCard()} disabled={saving}>
              Delete card
            </button>
          </div>
        </div>
      ) : (
        <button
          className={`flashcard ${flipped ? "flashcardFlipped" : ""}`}
          type="button"
          aria-pressed={flipped}
          disabled={saving}
          onClick={() => setFlipped((value) => !value)}
        >
          <span className="srOnly">{flipped ? "Answer side. Press to show the question." : "Question side. Press to show the answer."}</span>
          <span className="flashcardInner">
            <span className="flashcardFace flashcardFront" aria-hidden={flipped}>
              <small>FRONT</small>
              <span className="flashcardSide">{card.front}</span>
              <small>Tap to flip</small>
            </span>
            <span className="flashcardFace flashcardBack" aria-hidden={!flipped}>
              <small>BACK</small>
              <span className="flashcardSide">{card.back}</span>
            </span>
          </span>
        </button>
      )}

      {flipped && !editing && (
        <div className="cardMetaRow">
          <CitationChips citations={card.citations ?? []} />
          <button
            className="cardEditLink"
            disabled={saving || reviewRef.current !== null}
            type="button"
            onClick={() => {
              setDraft({ front: card.front, back: card.back });
              setEditing(true);
            }}
          >
            {card.learner_edited ? "Edited · change again" : "Fix this card"}
          </button>
        </div>
      )}

      {error && (
        <p className="formError" role="alert">
          {error}
        </p>
      )}

      <div className="ratingRow">
        {editing ? null : flipped ? (
          RATINGS.map((rating) => (
            <button
              key={rating.value}
              type="button"
              className={`ratingButton rating-${rating.value}`}
              disabled={saving || (reviewRef.current !== null && reviewRef.current.rating !== rating.value)}
              onClick={() => void rate(rating.value)}
            >
              <strong>{saving && reviewRef.current?.rating === rating.value ? "Saving review…" : reviewRef.current?.rating === rating.value ? "Retry review" : rating.label}</strong>
              <small>{rating.hint}</small>
            </button>
          ))
        ) : (
          <button className="buttonPrimary" type="button" onClick={() => setFlipped(true)}>
            Show answer <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  );
}
