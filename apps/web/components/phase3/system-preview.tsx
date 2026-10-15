"use client";

import { useEffect, useRef, useState } from "react";
import { ActionGlyph } from "./action-glyph";
import { ChoiceKeys, EvidenceTicket, ModeSwitch, ObjectiveRail, Phase3Key, SourceSpotlight } from "./ui";
import { phase3Fixture } from "./fixture";
import "./phase3.css";

const colors = [
  ["Blueberry", "#3C7CFF", "Primary action"], ["Tangerine", "#FF8A3D", "Coach"],
  ["Grape", "#7A5AF0", "Secondary"], ["Teal", "#1FC3B6", "Learn / sources"],
  ["Kiwi", "#93D93F", "Success"], ["Berry", "#F0457A", "Highlight"],
  ["Dandelion", "#FFD23F", "Attention"], ["Indigo", "#4A55C8", "Focus"],
  ["Snow", "#F7F8FB", "Ground"], ["Ink", "#141B2D", "Reading"]
] as const;
const icons = ["mission", "coach", "practice", "materials", "find", "readAloud", "hint", "speak", "tap", "type", "source", "original", "check", "progress", "resume", "return"] as const;

/** State and material board for the original Phase 3 primitives. Synthetic content only. */
export function SystemPreview() {
  const [mode, setMode] = useState<"learn" | "coach" | "practice">("learn");
  const [choice, setChoice] = useState<number | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const sourceTrigger = useRef<HTMLElement | null>(null);
  function closeSource() { setSourceOpen(false); sourceTrigger.current?.focus(); }
  useEffect(() => {
    if (!sourceOpen) return;
    const dialog = document.querySelector<HTMLElement>(".p3Source");
    const focusables = () => [...(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') ?? [])];
    focusables()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { closeSource(); return; }
      if (event.key !== "Tab") return;
      const items = focusables();
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && index === items.length - 1) { event.preventDefault(); items[0]?.focus(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sourceOpen]);
  return <main className="p3Preview p3System">
    <div className="p3System__inner">
      <header className="p3System__hero"><span className="p3Eyebrow">STUDIGO V2 · PHASE 3 · PROPOSED COMPONENTS</span><h1>A clear path, one touch at a time.</h1><p>Original UI source using the approved brand palette and type. The study passage below is a synthetic design fixture.</p><a href="/dev/phase3">Open connected lesson preview →</a></header>
      <section className="p3System__section" aria-labelledby="palette"><h2 id="palette">Color roles</h2><div className="p3System__colors">{colors.map(([name, hex, role]) => <div className="p3System__swatch" key={name}><span style={{ backgroundColor:hex }}/><strong>{name}</strong><code>{hex}</code><small>{role}</small></div>)}</div></section>
      <section className="p3System__section" aria-labelledby="type"><h2 id="type">Type and hierarchy</h2><div className="p3System__type"><div><small>BRICOLAGE GROTESQUE · DISPLAY</small><strong>Your materials.<br/>Your next step.</strong></div><div><small>FIGTREE · INTERFACE AND READING</small><p>A short explanation stays close to the original passage. Each action says what happens next.</p><code>JETBRAINS MONO · 02 / 06 · PAGE 2</code></div></div></section>
      <section className="p3System__section" aria-labelledby="controls"><h2 id="controls">Tactile controls and states</h2><p className="p3System__note">Hover, press, and keyboard focus are live. Disabled remains labeled and visible.</p><div className="p3System__keys"><Phase3Key tone="teal" icon={<ActionGlyph name="find" size={19}/>}>Find it</Phase3Key><Phase3Key tone="blueberry" icon={<ActionGlyph name="readAloud" size={19}/>}>Read to me</Phase3Key><Phase3Key tone="dandelion" icon={<ActionGlyph name="hint" size={19}/>}>Give me a hint</Phase3Key><Phase3Key tone="tangerine" icon={<ActionGlyph name="speak" size={19}/>}>Speak instead</Phase3Key><Phase3Key variant="quiet">Secondary action</Phase3Key><Phase3Key disabled>Waiting for answer</Phase3Key></div></section>
      <section className="p3System__section" aria-labelledby="progress"><h2 id="progress">Mode and progress</h2><ModeSwitch active={mode} onChange={setMode}/><ObjectiveRail current={1}/></section>
      <section className="p3System__section" aria-labelledby="evidence"><h2 id="evidence">Source, choice, response</h2><div className="p3System__two"><div><EvidenceTicket eyebrow="DESIGN FIXTURE" title={phase3Fixture.source.title} page={phase3Fixture.source.page} onClick={() => { sourceTrigger.current = document.activeElement as HTMLElement; setSourceOpen(true); }}/><p className="p3System__note">A citation opens a readable source pane; the lesson never invents a passage when material is absent.</p></div><ChoiceKeys choices={phase3Fixture.choices} selected={choice} onSelect={setChoice}/></div></section>
      <section className="p3System__section" aria-labelledby="glyphs"><h2 id="glyphs">Original action glyphs</h2><div className="p3System__icons">{icons.map(name => <div key={name}><ActionGlyph name={name} size={26}/><span>{name}</span></div>)}</div><p className="p3System__note">The existing mode glyphs stay in their current owner. These proposed glyphs use currentColor and are paired with words in controls.</p></section>
      <footer className="p3System__footer">Proposed visual system · No real learner material, grading, microphone capture, or mastery write.</footer>
    </div>
    {sourceOpen && <SourceSpotlight {...phase3Fixture.source} onClose={closeSource}/>}
  </main>;
}
