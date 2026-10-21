"use client";

import { useEffect, useRef, useState } from "react";
import type { Topic } from "@/lib/rooms";
import { buildCramPlan, type StudyAction, type WeakArea } from "@/lib/study-planning";
import { StudigoMascot } from "@/components/studigo-mascot";
import { ReadAloudControl } from "./read-aloud-control";
import { RichText } from "./rich-text";
import { CitationChips, type Citation } from "./citations";
import "./phase3-rooms.css";

function CramNotes({ roomId, topic }: { roomId: string; topic: Topic }) {
  const [notes, setNotes] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setNotes(null);
    void fetch("/api/learn", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, topicId: topic.id }), signal: controller.signal
    }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok || typeof payload.explanation !== "string" || !payload.explanation.trim())
        throw new Error(payload.error || "Could not load source-backed notes for this topic.");
      setNotes(payload.explanation);
      setCitations(Array.isArray(payload.citations) ? payload.citations : []);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load notes.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [roomId, topic.id]);
  return <article className="cramNotes" aria-label={`Cram notes for ${topic.title}`}>
    <h3>{topic.title}</h3>
    {loading ? <p role="status">Loading notes from your materials.</p> : error ? <p className="formError" role="alert">{error}</p> : <>
      <RichText text={notes ?? ""} />
      <ReadAloudControl text={notes ?? ""} label={`Read ${topic.title} notes aloud`} />
      <CitationChips citations={citations} />
    </>}
  </article>;
}

export function CramPanel({ roomId, topics, areas, testDate }: { roomId: string; topics: Topic[]; areas: WeakArea[]; testDate: string | null; onChanged: () => void; phase3Ui?: boolean }) {
  const [minutes, setMinutes] = useState(30);
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [session, setSession] = useState<StudyAction[] | null>(null);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const deadline = useRef(0);
  const chosen = topics.filter((topic) => selectedIds === null || selectedIds.includes(topic.id));
  const preview = buildCramPlan(areas.filter((area) => chosen.some((topic) => topic.id === area.topic.id)), chosen, minutes, testDate);
  const step = session?.[index];

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      if (!left) setRunning(false);
    }, 500);
    return () => window.clearInterval(timer);
  }, [running]);
  function openStep(next: number, plan: StudyAction[]) {
    setIndex(next);
    setRemaining(plan[next].minutes * 60);
    deadline.current = Date.now() + plan[next].minutes * 60_000;
    setRunning(true);
  }
  function begin() { if (preview.length) { setSession(preview); setDone(false); openStep(0, preview); } }
  function advance() {
    if (!session) return;
    if (index + 1 >= session.length) { setDone(true); setRunning(false); return; }
    openStep(index + 1, session);
  }
  if (done) return <section className="modeEmpty"><StudigoMascot state="celebrate" size={80} /><span className="tinyLabel">FOCUSED SESSION COMPLETE</span><h2>Review complete.</h2><p>Reading these notes does not change mastery. Practice when you are ready to check recall.</p><button className="buttonPrimary" onClick={() => { setSession(null); setDone(false); }}>Choose another session </button></section>;
  if (session && step) return <section className="cramSession">
    <header className="cramTimerBar"><div><span className="tinyLabel">CRAM / {index + 1} OF {session.length}</span><h2>{step.title}</h2></div><div className="cramClock"><strong role="timer" aria-label="Time remaining">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</strong><button onClick={() => { if (!running) { deadline.current = Date.now() + Math.max(remaining, 60) * 1000; setRemaining((value) => Math.max(value, 60)); } setRunning((value) => !value); }}>{running ? "Pause" : remaining === 0 ? "Add one minute" : "Resume"}</button></div></header>
    <ol className="cramTrack">{session.map((item, position) => <li key={item.key} aria-current={position === index ? "step" : undefined}><span>{position + 1}</span>{item.title}<small>{item.minutes} min</small></li>)}</ol>
    {!remaining && <p className="formNotice" role="status">Time for the next topic.</p>}
    <div className="cramActivity" key={step.topicId}>{topics.find((topic) => topic.id === step.topicId) && <CramNotes roomId={roomId} topic={topics.find((topic) => topic.id === step.topicId)!} />}</div>
    <footer className="cramFooter"><button className="ghostButton" type="button" disabled={index === 0} onClick={() => session && openStep(index - 1, session)}> Previous step</button><button className="buttonPrimary" type="button" onClick={advance}>{index + 1 === session.length ? "Finish session" : "Next topic"} </button></footer>
  </section>;
  const allSelected = chosen.length === topics.length;
  return <section className="cramSetup"><div className="roomSectionIntro"><span className="tinyLabel">PLANNING ROOM / CRAM</span><h2>Only the topics you need.</h2><p>Read the key notes from your materials, one topic after another.</p></div>
    <p className="setupLead">Choose your topics and time.</p>
    <div className="cramTopicPicker" role="group" aria-label="Topics to cram">
      <label><input type="checkbox" checked={allSelected} onChange={(event) => setSelectedIds(event.target.checked ? null : [])} />Select all</label>
      <div>{topics.map((topic) => <label key={topic.id}><input type="checkbox" checked={selectedIds === null || selectedIds.includes(topic.id)} onChange={(event) => setSelectedIds((current) => { const ids = current ?? topics.map((item) => item.id); return event.target.checked ? [...ids, topic.id] : ids.filter((id) => id !== topic.id); })} />{topic.title}</label>)}</div>
    </div>
    <div className="timeChoices" role="group" aria-label="Available study time">{[15, 30, 60, 120].map((value) => <button key={value} aria-pressed={minutes === value} onClick={() => setMinutes(value)}>{value < 60 ? `${value} min` : `${value / 60} hour${value === 120 ? "s" : ""}`}</button>)}</div>
    <ol className="cramPreview">{preview.map((item) => <li key={item.key}><strong>{item.title}</strong><b>{item.minutes} min</b></li>)}</ol>
    {!topics.length ? <p>Add your study guide and build a topic map first.</p> : <button className="buttonPrimary" disabled={!preview.length} onClick={begin}>Start {minutes}-minute session </button>}
  </section>;
}
