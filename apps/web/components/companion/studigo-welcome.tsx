"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ReadAloudControl } from "@/components/room/read-aloud-control";
import { StudigoComposer } from "@/components/room/studigo-composer";
import { studigoVoicePreview } from "@/lib/studigo-preview";
import type { StudigoController } from "./studigo-controller";

type Turn = { role: "learner" | "studigo"; text: string };
const GREETING = "Hi, I’m Studigo! Want to say hello, or see what we can learn together?";
const REPLY_ERROR = "Studigo couldn’t reply. Try again or start with homework.";
const PREVIEW_REPLIES = [
  "Hi! Want to try a quick question together? You can pick the sample or bring something from class.",
  "I’m up for it! Start with a sample or bring a file when you’re ready."
];

export function StudigoWelcome({ controller, fixture }: { controller: RefObject<StudigoController | null>; fixture: boolean }) {
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController>(null);
  const latest = turns.at(-1)?.text ?? GREETING;

  useEffect(() => () => {
    request.current?.abort();
    controller.current?.returnToIdle();
  }, [controller]);

  async function send() {
    const message = draft.trim().slice(0, 420);
    if (!message || request.current || turns.length >= 8) return;
    const next: Turn[] = [...turns, { role: "learner", text: message }];
    const call = new AbortController();
    request.current = call;
    setPending(true);
    setError("");
    controller.current?.setState("thinking");
    try {
      let reply = PREVIEW_REPLIES[Math.min(turns.length / 2, PREVIEW_REPLIES.length - 1)];
      if (!fixture) {
        const result = await fetch("/api/companion/welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-studigo-operation-id": crypto.randomUUID() },
          body: JSON.stringify({ turns: next }),
          signal: call.signal
        });
        const value = await result.json().catch(() => null);
        if (!result.ok || typeof value?.reply !== "string") throw new Error(REPLY_ERROR);
        reply = value.reply;
      }
      if (!call.signal.aborted) {
        setTurns([...next, { role: "studigo", text: reply }]);
        setDraft("");
        controller.current?.react("happy");
      }
    } catch {
      if (!call.signal.aborted) setError(REPLY_ERROR);
    } finally {
      if (request.current === call) request.current = null;
      if (!call.signal.aborted) {
        setPending(false);
        controller.current?.setState("idle");
      }
    }
  }

  return <div className="studigoWelcome">
    {fixture && <p className="studigoWelcomeNote">Local preview · scripted replies</p>}
    <div className="studigoWelcomeBubble" role="status" aria-atomic="true">
      <p>{latest}</p>
    </div>
    <ReadAloudControl text={latest} label="Hear Studigo" />
    {turns.length < 8
      ? <StudigoComposer className="studigoWelcomeComposer" value={draft} onChange={setDraft} onSubmit={() => void send()}
          ariaLabel="Say hello to Studigo" placeholder="Say hello…" variant="chat" disabled={pending} maxLength={420}
          enableSpeech={studigoVoicePreview} onListening={(active) => controller.current?.setState(active ? "listening" : "idle")} />
      : <p className="studigoWelcomeNote">Ready when you are. Pick a way to start below.</p>}
    {pending && <p className="studigoWelcomeNote" role="status">Studigo is thinking…</p>}
    {error && <p className="formError" role="alert">{error}</p>}
  </div>;
}
