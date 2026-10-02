"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RoomReadiness, StudyDocument, StudyRoom, Topic } from "@/lib/rooms";
import { MaterialsPanel } from "./materials-panel";
import { CoachPanel } from "./coach-panel";
import { QuizPanel } from "./quiz-panel";
import { CardsPanel } from "./cards-panel";
import { MasteryPanel } from "./mastery-panel";
import { WeakAreasPanel } from "./weak-areas-panel";
import { PracticeTestPanel } from "./practice-test-panel";
import { CramPanel } from "./cram-panel";
import { StudyPlanPanel } from "./study-plan-panel";
import { rankWeakAreas, summarizeCalibration, buildStudyPlan, type PracticeEvidence, type PlanEvent, type StudyAction } from "@/lib/study-planning";
import { RoomSettings } from "./room-settings";
import { StudyGuideDownloadButton } from "./study-guide-download-button";
import { ModeGlyph, type GlyphName } from "@/components/mode-glyph";
import { useRoomTheme } from "@/lib/room-theme";
import { HeaderSlots, ModeHeader } from "./mode-header";
import { useCollapsingTabBar } from "./use-collapsing-tab-bar";
import type { MascotState } from "@/components/studigo-mascot";
import { useCoachPreferences } from "./use-coach-preferences";
import { CompanionContext, useCompanionWindow } from "@/components/companion/companion";

// Each mode's id doubles as its color tone (see [data-tone] in globals.css):
// Learn blueberry, Ask/Materials teal, Coach/Cram tangerine, Quiz dandelion,
// Flashcards grape, Practice test graphite, Mastery kiwi, Weak areas berry,
// Study plan indigo.
const MODES = [
  { id: "materials", name: "Materials", copy: "Everything this room knows.", sub: "Your files" },
  { id: "coach", name: "Coach", copy: "Ask, learn and practice in one place.", sub: "Practice and apply" },
  { id: "quiz", name: "Quiz", copy: "Practice exactly what is testable.", sub: "5 questions" },
  { id: "cards", name: "Flashcards", copy: "Drill the terms until they stick.", sub: "Drill terms", short: "Cards" },
  { id: "weak", name: "Weak areas", copy: "Where to focus next.", sub: "Focus next" },
  { id: "test", name: "Practice test", copy: "Rehearse the whole test.", sub: "Full length", short: "Test" },
  { id: "plan", name: "Study plan", copy: "A little each day.", sub: "Day by day", short: "Plan" },
  { id: "cram", name: "Cram mode", copy: "Make limited time count.", sub: "Short on time", short: "Cram" },
  { id: "mastery", name: "Mastery", copy: "Find weak spots before test day.", sub: "How ready" }
] as const;

type Mode = (typeof MODES)[number]["id"];

/** The header's switch has narrow segments, so a few modes use a shorter name there. */
const headerName = (item: (typeof MODES)[number]) => ("short" in item ? item.short : item.name);

/** Ask and Learn now live inside Coach; older links and plan actions still resolve. */
type NavTarget = Mode | "ask" | "learn";

// Each page (group) has one color. It shows on the Studigo rail under the page header
// and on the page's dot in the selector, so you can tell which of the five you are on.
const GROUPS: Array<{name:string;icon:GlyphName;tone:string;modes:Mode[]}> = [
  {name:"Coach",icon:"coach",tone:"coach",modes:["coach"]},
  {name:"Practice",icon:"quiz",tone:"quiz",modes:["quiz","cards","test"]},
  {name:"Progress",icon:"mastery",tone:"mastery",modes:["mastery","weak"]},
  {name:"Plan",icon:"plan",tone:"plan",modes:["plan","cram"]},
  {name:"Materials",icon:"materials",tone:"materials",modes:["materials"]}
];

/** The five pages. Wide screens show it in the top bar beside the room title; phones get the bottom tab bar. */
function SectionNav({ current, onSelect, className, navRef }: { current: string; onSelect: (mode: Mode) => void; className?: string; navRef?: RefObject<HTMLElement | null> }) {
  return (
    <nav ref={navRef} className={className ? `studyGroups ${className}` : "studyGroups"} aria-label="Study Room sections">
      {GROUPS.map((group) => (
        <button key={group.name} type="button" data-tone={group.tone} aria-current={current === group.name ? "page" : undefined} onClick={() => onSelect(group.modes[0])}>
          <span className="studyGroupIcon" aria-hidden="true"><ModeGlyph name={group.icon} size={24} /></span>
          <span className="studyGroupLabel">{group.name}</span>
        </button>
      ))}
    </nav>
  );
}

