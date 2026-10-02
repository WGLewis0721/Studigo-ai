"use client";

import { COACH_MODE_OPTIONS, compileCoachPreferences, describeCoaching, sameCoachPreferences } from "@/lib/coach-preferences";
import type { useCoachPreferences } from "./use-coach-preferences";
import { StudigoMascot } from "@/components/studigo-mascot";
import { COACH_CONTROL_COMMANDS, LEARN_GUIDE_TEXT, learnStarters } from "@/lib/coach-route-selection";
import { useEffect, useRef, useState } from "react";
import { CitationChips, type Citation } from "./citations";
import { MATERIAL_NOTES } from "@/lib/fixture-materials";
import { coachMaterialLabel, coachMaterialState } from "@/lib/coach-material-state";
import { StudigoComposer } from "./studigo-composer";
import { ModeFrame } from "./mode-header";
import { useCompanion } from "@/components/companion/companion";
import { LearnPanel } from "./learn-panel";
import { RichText } from "./rich-text";
import type { Topic } from "@/lib/rooms";
import { useFitViewport } from "./use-fit-viewport";
import { CoachAside } from "./coach-aside";
import type { WeakArea } from "@/lib/study-planning";
import type { ExplainLevel } from "@studigo/learning";

type ChatMode = "coach" | "learn";
type Message = { id: string; role: "user" | "assistant"; content: string; mode?: ChatMode; /** Fixed product copy, not a model answer: never sent back as history. */ kind?: "guide"; citations?: Citation[]; grounded?: boolean; streaming?: boolean };

