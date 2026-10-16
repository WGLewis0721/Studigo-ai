"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./guided-learn-chapters.css";
import { ExploreJournal } from "./explore-journal";
import { MissionControlIcon } from "./mission-control-icon";
import { MATERIAL_NOTES } from "@/lib/fixture-materials";
import type { Topic } from "@/lib/rooms";
import { missionBeats, tapCheck, type ExplainDelivery, type MissionBeat } from "@/lib/learn-tap";
import { useCompanion } from "@/components/companion/companion";
import { StudigoMascot } from "@/components/studigo-mascot";
import { ReadAloudControl } from "./read-aloud-control";
import { SpeechAnswerControl } from "./speech-answer-control";
import { buildLearningMissionPlan } from "@/lib/learning-mission-blueprint";
import { lessonBeatIndex, formativeReflection, canAdvanceLesson } from "@/lib/learning-mission-stages";

type Phase = "brief" | "show" | "try" | "check" | "done";
type Mission = { topic_id: string; document_id: string; chunk_id?: string; source_revision?: number; phase: Phase; reflection: "ready" | "review" | null; paused: boolean; revision: number };
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
  // Do not convert a failed extraction into one enormous pretend lesson.
  // One usable line also cannot support distinct source-grounded alternatives.
  return tapCheck(objective, excerpt);
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

