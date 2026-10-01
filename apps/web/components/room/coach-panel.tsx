"use client";

import { STYLES, TRADITIONS, PRACTICE_PROTOCOLS, compileCoachPreferences, sameCoachPreferences } from "@/lib/coach-preferences";
import type { useCoachPreferences } from "./use-coach-preferences";
import { StudigoMascot } from "@/components/studigo-mascot";
import { COACH_CONTROL_COMMANDS, LEARN_GUIDE_TEXT, learnStarters } from "@/lib/coach-route-selection";
import { useEffect, useRef, useState } from "react";
import { CitationChips, type Citation } from "./citations";
import { MATERIAL_NOTES } from "@/lib/fixture-materials";
import { coachMaterialLabel, coachMaterialState } from "@/lib/coach-material-state";
import { StudigoComposer } from "./studigo-composer";
import { ModeFrame } from "./mode-header";
import { LearnPanel } from "./learn-panel";
import { RichText } from "./rich-text";
import type { Topic } from "@/lib/rooms";
import { useFitViewport } from "./use-fit-viewport";
import { CoachAside } from "./coach-aside";
import type { WeakArea } from "@/lib/study-planning";

type ChatMode = "coach" | "learn";
type Message = { id: string; role: "user" | "assistant"; content: string; mode?: ChatMode; /** Fixed product copy, not a model answer: never sent back as history. */ kind?: "guide"; citations?: Citation[]; grounded?: boolean; streaming?: boolean };

type CoachView = "chat" | "topics";
type ReplyMode = "coach" | "ask";
type SkillTopic = { title: string; objective: string | null };
const GENERAL_TOPIC: SkillTopic = { title: "This unit", objective: "Start with a quick diagnostic on the most important skill." };

function answerLabel(message: Message): string {
  const state = coachMaterialState({ content: message.content, grounded: message.grounded, streaming: message.streaming });
  if (message.kind === "guide") return "LEARN · HOW IT WORKS";
  if (message.mode === "learn") {
    if (state === "streaming") return "LEARN · READING YOUR MATERIALS…";
    return state === "grounded" ? "LEARN · FROM YOUR MATERIALS" : "LEARN · NOT IN YOUR MATERIALS";
  }
  if (state === "streaming") return "COACH · THINKING…";
  return state === "insufficient" ? "COACH · NEEDS MORE MATERIAL" : "COACH · PRACTICE";
}

