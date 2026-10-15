"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Topic } from "@/lib/rooms";
import { RichText } from "./rich-text";
import { CitationChips, type Citation } from "./citations";
import { tapCheck } from "@/lib/learn-tap";

type Mission = { topic_id: string; document_id: string; phase: "brief" | "show" | "try" | "check" | "done"; reflection: "ready" | "review" | null; paused: boolean; revision: number };
type Snapshot = { mission: Mission | null; sourceCurrent?: boolean; source?: { documentName: string; pageNumber: number | null; excerpt: string } | null };

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

const PHASES = ["brief", "show", "try", "check"] as const;

function Passage({ fixture, documentId, source }: {
  fixture: boolean;
  documentId: string;
  source: { documentName: string; pageNumber: number | null; excerpt: string };
}) {
  return <div className="learnMissionSource">
    <span className="tinyLabel">{source.documentName}{source.pageNumber ? ` - page ${source.pageNumber}` : ""}</span>
    <blockquote>{source.excerpt}</blockquote>
    {!fixture && <a target="_blank" rel="noreferrer" href={`/api/documents/download?documentId=${encodeURIComponent(documentId)}&inline=1${source.pageNumber ? `&page=${source.pageNumber}` : ""}`}>Open original</a>}
  </div>;
}

export function LearnMission({ roomId, topics, selectedTopicId, onOpenMaterials }: {
  roomId: string; topics: Topic[]; selectedTopicId: string | null; onOpenMaterials: () => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lesson, setLesson] = useState<{ topicId: string; text: string; citations: Citation[] } | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [choice, setChoice] = useState<"ready" | "review" | null>(null);
  const [tapped, setTapped] = useState<number | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [sample, setSample] = useState<keyof typeof SAMPLES>("elementary");
  const sectionRef = useRef<HTMLElement>(null);
  const inFlight = useRef(false);
  const fixture = roomId === "fixture";
  const currentTopic = topics.find((topic) => topic.id === snapshot?.mission?.topic_id);
  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId);
  const mission = snapshot?.mission;

  const reload = useCallback(async () => {
    if (roomId === "fixture") {
      const demo = SAMPLES[sample];
      setSnapshot({ mission: { topic_id: sample, document_id: "source", phase: "brief", reflection: null, paused: false, revision: 0 },
        sourceCurrent: true, source: { documentName: `${demo.title} - design fixture`, pageNumber: 2, excerpt: demo.excerpt } });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/learn/mission?roomId=${encodeURIComponent(roomId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not restore your Learn mission.");
      setSnapshot(await response.json() as Snapshot);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not restore your Learn mission.");
    } finally { setLoading(false); }
  }, [roomId, topics, sample]);

  useEffect(() => { void reload(); }, [reload]);

  async function act(action: "start" | "restart" | "advance" | "back" | "pause" | "resume", reflection: "ready" | "review" | null = null) {
    const topicId = action === "restart" ? selectedTopic?.id ?? mission?.topic_id : mission?.topic_id ?? selectedTopic?.id;
    if (!topicId || inFlight.current) return;
    if (fixture) {
      setSnapshot((current) => current?.mission ? { ...current, mission: { ...current.mission, revision: current.mission.revision + 1,
        paused: action === "pause" ? true : action === "resume" ? false : current.mission.paused,
        reflection: reflection ?? current.mission.reflection,
        phase: action === "advance" ? ({ brief: "show", show: "try", try: "check", check: "done", done: "done" } as const)[current.mission.phase]
          : action === "back" ? ({ brief: "brief", show: "brief", try: "show", check: "try", done: "check" } as const)[current.mission.phase] : current.mission.phase } } : current);
      return;
    }
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      let chunkId: string | null = null;
      if (action === "start" || action === "restart") {
        const prepared = await fetch("/api/learn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roomId, topicId }) });
        const reading = await prepared.json().catch(() => null) as { explanation?: string; citations?: Citation[]; error?: string } | null;
        chunkId = reading?.citations?.find((citation) => citation.chunkId)?.chunkId ?? null;
        if (!prepared.ok || !reading?.explanation?.trim() || !chunkId) throw new Error(reading?.error ?? "A cited lesson is not ready for this objective. Try another topic or check Materials.");
        setLesson({ topicId, text: reading.explanation, citations: reading.citations ?? [] });
      }
      const response = await fetch("/api/learn/mission", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId, topicId, requestId: crypto.randomUUID(), expectedRevision: mission?.revision ?? 0, action, reflection, chunkId }) });
      const payload = await response.json().catch(() => null) as (Snapshot & { error?: string }) | null;
      if (!response.ok || !payload) throw new Error(payload?.error ?? "Could not save this step.");
      setSnapshot(payload);
      if (action === "restart") { setChoice(null); setTapped(null); setHintOpen(false); }
      if (reflection) setChoice(reflection);
    } catch (caught) {
      await reload();
      setError(caught instanceof Error ? caught.message : "Could not save this step.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  async function loadExplanation() {
    if (!mission || !snapshot?.sourceCurrent || lesson?.topicId === mission.topic_id || inFlight.current) return;
    inFlight.current = true;
    setLessonError(null);
    if (fixture) {
      setLesson({ topicId: mission.topic_id, text: sample === "college"
        ? "A net force is what is left after the forces on an object are combined. That leftover force changes the motion."
        : "An inherited behavior comes naturally. A learned behavior grows through practice and experience.", citations: [] });
      inFlight.current = false;
      return;
    }
    try {
      const response = await fetch("/api/learn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roomId, topicId: mission.topic_id }) });
      const payload = await response.json().catch(() => null) as { explanation?: string; citations?: Citation[] } | null;
      if (!response.ok || !payload?.explanation?.trim()) throw new Error("The explanation is unavailable. You can still read the verified source below.");
      setLesson({ topicId: mission.topic_id, text: payload.explanation, citations: Array.isArray(payload.citations) ? payload.citations : [] });
    } catch (caught) { setLessonError(caught instanceof Error ? caught.message : "Explanation unavailable."); }
    finally { inFlight.current = false; }
  }

  useEffect(() => {
    if (mission?.phase === "show" && snapshot?.sourceCurrent && lesson?.topicId !== mission.topic_id) void loadExplanation();
    // A successful lesson is kept in this mount; explicit retry handles failures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission?.phase, mission?.topic_id, snapshot?.sourceCurrent]);

  useEffect(() => {
    const thread = sectionRef.current?.closest(".chatThread");
    if (thread instanceof HTMLElement) thread.scrollTop = 0;
  }, [mission?.phase, mission?.paused, loading]);

  const objectiveText = fixture ? SAMPLES[sample].objective : currentTopic?.objective ?? selectedTopic?.objective ?? "Read one objective from your materials.";
  const check = snapshot?.source?.excerpt ? tapCheck(objectiveText, snapshot.source.excerpt) : null;
  const tryReflection: "ready" | "review" | null = check && tapped !== null ? (tapped === check.target ? "ready" : "review") : choice;
  const phaseCursor = !mission ? -1 : mission.phase === "done" ? PHASES.length : PHASES.indexOf(mission.phase as typeof PHASES[number]);

  if (loading && !snapshot) return <section ref={sectionRef} className="learnMission" role="status">Restoring your Learn mission...</section>;
  return <section ref={sectionRef} className="learnMission" aria-label="Guided Learn mission" data-phase={mission?.phase ?? "new"}>
    {fixture && <p className="learnMissionFixture">Synthetic visual preview. Steps are not saved. <span className="learnMissionChoices">{(Object.keys(SAMPLES) as (keyof typeof SAMPLES)[]).map((key) => <button key={key} type="button" aria-pressed={sample === key} onClick={() => { setSample(key); setTapped(null); setHintOpen(false); setChoice(null); setLesson(null); }}>{key === "college" ? "College sample" : "Elementary sample"}</button>)}</span></p>}
    {error && <div className="formError" role="alert">{error} <button type="button" onClick={() => void reload()}>Reload mission</button></div>}
    {!mission ? (
      <div className="learnMissionCard learnMissionStart">
        {selectedTopic ? <button className="buttonPrimary" type="button" disabled={busy || loading} onClick={() => void act("start")}>{selectedTopic.title}</button> : <p>Choose a topic.</p>}
      </div>
    ) : snapshot?.sourceCurrent === false ? (
      <div className="learnMissionCard" role="status"><h3>Source changed</h3><button type="button" onClick={onOpenMaterials}>Open Materials</button> <button type="button" disabled={busy} onClick={() => void act("restart")}>Restart</button></div>
    ) : <>
      <ol className="learnMissionSteps" aria-label="Mission steps">{PHASES.map((phase, index) => <li key={phase} aria-current={mission.phase === phase ? "step" : undefined} data-state={index < phaseCursor ? "done" : undefined}>{phase}</li>)}</ol>
      {mission.paused ? (
        <div className="learnMissionActions"><button className="buttonPrimary" type="button" disabled={busy} onClick={() => void act("resume")}>Resume</button></div>
      ) : <>
        <div className="learnMissionHead"><h2>{objectiveText}</h2></div>
        <div className="learnMissionCard">
          {mission.phase === "show" && (lesson?.topicId === mission.topic_id
            ? <><RichText text={lesson.text} /><CitationChips citations={lesson.citations} /></>
            : <div className="learnMissionSkeleton" role="status"><span className="srOnly">{lessonError ?? "Preparing an explanation..."}</span>{lessonError && <button type="button" onClick={() => void loadExplanation()}>Retry</button>}</div>)}
          {mission.phase === "try" && (check ? <div className="learnMissionChoices learnMissionLines" role="group" aria-label="Sentences from your source">{check.sentences.map((sentence, index) => <button key={sentence} type="button" aria-pressed={tapped === index} data-hint={hintOpen && index === check.target ? "true" : undefined} onClick={() => setTapped(index)}>{sentence}</button>)}</div>
            : <div className="learnMissionChoices learnMissionLines"><button type="button" aria-pressed={choice === "ready"} onClick={() => setChoice("ready")}>I could explain it</button><button type="button" aria-pressed={choice === "review"} onClick={() => setChoice("review")}>I need another look</button></div>)}
          {mission.phase === "check" && check && <div className="learnMissionLines" role="list">{check.sentences.map((sentence, index) => {
            const picked = tapped === index;
            const answer = index === check.target;
            const result = mission.reflection === "review" ? (picked ? "miss" : answer ? "answer" : undefined) : (answer ? "match" : undefined);
            return <p key={sentence} role="listitem" data-result={result}>{sentence}</p>;
          })}<p className="srOnly" role="status">{mission.reflection === "review" ? "A different sentence was selected." : "The sentence that states this objective was selected."}</p></div>}
          {mission.phase === "check" && !check && <div className="learnMissionChoices learnMissionLines"><p data-result={mission.reflection === "review" ? "miss" : "match"}>{mission.reflection === "review" ? "I need another look" : "I could explain it"}</p></div>}
          {mission.phase === "done" && <div className="learnMissionDone" role="status"><span aria-hidden="true" /><button type="button" disabled={busy} onClick={() => void act("restart")}>Read again</button></div>}
          {snapshot?.source && mission.phase !== "try" && mission.phase !== "done" && !(mission.phase === "check" && check) && <Passage fixture={fixture} documentId={mission.document_id} source={snapshot.source} />}
        </div>
        {mission.phase !== "done" && <div className="learnMissionActions">
          <div className="learnMissionQuiet">
            {mission.phase !== "brief" && <button type="button" className="learnMissionIcon" aria-label="Back" disabled={busy} onClick={() => void act("back")}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M14.5 6.5 9 12l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}
            <button type="button" className="learnMissionIcon" aria-label="Pause" disabled={busy} onClick={() => void act("pause")}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6.5v11M15 6.5v11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg></button>}
            {mission.phase === "try" && check && <button type="button" className="learnMissionIcon" aria-label="Hint" aria-pressed={hintOpen} onClick={() => setHintOpen((open) => !open)}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 4.5a5 5 0 0 0-2.2 9.5c.4.3.7.8.7 1.3V16h3v-.7c0-.5.3-1 .7-1.3A5 5 0 0 0 12 4.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M10 18.5h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></button>}
          </div>
          <button className="buttonPrimary" type="button" disabled={busy || (mission.phase === "try" && tryReflection === null)} onClick={() => void act("advance", mission.phase === "try" ? tryReflection : null)}>{mission.phase === "check" ? "Finish" : "Continue"}</button>
        </div>}
      </>}
    </>}
  </section>;
}
