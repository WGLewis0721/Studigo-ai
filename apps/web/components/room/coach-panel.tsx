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
  { id: "drill", name: "Deliberate practice", description: "Targeted reps that build automaticity", instruction: "Use deliberate practice when it fits: isolate one skill, give a carefully targeted sequence of up to 50 problems one at a time, vary difficulty gradually, give immediate specific feedback, and revisit errors. Do not assign busywork." },
  { id: "socratic", name: "Socratic coach", description: "Questions that make the learner reason", instruction: "Ask short guiding questions instead of giving the answer. Let the learner explain their reasoning, then correct the exact misconception." },
  { id: "progression", name: "Skill progression", description: "Small parts, connected phrases, performance", instruction: "Break the skill into small parts, demonstrate the complete performance, coach one part at a time, connect the parts, then test transfer in a new context. Correct, repeat, and increase challenge only after evidence of mastery." },
  { id: "visual", name: "Concrete to abstract", description: "Models, diagrams, then symbols", instruction: "Start with a concrete or visual model, connect it to the idea, and only then move to symbolic or abstract practice. Keep the teacher's terminology." }
];

const TRADITIONS: CoachingStyle[] = [
  { id: "tradition-default", name: "Teacher's method", description: "Stay faithful to the uploaded guide", instruction: "Prioritize the teacher's stated method, vocabulary, scope, and examples. Never replace the teacher's requirements with a different tradition." },
  { id: "tradition-japanese", name: "Japanese-inspired", description: "Mastery, careful modeling, steady improvement", instruction: "Use a Japanese-inspired lesson rhythm: make the goal explicit, study one worked method carefully, ask the learner to explain the reasoning, practice a small progression, and reflect on one improvement. Treat errors as information, not failure." },
  { id: "tradition-swedish", name: "Swedish-inspired", description: "Curiosity, independence, critical thinking", instruction: "Use a Swedish-inspired approach: invite the learner to question assumptions, compare strategies, explain evidence, and choose a next step. Preserve structure and accountability while giving the learner meaningful agency." },
  { id: "tradition-singapore", name: "Singapore Math-inspired", description: "Concrete, pictorial, abstract", instruction: "For math, move deliberately from concrete objects or a bar/model representation to a drawing and then symbols. Ask the learner to connect each representation before increasing complexity." },
  { id: "tradition-montessori", name: "Montessori-inspired", description: "Choice within a prepared sequence", instruction: "Offer a bounded choice of practice, let the learner attempt independently, use precise hands-off prompts, and reveal the correction only after self-checking. Keep the objective and teacher scope fixed." }
];

type PracticeProtocol = { id: string; name: string; instruction: string };

const PRACTICE_PROTOCOLS: PracticeProtocol[] = [
  { id: "adaptive", name: "Best next practice", instruction: "Choose the smallest next task that reveals understanding. Use retrieval, a worked example, or a transfer problem based on the learner's last response." },
  { id: "repetition", name: "Focused repetition", instruction: "Use straightforward repetition when automaticity is the goal. Keep the target narrow, generate varied but equivalent items, give immediate feedback, and stop or reteach when the same error repeats." },
  { id: "transfer", name: "Transfer practice", instruction: "After a learner can perform the modeled skill, vary the surface features and context so they must choose and apply the method, not just copy a pattern." }
] as const;

type Message = { id: string; role: "user" | "assistant"; content: string; citations?: Citation[]; grounded?: boolean; streaming?: boolean };

export function CoachPanel({ roomId, readyCount, topics, onOpenMaterials }: { roomId: string; readyCount: number; topics: Array<{ title: string; objective: string | null }>; onOpenMaterials: () => void }) {
  const [style, setStyle] = useState(STYLES[0]);
  const [tradition, setTradition] = useState(TRADITIONS[0]);
  const [practice, setPractice] = useState(PRACTICE_PROTOCOLS[0]);
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
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId, question: `[COACHING STYLE: ${style.name}] ${style.instruction}\n\n[LEARNING TRADITION: ${tradition.name}] ${tradition.instruction}\n\n[PRACTICE PROTOCOL: ${practice.name}] ${practice.instruction}\n\nLearner request: ${text}`, conversationId: conversationId.current }) });
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
      <section className="coachSettings" aria-label="Personalize coaching">
        <div>
          <span className="tinyLabel">HOW TO COACH</span>
          <div className="coachStyleGrid" aria-label="Choose a coaching style">
            {STYLES.map((option) => <button key={option.id} type="button" className={option.id === style.id ? "coachStyle active" : "coachStyle"} onClick={() => setStyle(option)}><strong>{option.name}</strong><span>{option.description}</span></button>)}
          </div>
        </div>
        <div className="coachChoiceRow">
          <label>Learning tradition
            <select value={tradition.id} onChange={(event) => setTradition(TRADITIONS.find((option) => option.id === event.target.value) ?? TRADITIONS[0])}>
              {TRADITIONS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <small>{tradition.description}</small>
          </label>
          <label>Practice recipe
            <select value={practice.id} onChange={(event) => setPractice(PRACTICE_PROTOCOLS.find((option) => option.id === event.target.value) ?? PRACTICE_PROTOCOLS[0])}>
              {PRACTICE_PROTOCOLS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <small>{practice.name === "Focused repetition" ? "Use repetition when it is the right tool—not as busywork." : practice.instruction}</small>
          </label>
        </div>
      </section>
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
        
