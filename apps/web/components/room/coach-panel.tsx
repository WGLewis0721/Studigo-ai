"use client";

import { StudigoMascot } from "@/components/studigo-mascot";
import { COACH_CONTROL_COMMANDS, selectLearningRoute } from "@/lib/coach-route-selection";
import { useEffect, useRef, useState } from "react";
import { CitationChips, type Citation } from "./citations";
import { MATERIAL_NOTES } from "@/lib/fixture-materials";
import { coachMaterialLabel, coachMaterialState } from "@/lib/coach-material-state";
import { StudigoComposer } from "./studigo-composer";
import { CoachDevice } from "./coach-device";
import { LearnPanel } from "./learn-panel";
import { RichText } from "./rich-text";
import type { Topic } from "@/lib/rooms";
import { PageHead } from "./page-head";

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

type ChatMode = "coach" | "learn";
type Message = { id: string; role: "user" | "assistant"; content: string; mode?: ChatMode; citations?: Citation[]; grounded?: boolean; streaming?: boolean };

type CoachView = "chat" | "topics";
type ReplyMode = "coach" | "ask";
type SkillTopic = { title: string; objective: string | null };
const GENERAL_TOPIC: SkillTopic = { title: "This unit", objective: "Start with a quick diagnostic on the most important skill." };

function answerLabel(message: Message): string {
  const state = coachMaterialState({ content: message.content, grounded: message.grounded, streaming: message.streaming });
  if (message.mode === "learn") {
    if (state === "streaming") return "LEARN · READING YOUR MATERIALS…";
    return state === "grounded" ? "LEARN · FROM YOUR MATERIALS" : "LEARN · NOT IN YOUR MATERIALS";
  }
  if (state === "streaming") return "COACH · THINKING…";
  return state === "insufficient" ? "COACH · NEEDS MORE MATERIAL" : "COACH · PRACTICE";
}