export function RoomWorkspace({
  room,
  documents,
  topics,
  readiness,
  initialMode,
  evidence, planEvents, asOf
}: {
  room: StudyRoom;
  documents: StudyDocument[];
  topics: Topic[];
  readiness: RoomReadiness;
  initialMode?: string;
  evidence: PracticeEvidence[];
  planEvents: PlanEvent[];
  asOf: number;
}) {
  const router = useRouter();
  const coaching = useCoachPreferences(room);
  const readyDocuments = documents.filter((document) => document.status === "ready");
  const defaultMode: Mode = readyDocuments.length ? "coach" : "materials";
  const [mode, setMode] = useState<Mode>(
    MODES.some((item) => item.id === initialMode) ? (initialMode as Mode) : initialMode === "ask" || initialMode === "learn" ? "coach" : defaultMode
  );
  const [coachView, setCoachView] = useState<"chat" | "topics">(initialMode === "learn" ? "topics" : "chat");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const closeTimer = useRef(0);
  const surfaceRef = useRef<HTMLDivElement>(null);
  // The menu eases back up before it unmounts (wide screens only; phones close it at once).
  const closeSettings = useCallback(() => {
    if (closeTimer.current) return;
    const eased = window.matchMedia("(min-width: 701px) and (prefers-reduced-motion: no-preference)").matches;
    if (!eased) { setSettingsOpen(false); return; }
    setSettingsClosing(true);
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = 0;
      setSettingsOpen(false);
      setSettingsClosing(false);
    }, 190);
  }, []);
  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeSettings(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, closeSettings]);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  // On wide screens the page scrolls inside the room frame, so a new page (or Coach's
  // Chat/Topics switch) starts at the top instead of keeping the last page's scroll.
  useEffect(() => {
    if (surfaceRef.current) surfaceRef.current.scrollTop = 0;
  }, [mode, coachView]);
  const [theme] = useRoomTheme(room.id);
  const [chipHost, setChipHost] = useState<HTMLElement | null>(null);
  const [chipBarHost, setChipBarHost] = useState<HTMLElement | null>(null);
  const [mascotState, setMascotState] = useState<MascotState>("welcome");
  const slots = useMemo(() => ({ placement: "portal" as const, chipHost, chipBarHost, setMascot: setMascotState }), [chipHost, chipBarHost]);
  const [focusTopicId, setFocusTopicId] = useState<string | null>(null);

  const refresh = () => router.refresh();
  const areas = rankWeakAreas(topics, evidence, asOf);
  const calibration = summarizeCalibration(evidence);
  const plan = buildStudyPlan({ topics, areas, testDate: room.test_date, cardsDue: readiness.cardsDue, events: planEvents, now: asOf });
  const currentGroup = GROUPS.find(group => group.modes.includes(mode)) ?? GROUPS[0];
  const tabBarRef = useRef<HTMLElement>(null);
  useCollapsingTabBar(tabBarRef, mode);
  const currentMeta = MODES.find((item) => item.id === mode) ?? MODES[1];
  // The Coach chat draws its own header (its Coach/Learn switch and topic are chat state);
  // every other page shares the workspace header. Both end in the same Studigo rail.
  const coachFramed = mode === "coach" && readyDocuments.length > 0;
  const [cramStarted, setCramStarted] = useState(initialMode === "cram");
  // Studigo sits in his window on every page of the room, unless the learner sends him to his seat.
  const workspaceRef = useRef<HTMLDivElement>(null);
  const companion = useCompanionWindow({ roomId: room.id, workspaceRef, tone: mode });
  const { thinking: companionThinking } = companion.api;
  useEffect(() => { companionThinking(mascotState === "thinking"); }, [mascotState, companionThinking]);
  function navigate(target: NavTarget, topicId: string | null = null) {
    const nextMode: Mode = target === "ask" || target === "learn" ? "coach" : target;
    if (target === "learn") setCoachView("topics");
    if (target === "ask") setCoachView("chat");
    setFocusTopicId(topicId);
    setMode(nextMode);
    if (nextMode === "cram") setCramStarted(true);
    window.history.replaceState(null, "", `${window.location.pathname}?mode=${target}`);
  }
  function startPlannedAction(action: StudyAction) { navigate(action.mode, action.topicId); }


  return (
    <div className="roomDevice" data-shell={theme} data-tone={theme}>
    <div className="roomWorkspace" data-tone={mode} ref={workspaceRef}>
      <div className="topbarWrap">
      <header className="workspaceTopbar">
        <Link className="roomBackButton" href="/app" aria-label="All rooms">
          <span aria-hidden="true">‹</span>
        </Link>
        <div className="workspaceTitle roomTitleBlock">
          <i className="roomGem roomGemLarge" data-tone={theme} aria-hidden="true" />
          <div>
            <span className="crumb">
              {[room.subject, room.course_name].filter(Boolean).join(" / ").toUpperCase() ||
                "STUDY ROOM"}
            </span>
            <strong title={room.title}>{room.title}</strong>
          </div>
        </div>
        <SectionNav className="topbarNav" current={currentGroup.name} onSelect={(next) => navigate(next)} />
        <div className="topbarRight">
          <span className="sourceCount">
            {readyDocuments.length} of {documents.length}{" "}
            {documents.length === 1 ? "source" : "sources"} ready
          </span>
          <StudyGuideDownloadButton roomId={room.id} />
          <button
            className="iconButton"
            type="button"
            onClick={() => (settingsOpen ? closeSettings() : setSettingsOpen(true))}
            aria-expanded={settingsOpen && !settingsClosing}
            aria-label="Room settings"
          >
            •••
          </button>
        </div>
      </header>

      {settingsOpen && <button className="roomSettingsBackdrop" type="button" aria-label="Close room settings" onClick={closeSettings} />}
      {settingsOpen && <RoomSettings room={room} onClose={closeSettings} closing={settingsClosing} />}
      </div>

      <div className="studyNavigation">
        <SectionNav navRef={tabBarRef} current={currentGroup.name} onSelect={(next) => navigate(next)} />
      </div>

      {!coachFramed && (
        <ModeHeader
          groupName={currentGroup.name}
          frameTone={currentGroup.tone}
          modes={currentGroup.modes.map((id) => MODES.find((item) => item.id === id)!).map((item) => ({ id: item.id, name: headerName(item), sub: item.sub }))}
          current={mode}
          onSelect={(id) => navigate(id as Mode)}
          title={currentMeta.name}
          sub={currentMeta.copy}
          mascot={mascotState}
          chipRef={setChipHost}
          chipBarRef={setChipBarHost}
        />
      )}

      <CompanionContext.Provider value={companion.api}>
      <HeaderSlots.Provider value={slots}>
      <div ref={surfaceRef} className={coachFramed ? "modeSurface modeSurfaceFramed" : "modeSurface"}>
        {mode === "materials" && (
          <MaterialsPanel roomId={room.id} documents={documents} onChanged={refresh} />
        )}
        {mode === "coach" && (
          <CoachPanel
            coaching={coaching}
            roomId={room.id}
            readyCount={readyDocuments.length}
            topics={topics}
            areas={areas}
            onOpenMaterials={() => setMode("materials")}
            view={coachView}
            onViewChange={setCoachView}
            focusTopicId={focusTopicId}
            onClearFocus={() => setFocusTopicId(null)}
            onTopicsChanged={refresh}
          />
        )}
        {mode === "quiz" && (
          <QuizPanel key={focusTopicId ?? "all"}
            roomId={room.id}
            topics={topics}
            hasMaterials={readyDocuments.length > 0}
            initialTopicId={focusTopicId}
            onGraded={refresh}
          />
        )}
        {mode === "cards" && (
          <CardsPanel key={focusTopicId ?? "all"}
            initialTopicId={focusTopicId}
            roomId={room.id}
            topics={topics}
            hasMaterials={readyDocuments.length > 0}
            onReviewed={refresh}
          />
        )}
        {mode === "mastery" && (
          <MasteryPanel
            calibration={calibration}
            topics={topics}
            readiness={readiness}
            areas={areas}
            onPractice={(topicId) => {
              navigate("quiz", topicId);
            }}
          />
        )}
        {mode === "weak" && <WeakAreasPanel areas={areas} onStudy={(next,id)=>navigate(next,id)}/>}
        {mode === "test" && <PracticeTestPanel roomId={room.id} topicCount={topics.length} topics={topics} onGraded={refresh} onReviewTopic={id=>navigate("learn",id)}/>}
        {mode === "plan" && <StudyPlanPanel roomId={room.id} days={plan} testDate={room.test_date} onStart={startPlannedAction} onChanged={refresh} onSetDate={()=>setSettingsOpen(true)}/>}
        {(mode === "cram" || cramStarted) && <div hidden={mode!=="cram"}><CramPanel roomId={room.id} topics={topics} areas={areas} testDate={room.test_date} onChanged={refresh}/></div>}

      </div>
      </HeaderSlots.Provider>
      </CompanionContext.Provider>
      <div className="cmpHost" ref={companion.hostRef} />
    </div>
    </div>
  );
}
