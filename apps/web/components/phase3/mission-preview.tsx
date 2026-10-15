"use client";

import { useEffect, useRef, useState } from "react";
import { StudigoFigure } from "@/components/companion/figure";
import { ModeGlyph } from "@/components/mode-glyph";
import { ActionGlyph } from "./action-glyph";
import { ChoiceKeys, EvidenceTicket, ModeSwitch, ObjectiveRail, Phase3Key, SourceSpotlight } from "./ui";
import { phase3Fixture as fixture } from "./fixture";
import "./phase3.css";

type Step = "entry" | "brief" | "show" | "try" | "check" | "done";

/** Development-only visual/interaction fixture. No network call, persistence or grading. */
export function MissionPreview() {
  const [step, setStep] = useState<Step>("entry");
  const [mode, setMode] = useState<"learn" | "coach" | "practice">("learn");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const sourceTrigger = useRef<HTMLElement | null>(null);
  const voiceTrigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!sourceOpen && !voiceOpen) return;
    const dialog = document.querySelector<HTMLElement>(sourceOpen ? ".p3Source" : ".p3Voice");
    const focusables = () => [...(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, a[href]') ?? [])];
    focusables()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { setSourceOpen(false); setVoiceOpen(false); (sourceOpen ? sourceTrigger : voiceTrigger).current?.focus(); }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && index === items.length - 1) { event.preventDefault(); items[0]?.focus(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sourceOpen, voiceOpen]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const current = step === "brief" ? 0 : step === "show" ? 1 : step === "try" ? 2 : step === "check" || step === "done" ? 3 : 0;
  function readAloud() {
    if (!window.speechSynthesis) return;
    if (audioPlaying) { window.speechSynthesis.cancel(); setAudioPlaying(false); return; }
    const utterance = new SpeechSynthesisUtterance(fixture.explanation);
    utterance.onend = () => setAudioPlaying(false);
    utterance.onerror = () => setAudioPlaying(false);
    window.speechSynthesis.speak(utterance);
    setAudioPlaying(true);
  }
  function pause() { window.speechSynthesis?.cancel(); setAudioPlaying(false); setPaused(true); }
  function reset() { setStep("entry"); setPaused(false); setSelected(null); setHintOpen(false); setVoiceOpen(false); setTranscript(""); setMode("learn"); }
  function closeVoice() { setVoiceOpen(false); voiceTrigger.current?.focus(); }

  return <main className="p3Preview">
    <aside className="p3Sidebar" aria-label="Study Room navigation">
      <div className="p3Brand">
        <img src="/brand/studigo-wordmark.svg" alt="Studigo" className="p3Brand__logo" />
        <small>DESIGN FIXTURE</small>
      </div>
      <div className="p3Sidebar__room"><span className="p3Sidebar__roomIcon"><ModeGlyph name="learn" size={23}/></span><span><small>CURRENT ROOM</small><strong>{fixture.room}</strong></span></div>
      <nav className="p3Sidebar__nav" aria-label="Preview sections"><span className="p3Sidebar__navItem" data-active="true"><ModeGlyph name="learn" size={19}/> Guided Learn</span><span className="p3Sidebar__navItem"><ModeGlyph name="materials" size={19}/> Materials</span><span className="p3Sidebar__navItem"><ModeGlyph name="mastery" size={19}/> Progress</span></nav>
      <div className="p3Sidebar__foot"><span className="p3Sidebar__avatar">SL</span><span>Visual prototype<small>All lesson data is synthetic</small></span></div>
    </aside>

    <div className="p3Workspace">
      <header className="p3Topbar"><div className="p3Topbar__crumb">Study Rooms <span aria-hidden="true">/</span> {fixture.room}</div><div className="p3Topbar__status"><span className="p3Topbar__dot"/> Fixture material ready</div></header>
      <div className="p3Content">
        <div className="p3TitleRow"><div><span className="p3Eyebrow">YOUR LEARNING SPACE</span><h1>{step === "entry" || paused ? "Let’s learn together." : "How democracy works"}</h1><p>{step === "entry" || paused ? "A clear path from your materials to your own answer." : fixture.objective}</p></div><div className="p3TitleRow__figure" aria-hidden="true"><StudigoFigure pose="read" size={80}/></div></div>
        <ModeSwitch active={mode} onChange={setMode}/>
        {mode !== "learn" && <div className="p3ModeNotice" role="status"><strong>{mode === "coach" ? "Coach" : "Practice"} handoff preview</strong><p>This design fixture focuses on Guided Learn. The production handoff will use the existing {mode === "coach" ? "Coach" : "Practice"} assessment path.</p><Phase3Key variant="quiet" onClick={() => setMode("learn")}>Return to Learn</Phase3Key></div>}
        {mode === "learn" && <>
          {step === "entry" || paused ? <section className="p3Entry"><div className="p3Entry__copy"><span className="p3Eyebrow">{paused ? `PAUSED · ${current + 1} OF 4 STEPS` : "READY TO BEGIN · 1 OF 6 CONCEPTS"}</span><h2>{paused ? "Pick up where you left off." : "Your first objective is ready."}</h2><p>Find out how people have a voice in their government. We’ll show the idea, point to the material, then let you try it.</p><div className="p3Entry__actions"><Phase3Key onClick={() => { if (step === "entry") setStep("brief"); setPaused(false); }}>{paused ? "Resume learning" : "Start learning"} <span aria-hidden="true">→</span></Phase3Key><button className="p3TextAction" type="button" onClick={paused ? reset : () => setStep("brief")}>{paused ? "Start over" : "See the objective first"}</button></div></div><div className="p3Entry__tile"><span className="p3Entry__tileIcon"><ModeGlyph name="learn" size={36}/></span><span>01 / 06</span><strong>Government<br/>Vocabulary</strong><small>DESIGN FIXTURE</small></div></section> : <>
            <ObjectiveRail current={current}/>
            <div className="p3LearningGrid"><section className="p3Stage" aria-live="polite">
              {step === "brief" && <><span className="p3Eyebrow">01 · BRIEF</span><h2>One idea at a time.</h2><p className="p3Stage__lead">{fixture.objective}</p><p>Start with the main idea. Then we’ll look at the material and try a question together.</p><Phase3Key onClick={() => setStep("show")}>Show me <span aria-hidden="true">→</span></Phase3Key></>}
              {step === "show" && <><span className="p3Eyebrow">02 · SHOW</span><h2>People have a voice.</h2><p className="p3Stage__lead">{fixture.explanation}</p><p>The source passage names the action people use to choose representatives.</p><div className="p3Stage__support"><button className="p3Assist" type="button" onClick={readAloud} aria-pressed={audioPlaying}><ActionGlyph name="readAloud" size={19}/>{audioPlaying ? "Stop reading" : "Read to me"}</button><button className="p3Assist" type="button" onClick={() => setHintOpen(!hintOpen)} aria-expanded={hintOpen}><ActionGlyph name="hint" size={19}/> Key idea</button></div>{hintOpen && <p className="p3Hint">People choose representatives by voting. The source below uses those words.</p>}<Phase3Key onClick={() => setStep("try")}>I’m ready to try <span aria-hidden="true">→</span></Phase3Key></>}
              {step === "try" && <><span className="p3Eyebrow">03 · TRY · UNGRADED</span><h2>Now your turn.</h2><p className="p3Stage__lead">{fixture.question}</p><ChoiceKeys choices={fixture.choices} selected={selected} onSelect={setSelected}/><div className="p3Stage__support"><button className="p3Assist" type="button" onClick={() => setHintOpen(!hintOpen)} aria-expanded={hintOpen}><ActionGlyph name="hint" size={19}/> Give me a hint</button><button className="p3Assist" type="button" onClick={event => { voiceTrigger.current = event.currentTarget; setVoiceOpen(true); }}><ActionGlyph name="speak" size={19}/> Speak instead</button></div>{hintOpen && <p className="p3Hint">{fixture.hint}</p>}<Phase3Key disabled={selected === null && !transcript.trim()} onClick={() => setStep("check")}>Check my answer</Phase3Key></>}
              {step === "check" && <><span className="p3Eyebrow">04 · CHECK · FORMATIVE</span><div className="p3FeedbackIcon" aria-hidden="true">{selected === fixture.correctIndex || transcript ? "✓" : "↗"}</div><h2>{selected === fixture.correctIndex || transcript ? "That’s the idea." : "Let’s look again."}</h2><p className="p3Stage__lead">The passage says people choose representatives by voting in elections.</p><p>This check helps you learn. It does not change mastery.</p><div className="p3Stage__buttons"><Phase3Key onClick={() => setStep("done")}>Next <span aria-hidden="true">→</span></Phase3Key><Phase3Key variant="quiet" onClick={() => { setStep("try"); setSelected(null); }}>Try again</Phase3Key></div></>}
              {step === "done" && <><span className="p3Eyebrow">LESSON COMPLETE</span><div className="p3FeedbackIcon" aria-hidden="true">✓</div><h2>You practiced one concept.</h2><p className="p3Stage__lead">You found how people participate in a democracy and checked your answer against the passage.</p><p>When you’re ready, try it on your own in Coach or Practice.</p><div className="p3Stage__buttons"><Phase3Key onClick={() => setMode("coach")}>Try with Coach</Phase3Key><Phase3Key tone="ink" variant="quiet" onClick={() => setMode("practice")}>Practice independently</Phase3Key></div></>}
              <div className="p3Stage__bottom"><button type="button" onClick={() => { const prev: Record<Step, Step> = { entry:"entry", brief:"entry", show:"brief", try:"show", check:"try", done:"check" }; setStep(prev[step]); }}>← Back</button><button type="button" onClick={pause}>Pause & exit</button></div>
            </section><aside className="p3Evidence"><div className="p3Evidence__intro"><span className="p3Eyebrow">DESIGN FIXTURE EVIDENCE</span><h3>See it in your guide.</h3><p>Open the exact passage used for this example. This is a labeled design fixture.</p></div><EvidenceTicket eyebrow="DESIGN FIXTURE" title={fixture.source.title} page={fixture.source.page} onClick={() => { sourceTrigger.current = document.activeElement as HTMLElement; setSourceOpen(true); }}/><p className="p3Evidence__trust"><span aria-hidden="true">✓</span> Source shown only when the passage is available.</p></aside></div>
          </>}
        </>}
      </div>
    </div>
    {sourceOpen && <SourceSpotlight {...fixture.source} onClose={() => { setSourceOpen(false); sourceTrigger.current?.focus(); }}/>}
    {voiceOpen && <div className="p3VoiceBackdrop" onClick={closeVoice}><section className="p3Voice" role="dialog" aria-modal="true" aria-label="Review spoken answer" onClick={event => event.stopPropagation()}><div className="p3Voice__head"><span className="p3Eyebrow">VOICE RESPONSE · DESIGN PREVIEW</span><button className="p3IconButton" type="button" onClick={closeVoice} aria-label="Close voice review">×</button></div><h2>Review before you submit.</h2><p>Microphone capture is not connected in this visual fixture. Edit this example transcript to preview the review state.</p><label htmlFor="p3Transcript">Your answer</label><textarea id="p3Transcript" value={transcript} onChange={event => setTranscript(event.target.value)} placeholder="People vote to choose representatives." rows={3}/><div className="p3Voice__actions"><Phase3Key onClick={() => { closeVoice(); setSelected(null); }} disabled={!transcript.trim()}>Use this answer</Phase3Key><Phase3Key variant="quiet" onClick={closeVoice}>Choose by tap</Phase3Key></div></section></div>}
  </main>;
}
