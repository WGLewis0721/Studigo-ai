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
  const inFlight = useRef(false);
  const fixture = roomId === "fixture";
  const currentTopic = topics.find((topic) => topic.id === snapshot?.mission?.topic_id);
  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId);
  const mission = snapshot?.mission;

  const reload = useCallback(async () => {
    if (roomId === "fixture") {
      const demo = SAMPLES[sample];
      setSnapshot({ mission: { topic_id: sample, document_id: "source", phase: "brief", reflection: null, paused: false, revision: 0 },
        sourceCurrent: true, source: { documentName: `${demo.title} — design fixture`, pageNumber: 2, excerpt: demo.excerpt } });
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

  const heading = fixture ? SAMPLES[sample].title : currentTopic?.title ?? selectedTopic?.title ?? "Your next objective";
  const objectiveText = fixture ? SAMPLES[sample].objective : currentTopic?.objective ?? selectedTopic?.objective ?? "Read one objective from your materials.";
  const check = snapshot?.source?.excerpt ? tapCheck(objectiveText, snapshot.source.excerpt) : null;
  const tryReflection: "ready" | "review" | null = check && tapped !== null ? (tapped === check.target ? "ready" : "review") : choice;

  if (loading && !snapshot) return <section className="learnMission" role="status">Restoring your Learn mission…</section>;
  return <section className="learnMission" aria-label="Guided Learn mission" data-phase={mission?.phase ?? "new"}>
    {fixture && <p className="learnMissionFixture">Synthetic visual preview · steps are not saved and source/file actions are unavailable. <span className="learnMissionChoices">{(Object.keys(SAMPLES) as (keyof typeof SAMPLES)[]).map((key) => <button key={key} type="button" aria-pressed={sample === key} onClick={() => { setSample(key); setTapped(null); setHintOpen(false); setChoice(null); setLesson(null); }}>{key === "college" ? "College sample" : "Elementary sample"}</button>)}</span></p>}
    <div className="learnMissionHead"><span className="tinyLabel">GUIDED LEARN · NOT GRADED</span><h2>{heading}</h2>
      <p>{objectiveText}</p></div>
    {error && <div className="formError" role="alert">{error} <button type="button" onClick={() => void reload()}>Reload mission</button></div>}
    {!mission ? (
      <div className="learnMissionCard"><p>Follow one objective through a brief, a source-backed explanation, a reflection, and a check. This does not change mastery.</p>
        {selectedTopic ? <button className="buttonPrimary" type="button" disabled={busy || loading} onClick={() => void act("start")}>Start {selectedTopic.title}</button> : <p>Choose a topic to start.</p>}
      </div>
    ) : snapshot?.sourceCurrent === false ? (
      <div className="learnMissionCard" role="status"><h3>Source changed</h3><p>This objective is no longer backed by the same eligible passage. Nothing was graded.</p><button type="button" onClick={onOpenMaterials}>Open Materials</button> <button type="button" disabled={busy} onClick={() => void act("restart")}>Restart from current source</button></div>
    ) : mission.paused ? (
      <div className="learnMissionCard"><p>Paused at {mission.phase}. Your place is saved.</p><button className="buttonPrimary" type="button" disabled={busy} onClick={() => void act("resume")}>Resume</button></div>
    ) : <>
      <ol className="learnMissionSteps" aria-label="Mission steps">{(["brief","show","try","check"] as const).map((phase) => <li key={phase} aria-current={mission.phase === phase ? "step" : undefined}>{phase}</li>)}</ol>
      <div className="learnMissionCard">
        {mission.phase === "brief" && <><h3>Brief</h3><p>Here is what you are learning. Read the objective, then look at a passage from your own material.</p></>}
        {mission.phase === "show" && <><h3>Show</h3><p>Studigo explains the idea using your room’s material. Compare it with the source.</p>
          {lesson?.topicId === mission.topic_id ? <><RichText text={lesson.text} /><CitationChips citations={lesson.citations} /></> : <p role="status">{lessonError ?? "Preparing an explanation…"}</p>}
          {lessonError && <button type="button" onClick={() => void loadExplanation()}>Retry explanation</button>}</>}
        {mission.phase === "try" && (check ? <><h3>Try</h3><p>Tap the sentence from your source that states this objective. This is not a grade.</p>
          <div className="learnMissionChoices" role="group" aria-label="Sentences from your source">{check.sentences.map((sentence, index) => <button key={sentence} type="button" aria-pressed={tapped === index} onClick={() => setTapped(index)}>{sentence}</button>)}</div>
          <button type="button" aria-expanded={hintOpen} onClick={() => setHintOpen((open) => !open)}>Give me a hint</button>
          {hintOpen && <p className="learnMissionHint">The source states it in this sentence: {check.sentences[check.target]}</p>}
          {tapped !== null && <p role="status">{tapped === check.target ? "That sentence states this objective. Nothing was graded." : "That sentence is in the source, but it does not state this objective."}</p>}</>
        : <><h3>Try</h3><p>Could you explain this objective to someone else without looking? Choose honestly; this is a self-check, not a scored answer.</p>
          <div className="learnMissionChoices"><button type="button" aria-pressed={choice === "ready"} onClick={() => setChoice("ready")}>I could explain it</button><button type="button" aria-pressed={choice === "review"} onClick={() => setChoice("review")}>I need another look</button></div></>)}
        {mission.phase === "check" && <><h3>Check</h3><p>{check
          ? (mission.reflection === "review" ? "You tapped a different sentence. Read the source again. Nothing was graded." : "You tapped the sentence that states this objective. Nothing was graded.")
          : (mission.reflection === "review" ? "Good call. Read the source again, then use Coach when you want practice." : "You marked this as understood. Compare your explanation with the source, then practice with Coach to test it.")}</p></>}
        {mission.phase === "done" && <><h3>Reading complete</h3><p>This was an ungraded Learn pass. It did not change your mastery or readiness. Switch to Coach or Practice to test what you know.</p><button type="button" disabled={busy} onClick={() => void act("restart")}>Start another reading</button></>}
        {mission.phase !== "brief" && snapshot?.source && <div className="learnMissionSource"><span className="tinyLabel">{fixture ? "SAMPLE SOURCE" : "FIND IT · VERIFIED SOURCE"}</span><p><strong>{snapshot.source.documentName}</strong>{snapshot.source.pageNumber ? ` · page ${snapshot.source.pageNumber}` : ""}</p><blockquote>{snapshot.source.excerpt}</blockquote>{!fixture && <a target="_blank" rel="noreferrer" href={`/api/documents/download?documentId=${encodeURIComponent(mission.document_id)}&inline=1${snapshot.source.pageNumber ? `&page=${snapshot.source.pageNumber}` : ""}`}>Open original ↗</a>}</div>}
      </div>
      <div className="learnMissionActions">
        {mission.phase !== "brief" && mission.phase !== "done" && <button type="button" disabled={busy} onClick={() => void act("back")}>Back</button>}
        {mission.phase !== "done" && <button type="button" disabled={busy} onClick={() => void act("pause")}>Pause</button>}
        {mission.phase !== "done" && <button className="buttonPrimary" type="button" disabled={busy || (mission.phase === "try" && tryReflection === null)} onClick={() => void act("advance", mission.phase === "try" ? tryReflection : null)}>{mission.phase === "check" ? "Finish reading" : "Continue"}</button>}
      </div>
    </>}
  </section>;
}
