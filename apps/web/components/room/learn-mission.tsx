"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Topic } from "@/lib/rooms";
import { RichText } from "./rich-text";
import type { Citation } from "./citations";
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

/** How far through this reading. The bar is unlabeled on purpose. */
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
  const [lesson, setLesson] = useState<{ topicId: string; text: string } | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [tapped, setTapped] = useState<number | null>(null);
  const [sample, setSample] = useState<keyof typeof SAMPLES>("elementary");
  const sectionRef = useRef<HTMLElement>(null);
  const inFlight = useRef(false);
  const startTried = useRef(false);
  const fixture = roomId === "fixture";
  const mission = snapshot?.mission ?? null;
  const currentTopic = topics.find((topic) => topic.id === mission?.topic_id);
  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId);
  const objectiveText = fixture
    ? SAMPLES[sample].objective
    : currentTopic?.objective || selectedTopic?.objective || currentTopic?.title || selectedTopic?.title || "";

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

  async function post(current: Mission | null, action: Action, reflection: "ready" | "review" | null = null): Promise<Snapshot> {
    const topicId = action === "restart" ? selectedTopic?.id ?? current?.topic_id : current?.topic_id ?? selectedTopic?.id;
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
      const reading = await prepared.json().catch(() => null) as { explanation?: string; citations?: Citation[]; error?: string } | null;
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

  async function act(action: Action, reflection: "ready" | "review" | null = null) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await post(mission, action, reflection);
      if (action === "restart" || action === "start") setTapped(null);
    } catch (caught) {
      await reload();
      setError(caught instanceof Error ? caught.message : "Could not save this reading.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function loadExplanation(topicId: string) {
    if (lesson?.topicId === topicId || inFlight.current) return;
    setLessonError(null);
    if (fixture) {
      setLesson({
        topicId,
        text: sample === "college"
          ? "A net force is what is left after the forces on an object are combined. That leftover force changes the motion."
          : "An inherited behavior comes naturally. A learned behavior grows through practice and experience.",
      });
      return;
    }
    try {
      const response = await fetch("/api/learn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roomId, topicId }) });
      const payload = await response.json().catch(() => null) as { explanation?: string } | null;
      if (!response.ok || !payload?.explanation?.trim()) throw new Error("Explanation unavailable.");
      setLesson({ topicId, text: payload.explanation });
    } catch (caught) {
      setLessonError(caught instanceof Error ? caught.message : "Explanation unavailable.");
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

  const lines = snapshot?.source?.excerpt ? passageLines(objectiveText, snapshot.source.excerpt) : null;
  const revealed = mission?.phase === "check" || mission?.phase === "done";
  const miss = revealed && mission?.reflection === "review";
  const progress = readingProgress(mission?.phase ?? "new");

  useEffect(() => {
    if (miss && mission) void loadExplanation(mission.topic_id);
    // Explanation follows a miss. A hit does not request one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miss, mission?.topic_id]);

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
  const buttonLabel = showPassage && !revealed ? "Check" : "Continue";

  return <section ref={sectionRef} className="learnMission" aria-label="Reading" data-phase={mission?.phase ?? "new"}>
    {fixture && <div className="learnMissionChoices">{(Object.keys(SAMPLES) as (keyof typeof SAMPLES)[]).map((key) => <button key={key} type="button" aria-pressed={sample === key} onClick={() => { setSample(key); setTapped(null); setLesson(null); }}>{key === "college" ? "College sample" : "Elementary sample"}</button>)}</div>}
    <div className="learnProgress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Reading progress">
      <span style={{ width: `${progress}%` }} />
    </div>
    {objectiveText && <h2 className="learnQuestion">{objectiveText}</h2>}
    {error && <div className="formError" role="alert">{error}</div>}
    {loading && !snapshot ? <p className="srOnly" role="status">Restoring this reading.</p> : null}
    {snapshot?.sourceCurrent === false ? (
      <p role="status">This passage changed.</p>
    ) : showPassage && lines ? (
      <>
        <div className="learnPassage" role="group" aria-label="Passage">
          {lines.sentences.map((sentence, index) => {
            const result = !revealed || !mission ? undefined
              : mission.reflection === "ready"
                ? (index === lines.target ? "hit" : undefined)
                : mission.reflection === "review"
                  ? (tapped === index && index !== lines.target ? "miss" : index === lines.target ? "answer" : undefined)
                  : undefined;
            if (revealed) {
              return <p key={sentence} className="learnLine" data-result={result}>{sentence}{result && <span className={result === "miss" ? "learnMark learnMarkMiss" : "learnMark"} aria-hidden="true" />}</p>;
            }
            return <button key={sentence} type="button" className="learnLine" aria-pressed={tapped === index} onClick={() => setTapped(index)}>{sentence}</button>;
          })}
        </div>
        {revealed && <p className="srOnly" role="status">{miss ? "Not that sentence." : "That sentence is the one."}</p>}
        {miss && <div className="learnExplain">
          {lesson?.topicId === mission?.topic_id ? <RichText text={lesson.text} /> : lessonError ? <p role="status">{lessonError}</p> : <p className="srOnly" role="status">Explanation</p>}
        </div>}
      </>
    ) : !mission && !loading && !selectedTopic ? <p role="status">Choose a topic.</p> : <p className="srOnly" role="status">Opening the passage.</p>}
    {mission?.phase !== "done" && (showPassage || snapshot?.sourceCurrent === false || (error && !mission)) && <button className="buttonPrimary learnCheck" type="button" disabled={busy || loading || (showPassage && snapshot?.sourceCurrent !== false && !revealed && tapped === null)} onClick={() => {
      if (snapshot?.sourceCurrent === false) { void act("restart"); return; }
      if (error && !mission) { startTried.current = false; void act("start"); return; }
      if (revealed) void act("advance");
      else void submitCheck();
    }}>{buttonLabel}</button>}
  </section>;
}
