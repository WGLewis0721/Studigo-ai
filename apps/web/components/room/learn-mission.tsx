"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Topic } from "@/lib/rooms";
import { sourceSentences, tapCheck } from "@/lib/learn-tap";

type Phase = "brief" | "show" | "try" | "check" | "done";
type Mission = { topic_id: string; document_id: string; phase: Phase; reflection: "ready" | "review" | null; paused: boolean; revision: number };
type Snapshot = { mission: Mission | null; sourceCurrent?: boolean; source?: { documentName: string; pageNumber: number | null; excerpt: string } | null };
type Action = "start" | "restart" | "advance" | "back" | "pause" | "resume";

const SAMPLES = {
  elementary: {
    title: "Inherited and learned behavior",
    objective: "Explain which behaviors are inherited.",
    excerpt: "Some animal behaviors are inherited. Other behaviors are learned through experience.",
  },
  college: {
    title: "Net force and motion",
    objective: "Explain what a net force does to an object's motion.",
    excerpt: "A net force changes an object's motion. If the forces on an object are balanced, its velocity stays the same.",
  },
} as const;

function questionFrom(objective: string): string {
  const text = objective.trim();
  const colon = text.indexOf(":");
  if (colon >= 24 && colon < text.length - 1) return text.slice(0, colon).trim();
  return text;
}
function readingProgress(phase: Phase | "new"): number {
  if (phase === "done") return 100;
  if (phase === "check") return 72;
  return 16;
}

function passageLines(objective: string, excerpt: string): { sentences: string[]; target: number } | null {
  const checked = tapCheck(objective, excerpt);
  if (checked) return checked;
  const sentences = sourceSentences(excerpt);
  if (sentences.length === 1) return { sentences, target: 0 };
  const line = excerpt.trim();
  return line ? { sentences: [line], target: 0 } : null;
}

