"use client";

import { COACH_MODE_OPTIONS, describeCoaching, directivesForTurn, sameCoachPreferences } from "@/lib/coach-preferences";
import { operationHeaders } from "@/lib/ai-operation-client";
import type { useCoachPreferences } from "./use-coach-preferences";
import { StudigoMascot } from "@/components/studigo-mascot";
import { activeTopicId, leavePendingChallenge, nextTopic } from "@/lib/topic-cursor";
import { COACH_CONTROL_COMMANDS, LEARN_GUIDE_TEXT, learnStarters } from "@/lib/coach-route-selection";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CitationChips, type Citation } from "./citations";
import { MATERIAL_NOTES } from "@/lib/fixture-materials";
import { coachMaterialLabel, coachMaterialState } from "@/lib/coach-material-state";
import { StudigoComposer } from "./studigo-composer";
import { ModeFrame } from "./mode-header";
import { useCompanion } from "@/components/companion/companion";
import { LearnPanel, LessonMobileFrame, keepIndependentSurfaces, lessonPositionLabel, retainSuccessfulLesson } from "./learn-panel";
import { RichText } from "./rich-text";
import type { Topic } from "@/lib/rooms";
import { useFitViewport } from "./use-fit-viewport";
import { CoachAside } from "./coach-aside";
import type { WeakArea } from "@/lib/study-planning";
import { LEARN_MODE_OPTIONS, describeLearning, type LearnPreferences } from "@/lib/learn-preferences";
import { learnOutcomeView, readLearnOutcome } from "@/lib/learn-outcome-client";
import type { LearnOutcome } from "@/lib/learn-outcome";

type ChatMode = "coach" | "learn";
type Message = { id: string; role: "user" | "assistant"; content: string; mode?: ChatMode; /** Fixed product copy, not a model answer: never sent back as history. */ kind?: "guide"; citations?: Citation[]; grounded?: boolean; streaming?: boolean; outcome?: LearnOutcome };
type MessagesByMode = Record<ChatMode, Message[]>;
type ModeState<T> = Record<ChatMode, T>;

type CoachView = "chat" | "topics";
type ReplyMode = "coach" | "ask";
type SkillTopic = { id: string; title: string; objective: string | null };
const GENERAL_TOPIC: SkillTopic = { id: "general", title: "This unit", objective: "Start with a quick diagnostic on the most important skill." };