export function LearnMission({ roomId, topics, selectedTopicId, explainLevel = "standard", onOpenMaterials, onTryCoach, onTryPractice, previewJournal = false }: {
  roomId: string; topics: Topic[]; selectedTopicId: string | null; explainLevel?: ExplainDelivery;
  previewJournal?: boolean; onOpenMaterials: () => void; onTryCoach?: (topicId: string) => void; onTryPractice?: (topicId: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tapped, setTapped] = useState<number | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [shown, setShown] = useState(false);
  const [helpUsed, setHelpUsed] = useState(false);
  const [spokenDraft, setSpokenDraft] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  // The original synthetic Guided Learn fixture stays pixel-for-pixel unchanged.
  const [journalOpen, setJournalOpen] = useState(roomId !== "fixture" || previewJournal);
  const sourceDialogRef = useRef<HTMLDialogElement>(null);
  const sourceButtonRef = useRef<HTMLButtonElement>(null);
  const [sample, setSample] = useState<keyof typeof SAMPLES>("elementary");
  const sectionRef = useRef<HTMLElement>(null);
  const inFlight = useRef(false);

  const fixture = roomId === "fixture";
  // The original synthetic mission remains unchanged; preview and real
  // canary use one Learn journey instead of competing Learn/Explore modes.
  const integratedJourney = !fixture || previewJournal;
  const mission = snapshot?.mission ?? null;
  const { thinking: companionThinking } = useCompanion();
  useEffect(() => { companionThinking(busy); return () => companionThinking(false); }, [busy, companionThinking]);
  const currentTopic = topics.find((topic) => topic.id === mission?.topic_id);
  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId);
  const invitationTitle = fixture ? SAMPLES[sample].title : selectedTopic?.title;
  const invitationObjective = fixture ? SAMPLES[sample].objective : selectedTopic?.objective;
  const objectiveSource = fixture && !previewJournal
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
        : action === "back"
          ? ({ brief: "brief", show: "brief", try: "show", check: "try", done: "check" } as const)[current?.phase ?? "brief"]
          : action === "restart" || action === "start" ? "brief" : current?.phase ?? "brief";
      const previewTopic = previewJournal ? topics.find((topic) => topic.id === (topicOverride ?? current?.topic_id)) : null;
      const note = previewTopic ? MATERIAL_NOTES[previewTopic.title] : null;
      const previewSource = note && (action === "start" || action === "restart")
        ? { documentName: "Synthetic fifth-grade science guide", pageNumber: 1, excerpt: `${note.summary} ${note.example}` }
        : snapshot?.source ?? null;
      const next: Snapshot = {
        mission: {
          topic_id: previewJournal && topicOverride ? topicOverride : action === "restart" ? sample : current?.topic_id ?? sample,
          document_id: "source",
          phase: nextPhase,
          reflection: reflection ?? (action === "restart" ? null : current?.reflection ?? null),
          paused: action === "pause" ? true : action === "resume" || action === "restart" || action === "start" ? false : (current?.paused ?? false),
          revision: (current?.revision ?? 0) + 1,
        },
        sourceCurrent: true,
        source: previewSource,
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

  async function act(action: Action, reflection: "ready" | "review" | null = null, topicOverride?: string): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await post(mission, action, reflection, topicOverride);
      if (action === "restart" || action === "start") setTapped(null);
      return true;
    } catch (caught) {
      await reload();
      setError(caught instanceof Error ? caught.message : "Could not save this reading.");
      return false;
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
  const proposedBeats = lines ? missionBeats(objectiveSource, lines.sentences, lines.target, explainLevel) : [];
  // Backend uses four fixed formative phases. A shorter question set must not
  // silently replay the preceding activity (and force duplicate Continue).
  const beats = proposedBeats.length === 4 ? proposedBeats : [];
  const step = mission ? lessonBeatIndex(mission.phase, beats.length) : null;
  const beat = step === null ? undefined : beats[step];
  const passageKey = `${explainLevel}|${objectiveSource}|${snapshot?.source?.excerpt ?? ""}`;
  const progress = beats.length && step !== null ? Math.round(((step + (beat?.kind === "read" || shown ? 1 : 0.35)) / beats.length) * 100) : 16;
  const hit = Boolean(beat && beat.kind !== "read" && shown && beatHit(beat, picked));

  useEffect(() => {
    setPicked([]);
    setShown(false);
    setHelpUsed(false);
    setSpokenDraft("");
  }, [passageKey, mission?.phase]);

  function play(index: number) {
    if (shown || !beat || beat.kind === "read") return;
    setPicked((current) => {
      if (beat.kind !== "boxes") return [index];
      return current.includes(index) ? current.filter((item) => item !== index) : [...current, index];
    });
  }

  function advanceLevel() {
    if (!mission || mission.paused || mission.phase === "done") return;
    // The server advances the source-bound cursor. UI does not own progression.
    void act("advance", formativeReflection(mission.phase, shown, hit && !helpUsed));
  }

  const missionPlan = buildLearningMissionPlan(topics.map((topic) => ({
    id: topic.id,
    title: topic.title,
    objective: topic.objective
  })), mission && snapshot?.source && snapshot.sourceCurrent !== false ? [{
    topicId: mission.topic_id,
    documentId: mission.document_id,
    chunkId: mission.chunk_id ?? "fixture-only-reading",
    revision: mission.source_revision ?? 0,
    pageNumber: snapshot.source.pageNumber,
    documentName: snapshot.source.documentName,
    excerpt: snapshot.source.excerpt,
    eligible: true
  }] : []);
  const lessonNumber = Math.max(1, topics.findIndex((topic) => topic.id === (mission?.topic_id ?? selectedTopicId)) + 1);

  const openSource = () => {
    if (!snapshot?.source || snapshot.sourceCurrent === false || !mission) return;
    setSourceOpen(true);
    sourceDialogRef.current?.showModal();
  };
  const closeSource = () => {
    sourceDialogRef.current?.close();
    setSourceOpen(false);
    sourceButtonRef.current?.focus();
  };
  const ready = Boolean(mission && !mission.paused && snapshot?.sourceCurrent !== false && beat);
  const introduction = Boolean(integratedJourney && mission?.phase === "brief" && beat?.kind === "read");
  const firstCheck = Boolean(integratedJourney && mission?.phase === "show" && beat?.kind === "choice");
  // Use the exact retrieved current passage as the learning introduction.
  const reading = introduction ? snapshot?.source?.excerpt ?? "" : beat?.kind === "read" ? beat.body : "";

  // Render the journal in the same Learn room. All teaching, answers and
  // revision-bound cursor updates still belong to the existing player/API.
  if (journalOpen && !loading) return <ExploreJournal
    roomId={roomId} fixture={fixture} topics={topics} cursor={mission} sourceCurrent={snapshot?.sourceCurrent}
    busy={busy} error={error} onOpenMaterials={onOpenMaterials}
    onStart={(topicId) => act(mission ? "restart" : "start", null, topicId)}
    onContinue={() => act("resume")}
    onOpenLesson={() => setJournalOpen(false)}
  />;

  return <section ref={sectionRef} className="learnReading" aria-label="Guided Learn mission">
    {!loading && !mission && <div className="learnInvitation">
      <p className="tinyLabel">YOUR LEARNING MISSION</p>
      <h2>{invitationTitle ? "Learn " + invitationTitle : "Start with your material"}</h2>
      <p>{invitationObjective || "Choose a topic from your uploaded study guide. Studigo will show you one idea at a time."}</p>
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

    {mission && !mission.paused && <div className="learnLessonLabel" aria-label={`${integratedJourney ? "Quest" : "Lesson"} ${lessonNumber} of ${topics.length}`}>
      <span>{integratedJourney ? "Quest" : "Lesson"} {lessonNumber} of {topics.length}</span>
      <span className="learnLessonTopic">{currentTopic?.title}</span>
    </div>}
    {(mission && !mission.paused) && <div className="learnBar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={integratedJourney ? "Guided lesson progress, not mastery" : "Level progress"}>
      <span style={{ width: `${progress}%` }} />
    </div>}
    {error && <p className="formError" role="alert">{error}</p>}
    {mission?.paused || (!mission && !loading) ? null : snapshot?.sourceCurrent === false ? <p role="status">This part changed. Please restart from the current source.</p> : mission?.phase === "done" ? <div className="learnInvitation learnHandoff" role="status">
      <p className="tinyLabel">LEARNING CHECKPOINT COMPLETE · NO MASTERY AWARDED</p>
      <h2>You practiced {currentTopic?.title || (fixture ? SAMPLES[sample].title : "this idea")}.</h2>
      <p>Studigo helped you learn the idea. To find out what you know independently, try Coach or a Practice question.</p>
      {mission.reflection && <p className="learnAssistanceNote">Last learning check: {mission.reflection === "ready" ? "Ready to try" : "Review suggested"} · Formative only</p>}
      <div className="learnHandoffActions">
        {onTryCoach && <button className="buttonPrimary" type="button"
          onClick={() => onTryCoach(topics.some((topic) => topic.id === mission.topic_id) ? mission.topic_id : selectedTopicId ?? mission.topic_id)}>Try with Coach →</button>}
        {onTryPractice && <button className="ghostButton" type="button"
          onClick={() => onTryPractice(topics.some((topic) => topic.id === mission.topic_id) ? mission.topic_id : selectedTopicId ?? mission.topic_id)}>Practice independently</button>}
        {snapshot?.source && <button className="ghostButton" type="button" onClick={openSource}>Review source</button>}
        <button className="ghostButton" type="button" onClick={() => {
          if (window.confirm("Start this learning mission over? This will not change your mastery or graded attempts.")) void act("restart");
        }}>Start lesson over</button>
      </div>
    </div> : beat ? (
      <div className="learnTalk" data-journey-stage={introduction ? "intro" : firstCheck ? "first-check" : integratedJourney ? "explore" : undefined}>
        <div className="learnTeachingMascot" aria-hidden="true"><StudigoMascot state={shown ? "explain" : beat.kind === "read" ? "explain" : "welcome"} size={42} mark /></div>
        <div className="learnTalkBody">
          {integratedJourney && <p className="tinyLabel">{introduction ? "MEET YOUR QUEST · READ" : firstCheck ? "BEFORE EXPLORE · UNDERSTANDING CHECK" : "EXPLORE · GUIDED ACTIVITY"}</p>}
          {introduction && <p className="learnJourneyDialogue">Let's explore {currentTopic?.title ?? "this topic"}. First, read what your study guide says. Then we'll check what you noticed before going deeper.</p>}
          <h2 className="learnAsk">{introduction ? currentTopic?.title ?? "From your study guide" : beat.kind === "read" ? beat.title : beat.prompt}</h2>
          {beat.kind === "read" && (introduction ? <div className="learnSourceReading">
            <p className="tinyLabel">{snapshot?.source?.documentName ?? "SOURCE"}{snapshot?.source?.pageNumber ? ` · PAGE ${snapshot.source.pageNumber}` : ""}</p>
            <p className="learnLine">{reading}</p>
          </div> : <p className="learnLine">{beat.body}</p>)}
          <div className="learnLessonAudio" role="group" aria-label="Optional audio help">
            <ReadAloudControl key={mission?.phase} text={beat.kind === "read" ? reading : [beat.prompt, ...("options" in beat ? beat.options : [])].join(". ")} label={introduction ? "Hear the verified source passage" : "Hear this teaching step"} />
            {beat.kind !== "read" && <div className="learnOptionalVoice">
              <SpeechAnswerControl onUse={(text) => setSpokenDraft(text)} />
              <span className="learnVoiceExplanation">Speak an answer draft</span>
            </div>}
          </div>
          {spokenDraft && beat.kind !== "read" && <p className="learnSpokenDraft" role="status">Spoken draft: {spokenDraft} · Select an answer to check.</p>}

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
    ) : mission && !loading ? <div className="learnInvitation learnSourceInsufficient" role="status">
      <p className="tinyLabel">SOURCE NEEDS REVIEW</p>
      <h2>Not enough clear text for a trustworthy question.</h2>
      <p>This excerpt does not contain two distinct statements Studigo can safely compare. Your original material is still available; the lesson won't repeat the same passage as fake activities.</p>
      <button className="ghostButton" type="button" onClick={openSource}>Review the source passage</button>
      <button className="buttonPrimary" type="button" onClick={onOpenMaterials}>Choose another source</button>
    </div> : <p className="learnAsk">{loading ? "Opening this part." : "Choose a topic."}</p>}
    {shown && beat && beat.kind !== "read" && <div className="learnAnswerFeedback"
      role="status" aria-live="polite"
      data-outcome={helpUsed ? "assisted" : hit ? "correct" : "incorrect"}>
      <strong>{helpUsed ? "Here's some help" : hit ? "Correct! You got it." : "Not quite. Let's review."}</strong>
      <span>{helpUsed
        ? `The source supports: ${beatFix(beat)}. This was a guided answer, not independent mastery.`
        : hit
          ? `That's supported by your study guide${snapshot?.source?.pageNumber ? `, page ${snapshot.source.pageNumber}` : ""}. Ready for the next activity.`
          : `The correct answer is: ${beatFix(beat)}. You can review the source, then try the next activity.`}</span>
    </div>}
    {mission && <dialog className="learnSourceDialog" ref={sourceDialogRef}
      aria-label="Find the original source for this lesson"
      onClose={() => { setSourceOpen(false); sourceButtonRef.current?.focus(); }}>
      <div className="learnSourceHeading">
        <div><span className="tinyLabel">FROM YOUR ORIGINAL MATERIAL</span><h2>Find it in your guide</h2></div>
        <button type="button" className="learnSourceClose" aria-label="Close source" onClick={closeSource}>×</button>
      </div>
      {snapshot?.sourceCurrent === false ? <p role="status">The original source changed. Restart with current material.</p> : snapshot?.source ? <>
        <div className="learnSourceMeta">
          <strong>{snapshot.source.documentName}</strong>
          <span>{snapshot.source.pageNumber ? `Page ${snapshot.source.pageNumber}` : "Page not available"}</span>
        </div>
        <blockquote className="learnSourceQuote">{snapshot.source.excerpt}</blockquote>
        {sourceOpen && <ReadAloudControl text={snapshot.source.excerpt} label="Hear the verified source excerpt" />}

        <p className="learnSourceNote">Verified extracted text from this lesson's source. Exact word highlighting in the original PDF is not available.</p>
        {!fixture && <a className="buttonPrimary learnSourceOriginal" target="_blank" rel="noopener noreferrer"
          href={`/api/documents/download?documentId=${encodeURIComponent(mission.document_id)}&inline=1${snapshot.source.pageNumber ? `&page=${snapshot.source.pageNumber}` : ""}`}>Open original{snapshot.source.pageNumber ? ` · p. ${snapshot.source.pageNumber}` : ""}</a>}
        {fixture && <p className="hintText">This is a synthetic review source. Original-file links are only enabled for authorized uploaded material.</p>}
      </> : <p role="status">This source has no available extract. Return to Materials for help.</p>}
      <button className="ghostButton" type="button" onClick={closeSource}>Back to lesson</button>
    </dialog>}
    {((mission && (mission.paused || mission.phase === "done" || ready || snapshot?.sourceCurrent === false)) || (error && !mission)) && <div className="learnActionDock" role="group" aria-label="Lesson actions">
      {mission && !mission.paused && mission.phase !== "done" && <button className="ghostButton learnDockBack learnIconKey" type="button" disabled={busy || mission.phase === "brief"}
        onClick={() => void act("back")} aria-label="Previous lesson step" title="Previous step">
        <MissionControlIcon name="back" />
      </button>}
      {mission && !mission.paused && mission.phase !== "done" && <button className="ghostButton learnDockPause learnIconKey" type="button" disabled={busy}
        onClick={() => void act("pause")} aria-label="Pause lesson" title="Pause lesson">
        <MissionControlIcon name="pause" />
      </button>}
      {(!fixture || previewJournal) && <button type="button"
        className="ghostButton learnDockJournal learnIconKey"
        aria-label="Quest journal" title="Quest journal" onClick={() => setJournalOpen(true)}>
        <MissionControlIcon name="journal" />
      </button>}
      {ready && beat?.kind !== "read" && !shown && <button type="button" className="ghostButton learnDockHint learnIconKey"
        onClick={() => { setHelpUsed(true); setShown(true); }} aria-label="Give me a hint" title="Give me a hint">
        <span className="learnHelpGlyph" aria-hidden="true">?</span>
      </button>}
      {!mission?.paused && mission?.phase !== "done" && <button className={introduction ? "buttonPrimary learnGo learnGoIconOnly" : "buttonPrimary learnGo"} type="button"
        aria-label={introduction ? "Check what I understood" : undefined}
        title={introduction ? "Check what I understood" : undefined}
        disabled={busy || loading || !mission || (beat?.kind !== "read" && !shown ? picked.length === 0 : !canAdvanceLesson(mission.phase, mission.paused, picked.length > 0 || helpUsed, shown, beat?.kind === "read"))}
        onClick={() => {
          if (snapshot?.sourceCurrent === false) { void act("restart"); return; }
          if (error && !mission) { void act("start"); return; }
          if (!beat || beat.kind === "read" || shown) advanceLevel();
          else setShown(true);
        }}>{introduction ? <MissionControlIcon name="check" />
          : beat?.kind === "read" ? "Start question →"
          : shown ? firstCheck ? "Explore this lesson →" : mission?.phase === "check" ? "Finish lesson →" : "Next activity →"
          : "Check answer →"}</button>}
      {ready && <button type="button" className="ghostButton learnDockSource learnIconKey"
        ref={sourceButtonRef} onClick={openSource} aria-label="Find it in my guide" title="Find it in my guide">
        <MissionControlIcon name="guide" />
      </button>}
    </div>}
  </section>;
}