export function CoachPanel({ roomId, readyCount, topics, onOpenMaterials, view, onViewChange, focusTopicId, onClearFocus, onTopicsChanged }: {
  roomId: string;
  readyCount: number;
  topics: Topic[];
  onOpenMaterials: () => void;
  view: CoachView;
  onViewChange: (view: CoachView) => void;
  focusTopicId: string | null;
  onClearFocus: () => void;
  onTopicsChanged: () => void;
}) {
  const [style, setStyle] = useState(STYLES[0]);
  const [tradition, setTradition] = useState(TRADITIONS[0]);
  const [practice, setPractice] = useState(PRACTICE_PROTOCOLS[0]);
  const [selectedTopic, setSelectedTopic] = useState<SkillTopic>(topics[0] ?? GENERAL_TOPIC);
  // Coach = practice and application with checking. Learn = facts from the materials, with sources.
  const [chatMode, setChatMode] = useState<ChatMode>("coach");
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const modalOpen = personalizeOpen || skillPickerOpen;
  const conversationId = useRef<string | null>(null);
  const askConversationId = useRef<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!messages.length) return;
    const frame = window.requestAnimationFrame(() => {
      threadEndRef.current?.scrollIntoView({ behavior: busy ? "auto" : "smooth", block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, busy]);

  useEffect(() => {
    if (!modalOpen) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const root = document.documentElement;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      rootOverflow: root.style.overflow
    };

    // iOS Safari will still rubber-band/scroll the page behind a fixed sheet
    // unless the document itself is frozen. Pinning the body preserves the
    // current viewport while the sheet remains the only scrollable surface.
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      root.style.overflow = previous.rootOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [modalOpen]);

  async function coach(input: string, modeOverride?: ReplyMode) {
    const replying: ReplyMode = modeOverride ?? (chatMode === "learn" ? "ask" : "coach");
    const messageMode: ChatMode = replying === "ask" ? "learn" : "coach";
    const text = input.trim();
    if (!text || busy) return;
    setPrompt(""); setError(null); setBusy(true);
    const assistantId = crypto.randomUUID();
    // One UUID per submitted turn. It becomes the persisted user message's ID
    // and the identity of any learning evidence, so a resend of this same
    // turn is recognized server-side instead of being recorded twice.
    const interactionId = crypto.randomUUID();
    // Snapshot the conversation so far — before the new user turn and the
    // streaming placeholder are added — so the engine can dedupe a new
    // batch of practice questions against everything already asked.
    const priorHistory = messages.filter((message) => !message.streaming).map((message) => ({ role: message.role, content: message.content }));
    setMessages((current) => [...current, { id: interactionId, role: "user", content: text, mode: messageMode }, { id: assistantId, role: "assistant", content: "", mode: messageMode, streaming: true }]);
    try {
      // The learner's question stays clean for retrieval; pedagogy choices
      // travel as separate directives so they only ever shape how the coach
      // answers, never what gets searched for.
      const directives = [
        { name: "Coaching style", instruction: style.instruction },
        { name: "Learning tradition", instruction: tradition.instruction },
        { name: "Practice protocol", instruction: practice.instruction }
      ];
      // Fixture and production hit the same request/response contract; only
      // the endpoint (and how it sources chunks) differs. One brain, one
      // client code path.
      const isFixture = roomId === "fixture";
      const endpoint = isFixture ? "/api/dev/coach" : "/api/chat";
      const body = isFixture
        ? JSON.stringify({ question: text, topics, history: priorHistory, directives })
        : replying === "coach"
          ? JSON.stringify({ roomId, question: text, directives, mode: "coach", route: selectLearningRoute(style.id, tradition.id), interactionId, conversationId: conversationId.current })
          : JSON.stringify({ roomId, question: text, conversationId: askConversationId.current });
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (!response.ok || !response.body) throw new Error((await response.json().catch(() => ({}))).error || "Studigo could not coach that attempt.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true }); const frames = buffer.split("\n\n"); buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.trim(); if (!line.startsWith("data:")) continue;
          const event = JSON.parse(line.slice(5).trim()) as { type: string; text?: string; citations?: Citation[]; grounded?: boolean; conversationId?: string; error?: string };
          if (event.type === "start") { if (replying === "coach") conversationId.current = event.conversationId ?? null; else askConversationId.current = event.conversationId ?? null; }
          if (event.type === "delta" && event.text) setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: message.content + event.text } : message));
          if (event.type === "done") setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: event.text ?? message.content, citations: event.citations, grounded: event.grounded, streaming: false } : message));
          if (event.type === "error") throw new Error(event.error || "Studigo could not finish that coaching session.");
        }
      }
    } catch (coachError) { setError(coachError instanceof Error ? coachError.message : "Something went wrong."); setMessages((current) => current.filter((message) => message.id !== assistantId)); }
    finally { setBusy(false); }
  }

  function coachTopic(topic: Topic) {
    setSelectedTopic(topic);
    setChatMode("coach");
    onViewChange("chat");
    void coach(`Coach me through: ${topic.title}. ${topic.objective ?? "Start with a quick diagnostic."}`, "coach");
  }

  if (readyCount === 0) return <div className="modeEmpty"><PageHead title="Coach" sub="Nothing to coach from yet." /><p>Upload a study guide, worksheet, notes, or slides first. The coach only teaches from this room&apos;s materials.</p><button className="buttonPrimary" type="button" onClick={onOpenMaterials}>Add materials <span aria-hidden="true">→</span></button></div>;

  return (
    <CoachDevice roomId={roomId}>
    <div className={messages.length > 0 ? "coachMode activeSession" : "coachMode"}>
      <PageHead title="Coach" sub="Guided practice on your teacher's material." state={busy ? "thinking" : "welcome"} />
      <div className="coachTabs" role="group" aria-label="Coach sections">
        <button type="button" aria-pressed={view === "chat"} onClick={() => onViewChange("chat")}>Chat</button>
        <button type="button" aria-pressed={view === "topics"} onClick={() => onViewChange("topics")}>Topics{topics.length > 0 && <span className="coachTabCount">{topics.length}</span>}</button>
      </div>
      {view === "topics" ? (
        <div className="coachTopicsView">
          {focusTopicId && <button type="button" className="ghostButton coachShowAll" onClick={onClearFocus}>Showing one topic · Show all</button>}
          <LearnPanel embedded roomId={roomId} topics={focusTopicId ? topics.filter((topic) => topic.id === focusTopicId) : topics} hasMaterials onChanged={onTopicsChanged} onCoachTopic={coachTopic} />
        </div>
      ) : (
      <>
      {personalizeOpen && <button className="coachSetupBackdrop" type="button" aria-label="Close Coach personalization" onClick={() => setPersonalizeOpen(false)} />}
      <section
        id="coach-personalization"
        className={personalizeOpen ? "coachSettings mobileOpen" : "coachSettings"}
        aria-label="Personalize coaching"
        role={personalizeOpen ? "dialog" : undefined}
        aria-modal={personalizeOpen ? true : undefined}
      >
        <div className="coachSettingsSheetHead">
          <div><span className="tinyLabel">COACH SETUP</span><strong>Personalize this session</strong></div>
          <button type="button" onClick={() => setPersonalizeOpen(false)}>Done</button>
        </div>
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
      {skillPickerOpen && <button className="coachSetupBackdrop" type="button" aria-label="Close skill picker" onClick={() => setSkillPickerOpen(false)} />}
      {skillPickerOpen && (
        <section className="coachSkillSheet" role="dialog" aria-modal="true" aria-labelledby="coach-skill-sheet-title">
          <div className="coachSettingsSheetHead">
            <div><span className="tinyLabel">TODAY&apos;S SKILLS</span><strong id="coach-skill-sheet-title">Choose what to practice</strong></div>
            <button type="button" onClick={() => setSkillPickerOpen(false)}>Done</button>
          </div>
          <div className="coachSkillList">
            {topics.map((topic, index) => (
              <button
                key={topic.title}
                type="button"
                className={selectedTopic.title === topic.title ? "active" : ""}
                onClick={() => { setSelectedTopic(topic); setSkillPickerOpen(false); }}
              >
                <span className="coachSkillIndex">{index + 1}</span>
                <span><strong>{topic.title}</strong>{topic.objective && topic.objective !== topic.title && <small>{topic.objective}</small>}</span>
                {selectedTopic.title === topic.title && <span className="coachSkillCheck" aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        </section>
      )}
      {(() => { const material = MATERIAL_NOTES[selectedTopic.title]; return material ? <section className="coachMaterial" aria-label={`Study material for ${selectedTopic.title}`}><div><span className="tinyLabel">FROM YOUR STUDY GUIDE</span><h3>{selectedTopic.title}</h3><p>{material.summary}</p></div><div className="coachMaterialExample"><span>EXAMPLE</span><p>{material.example}</p><small>{material.source}</small></div></section> : null; })()}
      <section className="coachChat" data-chat-mode={chatMode} aria-label="Conversation with Studigo">
        <header className="chatHead">
          <StudigoMascot state={busy ? "thinking" : "welcome"} size={38} mark />
          <div className="chatModes" role="group" aria-label="How Studigo helps">
            <button type="button" data-tone="coach" aria-pressed={chatMode === "coach"} onClick={() => setChatMode("coach")}>
              <strong>Coach</strong><small>Practice and apply</small>
            </button>
            <button type="button" data-tone="ask" aria-pressed={chatMode === "learn"} onClick={() => setChatMode("learn")}>
              <strong>Learn</strong><small>Facts, with sources</small>
            </button>
          </div>
          {chatMode === "coach" && (
            <div className="chatFocus" aria-label="Coaching focus">
              <button type="button" className="chatSkill" disabled={busy} title="Start coaching on this skill" onClick={() => void coach(`Coach me through: ${selectedTopic.title}. ${selectedTopic.objective ?? "Start with a quick diagnostic."}`)}>
                <span aria-hidden="true">▶</span><span className="chatSkillName">{selectedTopic.title}</span>
              </button>
              {topics.length > 1 && <button type="button" className="chatChip" onClick={() => { setPersonalizeOpen(false); setSkillPickerOpen(true); }}>Change</button>}
              <button type="button" className="chatChip" aria-expanded={personalizeOpen} aria-controls="coach-personalization" onClick={() => { setSkillPickerOpen(false); setPersonalizeOpen((open) => !open); }} title={`Coaching style: ${style.name}`}>Style</button>
            </div>
          )}
        </header>
        <div className="chatThread" role="log" aria-live="polite" aria-label="Messages">
        {messages.length === 0 ? (
          chatMode === "coach" ? (
            <div className="coachEmpty">
              <strong>Practice it.</strong>
              <p>Coach gives you problems, checks your work and tracks what you have mastered. Use it to rehearse steps and apply ideas. Not sure what a term means? Switch to Learn first.</p>
              <div className="starterList">
                <button type="button" onClick={() => void coach("Give me a quick diagnostic for the most important skill in this unit.")}>Start with a diagnostic</button>
                <button type="button" onClick={() => void coach("Show me one worked example, then give me a similar problem to try.")}>Show me an example</button>
              </div>
            </div>
          ) : (
            <div className="coachEmpty">
              <strong>Understand it.</strong>
              <p>Learn answers from your materials and shows the page it came from. Use it when an idea or term does not make sense yet. Then switch to Coach to practice it.</p>
              <div className="starterList">
                <button type="button" onClick={() => void coach("What does the study guide say I need to know?")}>What does my guide cover?</button>
                <button type="button" onClick={() => void coach("What am I most likely to be tested on?")}>What will be on the test?</button>
                <button type="button" onClick={() => void coach("Explain the hardest idea in this unit simply.")}>Explain the hardest idea</button>
              </div>
            </div>
          )
        ) : messages.map((message) => message.role === "user" ? <div className="studentBubble" key={message.id}>{message.content}</div> : <div className="answerBubble" key={message.id} data-mode={message.mode ?? "coach"} data-state={coachMaterialState({ content: message.content, grounded: message.grounded, streaming: message.streaming })}><span className="answerKicker"><StudigoMascot state={message.streaming ? "thinking" : "sources"} size={28} mark />{answerLabel(message)}</span><div className="answerText"><RichText text={message.content} />{message.streaming && <span className="caret" aria-hidden="true" />}</div>{message.citations && <CitationChips citations={message.citations} />}</div>)}
        <div ref={threadEndRef} className="threadEnd" aria-hidden="true" />
        </div>
        {chatMode === "coach" && messages.length > 0 && <div className="chatChips" aria-label="Coach controls">{COACH_CONTROL_COMMANDS.map((command) => <button key={command.label} type="button" disabled={busy} onClick={() => void coach(command.text)}>{command.label}</button>)}</div>}
        {error && <p className="formError chatError" role="alert">{error}</p>}
        <StudigoComposer
          variant="chat"
          accent={chatMode === "learn" ? "learn" : undefined}
          placeholder={chatMode === "learn" ? "Ask about your materials" : "Answer, or message your coach"}
          value={prompt}
          onChange={setPrompt}
          onSubmit={() => void coach(prompt)}
          disabled={busy}
          ariaLabel="Message Studigo"
        />
      </section>
      </>
      )}
    </div>
    </CoachDevice>
  );
}

export { STYLES };
export type { CoachingStyle };
        