function answerLabel(message: Message): string {
  const state = coachMaterialState({ content: message.content, grounded: message.grounded, streaming: message.streaming });
  if (message.kind === "guide") return "LEARN · HOW IT WORKS";
  if (message.mode === "learn") {
    if (state === "streaming") return "LEARN · READING YOUR MATERIALS…";
    if (message.outcome) {
      const view = learnOutcomeView(message.outcome);
      if (view) return `LEARN · ${view.title.toUpperCase()}`;
    }
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
  const [learnDraft, setLearnDraft] = useState<LearnPreferences>(coaching.learnApplied);
  const coachDirty = !sameCoachPreferences(draft, coaching.applied);
  const learnDirty = learnDraft.mode !== coaching.learnApplied.mode;
  const active = describeCoaching(coaching.applied);
  const draftMode = describeCoaching(draft);
  const learnActive = describeLearning(coaching.learnApplied);
  const learnDraftMode = describeLearning(learnDraft);
  useEffect(() => { setDraft(coaching.applied); }, [coaching.applied]);
  useEffect(() => { setLearnDraft(coaching.learnApplied); }, [coaching.learnApplied]);
  const defaultTopicIds = topics[0] ? [topics[0].id] : [];
  const [coachTopicIds, setCoachTopicIds] = useState<string[]>(defaultTopicIds);
  const [learnTopicIds, setLearnTopicIds] = useState<string[]>(defaultTopicIds);
  const [cursors, setCursors] = useState<{ coach: number; learn: number }>({ coach: 0, learn: 0 });
  const cursorRef = useRef(cursors);
  const [lessonCache, setLessonCache] = useState<Record<string, { text: string; citations: Citation[] }>>({});
  const lessonCacheRef = useRef(lessonCache);
  lessonCacheRef.current = lessonCache;
  const [lessonPhase, setLessonPhase] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [overviewDoc, setOverviewDoc] = useState<{ text: string } | null>(null);
  const overviewRef = useRef(overviewDoc);
  overviewRef.current = overviewDoc;
  const [overviewPhase, setOverviewPhase] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [learnView, setLearnView] = useState<"lesson" | "overview">("lesson");
  const lessonRequest = useRef<string | null>(null);
  const [topicDraftIds, setTopicDraftIds] = useState<string[]>(defaultTopicIds);
  const [coachScopeStatus, setCoachScopeStatus] = useState<string | null>(null);
  const [learnScopeStatus, setLearnScopeStatus] = useState<string | null>(null);
  // Coach = practice and application with checking. Learn = facts from the materials, with sources.
  const [chatMode, setChatMode] = useState<ChatMode>("coach");
  // Coach and Learn have separate persisted conversations. Keep their visible
  // turn history separate too, so switching surfaces cannot make one appear
  // to be context for the other.
  const [messagesByMode, setMessagesByMode] = useState<MessagesByMode>({ coach: [], learn: [] });
  const [prompts, setPrompts] = useState<ModeState<string>>({ coach: "", learn: "" });
  const [pending, setPending] = useState<ModeState<boolean>>({ coach: false, learn: false });
  const [errors, setErrors] = useState<ModeState<string | null>>({ coach: null, learn: null });
  const prompt = prompts[chatMode];
  const busy = pending[chatMode];
  const error = errors[chatMode];
  const pendingRef = useRef<ModeState<boolean>>({ coach: false, learn: false });
  const requestIdByMode = useRef<ModeState<string | null>>({ coach: null, learn: null });
  const threadGeneration = useRef<ModeState<number>>({ coach: 0, learn: 0 });
  const scrollPositions = useRef<ModeState<number>>({ coach: 0, learn: 0 });
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  useFitViewport(view === "chat");
  const { thinking: companionThinking } = useCompanion();
  useEffect(() => { companionThinking(busy); return () => companionThinking(false); }, [busy, companionThinking]);
  const modalOpen = personalizeOpen || skillPickerOpen;
  const conversationId = useRef<string | null>(null);
  const askConversationId = useRef<string | null>(null);
  const handledFocusTopicId = useRef<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const lastAutoScrollMode = useRef<ChatMode | null>(null);
  const skipAutoScroll = useRef(false);

  const resetThreadIdentity = (mode: ChatMode) => {
    threadGeneration.current[mode] += 1;
    requestIdByMode.current[mode] = null;
    pendingRef.current[mode] = false;
    setPending((current) => ({ ...current, [mode]: false }));
    setMessagesByMode((current) => current[mode].some((message) => message.streaming)
      ? { ...current, [mode]: current[mode].filter((message) => !message.streaming) }
      : current);
  };

  const switchChatMode = (mode: ChatMode) => {
    if (mode === chatMode) return;
    if (threadRef.current) scrollPositions.current[chatMode] = threadRef.current.scrollTop;
    setPersonalizeOpen(false);
    setChatMode(mode);
  };

  useEffect(() => {
    const valid = new Set(topics.map((topic) => topic.id));
    const keepValid = (current: string[]) => {
      const kept = current.filter((id) => valid.has(id));
      return kept.length ? kept : topics[0] ? [topics[0].id] : [];
    };
    setCoachTopicIds(keepValid);
    setLearnTopicIds(keepValid);
  }, [topics]);

  const activeTopicIds = chatMode === "coach" ? coachTopicIds : learnTopicIds;
  const messages = messagesByMode[chatMode];
  const cursorTopicId = activeTopicId(activeTopicIds, cursors[chatMode]);
  const selectedTopics = topics.filter((topic) => topic.id === cursorTopicId);
  const selectedTopic: SkillTopic = topics.find((topic) => topic.id === cursorTopicId) ?? topics[0] ?? GENERAL_TOPIC;
  const activeScopeStatus = chatMode === "coach" ? coachScopeStatus : learnScopeStatus;
  const coachCursorId = activeTopicId(coachTopicIds, cursors.coach);
  const learnCursorId = activeTopicId(learnTopicIds, cursors.learn);
  const coachTopicTitle = topics.find((topic) => topic.id === coachCursorId)?.title ?? GENERAL_TOPIC.title;
  const learnTopicTitle = topics.find((topic) => topic.id === learnCursorId)?.title ?? GENERAL_TOPIC.title;
  const learnLabel = lessonPositionLabel(cursors.learn, learnTopicIds.length);
  const showingOverview = chatMode === "learn" && learnView === "overview";
  const cursorLesson = learnCursorId ? lessonCache[learnCursorId] ?? null : null;

  useEffect(() => {
    if (chatMode !== "learn" || view !== "chat") return;
    const topic = topics.find((item) => item.id === learnCursorId);
    if (!topic) return;
    void loadCursorLesson(topic, "open");
  }, [chatMode, view, learnCursorId, topics, roomId]);

  useEffect(() => {
    if (!focusTopicId) {
      handledFocusTopicId.current = null;
      return;
    }
    if (handledFocusTopicId.current === focusTopicId) return;
    const focused = topics.find((topic) => topic.id === focusTopicId);
    if (!focused) return;
    handledFocusTopicId.current = focusTopicId;
    if (chatMode === "coach") {
      setCoachTopicIds([focused.id]);
      conversationId.current = null;
      resetThreadIdentity("coach");
    } else {
      setLearnTopicIds([focused.id]);
      askConversationId.current = null;
      resetThreadIdentity("learn");
    }
    const reset = { ...cursorRef.current, [chatMode]: 0 };
    cursorRef.current = reset;
    setCursors(reset);
    setTopicDraftIds([focused.id]);
  }, [focusTopicId, topics, chatMode]);

  const openSetup = () => {
    (document.activeElement as HTMLElement | null)?.blur();
    setSkillPickerOpen(false);
    setDraft(coaching.applied);
    setLearnDraft(coaching.learnApplied);
    setPersonalizeOpen(true);
  };

  const openTopicPicker = () => {
    (document.activeElement as HTMLElement | null)?.blur();
    setPersonalizeOpen(false);
    setTopicDraftIds(activeTopicIds.length ? activeTopicIds : topics[0] ? [topics[0].id] : []);
    setSkillPickerOpen(true);
  };

  useLayoutEffect(() => {
    skipAutoScroll.current = lastAutoScrollMode.current !== chatMode;
    if (view === "chat" && threadRef.current) threadRef.current.scrollTop = scrollPositions.current[chatMode];
    lastAutoScrollMode.current = chatMode;
  }, [chatMode, view]);

  useEffect(() => {
    if (skipAutoScroll.current) { skipAutoScroll.current = false; return; }
    if (view !== "chat" || !messages.length) return;
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
    scrollPositions.current[chatMode] = thread.scrollTop;
  }, [messages, chatMode, view]);

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

  async function loadCursorLesson(topic: { id: string; title: string }, reason: "open" | "retry") {
    const kept = lessonCacheRef.current[topic.id] ?? null;
    if (reason === "open" && kept) return;
    if (lessonRequest.current || roomId === "fixture") return;
    lessonRequest.current = topic.id;
    setLessonPhase("loading");
    try {
      const response = await fetch("/api/learn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId, topicId: topic.id })
      });
      const payload = await response.json().catch(() => null) as { explanation?: unknown; citations?: Citation[]; error?: string; outcome?: unknown } | null;
      const outcome = readLearnOutcome(payload?.outcome);
      const failedOutcome = Boolean(outcome && outcome.kind !== "ready" && outcome.kind !== "partial_coverage");
      const explanation = typeof payload?.explanation === "string" ? payload.explanation.trim() : "";
      if (!response.ok || !explanation || failedOutcome) {
        setLessonPhase(kept ? "ready" : "error");
        setLessonCache((current) => {
          const next = retainSuccessfulLesson(current, topic.id, kept, null);
          lessonCacheRef.current = next;
          return next;
        });
        return;
      }
      setLessonCache((current) => {
        const next = retainSuccessfulLesson(current, topic.id, kept, {
          text: explanation,
          citations: Array.isArray(payload?.citations) ? payload.citations : []
        });
        lessonCacheRef.current = next;
        return next;
      });
      setLessonPhase("ready");
    } catch {
      setLessonPhase(kept ? "ready" : "error");
      setLessonCache((current) => {
        const next = retainSuccessfulLesson(current, topic.id, kept, null);
        lessonCacheRef.current = next;
        return next;
      });
    } finally {
      if (lessonRequest.current === topic.id) lessonRequest.current = null;
    }
  }

  async function teachSelected(_text: string) {
    if (pendingRef.current.learn) return;
    if (learnTopicIds.length <= 1) {
      setLearnView("lesson");
      const topic = topics.find((item) => item.id === activeTopicId(learnTopicIds, cursorRef.current.learn));
      if (topic) void loadCursorLesson(topic, "retry");
      return;
    }
    setPrompts((current) => ({ ...current, learn: "" }));
    pendingRef.current.learn = true;
    setPending((current) => ({ ...current, learn: true }));
    setOverviewPhase("loading");
    const previous = overviewRef.current;
    try {
      const response = await fetch("/api/learn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId, overview: true, topicIds: learnTopicIds })
      });
      const payload = await response.json().catch(() => null) as { error?: string; sections?: Array<{ title: string; text: string; citation: string | null; status: string }> } | null;
      const content = payload?.sections?.length
        ? payload.sections.map((section) => `## ${section.title}\n${section.text}${section.citation ? `\nSource: ${section.citation}` : ""}`).join("\n\n")
        : "";
      if (!response.ok || !content) {
        const kept = keepIndependentSurfaces(
          { lesson: lessonCacheRef.current, overview: previous, coach: messagesByMode.coach },
          { overview: previous }
        );
        overviewRef.current = kept.overview;
        setOverviewDoc(kept.overview);
        setOverviewPhase("error");
        setLearnScopeStatus(payload?.error || "The overview could not refresh. The lesson and cursor were kept.");
        return;
      }
      const kept = keepIndependentSurfaces(
        { lesson: lessonCacheRef.current, overview: previous, coach: messagesByMode.coach },
        { overview: { text: content } }
      );
      overviewRef.current = kept.overview;
      setOverviewDoc(kept.overview);
      setOverviewPhase("ready");
      setLearnView("overview");
      setLearnScopeStatus(null);
    } catch {
      const kept = keepIndependentSurfaces(
        { lesson: lessonCacheRef.current, overview: previous, coach: messagesByMode.coach },
        { overview: previous }
      );
      overviewRef.current = kept.overview;
      setOverviewDoc(kept.overview);
      setOverviewPhase("error");
      setLearnScopeStatus("The overview could not refresh. The lesson and cursor were kept.");
    } finally {
      pendingRef.current.learn = false;
      setPending((current) => ({ ...current, learn: false }));
    }
  }

  async function coach(input: string, modeOverride?: ReplyMode, topicIdsOverride?: string[]) {
    const replying: ReplyMode = modeOverride ?? (chatMode === "learn" ? "ask" : "coach");
    const messageMode: ChatMode = replying === "ask" ? "learn" : "coach";
    const text = input.trim();
    if (!text || pendingRef.current[messageMode] || (messageMode === "coach" ? coaching.applying : coaching.learnApplying)) return;
    if (messageMode === "learn" && /\b(explain all topics|teach my selected topics)\b/i.test(text)) {
      void teachSelected(text);
      return;
    }
    setPrompts((current) => ({ ...current, [messageMode]: "" }));
    setErrors((current) => ({ ...current, [messageMode]: null }));
    pendingRef.current[messageMode] = true;
    setPending((current) => ({ ...current, [messageMode]: true }));
    const assistantId = crypto.randomUUID();
    const submittedGeneration = threadGeneration.current[messageMode];
    const submittedConversationId = messageMode === "coach" ? conversationId.current : askConversationId.current;
    requestIdByMode.current[messageMode] = assistantId;
    const isCurrentThread = () => threadGeneration.current[messageMode] === submittedGeneration && requestIdByMode.current[messageMode] === assistantId;
    // One UUID per submitted turn. It becomes the persisted user message's ID
    // and the identity of any learning evidence, so a resend of this same
    // turn is recognized server-side instead of being recorded twice.
    const interactionId = crypto.randomUUID();
    // Snapshot the conversation so far — before the new user turn and the
    // streaming placeholder are added — so the engine can dedupe a new
    // batch of practice questions against everything already asked.
    const priorHistory = messagesByMode[messageMode]
      .filter((message) => !message.streaming && message.kind !== "guide")
      .map((message) => ({ role: message.role, content: message.content }));
    const scopedTopicIds = topicIdsOverride ?? (activeTopicId(replying === "coach" ? coachTopicIds : learnTopicIds, cursorRef.current[messageMode]) ? [activeTopicId(replying === "coach" ? coachTopicIds : learnTopicIds, cursorRef.current[messageMode]) as string] : []);
    const scopedTopics = topics.filter((topic) => scopedTopicIds.includes(topic.id));
    setMessagesByMode((current) => ({
      ...current,
      [messageMode]: [
        ...current[messageMode],
        { id: interactionId, role: "user", content: text, mode: messageMode },
        { id: assistantId, role: "assistant", content: "", mode: messageMode, streaming: true }
      ]
    }));
    try {
      // The learner's question stays clean for retrieval; saved preferences
      // shape presentation only and never what gets searched for.
      const isFixture = roomId === "fixture";
      const endpoint = isFixture ? "/api/dev/coach" : "/api/chat";
      const scopeInstruction = scopedTopics.length
        ? `The learner selected these study topics: ${scopedTopics.map((topic) => `"${topic.title}"`).join(", ")}. If the question is ambiguous, read it in that scope. Still answer only from the retrieved excerpts.`
        : "Use the active Study Room topics only. Still answer only from the retrieved excerpts.";
      const fixtureDirectives = directivesForTurn(
        replying,
        coaching.applied,
        [{ name: "Current topics", instruction: scopeInstruction }],
        coaching.learnApplied
      );
      const body = isFixture
        ? JSON.stringify({ question: text, topics: scopedTopics.length ? scopedTopics : topics, history: priorHistory, directives: fixtureDirectives })
        : replying === "coach"
          ? JSON.stringify({ roomId, question: text, mode: "coach", surface: "coach", interactionId, conversationId: submittedConversationId, topicIds: scopedTopicIds })
          : JSON.stringify({ roomId, question: text, surface: "learn", conversationId: submittedConversationId, topicIds: scopedTopicIds });
      const response = await fetch(endpoint, { method: "POST", headers: operationHeaders(interactionId), body });
      if (response.status === 202 || response.status === 409 || !response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        const outcome = messageMode === "learn" ? readLearnOutcome(payload.outcome) : null;
        const view = outcome && learnOutcomeView(outcome);
        if (outcome && view && isCurrentThread()) {
          setMessagesByMode((current) => ({
            ...current,
            learn: current.learn.map((message) => message.id === assistantId
              ? { ...message, content: view.message, citations: [], grounded: false, streaming: false, outcome }
              : message)
          }));
          return;
        }
        throw new Error(payload.error || "Studigo could not coach that attempt.");
      }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true }); const frames = buffer.split("\n\n"); buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.trim(); if (!line.startsWith("data:")) continue;
          const event = JSON.parse(line.slice(5).trim()) as { type: string; text?: string; citations?: Citation[]; grounded?: boolean; conversationId?: string; error?: string; outcome?: unknown };
          if (!isCurrentThread()) continue;
          if (event.type === "start") { if (replying === "coach") conversationId.current = event.conversationId ?? null; else askConversationId.current = event.conversationId ?? null; }
          if (event.type === "delta" && event.text) setMessagesByMode((current) => ({
            ...current,
            [messageMode]: current[messageMode].map((message) => message.id === assistantId ? { ...message, content: message.content + event.text } : message)
          }));
          if (event.type === "done") {
            const outcome = messageMode === "learn" ? readLearnOutcome(event.outcome) : null;
            const view = outcome && learnOutcomeView(outcome);
            const unavailable = outcome && outcome.kind !== "ready" && outcome.kind !== "partial_coverage";
            setMessagesByMode((current) => ({
              ...current,
              [messageMode]: current[messageMode].map((message) => message.id === assistantId ? {
                ...message,
                content: unavailable && view ? view.message : event.text ?? message.content,
                citations: unavailable ? [] : event.citations,
                grounded: unavailable ? false : event.grounded,
                streaming: false,
                ...(outcome ? { outcome } : {})
              } : message)
            }));
          }
          if (event.type === "error") {
            const outcome = messageMode === "learn" ? readLearnOutcome(event.outcome) : null;
            const view = outcome && learnOutcomeView(outcome);
            if (outcome && view) {
              setMessagesByMode((current) => ({
                ...current,
                learn: current.learn.map((message) => message.id === assistantId
                  ? { ...message, content: view.message, citations: [], grounded: false, streaming: false, outcome }
                  : message)
              }));
            } else {
              throw new Error(event.error || "Studigo could not finish that coaching session.");
            }
          }
        }
      }
      // Refresh authoritative evidence after a completed turn; presentation stays unchanged.
      if (replying === "coach") onTopicsChanged();
    } catch (coachError) {
      if (isCurrentThread()) {
        setErrors((current) => ({ ...current, [messageMode]: coachError instanceof Error ? coachError.message : "Something went wrong." }));
        setMessagesByMode((current) => ({
          ...current,
          [messageMode]: current[messageMode].filter((message) => message.id !== assistantId)
        }));
      }
    }
    finally {
      if (isCurrentThread()) {
        requestIdByMode.current[messageMode] = null;
        pendingRef.current[messageMode] = false;
        setPending((current) => ({ ...current, [messageMode]: false }));
      }
    }
  }

  /** The "How Learn works" starter: answered locally with fixed copy, no model call. */
  function showLearnGuide(text: string) {
    if (pendingRef.current.learn) return;
    setErrors((current) => ({ ...current, learn: null }));
    setMessagesByMode((current) => ({
      ...current,
      learn: [
        ...current.learn,
        { id: crypto.randomUUID(), role: "user", content: text, mode: "learn", kind: "guide" },
        { id: crypto.randomUUID(), role: "assistant", content: LEARN_GUIDE_TEXT, mode: "learn", kind: "guide", grounded: false }
      ]
    }));
  }

  async function archiveCurrent() {
    const currentId = chatMode === "coach" ? conversationId.current : askConversationId.current;
    if (currentId && roomId !== "fixture") {
      const response = await fetch("/api/chat/clear", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId, conversationId: currentId, surface: chatMode })
      });
      if (!response.ok) return false;
    }
    if (chatMode === "coach") conversationId.current = null;
    else askConversationId.current = null;
    setMessagesByMode((current) => ({ ...current, [chatMode]: [] }));
    setPrompts((current) => ({ ...current, [chatMode]: "" }));
    resetThreadIdentity(chatMode);
    return true;
  }

  async function startFresh() {
    if (pendingRef.current[chatMode]) return;
    const label = chatMode === "coach" ? "Coach" : "Learn";
    if (!window.confirm(`Earlier ${label} chats stay stored. Mastery is kept. This only starts a new ${label} chat.`)) return;
    if (!await archiveCurrent()) setErrors((current) => ({ ...current, [chatMode]: "Could not start a fresh chat." }));
  }

  async function goToNextTopic() {
    if (pendingRef.current[chatMode]) return;
    const result = nextTopic({ orderedIds: activeTopicIds, index: cursors[chatMode], knownIds: topics.map((topic) => topic.id) });
    const setStatus = chatMode === "coach" ? setCoachScopeStatus : setLearnScopeStatus;
    if (result.status === "last") { setStatus("This is the last topic."); return; }
    if (result.status === "choose_more") { setStatus("Choose more topics."); return; }
    if (result.status === "removed") { setStatus("That topic was removed from this room."); return; }
    const pendingChallenge = chatMode === "coach" && messages.at(-1)?.role === "assistant";
    const left = leavePendingChallenge({
      pending: Boolean(pendingChallenge),
      confirmed: pendingChallenge ? window.confirm("Leave this challenge unanswered? It will not be graded.") : true,
      mastery: 0
    });
    if (!left.advanced || left.graded) return;
    const next = { ...cursorRef.current, [chatMode]: result.index };
    cursorRef.current = next;
    setCursors(next);
    if (chatMode === "learn") setLearnView("lesson");
    if (!await archiveCurrent()) return;
    const topic = topics.find((item) => item.id === result.topicId);
    if (!topic || chatMode === "learn") return;
    void coach(`Coach me through: ${topic.title}. ${topic.objective ?? "Start with a quick diagnostic."}`, "coach", [topic.id]);
  }

  function coachTopic(topic: Topic) {
    setCoachTopicIds([topic.id]);
    setTopicDraftIds([topic.id]);
    conversationId.current = null;
    resetThreadIdentity("coach");
    switchChatMode("coach");
    onViewChange("chat");
    void coach(`Coach me through: ${topic.title}. ${topic.objective ?? "Start with a quick diagnostic."}`, "coach", [topic.id]);
  }

  async function applySurfaceSettings() {
    if (pendingRef.current[chatMode]) return;
    if (chatMode === "coach") {
      const ok = await coaching.apply(draft);
      if (ok) { conversationId.current = null; resetThreadIdentity("coach"); }
      return;
    }
    const ok = await coaching.applyLearn(learnDraft);
    if (ok) { askConversationId.current = null; resetThreadIdentity("learn"); }
  }

  function applyTopicScope() {
    const ordered = topics.filter((topic) => topicDraftIds.includes(topic.id)).map((topic) => topic.id);
    if (!ordered.length) return;
    const count = ordered.length === topics.length ? "all topics" : `${ordered.length} topic${ordered.length === 1 ? "" : "s"}`;
    if (chatMode === "coach") {
      setCoachTopicIds(ordered);
      conversationId.current = null;
      resetThreadIdentity("coach");
      setCoachScopeStatus(`Applied ${count} to Coach. Learn topics were not changed.`);
    } else {
      setLearnTopicIds(ordered);
      askConversationId.current = null;
      resetThreadIdentity("learn");
      setLearnScopeStatus(`Applied ${count} to Learn. Coach topics were not changed.`);
    }
    const reset = { ...cursorRef.current, [chatMode]: 0 };
    cursorRef.current = reset;
    setCursors(reset);
    setSkillPickerOpen(false);
    onViewChange("chat");
  }

  if (readyCount === 0 && chatMode === "coach") return <div className="modeEmpty"><h3>Nothing to coach from yet.</h3><p>Upload a study guide, worksheet, notes, or slides first. The coach only teaches from this room&apos;s materials.</p><button className="buttonPrimary" type="button" onClick={onOpenMaterials}>Add materials <span aria-hidden="true">→</span></button><button className="ghostButton" type="button" onClick={() => { switchChatMode("learn"); onViewChange("chat"); }}>Open Learn</button></div>;

  // Chat stays the conversation view. Topics is now the topic-scope control itself,
  // so there is no second green topic dropdown competing with it.
  const contextControls = (
    <div className="coachTabs" role="group" aria-label="Coach sections and topic scope">
      <button type="button" aria-pressed={view === "chat" && !skillPickerOpen} onClick={() => onViewChange("chat")}>Chat</button>
      <button type="button" aria-pressed={skillPickerOpen || view === "topics"} aria-haspopup="dialog" aria-expanded={skillPickerOpen} onClick={openTopicPicker}>
        Topics{topics.length > 0 && <span className="coachTabCount">{activeTopicIds.length}/{topics.length}</span>}
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
          <button type="button" data-tone="coach" aria-pressed={chatMode === "coach"} aria-label={`Coach, practice, ${coachTopicTitle}`} onClick={() => switchChatMode("coach")}>
            <strong>Coach</strong><small>Practice and apply</small>
          </button>
          <button type="button" data-tone="ask" aria-pressed={chatMode === "learn"} aria-label={`Learn, ${learnLabel ?? "lesson"}, ${learnTopicTitle}`} onClick={() => switchChatMode("learn")}>
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
          <LearnPanel embedded roomId={roomId} topics={focusTopicId ? topics.filter((topic) => topic.id === focusTopicId) : topics} hasMaterials={readyCount > 0} onChanged={onTopicsChanged} onCoachTopic={coachTopic} onOpenMaterials={onOpenMaterials} lessonCursor={learnLabel ? { index: cursors.learn, count: learnTopicIds.length, title: learnTopicTitle } : null} />
        </div>
      ) : (
      <div className="coachBody">
      <div className="coachMain">
      {readyCount > 0 && (() => { const material = MATERIAL_NOTES[selectedTopic.title]; return material ? <section className="coachMaterial" aria-label={`Study material for ${selectedTopic.title}`}><div><span className="tinyLabel">FROM YOUR STUDY GUIDE</span><h3>{selectedTopic.title}</h3><p>{material.summary}</p></div><div className="coachMaterialExample"><span>EXAMPLE</span><p>{material.example}</p><small>{material.source}</small></div></section> : null; })()}
      <section className="coachChat" data-chat-mode={chatMode} aria-label="Conversation with Studigo">
      {skillPickerOpen && <button className="coachSetupBackdrop" type="button" aria-label="Close skill picker" onClick={() => setSkillPickerOpen(false)} />}
      {skillPickerOpen && (
        <section className="coachSkillSheet" role="dialog" aria-modal="true" aria-labelledby="coach-skill-sheet-title">
          <div className="coachSettingsSheetHead">
            <div><span className="tinyLabel">{chatMode === "coach" ? "COACH TOPIC SCOPE" : "LEARN TOPIC SCOPE"}</span><strong id="coach-skill-sheet-title">Choose one or more topics</strong></div>
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
            <button type="button" className="buttonPrimary" disabled={!topicDraftIds.length} onClick={applyTopicScope}>{chatMode === "coach" ? "Apply to Coach" : "Apply to Learn"}</button>
          </div>
        </section>
      )}
      {personalizeOpen && <button className="coachSetupBackdrop" type="button" aria-label="Close Coach personalization" onClick={() => setPersonalizeOpen(false)} />}
      <section
        id="coach-personalization"
        className={personalizeOpen ? "coachSettings mobileOpen" : "coachSettings"}
        aria-label={chatMode === "coach" ? "Personalize coaching" : "Personalize learning"}
        role={personalizeOpen ? "dialog" : undefined}
        aria-modal={personalizeOpen ? true : undefined}
      >
        <div className="coachSettingsSheetHead">
          <div><span className="tinyLabel">{chatMode === "coach" ? "COACH SETUP" : "LEARN SETUP"}</span><strong>{chatMode === "coach" ? "How should Studigo coach you?" : "How should Studigo explain things?"}</strong></div>
          <button type="button" onClick={() => setPersonalizeOpen(false)}>Done</button>
        </div>
        {chatMode === "coach" ? (
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
        ) : (
          <>
            <div className="coachExpect" aria-live="polite">
              <span className="tinyLabel">{learnDirty ? "AFTER YOU APPLY" : "IN USE NOW"}</span>
              <strong>{learnDraftMode.label}</strong>
              <p>{learnDraftMode.expect}</p>
            </div>
            <div>
              <span className="tinyLabel">LEARN MODE</span>
              <div className="coachStyleGrid coachModeGrid" aria-label="Choose a learning mode">
                {LEARN_MODE_OPTIONS.map((option) => <button key={option.id} type="button" aria-pressed={option.id === learnDraftMode.mode} disabled={coaching.learnApplying} className={option.id === learnDraftMode.mode ? "coachStyle active" : "coachStyle"} onClick={() => setLearnDraft({ mode: option.id })}><strong>{option.name}</strong><span>{option.expect}</span></button>)}
              </div>
            </div>
          </>
        )}
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
        {!personalizeOpen && activeScopeStatus && <p className="coachPreferenceStatus" role="status">{activeScopeStatus}</p>}
        {view === "chat" && !personalizeOpen && (
          <button type="button" className="coachActiveStyle" onClick={openSetup} aria-label={chatMode === "coach" ? `Coaching: ${active.label}. Change` : `Learning: ${learnActive.label}. Change`}>
            <span>{chatMode === "coach" ? "Coaching" : "Learning"}</span>
            <strong>{chatMode === "coach" ? active.label : learnActive.label}</strong>
          </button>
        )}
        <LessonMobileFrame
          mode={chatMode}
          label={learnLabel}
          topicTitle={chatMode === "learn" ? learnTopicTitle : coachTopicTitle}
          text={chatMode !== "learn" ? null : showingOverview ? (overviewDoc?.text ?? null) : (cursorLesson?.text ?? null)}
          citations={chatMode === "learn" && !showingOverview ? (cursorLesson?.citations ?? []) : []}
          status={chatMode !== "learn" ? null : showingOverview
            ? (overviewPhase === "loading" ? "Opening the unit overview…" : overviewPhase === "error" ? "The overview could not refresh. The lesson and cursor were kept." : null)
            : (lessonPhase === "loading" && !cursorLesson ? "Reading your materials…" : lessonPhase === "loading" ? "Checking this lesson again…" : lessonPhase === "error" ? "This lesson could not refresh. The last lesson is still here." : null)}
          onRetry={chatMode !== "learn" ? undefined : showingOverview && overviewPhase === "error"
            ? () => void teachSelected("Teach my selected topics")
            : !showingOverview && lessonPhase === "error"
              ? () => { const topic = topics.find((item) => item.id === learnCursorId); if (topic) void loadCursorLesson(topic, "retry"); }
              : undefined}
          onClear={() => void startFresh()}
          onNext={() => void goToNextTopic()}
          actionsDisabled={busy}
          threadRef={threadRef}
          onScroll={(event) => { scrollPositions.current[chatMode] = event.currentTarget.scrollTop; }}
        >
        {showingOverview && <button className="ghostButton" type="button" onClick={() => setLearnView("lesson")}>Show this lesson</button>}
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
          ) : cursorLesson || showingOverview ? null : (
            <div className="coachEmpty">
              <strong>Understand it.</strong>
              <p>Learn answers from your materials and shows the page it came from. The lesson stays put while you ask a follow-up. Then switch to Coach to practice it.</p>
              <p className="coachEmptyStyle"><b>{learnActive.label}:</b> {learnActive.expect}</p>
            </div>
          )
        ) : messages.map((message, index) => {
          if (message.role === "user") return <div className="studentBubble" key={message.id}>{message.content}</div>;
          const outcomeView = message.outcome && learnOutcomeView(message.outcome);
          const priorQuestion = messages.slice(0, index).reverse().find((turn) => turn.role === "user")?.content;
          return (
            <div className="answerBubble" key={message.id} data-mode={message.mode ?? "coach"} data-state={coachMaterialState({ content: message.content, grounded: message.grounded, streaming: message.streaming })}>
              <span className="answerKicker"><StudigoMascot state={message.streaming ? "thinking" : "sources"} size={28} mark />{answerLabel(message)}</span>
              <div className="answerText"><RichText text={message.content} />{message.streaming && <span className="caret" aria-hidden="true" />}</div>
              {message.citations && <div className="lessonCitations"><CitationChips citations={message.citations} /></div>}
              {outcomeView && message.outcome?.kind === "partial_coverage" && <p className="formNotice" role="status">{outcomeView.message}</p>}
              {outcomeView?.action === "materials" && <button className="ghostButton" type="button" onClick={onOpenMaterials}>Open Materials</button>}
              {outcomeView?.action === "see_topics" && <button className="ghostButton" type="button" onClick={() => onViewChange("topics")}>See topics</button>}
              {outcomeView?.action === "retry" && priorQuestion && <button className="ghostButton" type="button" onClick={() => setPrompts((current) => ({ ...current, learn: priorQuestion }))}>Edit and retry</button>}
            </div>
          );
        })}
        </LessonMobileFrame>
        {chatMode === "learn" && <div className="chatChips" aria-label="Learn starters">{learnStarters(selectedTopic.title).map((starter) => <button key={starter.id} type="button" disabled={busy} onClick={() => starter.local ? showLearnGuide(starter.text) : void coach(starter.text)}>{starter.label}</button>)}<button type="button" disabled={busy} onClick={() => void teachSelected("Teach my selected topics")}>Teach my selected topics</button></div>}
        {chatMode === "coach" && messages.length > 0 && <div className="chatChips" aria-label="Coach controls">{COACH_CONTROL_COMMANDS.map((command) => <button key={command.label} type="button" disabled={busy} onClick={() => void coach(command.text)}>{command.label}</button>)}</div>}
        {error && <p className="formError chatError" role="alert">{error}</p>}
        <StudigoComposer
          variant="chat"
          accent={chatMode === "learn" ? "learn" : undefined}
          placeholder={chatMode === "learn" ? "Ask about your materials" : "Answer, or message your coach"}
          value={prompt}
          onChange={(value) => setPrompts((current) => ({ ...current, [chatMode]: value }))}
          onSubmit={() => void coach(prompt)}
          disabled={busy}
          ariaLabel={chatMode === "learn" ? `Message Learn about ${learnTopicTitle}` : `Message Coach about ${coachTopicTitle}`}
        />
      </section>
      </div>
      <CoachAside topics={topics} areas={areas} selectedTitle={selectedTopic.title} onSelect={(topic) => {
        if (chatMode === "coach") {
          setCoachTopicIds([topic.id]);
          conversationId.current = null;
          resetThreadIdentity("coach");
        } else {
          setLearnTopicIds([topic.id]);
          askConversationId.current = null;
          resetThreadIdentity("learn");
        }
      }} onAllTopics={openTopicPicker} />
      </div>
      )}
    </div>
    </>
  );
}


