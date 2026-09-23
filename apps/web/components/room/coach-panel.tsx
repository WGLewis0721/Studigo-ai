"use client";

import { StudigoMascot } from "@/components/studigo-mascot";
import { useRef, useState } from "react";
import { CitationChips, type Citation } from "./citations";

type CoachingStyle = {
  id: string;
  name: string;
  description: string;
  instruction: string;
};

const STYLES: CoachingStyle[] = [
  { id: "default", name: "Studigo default", description: "Clear explanation, example, guided practice", instruction: "Use a balanced coach loop: explain briefly, demonstrate one example, ask the learner to try, diagnose the mistake, then assign the next best practice." },
  { id: "direct", name: "Direct instruction", description: "Worked examples, correction, repetition", instruction: "Teach directly. Show worked examples, give one precise correction at a time, and use deliberate repetition until the learner is accurate." },
  { id: "drill", name: "50-problem drill", description: "Focused reps that build automaticity", instruction: "Use a focused drill. Give one problem at a time, keep the skill narrow, vary difficulty gradually, and stop to reteach a repeated error." },
  { id: "socratic", name: "Socratic coach", description: "Questions that make the learner reason", instruction: "Ask short guiding questions instead of giving the answer. Let the learner explain their reasoning, then correct the exact misconception." },
  { id: "progression", name: "Skill progression", description: "Small parts, connected phrases, performance", instruction: "Break the skill into small parts, master each part, connect them, then test the whole performance in a new context." },
  { id: "visual", name: "Concrete to abstract", description: "Models, diagrams, then symbols", instruction: "Start with a concrete or visual model, connect it to the idea, and only then move to symbolic or abstract practice. Keep the teacher's terminology." }
];

type Message = { id: string; role: "user" | "assistant"; content: string; citations?: Citation[]; grounded?: boolean; streaming?: boolean };

export function CoachPanel({ roomId, readyCount, topics, onOpenMaterials }: { roomId: string; readyCount: number; topics: Array<{ title: string; objective: string | null }>; onOpenMaterials: () => void }) {
  const [style, setStyle] = useState(STYLES[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationId = useRef<string | null>(null);

  async function coach(input: string) {
    const text = input.trim();
    if (!text || busy) return;
    setPrompt(""); setError(null); setBusy(true);
    const assistantId = crypto.randomUUID();
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: text }, { id: assistantId, role: "assistant", content: "", streaming: true }]);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId, question: `[COACHING STYLE: ${style.name}] ${style.instruction}\n\nLearner request: ${text}`, conversationId: conversationId.current }) });
      if (!response.ok || !response.body) throw new Error((await response.json().catch(() => ({}))).error || "Studigo could not coach that attempt.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true }); const frames = buffer.split("\n\n"); buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.trim(); if (!line.startsWith("data:")) continue;
          const event = JSON.parse(line.slice(5).trim()) as { type: string; text?: string; citations?: Citation[]; grounded?: boolean; conversationId?: string; error?: string };
          if (event.type === "start") conversationId.current = event.conversationId ?? null;
          if (event.type === "delta" && event.text) setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: message.content + event.text } : message));
          if (event.type === "done") setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: event.text ?? message.content, citations: event.citations, grounded: event.grounded, streaming: false } : message));
          if (event.type === "error") throw new Error(event.error || "Studigo could not finish that coaching session.");
        }
      }
    } catch (coachError) { setError(coachError instanceof Error ? coachError.message : "Something went wrong."); setMessages((current) => current.filter((message) => message.id !== assistantId)); }
    finally { setBusy(false); }
  }

  if (readyCount === 0) return <div className="modeEmpty"><StudigoMascot state="welcome" size={72} /><h2>Give Studigo something to coach.</h2><p>Upload a study guide, worksheet, notes, or slides first. The coach only teaches from this room&apos;s materials.</p><button className="buttonPrimary" type="button" onClick={onOpenMaterials}>Add materials <span aria-hidden="true">→</span></button></div>;

  return (
    <div className="coachMode">
      <div className="coachHeader">
        <div><span className="tinyLabel">THE COACHING FLOOR</span><h2>Practice the skill, not just the facts.</h2><p>Studigo keeps the teacher&apos;s content fixed and changes how it helps you practice.</p></div>
        <StudigoMascot state={busy ? "thinking" : "welcome"} size={76} />
      </div>
      <div className="coachStyleGrid" aria-label="Choose a coaching style">
        {STYLES.map((option) => <button key={option.id} type="button" className={option.id === style.id ? "coachStyle active" : "coachStyle"} onClick={() => setStyle(option)}><strong>{option.name}</strong><span>{option.description}</span></button>)}
      </div>
      <div className="coachTopics"><span className="tinyLabel">TODAY&apos;S SKILLS</span>{topics.slice(0, 5).map((topic) => <button key={topic.title} type="button" onClick={() => void coach(`Coach me through: ${topic.title}. ${topic.objective ?? "Start with a quick diagnostic."}`)}>{topic.title}<span aria-hidden="true">→</span></button>)}</div>
      <div className="coachThread">
        {messages.length === 0 ? (
          <div className="coachEmpty"><strong>Ready when you are.</strong><p>Pick a skill above or ask for a diagnostic. Studigo will explain, demonstrate, watch your attempt, and choose what comes next.</p><div className="starterList"><button type="button" onClick={() => void coach("Give me a quick diagnostic for the most important skill in this unit.")}>Start with a diagnostic</button><button type="button" onClick={() => void coach("Show me one worked example, then give me a similar problem to try.")}>Show me an example</button></div></div>
        ) : messages.map((message) => message.role === "user" ? <div className="studentBubble" key={message.id}>{message.content}</div> : <div className="answerBubble" key={message.id}><span className="answerKicker"><StudigoMascot state={message.streaming ? "thinking" : "sources"} size={28} mark />{message.streaming ? "COACHING…" : message.grounded ? "GROUNDED IN YOUR MATERIALS" : "NEEDS MORE MATERIAL"}</span><p className="answerText">{message.content}{message.streaming && <span className="caret" aria-hidden="true" />}</p>{message.citations && <CitationChips citations={message.citations} />}</div>)}
      </div>
      {error && <p className="formError" role="alert">{error}</p>}
      <form className="askComposer askComposerLive" onSubmit={(event) => { event.preventDefault(); void coach(prompt); }}><input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={`Ask the ${style.name.toLowerCase()}…`} aria-label="Ask Studigo to coach you" disabled={busy} /><button type="submit" aria-label="Start coaching" disabled={busy || !prompt.trim()}>↑</button></form>
    </div>
  );
}

export { STYLES };
export type { CoachingStyle };
        