export function LearnMission({ roomId, topics, selectedTopicId }: {
  roomId: string; topics: Topic[]; selectedTopicId: string | null; onOpenMaterials: () => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tapped, setTapped] = useState<number | null>(null);
  const [sample, setSample] = useState<keyof typeof SAMPLES>("elementary");
  const sectionRef = useRef<HTMLElement>(null);
  const inFlight = useRef(false);
  const startTried = useRef(false);
  const fixture = roomId === "fixture";
  const mission = snapshot?.mission ?? null;
  const currentTopic = topics.find((topic) => topic.id === mission?.topic_id);
  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId);
  const objectiveSource = fixture
    ? SAMPLES[sample].objective
    : currentTopic?.objective || selectedTopic?.objective || currentTopic?.title || selectedTopic?.title || "";
  const objectiveText = questionFrom(objectiveSource);

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
      if (action === "restart" || action === "start") setTapped(null);
    } catch (caught) {
      await reload();
      setError(caught instanceof Error ? caught.message : "Could not save this reading.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (fixture || loading || mission || !selectedTopic || startTried.current) return;
    startTried.current = true;
    void act("start");
    // Start once when Learn opens with no saved reading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture, loading, mission, selectedTopic]);

  useEffect(() => {
    if (fixture || !mission?.paused || inFlight.current) return;
    void act("resume");
    // A paused cursor still opens on the passage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission?.paused, mission?.revision]);

  useEffect(() => {
    const thread = sectionRef.current?.closest(".chatThread");
    if (thread instanceof HTMLElement) thread.scrollTop = 0;
  }, [mission?.phase, loading]);

  const lines = snapshot?.source?.excerpt ? passageLines(objectiveSource, snapshot.source.excerpt) : null;
  const revealed = mission?.phase === "check" || mission?.phase === "done";
  const miss = revealed && mission?.reflection === "review";
  const progress = readingProgress(mission?.phase ?? "new");

  async function submitCheck() {
    if (!mission || !lines || tapped === null || revealed || inFlight.current) return;
    const reflection: "ready" | "review" = tapped === lines.target ? "ready" : "review";
    if (fixture) {
      setSnapshot((current) => current?.mission ? {
        ...current,
        mission: { ...current.mission, phase: "check", reflection, paused: false, revision: current.mission.revision + 1 },
      } : current);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      let current = mission;
      if (current.paused) {
        const resumed = await post(current, "resume");
        if (!resumed.mission) throw new Error("Could not save this reading.");
        current = resumed.mission;
      }
      while (current.phase === "brief" || current.phase === "show") {
        const next = await post(current, "advance");
        if (!next.mission) throw new Error("Could not save this reading.");
        current = next.mission;
      }
      if (current.phase === "try") await post(current, "advance", reflection);
    } catch (caught) {
      await reload();
      setError(caught instanceof Error ? caught.message : "Could not save this reading.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const showPassage = Boolean(mission && snapshot?.sourceCurrent !== false && lines);
  const waiting = showPassage && !revealed && tapped === null;
  const explain = miss ? lines?.sentences[lines.target] ?? "" : "";

  async function continueReading() {
    if (!mission || inFlight.current) return;
    if (mission.phase !== "check" && mission.phase !== "done") {
      void act("advance");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      let current = mission;
      if (current.phase === "check") {
        const advanced = await post(current, "advance");
        if (!advanced.mission) throw new Error("Could not save this reading.");
        current = advanced.mission;
      }
      const index = topics.findIndex((topic) => topic.id === current.topic_id);
      const next = topics[index + 1] ?? topics[0];
      await post(current, "restart", null, next?.id ?? current.topic_id);
      setTapped(null);
    } catch (caught) {
      await reload();
      setError(caught instanceof Error ? caught.message : "Could not save this reading.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <section ref={sectionRef} className="learnReading" aria-label="Reading">
    {fixture && <div className="learnSamples">{(Object.keys(SAMPLES) as (keyof typeof SAMPLES)[]).map((key) => <button key={key} type="button" aria-pressed={sample === key} onClick={() => { setSample(key); setTapped(null); }}>{key === "college" ? "College sample" : "Elementary sample"}</button>)}</div>}
    <div className="learnBar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Reading progress">
      <span style={{ width: `${progress}%` }} />
    </div>
    {objectiveText && <h2 className="learnAsk">{objectiveText}</h2>}
    {error && <p className="formError" role="alert">{error}</p>}
    {snapshot?.sourceCurrent === false ? <p role="status">This passage changed.</p> : showPassage && lines ? (
      <div className="learnChoices" role="group" aria-label="Passage">
        {lines.sentences.map((sentence, index) => {
          const result = !revealed || !mission ? undefined
            : mission.reflection === "ready"
              ? (index === lines.target ? "hit" : undefined)
              : mission.reflection === "review"
                ? (tapped === index && index !== lines.target ? "miss" : index === lines.target ? "answer" : undefined)
                : undefined;
          const mark = result === "miss" ? "×" : result === "hit" || result === "answer" || tapped === index ? "✓" : "";
          if (revealed) {
            return <p key={sentence} className="learnChoice" data-result={result}><span className="learnBox" aria-hidden="true">{mark}</span>{sentence}</p>;
          }
          return <button key={sentence} type="button" className="learnChoice" aria-pressed={tapped === index} onClick={() => setTapped(index)}><span className="learnBox" aria-hidden="true">{mark}</span>{sentence}</button>;
        })}
      </div>
    ) : <p className="srOnly" role="status">{loading ? "Opening the passage." : "Choose a topic."}</p>}
    {miss && explain ? <p className="learnSheet">{explain}</p> : null}
    {revealed && <p className="srOnly">{miss ? "Not that sentence." : "That sentence is the one."}</p>}
    {(showPassage || snapshot?.sourceCurrent === false || (error && !mission)) && <button className="buttonPrimary learnGo" type="button" disabled={busy || loading || (mission?.phase !== "done" && waiting)} onClick={() => {
      if (snapshot?.sourceCurrent === false) { void act("restart"); return; }
      if (error && !mission) { startTried.current = false; void act("start"); return; }
      if (revealed) continueReading();
      else void submitCheck();
    }}>{showPassage && !revealed ? "Check" : "Continue"}</button>}
  </section>;
}
