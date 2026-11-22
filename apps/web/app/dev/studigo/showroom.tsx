"use client";

import { useRef, useState } from "react";
import { StudigoCharacter } from "@/components/companion/StudigoCharacter";
import type { StudigoController } from "@/components/companion/studigo-controller";
import { STUDIGO_EMOTES, STUDIGO_REACTIONS, type StudigoEmote, type StudigoReaction, type StudigoState } from "@/lib/studigo-behaviors";
import { OUTFITS, OUTFIT_LABELS, parseOutfit, type Outfit } from "@/lib/companion-logic";
import { FLAME_BOOST, type FlameStage } from "@/lib/companion-growth";

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
  const [emote, setEmote] = useState<StudigoEmote | "">("");
  const [interaction, setInteraction] = useState("");
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [flame, setFlame] = useState<FlameStage>("warm");
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
      <h1>Studigo character showroom</h1>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "end" }}>
        {mounted && <StudigoCharacter ref={main} state={state} size={size} interactive reducedMotion={reduced || "system"}
          staticOnly={fallback} label="Pet or tap Studigo" onInteraction={setInteraction}
          outfit={outfit} flameBoost={FLAME_BOOST[flame]} />}
        {second && <StudigoCharacter state="thinking" size={120} label="Second Studigo instance" />}
      </div>
      <p aria-live="polite">{interaction}</p>
      <p>Tap or stroke his head, poke his belly, hold, drag, or tap three times to surprise him.</p>
      <fieldset>
        <legend>Base state</legend>
        {states.map((value) => <button type="button" key={value} onClick={() => setState(value)}>{value}</button>)}
      </fieldset>
      <fieldset>
        <legend>Cosmetics</legend>
        <label>Outfit <select value={outfit ?? ""} onChange={(event) => setOutfit(parseOutfit(event.target.value))}>
          <option value="">None</option>
          {OUTFITS.map((choice) => <option key={choice} value={choice}>{OUTFIT_LABELS[choice]}</option>)}
        </select></label>{" "}
        <label>Flame <select value={flame} onChange={(event) => setFlame(event.target.value as FlameStage)}>
          <option value="warm">Warm</option>
          <option value="bright">Bright</option>
          <option value="blazing">Blazing</option>
        </select></label>
      </fieldset>
      <fieldset>
        <legend>Reaction</legend>
        {reactions.map((value) => <button type="button" key={value} onClick={() => main.current?.react(value)}>{value}</button>)}
        <button type="button" onClick={() => { setState("idle"); main.current?.returnToIdle(); }}>Return to idle</button>
      </fieldset>
      <fieldset>
        <legend>Emotes</legend>
        <label>Overlay <select value={emote} onChange={(event) => {
          const next = event.target.value as StudigoEmote | "";
          setEmote(next);
          main.current?.setEmote(next || null);
        }}>
          <option value="">Automatic</option>
          {STUDIGO_EMOTES.map((choice) => <option key={choice}>{choice}</option>)}
        </select></label>
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
      <fieldset>
        <legend>Motion review</legend>
        <button type="button" onClick={() => { setState("idle"); main.current?.returnToIdle(); main.current?.react("excited"); }}>Anticipation, jump and landing</button>
        <button type="button" onClick={() => main.current?.lookAt({ x: 0.8, y: -0.4 })}>Eyes, head and frill follow-through</button>
        <button type="button" onClick={() => { setState("idle"); main.current?.returnToIdle(); main.current?.react("surprised"); }}>Recoil and settling</button>
        <button type="button" onClick={() => {
          main.current?.returnToIdle();
          main.current?.react("petting");
          main.current?.react("excited");
          main.current?.react("curious");
        }}>Interrupt petting with excitement</button>
      </fieldset>
    </main>
  );
}
