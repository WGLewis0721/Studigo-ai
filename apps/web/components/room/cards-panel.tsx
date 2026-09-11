"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { Topic } from "@/lib/rooms";
import { CitationChips, type Citation } from "./citations";

type Card = {
  id: string;
  front: string;
  back: string;
  citations: Citation[];
  repetitions: number;
  topic_id: string | null;
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
  onReviewed
}: {
  roomId: string;
  topics: Topic[];
  hasMaterials: boolean;
  onReviewed: () => void;
}) {
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [topicId, setTopicId] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const loadDue = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/flashcards?roomId=${roomId}`);
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
  }, [roomId]);

  useEffect(() => {
    void loadDue();
  }, [loadDue]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, topicId: topicId || null, count: 10 })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not build cards.");
      await loadDue();
      startTransition(onReviewed);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  async function rate(rating: 1 | 2 | 3) {
    const card = cards[index];
    if (!card) return;

    setFlipped(false);
    setIndex((value) => value + 1);

    try {
      await fetch("/api/flashcards/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, rating })
      });
      startTransition(onReviewed);
    } catch {
      setError("That review didn't save. Check your connection.");
    }
  }

  const card = cards[index];
  const done = !loading && cards.length > 0 && index >= cards.length;

  if (!hasMaterials) {
    return (
      <div className="modeEmpty">
        <h2>Flashcards come from your materials.</h2>
        <p>Add and process a document first, then Studigo pulls the terms worth drilling.</p>
      </div>
    );
  }

  if (loading) return <p className="hintText">Loading your deck…</p>;

  if (!cards.length || done) {
    return (
      <div className="quizSetup">
        {done && (
          <div className="quizScoreCard">
            <span className="tinyLabel">DECK CLEAR</span>
            <strong>{cards.length}</strong>
            <small>cards reviewed · they'll come back when they're due</small>
          </div>
        )}

        <span className="tinyLabel">FLASHCARDS</span>
        <h2>{done ? "Nothing else due right now." : "Build a deck from this room."}</h2>
        <p>
          Cards are written only from your materials, and they come back on a schedule based on how
          well you knew them.
        </p>

        <label className="field">
          <span>Topic</span>
          <select value={topicId} onChange={(event) => setTopicId(event.target.value)}>
            <option value="">Everything in this room</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className="formError" role="alert">
            {error}
          </p>
        )}

        <button className="buttonPrimary" type="button" onClick={() => void generate()} disabled={generating}>
          {generating ? "Writing cards…" : "Add 10 cards"} <span aria-hidden="true">→</span>
        </button>
      </div>
    );
  }

  return (
    <div className="cardsMode">
      <span className="tinyLabel">
        CARD {index + 1} OF {cards.length} DUE
      </span>

      <button
        className={`flashcard ${flipped ? "flashcardFlipped" : ""}`}
        type="button"
        onClick={() => setFlipped((value) => !value)}
        aria-label={flipped ? "Show the question" : "Show the answer"}
      >
        <span className="flashcardSide">{flipped ? card.back : card.front}</span>
        {!flipped && <small>Tap to flip</small>}
      </button>

      {flipped && <CitationChips citations={card.citations ?? []} />}

      {error && (
        <p className="formError" role="alert">
          {error}
        </p>
      )}

      <div className="ratingRow">
        {flipped ? (
          RATINGS.map((rating) => (
            <button
              key={rating.value}
              type="button"
              className={`ratingButton rating-${rating.value}`}
              onClick={() => void rate(rating.value)}
            >
              <strong>{rating.label}</strong>
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