export function CoachPanel({ roomId, coaching, readyCount, topics, areas = [], onOpenMaterials, view, onViewChange, focusTopicId, onClearFocus, onTopicsChanged }: {
  roomId: string;
  coaching: ReturnType<typeof useCoachPreferences>;
  readyCount: number;
  topics: Topic[];
  areas?: WeakArea[];
  onOpenMaterials: () => void;
  view: CoachView;
  onViewChange: (view: CoachView) => void;
  focusTopicId: string | null;
  onClearFocus: () => void;
  onTopicsChanged: () => void;
}) {
  const [draft, setDraft] = useState(coaching.applied);
  const style = STYLES.find(option => option.id === draft.style) ?? STYLES[0];
  const tradition = TRADITIONS.find(option => option.id === draft.tradition) ?? TRADITIONS[0];
  const practice = PRACTICE_PROTOCOLS.find(option => option.id === draft.practice) ?? PRACTICE_PROTOCOLS[0];
  const dirty = !sameCoachPreferences(draft, coaching.applied);
  useEffect(() => { setDraft(coaching.applied); }, [coaching.applied]);
  const [selectedTopic, setSelectedTopic] = useState<SkillTopic>(topics[0] ?? GENERAL_TOPIC);
  // Coach = practice and application with checking. Learn = facts from the materials, with sources.
  const [chatMode, setChatMode] = useState<ChatMode>("coach");
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  useFitViewport(view === "chat");
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
    if (!text || busy || coaching.applying) return;
    setPrompt(""); setError(null); setBusy(true);
    const assistantId = crypto.randomUUID();
    // One UUID per submitted turn. It becomes the persisted user message's ID
    // and the identity of any learning evidence, so a resend of this same
    // turn is recognized server-side instead of being recorded twice.
    const interactionId = crypto.randomUUID();
    // Snapshot the conversation so far — before the new user turn and the
    // streaming placeholder are added — so the engine can dedupe a new
    // batch of practice questions against everything already asked.
    const priorHistory = messages.filter((message) => !message.streaming && message.kind !== "guide").map((message) => ({ role: message.role, content: message.content }));
    setMessages((current) => [...current, { id: interactionId, role: "user", content: text, mode: messageMode }, { id: assistantId, role: "assistant", content: "", mode: messageMode, streaming: true }]);
    try {
      // The learner's question stays clean for retrieval; pedagogy choices
      // travel as separate directives so they only ever shape how the coach
      // answers, never what gets searched for.
      const { directives } = compileCoachPreferences(coaching.applied);
      // Fixture and production hit the same request/response contract; only
      // the endpoint (and how it sources chunks) differs. One brain, one
      // client code path.
      const isFixture = roomId === "fixture";
      const endpoint = isFixture ? "/api/dev/coach" : "/api/chat";
      const body = isFixture
        ? JSON.stringify({ question: text, topics, history: priorHistory, directives })
        : replying === "coach"
          ? JSON.stringify({ roomId, question: text, mode: "coach", interactionId, conversationId: conversationId.current })
          : JSON.stringify({ roomId, question: text, conversationId: askConversationId.current, directives: [{ name: "Current topic", instruction: `The learner is currently studying "${selectedTopic.title}". If the question is ambiguous, read it in that context. Still answer only from the retrieved excerpts.` }] });
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

  /** The "How Learn works" starter: answered locally with fixed copy, no model call. */
  function showLearnGuide(text: string) {
    if (busy) return;
    setError(null);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: text, mode: "learn", kind: "guide" },
      { id: crypto.randomUUID(), role: "assistant", content: LEARN_GUIDE_TEXT, mode: "learn", kind: "guide", grounded: false }
    ]);
  }

  function coachTopic(topic: Topic) {
    setSelectedTopic(topic);
    setChatMode("coach");
    onViewChange("chat");
    void coach(`Coach me through: ${topic.title}. ${topic.objective ?? "Start with a quick diagnostic."}`, "coach");
  }

  if (readyCount === 0) return <div className="modeEmpty"><h3>Nothing to coach from yet.</h3><p>Upload a study guide, worksheet, notes, or slides first. The coach only teaches from this room&apos;s materials.</p><button className="buttonPrimary" type="button" onClick={onOpenMaterials}>Add materials <span aria-hidden="true">→</span></button></div>;

  // Chat/Topics and the topic chip. Wide screens show them at the right end of the header;
  // phones show a second copy just under the Studigo rail (CSS shows one and hides the other).
  const contextControls = (
    <>
      <div className="coachTabs" role="group" aria-label="Coach sections">
        <button type="button" aria-pressed={view === "chat"} onClick={() => onViewChange("chat")}>Chat</button>
        <button type="button" aria-pressed={view === "topics"} onClick={() => onViewChange("topics")}>Topics{topics.length > 0 && <span className="coachTabCount">{topics.length}</span>}</button>
      </div>
      {view === "chat" && (topics.length > 1 ? (
        <button type="button" className="chatTopic" aria-label={`Topic: ${selectedTopic.title}. Change topic`} aria-expanded={skillPickerOpen} onClick={() => { (document.activeElement as HTMLElement | null)?.blur(); setPersonalizeOpen(false); setSkillPickerOpen(true); }}>
          <span className="chatTopicName">{selectedTopic.title}</span><span aria-hidden="true">▾</span>
        </button>
      ) : (
        <span className="chatTopic chatTopicStatic" aria-label={`Topic: ${selectedTopic.title}`}><span className="chatTopicName">{selectedTopic.title}</span></span>
      ))}
    </>
  );

  return (
    <>
    <ModeFrame tone="coach">
      <header className="modeHead" data-tone={chatMode === "learn" ? "ask" : "coach"}>
        {view === "chat" && chatMode === "coach" ? (
          <button type="button" className="chatMascot" aria-label="Coaching style" aria-expanded={personalizeOpen} aria-controls="coach-personalization" title="Coaching style" onClick={() => { (document.activeElement as HTMLElement | null)?.blur(); setSkillPickerOpen(false); setDraft(coaching.applied); setPersonalizeOpen((open) => !open); }}>
            <StudigoMascot state={busy ? "thinking" : "welcome"} size={38} mark />
            <span className="chatMascotDot" aria-hidden="true" />
          </button>
        ) : (
          <span className="chatMascot chatMascotStatic"><StudigoMascot state={busy ? "thinking" : "welcome"} size={38} mark /></span>
        )}
        {view === "chat" ? (
          <div className="chatModes" role="group" aria-label="How Studigo helps">
            <button type="button" data-tone="coach" aria-pressed={chatMode === "coach"} onClick={() => setChatMode("coach")}>
              <strong>Coach</strong><small>Practice and apply</small>
            </button>
            <button type="button" data-tone="ask" aria-pressed={chatMode === "learn"} onClick={() => { setPersonalizeOpen(false); setChatMode("learn"); }}>
              <strong>Learn</strong><small>Facts, with sources</small>
            </button>
          </div>
        ) : (
          <div className="mhTitle">
            <h2>Topics</h2>
            <p>Pick one to learn it or be coached on it.</p>
          </div>
        )}
        <div className="chatTopicRow mhChipRow">{contextControls}</div>
      </header>
    </ModeFrame>
    <div className={messages.length > 0 ? "coachMode activeSession" : "coachMode"}>
      <div className="mhChipBar" data-tone={chatMode === "learn" ? "ask" : "coach"}>{contextControls}</div>
      {view === "topics" ? (
        <div className="coachTopicsView">
          {focusTopicId && <button type="button" className="ghostButton coachShowAll" onClick={onClearFocus}>Showing one topic · Show all</button>}
          <LearnPanel embedded roomId={roomId} topics={focusTopicId ? topics.filter((topic) => topic.id === focusTopicId) : topics} hasMaterials onChanged={onTopicsChanged} onCoachTopic={coachTopic} />
        </div>
      ) : (
      <div className="coachBody">
      <div className="coachMain">
      {(() => { const material = MATERIAL_NOTES[selectedTopic.title]; return material ? <section className="coachMaterial" aria-label={`Study material for ${selectedTopic.title}`}><div><span className="tinyLabel">FROM YOUR STUDY GUIDE</span><h3>{selectedTopic.title}</h3><p>{material.summary}</p></div><div className="coachMaterialExample"><span>EXAMPLE</span><p>{material.example}</p><small>{material.source}</small></div></section> : null; })()}
      <section className="coachChat" data-chat-mode={chatMode} aria-label="Conversation with Studigo">
      {skillPickerOpen && <button className="coachSetupBackdrop" type="button" aria-label="Close skill picker" onClick={() => setSkillPickerOpen(false)} />}
      {skillPickerOpen && (
        <section className="coachSkillSheet" role="dialog" aria-modal="true" aria-labelledby="coach-skill-sheet-title">
          <div className="coachSettingsSheetHead">
            <div><span className="tinyLabel">TOPIC</span><strong id="coach-skill-sheet-title">Pick a topic</strong></div>
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
      {personalizeOpen && <button className="coachSetupBackdrop" type="button" aria-label="Close Coach personalization" onClick={() => setPersonalizeOpen(false)} />}
      <section
        id="coach-personalization"
        className={personalizeOpen ? "coachSettings mobileOpen" : "coachSettings"}
        aria-label="Personalize coaching"
        role={personalizeOpen ? "dialog" : undefined}
        aria-modal={personalizeOpen ? true : undefined}
      >
        <div className="coachSettingsSheetHead">
          <div><span className="tinyLabel">COACH SETUP</span><strong>Personalize this room</strong></div>
          <button type="button" onClick={() => setPersonalizeOpen(false)}>Done</button>
        </div>
        <div>
          <span className="tinyLabel">HOW TO COACH</span>
          <div className="coachStyleGrid" aria-label="Choose a coaching style">
            {STYLES.map((option) => <button key={option.id} type="button" aria-pressed={option.id === style.id} disabled={coaching.applying} className={option.id === style.id ? "coachStyle active" : "coachStyle"} onClick={() => setDraft(current => ({ ...current, style: option.id }))}><strong>{option.name}</strong><span>{option.description}</span></button>)}
          </div>
        </div>
        <div className="coachChoiceRow">
          <label>Learning tradition
            <select value={tradition.id} disabled={coaching.applying} onChange={(event) => setDraft(current => ({ ...current, tradition: event.target.value }))}>
              {TRADITIONS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <small>{tradition.description}</small>
          </label>
          <label>Practice recipe
            <select value={practice.id} disabled={coaching.applying} onChange={(event) => setDraft(current => ({ ...current, practice: event.target.value }))}>
              {PRACTICE_PROTOCOLS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <small>{practice.name === "Focused repetition" ? "Use repetition when it is the right tool, not as busywork." : practice.instruction}</small>
          </label>
        </div>
        <label className="field">Explanation level
          <select value={draft.explainLevel} disabled={coaching.applying} onChange={event => setDraft(current => ({ ...current, explainLevel: event.target.value as typeof draft.explainLevel }))}>
            <option value="simpler">Simpler: plain words and familiar examples</option>
            <option value="standard">Standard: the level of the material</option>
            <option value="deeper">Deeper: precise terms and more connections</option>
          </select>
        </label>
        <div className="coachApplyActions">
          <button className="buttonPrimary" type="button" disabled={!dirty || busy || coaching.applying} onClick={() => void coaching.apply(draft)}>{coaching.applying ? "Recalibrating…" : "Apply"}</button>
          <small>{busy ? "Apply after Studigo finishes this reply." : dirty ? "Apply to save these choices for this room." : "Your settings are saved for this room."}</small>
        </div>
        {coaching.error && <p className="formError" role="alert">{coaching.error}</p>}
        {coaching.status && <p className="coachPreferenceStatus" role="status">{coaching.status}</p>}
      </section>
        {!personalizeOpen && coaching.status && <p className="coachPreferenceStatus" role="status">{coaching.status}</p>}
        <div className="chatThread" role="log" aria-live="polite" aria-label="Messages">
        {messages.length === 0 ? (
          chatMode === "coach" ? (
            <div className="coachEmpty">
              <strong>Practice it.</strong>
              <p>Coach gives you problems, checks your work and tracks what you have mastered. Use it to rehearse steps and apply ideas. Not sure what a term means? Switch to Learn first.</p>
              <div className="starterList">
                <button type="button" onClick={() => void coach(`Coach me through: ${selectedTopic.title}. ${selectedTopic.objective ?? "Start with a quick diagnostic."}`)}>Coach me on {selectedTopic.title}</button>
                <button type="button" onClick={() => void coach("Show me one worked example, then give me a similar problem to try.")}>Show me an example</button>
              </div>
            </div>
          ) : (
            <div className="coachEmpty">
              <strong>Understand it.</strong>
              <p>Learn answers from your materials and shows the page it came from. Use it when an idea or term does not make sense yet. Then switch to Coach to practice it. Tap a starter below to see how it works.</p>
            </div>
          )
        ) : messages.map((message) => message.role === "user" ? <div className="studentBubble" key={message.id}>{message.content}</div> : <div className="answerBubble" key={message.id} data-mode={message.mode ?? "coach"} data-state={coachMaterialState({ content: message.content, grounded: message.grounded, streaming: message.streaming })}><span className="answerKicker"><StudigoMascot state={message.streaming ? "thinking" : "sources"} size={28} mark />{answerLabel(message)}</span><div className="answerText"><RichText text={message.content} />{message.streaming && <span className="caret" aria-hidden="true" />}</div>{message.citations && <CitationChips citations={message.citations} />}</div>)}
        <div ref={threadEndRef} className="threadEnd" aria-hidden="true" />
        </div>
        {chatMode === "learn" && <div className="chatChips" aria-label="Learn starters">{learnStarters(selectedTopic.title).map((starter) => <button key={starter.id} type="button" disabled={busy} onClick={() => starter.local ? showLearnGuide(starter.text) : void coach(starter.text)}>{starter.label}</button>)}</div>}
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
      </div>
      <CoachAside topics={topics} areas={areas} selectedTitle={selectedTopic.title} onSelect={(topic) => setSelectedTopic(topic)} onAllTopics={() => onViewChange("topics")} />
      </div>
      )}
    </div>
    </>
  );
}

export { STYLES };
export type { CoachingStyle } from "@/lib/coach-preferences";
        