type CoachView = "chat" | "topics";
type ReplyMode = "coach" | "ask";
type SkillTopic = { id: string; title: string; objective: string | null };
const GENERAL_TOPIC: SkillTopic = { id: "general", title: "This unit", objective: "Start with a quick diagnostic on the most important skill." };
const EXPLAIN_OPTIONS: Array<{ id: ExplainLevel; label: string; copy: string }> = [
  { id: "simpler", label: "Simpler", copy: "Plain words and familiar examples." },
  { id: "standard", label: "Standard", copy: "Match the level of your materials." },
  { id: "deeper", label: "Deeper", copy: "More precise vocabulary and connections." }
];
const LEVEL_LABEL: Record<ExplainLevel, string> = { simpler: "Simpler words", standard: "Standard words", deeper: "Deeper detail" };

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
  const [learnDraft, setLearnDraft] = useState<ExplainLevel>(coaching.learnLevel);
  const [coachApplyBoth, setCoachApplyBoth] = useState(false);
  const [learnApplyBoth, setLearnApplyBoth] = useState(false);
  const coachDirty = !sameCoachPreferences(draft, coaching.applied)
    || (coachApplyBoth && coaching.learnLevel !== draft.explainLevel);
  const learnDirty = learnDraft !== coaching.learnLevel
    || (learnApplyBoth && coaching.applied.explainLevel !== learnDraft);
  const active = describeCoaching(coaching.applied);
  const draftMode = describeCoaching(draft);
  useEffect(() => { setDraft(coaching.applied); }, [coaching.applied]);
  useEffect(() => { setLearnDraft(coaching.learnLevel); }, [coaching.learnLevel]);
  const [selectedTopic, setSelectedTopic] = useState<SkillTopic>(topics[0] ?? GENERAL_TOPIC);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>(topics[0] ? [topics[0].id] : []);
  const [topicDraftIds, setTopicDraftIds] = useState<string[]>(topics[0] ? [topics[0].id] : []);
  const [scopeStatus, setScopeStatus] = useState<string | null>(null);
  // Coach = practice and application with checking. Learn = facts from the materials, with sources.
  const [chatMode, setChatMode] = useState<ChatMode>("coach");
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  useFitViewport(view === "chat");
  const { thinking: companionThinking } = useCompanion();
  useEffect(() => { companionThinking(busy); return () => companionThinking(false); }, [busy, companionThinking]);
  const modalOpen = personalizeOpen || skillPickerOpen;
  const conversationId = useRef<string | null>(null);
  const askConversationId = useRef<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const valid = new Set(topics.map((topic) => topic.id));
    setSelectedTopicIds((current) => {
      const kept = current.filter((id) => valid.has(id));
      return kept.length ? kept : topics[0] ? [topics[0].id] : [];
    });
  }, [topics]);

  useEffect(() => {
    const first = topics.find((topic) => selectedTopicIds.includes(topic.id));
    if (first) setSelectedTopic(first);
  }, [selectedTopicIds, topics]);

  const openSetup = () => {
    (document.activeElement as HTMLElement | null)?.blur();
    setSkillPickerOpen(false);
    setDraft(coaching.applied);
    setLearnDraft(coaching.learnLevel);
    setPersonalizeOpen(true);
  };

  const openTopicPicker = () => {
    (document.activeElement as HTMLElement | null)?.blur();
    setPersonalizeOpen(false);
    setTopicDraftIds(selectedTopicIds.length ? selectedTopicIds : topics[0] ? [topics[0].id] : []);
    setSkillPickerOpen(true);
  };

  const selectedTopics = topics.filter((topic) => selectedTopicIds.includes(topic.id));

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

  async function coach(input: string, modeOverride?: ReplyMode, topicIdsOverride?: string[]) {
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
    const scopedTopicIds = topicIdsOverride ?? selectedTopicIds;
    const scopedTopics = topics.filter((topic) => scopedTopicIds.includes(topic.id));
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
      const scopeInstruction = scopedTopics.length
        ? `The learner selected these study topics: ${scopedTopics.map((topic) => `"${topic.title}"`).join(", ")}. If the question is ambiguous, read it in that scope. Still answer only from the retrieved excerpts.`
        : "Use the active Study Room topics only. Still answer only from the retrieved excerpts.";
      const body = isFixture
        ? JSON.stringify({ question: text, topics: scopedTopics.length ? scopedTopics : topics, history: priorHistory, directives })
        : replying === "coach"
          ? JSON.stringify({ roomId, question: text, mode: "coach", interactionId, conversationId: conversationId.current, topicIds: scopedTopicIds })
          : JSON.stringify({ roomId, question: text, conversationId: askConversationId.current, topicIds: scopedTopicIds, directives: [{ name: "Current topics", instruction: scopeInstruction }] });
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
      // Refresh authoritative evidence after a completed turn; presentation stays unchanged.
      if (replying === "coach") onTopicsChanged();
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
    setSelectedTopicIds([topic.id]);
    setTopicDraftIds([topic.id]);
    conversationId.current = null;
    setChatMode("coach");
    onViewChange("chat");
    void coach(`Coach me through: ${topic.title}. ${topic.objective ?? "Start with a quick diagnostic."}`, "coach", [topic.id]);
  }

  async function applySurfaceSettings() {
    if (busy) return;
    if (chatMode === "coach") {
      const ok = await coaching.apply(draft, coachApplyBoth);
      if (ok) {
        conversationId.current = null;
        if (coachApplyBoth) askConversationId.current = null;
      }
      return;
    }
    const ok = await coaching.applyLearn(learnDraft, learnApplyBoth);
    if (ok) {
      askConversationId.current = null;
      if (learnApplyBoth) conversationId.current = null;
    }
  }

  function applyTopicScope() {
    const ordered = topics.filter((topic) => topicDraftIds.includes(topic.id)).map((topic) => topic.id);
    if (!ordered.length) return;
    setSelectedTopicIds(ordered);
    const first = topics.find((topic) => topic.id === ordered[0]);
    if (first) setSelectedTopic(first);
    conversationId.current = null;
    askConversationId.current = null;
    setScopeStatus(`Applied ${ordered.length === topics.length ? "all topics" : `${ordered.length} topic${ordered.length === 1 ? "" : "s"}`}. Coach and Learn will recalibrate on the next reply.`);
    setSkillPickerOpen(false);
    onViewChange("chat");
  }

  if (readyCount === 0) return <div className="modeEmpty"><h3>Nothing to coach from yet.</h3><p>Upload a study guide, worksheet, notes, or slides first. The coach only teaches from this room&apos;s materials.</p><button className="buttonPrimary" type="button" onClick={onOpenMaterials}>Add materials <span aria-hidden="true">→</span></button></div>;

  // Chat stays the conversation view. Topics is now the topic-scope control itself,
  // so there is no second green topic dropdown competing with it.
  const contextControls = (
    <div className="coachTabs" role="group" aria-label="Coach sections and topic scope">
      <button type="button" aria-pressed={view === "chat" && !skillPickerOpen} onClick={() => onViewChange("chat")}>Chat</button>
      <button type="button" aria-pressed={skillPickerOpen || view === "topics"} aria-haspopup="dialog" aria-expanded={skillPickerOpen} onClick={openTopicPicker}>
        Topics{topics.length > 0 && <span className="coachTabCount">{selectedTopicIds.length}/{topics.length}</span>}
      </button>
    </div>
  );

  return (
    <>
    <ModeFrame tone="coach">
      <header className="modeHead" data-tone={chatMode === "learn" ? "ask" : "coach"}>
        <button type="button" className="chatMascot" aria-label={chatMode === "coach" ? "Coach settings" : "Learn settings"} aria-expanded={personalizeOpen} aria-controls="coach-personalization" title={chatMode === "coach" ? "Coach settings" : "Learn settings"} onClick={() => { if (personalizeOpen) setPersonalizeOpen(false); else openSetup(); }}>
          <StudigoMascot state={busy ? "thinking" : "welcome"} size={38} mark />
          <span className="chatMascotDot" aria-hidden="true" />
        </button>
        <div className="chatModes" role="group" aria-label="How Studigo helps">
          <button type="button" data-tone="coach" aria-pressed={chatMode === "coach"} onClick={() => { setPersonalizeOpen(false); setChatMode("coach"); }}>
            <strong>Coach</strong><small>Practice and apply</small>
          </button>
          <button type="button" data-tone="ask" aria-pressed={chatMode === "learn"} onClick={() => { setPersonalizeOpen(false); setChatMode("learn"); }}>
            <strong>Learn</strong><small>Facts, with sources</small>
          </button>
        </div>
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
            <div><span className="tinyLabel">TOPIC SCOPE</span><strong id="coach-skill-sheet-title">Choose one or more topics</strong></div>
            <button type="button" onClick={() => setSkillPickerOpen(false)}>Cancel</button>
          </div>
          <div className="coachTopicBulkActions">
            <button type="button" onClick={() => setTopicDraftIds(topics.map((topic) => topic.id))}>Select all</button>
            <button type="button" onClick={() => setTopicDraftIds([])}>Clear</button>
          </div>
          <div className="coachSkillList coachSkillMulti">
            {topics.map((topic, index) => {
              const checked = topicDraftIds.includes(topic.id);
              return (
                <label key={topic.id} className={checked ? "active" : ""}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => setTopicDraftIds((current) => event.target.checked ? [...current, topic.id] : current.filter((id) => id !== topic.id))}
                  />
                  <span className="coachSkillIndex">{index + 1}</span>
                  <span><strong>{topic.title}</strong>{topic.objective && topic.objective !== topic.title && <small>{topic.objective}</small>}</span>
                </label>
              );
            })}
          </div>
          <div className="coachTopicApply">
            <button type="button" className="ghostButton" onClick={() => { setSkillPickerOpen(false); onViewChange("topics"); }}>Manage topics</button>
            <button type="button" className="buttonPrimary" disabled={!topicDraftIds.length} onClick={applyTopicScope}>Apply topics</button>
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
          <div><span className="tinyLabel">{chatMode === "coach" ? "COACH SETUP" : "LEARN SETUP"}</span><strong>{chatMode === "coach" ? "How should Studigo coach you?" : "How should Studigo explain things?"}</strong></div>
          <button type="button" onClick={() => setPersonalizeOpen(false)}>Done</button>
        </div>
        {chatMode === "coach" && (
          <>
            <div className="coachExpect" aria-live="polite">
              <span className="tinyLabel">{coachDirty ? "AFTER YOU APPLY" : "IN USE NOW"}</span>
              <strong>{draftMode.label}</strong>
              <p>{draftMode.expect}</p>
            </div>
            <div>
              <span className="tinyLabel">COACH MODE</span>
              <div className="coachStyleGrid coachModeGrid" aria-label="Choose a coaching mode">
                {COACH_MODE_OPTIONS.map((option) => <button key={option.id} type="button" aria-pressed={option.id === draftMode.mode} disabled={coaching.applying} className={option.id === draftMode.mode ? "coachStyle active" : "coachStyle"} onClick={() => setDraft(current => ({ ...current, coach_mode: option.id }))}><strong>{option.name}</strong><span>{option.expect}</span></button>)}
              </div>
            </div>
          </>
        )}
        <div>
          <span className="tinyLabel">{chatMode === "coach" ? "COACH EXPLANATION LEVEL" : "LEARN EXPLANATION LEVEL"}</span>
          <div className="coachStyleGrid explainLevelGrid" aria-label={chatMode === "coach" ? "Choose Coach explanation level" : "Choose Learn explanation level"}>
            {EXPLAIN_OPTIONS.map((option) => {
              const selected = chatMode === "coach" ? draft.explainLevel === option.id : learnDraft === option.id;
              return <button key={option.id} type="button" aria-pressed={selected} disabled={coaching.applying || coaching.learnApplying} className={selected ? "coachStyle active" : "coachStyle"} onClick={() => chatMode === "coach" ? setDraft((current) => ({ ...current, explainLevel: option.id })) : setLearnDraft(option.id)}><strong>{option.label}</strong><span>{option.copy}</span></button>;
            })}
          </div>
        </div>
        <label className="coachApplyBoth">
          <input type="checkbox" checked={chatMode === "coach" ? coachApplyBoth : learnApplyBoth} onChange={(event) => chatMode === "coach" ? setCoachApplyBoth(event.target.checked) : setLearnApplyBoth(event.target.checked)} />
          <span>Apply this explanation level to both Coach and Learn</span>
        </label>
        <div className="coachApplyActions">
          <button className="buttonPrimary" type="button" disabled={busy || coaching.applying || coaching.learnApplying || (chatMode === "coach" ? !coachDirty : !learnDirty)} onClick={() => void applySurfaceSettings()}>
            {(chatMode === "coach" ? coaching.applying : coaching.learnApplying) ? "Recalibrating…" : chatMode === "coach" ? "Apply Coach" : "Apply Learn"}
          </button>
          <small>{busy ? "Apply after Studigo finishes this reply." : "Apply saves the selection and starts a fresh response context for this surface."}</small>
        </div>
        {(chatMode === "coach" ? coaching.error : coaching.learnError) && <p className="formError" role="alert">{chatMode === "coach" ? coaching.error : coaching.learnError}</p>}
        {(chatMode === "coach" ? coaching.status : coaching.learnStatus) && <p className="coachPreferenceStatus" role="status">{chatMode === "coach" ? coaching.status : coaching.learnStatus}</p>}
      </section>
        {!personalizeOpen && (chatMode === "coach" ? coaching.status : coaching.learnStatus) && <p className="coachPreferenceStatus" role="status">{chatMode === "coach" ? coaching.status : coaching.learnStatus}</p>}
        {!personalizeOpen && scopeStatus && <p className="coachPreferenceStatus" role="status">{scopeStatus}</p>}
        {view === "chat" && !personalizeOpen && (
          <button type="button" className="coachActiveStyle" onClick={openSetup} aria-label={chatMode === "coach" ? `Coaching: ${active.label}, ${active.level}. Change` : `Learning: ${LEVEL_LABEL[coaching.learnLevel]}. Change`}>
            <span>{chatMode === "coach" ? "Coaching" : "Learning"}</span>
            <strong>{chatMode === "coach" ? active.label : LEVEL_LABEL[coaching.learnLevel]}</strong>
            {chatMode === "coach" && <em>{active.level}</em>}
          </button>
        )}
        <div className="chatThread" role="log" aria-live="polite" aria-label="Messages">
        {messages.length === 0 ? (
          chatMode === "coach" ? (
            <div className="coachEmpty">
              <strong>Practice it.</strong>
              <p>Coach gives you problems, checks your work and tracks what you have mastered. Not sure what a term means? Switch to Learn first.</p>
              <p className="coachEmptyStyle"><b>{active.label}:</b> {active.expect}</p>
              <div className="starterList">
                <button type="button" onClick={() => void coach(selectedTopics.length > 1 ? `Coach me across these selected topics: ${selectedTopics.map((topic) => topic.title).join(", ")}.` : `Coach me through: ${selectedTopic.title}. ${selectedTopic.objective ?? "Start with a quick diagnostic."}`)}>{selectedTopics.length > 1 ? `Coach me across ${selectedTopics.length} topics` : `Coach me on ${selectedTopic.title}`}</button>
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
      <CoachAside topics={topics} areas={areas} selectedTitle={selectedTopic.title} onSelect={(topic) => { setSelectedTopic(topic); setSelectedTopicIds([topic.id]); conversationId.current = null; askConversationId.current = null; }} onAllTopics={openTopicPicker} />
      </div>
      )}
    </div>
    </>
  );
}


