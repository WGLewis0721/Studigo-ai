"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./guided-learn-chapters.css";
import type { Topic } from "@/lib/rooms";
import { missionBeats, sourceSentences, tapCheck, type ExplainDelivery, type MissionBeat } from "@/lib/learn-tap";
import { StudigoMascot } from "@/components/studigo-mascot";
import { buildLearningMissionPlan } from "@/lib/learning-mission-blueprint";

type Phase = "brief" | "show" | "try" | "check" | "done";
type Mission = { topic_id: string; document_id: string; phase: Phase; reflection: "ready" | "review" | null; paused: boolean; revision: number };
type Snapshot = { mission: Mission | null; sourceCurrent?: boolean; source?: { documentName: string; pageNumber: number | null; excerpt: string } | null };
type Action = "start" | "restart" | "advance" | "back" | "pause" | "resume";

const SAMPLES = {
  elementary: {
    title: "Three branches of government",
    objective: "Which branch makes the laws?",
    excerpt: "The legislative branch makes laws. The executive branch carries out laws. The judicial branch interprets laws.",
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
  if (phase === "check") return 80;
  if (phase === "try") return 60;
  if (phase === "show") return 40;
  return 20;
}

function passageLines(objective: string, excerpt: string): { sentences: string[]; target: number } | null {
  const checked = tapCheck(objective, excerpt);
  if (checked) return checked;
  const sentences = sourceSentences(excerpt);
  if (sentences.length === 1) return { sentences, target: 0 };
  const line = excerpt.trim();
  return line ? { sentences: [line], target: 0 } : null;
}

function beatHit(beat: MissionBeat, picked: number[]): boolean {
  if (beat.kind === "choice") return picked[0] === beat.answer;
  if (beat.kind === "blank") return beat.options[picked[0]] === beat.answer;
  if (beat.kind === "boxes") return picked.length === beat.answers.length && beat.answers.every((index) => picked.includes(index));
  return true;
}

function beatFix(beat: MissionBeat): string {
  if (beat.kind === "choice") return beat.options[beat.answer] ?? "";
  if (beat.kind === "blank") return beat.answer;
  if (beat.kind === "boxes") return beat.answers.map((index) => beat.options[index]).filter(Boolean).join(" ");
  return "";
}

export function LearnMission({ roomId, topics, selectedTopicId, explainLevel = "standard", onOpenMaterials }: {
  roomId: string; topics: Topic[]; selectedTopicId: string | null; explainLevel?: ExplainDelivery; onOpenMaterials: () => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tapped, setTapped] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [shown, setShown] = useState(false);
  const [sample, setSample] = useState<keyof typeof SAMPLES>("elementary");
  const sectionRef = useRef<HTMLElement>(null);
  const inFlight = useRef(false);

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
        mission: null,
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
    const thread = sectionRef.current?.closest(".chatThread");
    if (thread instanceof HTMLElement) thread.scrollTop = 0;
  }, [mission?.phase, loading]);

  const lines = snapshot?.source?.excerpt ? passageLines(objectiveSource, snapshot.source.excerpt) : null;
  const beats = lines ? missionBeats(objectiveSource, lines.sentences, lines.target, explainLevel) : [];
  const beat = beats[step];
  const passageKey = `${explainLevel}|${objectiveSource}|${snapshot?.source?.excerpt ?? ""}`;
  const progress = beats.length ? Math.round(((step + (beat?.kind === "read" || shown ? 1 : 0.35)) / beats.length) * 100) : 16;
  const hit = Boolean(beat && beat.kind !== "read" && shown && beatHit(beat, picked));

  useEffect(() => {
    setStep(0);
    setPicked([]);
    setShown(false);
  }, [passageKey]);

  function play(index: number) {
    if (shown || !beat || beat.kind === "read") return;
    setPicked((current) => {
      if (beat.kind !== "boxes") return [index];
      return current.includes(index) ? current.filter((item) => item !== index) : [...current, index];
    });
  }

  function advanceLevel() {
    if (step < beats.length - 1) {
      setStep(step + 1);
      setPicked([]);
      setShown(false);
      return;
    }
    void nextLevel();
  }

  async function nextLevel() {
    setStep(0);
    setPicked([]);
    setShown(false);
    if (fixture) {
      setSample((current) => current === "elementary" ? "college" : "elementary");
      return;
    }
    if (!mission || inFlight.current) return;
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
      await post(current, "restart", null, next?.id ?? current.topic_id);
    } catch (caught) {
      await reload();
      setError(caught instanceof Error ? caught.message : "Could not open the next part.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const missionPlan = buildLearningMissionPlan(topics.map((topic) => ({
    id: topic.id,
    title: topic.title,
    objective: topic.objective
  })), mission && snapshot?.source && snapshot.sourceCurrent !== false ? [{
    topicId: mission.topic_id,
    documentId: mission.document_id,
    chunkId: "current-authorized-reading",
    revision: mission.revision,
    pageNumber: snapshot.source.pageNumber,
    documentName: snapshot.source.documentName,
    excerpt: snapshot.source.excerpt,
    eligible: true
  }] : []);
  const lessonNumber = Math.max(1, topics.findIndex((topic) => topic.id === (mission?.topic_id ?? selectedTopicId)) + 1);

  const ready = Boolean(mission && snapshot?.sourceCurrent !== false && beat);

  return <section ref={sectionRef} className="learnReading" aria-label="Guided Learn mission">
    {!loading && !mission && <div className="learnInvitation">
      <p className="tinyLabel">YOUR LEARNING MISSION</p>
      <h2>{selectedTopic ? "Learn " + selectedTopic.title : "Start with your material"}</h2>
      <p>{selectedTopic?.objective || "Choose a topic from your uploaded study guide. Studigo will show you one idea at a time."}</p>
      <div className="learnInvitationMeta">
        <span>{topics.length} {topics.length === 1 ? "topic" : "topics"} in your guide</span>
        <span>{fixture ? "Example material" : "Source checked before teaching"}</span>
      </div>
      {fixture && <div className="learnSamples" aria-label="Review subject examples">
        {(Object.keys(SAMPLES) as (keyof typeof SAMPLES)[]).map((key) =>
          <button key={key} type="button" aria-pressed={sample === key}
            onClick={() => setSample(key)}>{key === "college" ? "College physics" : "Elementary science"}</button>)}
      </div>}
      <button className="buttonPrimary learnInvitationStart" type="button" disabled={busy || (!fixture && !selectedTopic)}
        onClick={() => void act("start")}>Start learning →</button>
      {!fixture && <button className="ghostButton" type="button" onClick={onOpenMaterials}>View original materials</button>}
      {!fixture && missionPlan.sourceStatus === "missing" && <p className="hintText">Studigo will verify the exact source passage when you start. Unsupported topics cannot become cited lessons.</p>}
    </div>}
    {mission?.paused && <div className="learnInvitation" role="status">
      <p className="tinyLabel">PAUSED MISSION · LESSON {lessonNumber} OF {topics.length}</p>
      <h2>{currentTopic?.title || "Your saved lesson"}</h2>
      <p>You're at {mission.phase}. Continue exactly where you stopped.</p>
      <button className="buttonPrimary" type="button" disabled={busy}
        onClick={() => void act("resume")}>Continue lesson →</button>
    </div>}

    {mission && !mission.paused && <div className="learnLessonLabel" aria-label={`Lesson ${lessonNumber} of ${topics.length}`}>Lesson {lessonNumber} of {topics.length} · {currentTopic?.title}</div>}
    {(mission && !mission.paused) && <div className="learnBar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Level progress">
      <span style={{ width: `${progress}%` }} />
    </div>
    {error && <p className="formError" role="alert">{error}</p>}
    {mission?.paused || (!mission && !loading) ? null : snapshot?.sourceCurrent === false ? <p role="status">This part changed. Please restart from the current source.</p> : beat ? (
      <div className="learnTalk">
        <StudigoMascot state={shown ? (hit ? "celebrate" : "explain") : beat.kind === "read" ? "explain" : "welcome"} size={64} />
        <div className="learnTalkBody">
          <h2 className="learnAsk">{beat.kind === "read" ? beat.title : beat.prompt}</h2>
          {beat.kind === "read" && <p className="learnLine">{beat.body}</p>}
          {beat.kind === "blank" && <p className="learnLine">{beat.before}<span className="learnGap">{picked.length ? beat.options[picked[0]] : "______"}</span>{beat.after}</p>}
          {beat.kind === "blank" && <div className="learnWords">{beat.options.map((word, index) => <button key={word} type="button" className="learnWord" aria-pressed={picked[0] === index} onClick={() => play(index)}>{word}</button>)}</div>}
          {(beat.kind === "choice" || beat.kind === "boxes") && <div className="learnChoices" role="group">
            {beat.options.map((option, index) => {
              const result = !shown ? undefined : beat.kind === "choice"
                ? (index === beat.answer ? "hit" : picked[0] === index ? "miss" : undefined)
                : beat.answers.includes(index) ? "hit" : picked.includes(index) ? "miss" : undefined;
              const mark = result === "miss" ? "×" : result === "hit" || picked.includes(index) ? "✓" : "";
              return <button key={option} type="button" className="learnChoice" aria-pressed={picked.includes(index)} data-result={result} onClick={() => play(index)}><span className="learnBox" aria-hidden="true">{mark}</span>{option}</button>;
            })}
          </div>}
        </div>
      </div>
    ) : <p className="learnAsk">{loading ? "Opening this part." : "Choose a topic."}</p>}
    {shown && beat && beat.kind !== "read" && !hit ? <p className="learnSheet">{beatFix(beat)}</p> : null}
    {(!mission?.paused && (ready || snapshot?.sourceCurrent === false || (error && !mission))) && <button className="buttonPrimary learnGo" type="button" disabled={busy || loading || (Boolean(beat && beat.kind !== "read" && !shown && picked.length === 0))} onClick={() => {
      if (snapshot?.sourceCurrent === false) { void act("restart"); return; }
      if (error && !mission) { void act("start"); return; }
      if (!beat || beat.kind === "read" || shown) advanceLevel();
      else setShown(true);
    }}>{!beat || beat.kind === "read" || shown ? "Continue" : "Check"}</button>}
  </section>;
}
