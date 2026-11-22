"use client";

import { useRef, useState } from "react";
import { StudigoCharacter } from "@/components/companion/StudigoCharacter";
import type { StudigoController } from "@/components/companion/studigo-controller";
import { STUDIGO_REACTIONS, type StudigoReaction, type StudigoState } from "@/lib/studigo-behaviors";

const states = ["idle", "listening", "thinking", "reading", "sleepy"] as const satisfies readonly StudigoState[];
const reactions = Object.keys(STUDIGO_REACTIONS) as StudigoReaction[];

export function StudigoShowroom() {
  const main = useRef<StudigoController>(null);
  const [state, setState] = useState<StudigoState>("idle");
  const [size, setSize] = useState(280);
  const [reduced, setReduced] = useState(false);
  const [second, setSecond] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [interaction, setInteraction] = useState("");
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
      <h1>Studigo character showroom</h1>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "end" }}>
        {mounted && <StudigoCharacter ref={main} state={state} size={size} interactive reducedMotion={reduced || "system"}
          staticOnly={fallback} label="Pet or tap Studigo" onInteraction={setInteraction} />}
        {second && <StudigoCharacter state="thinking" size={120} label="Second Studigo instance" />}
      </div>
      <p aria-live="polite">{interaction}</p>
      <fieldset>
        <legend>Base state</legend>
        {states.map((value) => <button type="button" key={value} onClick={() => setState(value)}>{value}</button>)}
      </fieldset>
      <fieldset>
        <legend>Reaction</legend>
        {reactions.map((value) => <button type="button" key={value} onClick={() => main.current?.react(value)}>{value}</button>)}
        <button type="button" onClick={() => { setState("idle"); main.current?.returnToIdle(); }}>Return to idle</button>
      </fieldset>
      <fieldset>
        <legend>Gaze</legend>
        <button type="button" onClick={() => main.current?.lookAt({ x: -1, y: 0 })}>Left</button>
        <button type="button" onClick={() => main.current?.lookAt({ x: 1, y: 0 })}>Right</button>
        <button type="button" onClick={() => main.current?.lookAt({ x: 0, y: -1 })}>Up</button>
        <button type="button" onClick={() => main.current?.lookAt({ x: 0, y: 1 })}>Down</button>
      </fieldset>
      <fieldset>
        <legend>Mounting and display</legend>
        <label>Size <input type="range" min="80" max="320" value={size} onChange={(event) => setSize(Number(event.target.value))} /></label>{" "}
        <label><input type="checkbox" checked={reduced} onChange={(event) => setReduced(event.target.checked)} /> Reduced motion</label>{" "}
        <label><input type="checkbox" checked={fallback} onChange={(event) => setFallback(event.target.checked)} /> Static fallback</label>{" "}
        <label><input type="checkbox" checked={second} onChange={(event) => setSecond(event.target.checked)} /> Second instance</label>{" "}
        <label><input type="checkbox" checked={mounted} onChange={(event) => setMounted(event.target.checked)} /> Mounted</label>
      </fieldset>
    </main>
  );
}
