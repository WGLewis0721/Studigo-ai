"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Topic } from "@/lib/rooms";
import { operationHeaders } from "@/lib/ai-operation-client";

type Phase = "brief" | "show" | "try" | "check" | "done";
type Mission = { topic_id: string; document_id: string; phase: Phase; reflection: "ready" | "review" | null; paused: boolean; revision: number };
type Snapshot = { mission: Mission | null; sourceCurrent?: boolean; source?: { documentName: string; pageNumber: number | null; excerpt: string } | null };
type Action = "start" | "restart" | "advance" | "back" | "pause" | "resume";

const SAMPLES = {
  elementary: {
    title: "Inherited and learned behavior",
    objective: "Explain which behaviors are inherited.",
    excerpt: "Some animal behaviors are inherited. Other behaviors are learned through experience.",
    question: "Why does one animal behavior show up without being taught, while another has to be practiced?",
  },
  college: {
    title: "Net force and motion",
    objective: "Explain what a net force does to an object's motion.",
    excerpt: "A net force changes an object's motion. If the forces on an object are balanced, its velocity stays the same.",
    question: "What happens to an object's motion when the forces on it are balanced, and why?",
  },
} as const;

export function LearnMission({ roomId, topics, selectedTopicId }: {
  roomId: string; topics: Topic[]; selectedTopicId: string | null; onOpenMaterials: () => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sample, setSample] = useState<keyof typeof SAMPLES>("elementary");
  const [question, setQuestion] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [asking, setAsking] = useState(false);
  const [pickedTopicId, setPickedTopicId] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const inFlight = useRef(false);
  const askedFor = useRef<string | null>(null);
  const askGen = useRef(0);
  const fixture = roomId === "fixture";
  const mission = snapshot?.mission ?? null;
  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId);
  const topicId = fixture ? sample : pickedTopicId ?? mission?.topic_id ?? selectedTopic?.id ?? null;

  const reload = useCallback(async () => {
    if (roomId === "fixture") {
      const demo = SAMPLES[sample];
      setSnapshot({
        mission: { topic_id: sample, document_id: "source", phase: "brief", reflection: null, paused: false, revision: 0 },
        sourceCurrent: true,
        source: { documentName: `${demo.title} - design fixture`, pageNumber: 2, excerpt: demo.excerpt },
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/learn/mission?roomId=${encodeURIComponent(roomId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not restore this reading.");
      setSnapshot(await response.json() as Snapshot);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not restore this reading.");
    } finally { setLoading(false); }
  }, [roomId, sample]);

  useEffect(() => { void reload(); }, [reload]);

  async function post(current: Mission | null, action: Action, reflection: "ready" | "review" | null = null, topicOverride?: string): Promise<Snapshot> {
    const topicId = topicOverride ?? (action === "restart" ? selectedTopic?.id ?? current?.topic_id : current?.topic_id ?? selectedTopic?.id);
    if (!topicId) throw new Error("Choose a topic.");
    if (fixture) {
      const nextPhase: Phase = action === "advance"
        ? ({ brief: "show", show: "try", try: "check", check: "done", done: "done" } as const)[current?.phase ?? "brief"]
        : action === "restart" ? "brief" : current?.phase ?? "brief";
      const next: Snapshot = {
        mission: {
          topic_id: action === "restart" ? sample : current?.topic_id ?? sample,
          document_id: "source",
          phase: nextPhase,
          reflection: reflection ?? (action === "restart" ? null : current?.reflection ?? null),
          paused: false,
          revision: (current?.revision ?? 0) + 1,
        },
        sourceCurrent: true,
        source: snapshot?.source ?? null,
      };
      setSnapshot(next);
      return next;
    }
    let chunkId: string | null = null;
    if (action === "start" || action === "restart") {
      const prepared = await fetch("/api/learn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roomId, topicId }) });
      const reading = await prepared.json().catch(() => null) as { explanation?: string; citations?: { chunkId?: string }[]; error?: string } | null;
      chunkId = reading?.citations?.find((citation) => citation.chunkId)?.chunkId ?? null;
      if (!prepared.ok || !reading?.explanation?.trim() || !chunkId) throw new Error(reading?.error ?? "A cited passage is not ready for this objective.");
    }
    const response = await fetch("/api/learn/mission", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId, topicId, requestId: crypto.randomUUID(), expectedRevision: current?.revision ?? 0, action, reflection, chunkId }),
    });
    const payload = await response.json().catch(() => null) as (Snapshot & { error?: string }) | null;
    if (!response.ok || !payload) throw new Error(payload?.error ?? "Could not save this reading.");
    setSnapshot(payload);
    return payload;
  }

  async function act(action: Action, reflection: "ready" | "review" | null = null, topicOverride?: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await post(mission, action, reflection, topicOverride);
    } catch (caught) {
      await reload();
      setError(caught instanceof Error ? caught.message : "Could not save this reading.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (fixture || !mission?.paused || inFlight.current) return;
    void act("resume");
    // A paused cursor still opens on the passage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission?.paused, mission?.revision]);

  useEffect(() => {
    const thread = sectionRef.current?.closest(".chatThread");
    if (thread instanceof HTMLElement) thread.scrollTop = 0;
  }, [question, feedback]);

  const ask = useCallback(async (id: string) => {
    if (askedFor.current === id) return;
    askedFor.current = id;
    const gen = ++askGen.current;
    setAsking(true);
    setError(null);
    setFeedback(null);
    setUnderstood(false);
    setDraft("");
    if (fixture) {
      setQuestion(SAMPLES[id === "college" ? "college" : "elementary"].question);
      setAsking(false);
      return;
    }
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await fetch("/api/learn/check", {
          method: "POST",
          headers: operationHeaders(crypto.randomUUID()),
          body: JSON.stringify({ roomId, topicId: id }),
        });
        if (askGen.current !== gen) return;
        const payload = await response.json().catch(() => null) as { question?: string; error?: string } | null;
        if ((response.status === 429 || response.status === 503) && attempt < 4) {
          await new Promise((resolve) => setTimeout(resolve, 3000 + attempt * 2000));
          if (askGen.current !== gen) return;
          continue;
        }
        if (!response.ok || !payload?.question) throw new Error(payload?.error || "Could not ask a question from your materials.");
        setQuestion(payload.question);
        return;
      }
    } catch (caught) {
      if (askGen.current !== gen) return;
      askedFor.current = null;
      setQuestion(null);
      setError(caught instanceof Error ? caught.message : "Could not ask a question from your materials.");
    } finally {
      if (askGen.current === gen) setAsking(false);
    }
  }, [fixture, roomId]);

  useEffect(() => {
    if (!topicId || (!fixture && loading)) return;
    void ask(topicId);
  }, [ask, fixture, loading, topicId]);

  async function submitAnswer() {
    const answer = draft.trim();
    if (!topicId || !question || !answer || asking || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    if (fixture) {
      const hit = /inherit|learn|practice|force|motion|balanced/i.test(answer);
      setFeedback(hit
        ? "That has the idea. You used what the material says, in your own words."
        : "Not quite. Look at what the material says happens, and say that part in your own words.");
      setUnderstood(hit);
      if (!hit) setQuestion(SAMPLES[sample].question);
      setDraft("");
      inFlight.current = false;
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/learn/check", {
        method: "POST",
        headers: operationHeaders(crypto.randomUUID()),
        body: JSON.stringify({ roomId, topicId, question, answer }),
      });
      const payload = await response.json().catch(() => null) as { feedback?: string; followUp?: string | null; understood?: boolean; error?: string } | null;
      if (!response.ok || !payload?.feedback) throw new Error(payload?.error || "Could not check that answer.");
      setFeedback(payload.feedback);
      setUnderstood(Boolean(payload.understood));
      if (!payload.understood && payload.followUp) setQuestion(payload.followUp);
      setDraft("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not check that answer.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function continueReading() {
    if (fixture) {
      setSample((current) => current === "elementary" ? "college" : "elementary");
      askedFor.current = null;
      return;
    }
    if (!mission || inFlight.current) {
      const index = topics.findIndex((topic) => topic.id === topicId);
      const next = topics[index + 1] ?? topics[0];
      askedFor.current = null;
      setFeedback(null);
      setUnderstood(false);
      setDraft("");
      setQuestion(null);
      if (next) setPickedTopicId(next.id);
      if (next) void ask(next.id);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      let current = mission;
      if (current.phase === "check") {
        const advanced = await post(current, "advance");
        if (advanced.mission) current = advanced.mission;
      }
      const index = topics.findIndex((topic) => topic.id === current.topic_id);
      const next = topics[index + 1] ?? topics[0];
      const nextId = next?.id ?? current.topic_id;
      setPickedTopicId(nextId);
      askedFor.current = null;
      setQuestion(null);
      setFeedback(null);
      setUnderstood(false);
      setDraft("");
      await ask(nextId);
    } catch (caught) {
      await reload();
      setError(caught instanceof Error ? caught.message : "Could not open the next question.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const progress = understood ? 100 : feedback ? 72 : question ? 40 : 16;

  return <section ref={sectionRef} className="learnReading" aria-label="Lesson">
    {fixture && <div className="learnSamples">{(Object.keys(SAMPLES) as (keyof typeof SAMPLES)[]).map((key) => <button key={key} type="button" aria-pressed={sample === key} onClick={() => { askedFor.current = null; setSample(key); }}>{key === "college" ? "College sample" : "Elementary sample"}</button>)}</div>}
    <div className="learnBar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Lesson progress">
      <span style={{ width: `${progress}%` }} />
    </div>
    {error && <p className="formError" role="alert">{error}</p>}
    {feedback && <p className="learnTeach" data-understood={understood ? "true" : "false"}>{feedback}</p>}
    {question ? <h2 className="learnAsk">{question}</h2> : !error && <p className="learnAsk">Asking from your materials.</p>}
    {!understood && <textarea className="learnAnswer" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="In your own words" rows={4} disabled={asking || busy || !question} />}
    <button className="buttonPrimary learnGo" type="button" disabled={busy || asking || loading || (!understood && !(error && !question) && !draft.trim())} onClick={() => {
      if (understood) void continueReading();
      else if (!question && topicId) { askedFor.current = null; void ask(topicId); }
      else void submitAnswer();
    }}>{understood ? "Continue" : asking ? "Asking" : "Check"}</button>
  </section>;
}
