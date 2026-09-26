"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomReadiness, StudyDocument, StudyRoom, Topic } from "@/lib/rooms";
import { MaterialsPanel } from "./materials-panel";
import { AskPanel } from "./ask-panel";
import { CoachPanel } from "./coach-panel";
import { LearnPanel } from "./learn-panel";
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
import { ModeGlyph } from "@/components/mode-glyph";
import { roomShellFor } from "@/lib/room-shell";

// Each mode's id doubles as its color tone (see [data-tone] in globals.css):
// Learn blueberry, Ask/Materials teal, Coach/Cram tangerine, Quiz dandelion,
// Flashcards grape, Practice test graphite, Mastery kiwi, Weak areas berry,
// Study plan indigo.
const MODES = [
  { id: "materials", name: "Materials", copy: "Everything this room knows." },
  { id: "ask", name: "Ask", copy: "Explain anything from your materials." },
  { id: "coach", name: "Coach", copy: "Practice with the right method." },
  { id: "learn", name: "Learn", copy: "Walk the guide in the right order." },
  { id: "quiz", name: "Quiz", copy: "Practice exactly what is testable." },
  { id: "cards", name: "Flashcards", copy: "Drill the terms until they stick." },
  { id: "weak", name: "Weak areas", copy: "Where to focus next." },
  { id: "test", name: "Practice test", copy: "Rehearse the whole test." },
  { id: "plan", name: "Study plan", copy: "A little each day." },
  { id: "cram", name: "Cram mode", copy: "Make limited time count." },
  { id: "mastery", name: "Mastery", copy: "Find weak spots before test day." }
] as const;

type Mode = (typeof MODES)[number]["id"];

const GROUPS: Array<{name:string;modes:Mode[]}> = [
  {name:"Study",modes:["learn","ask","coach"]},
  {name:"Practice",modes:["quiz","cards","test"]},
  {name:"Progress",modes:["mastery","weak"]},
  {name:"Plan",modes:["plan","cram"]},
  {name:"Materials",modes:["materials"]}
];

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
  const readyDocuments = documents.filter((document) => document.status === "ready");
  const defaultMode: Mode = readyDocuments.length ? "ask" : "materials";
  const [mode, setMode] = useState<Mode>(
    MODES.some((item) => item.id === initialMode) ? (initialMode as Mode) : defaultMode
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusTopicId, setFocusTopicId] = useState<string | null>(null);

  const refresh = () => router.refresh();
  const areas = rankWeakAreas(topics, evidence, asOf);
  const calibration = summarizeCalibration(evidence);
  const plan = buildStudyPlan({ topics, areas, testDate: room.test_date, cardsDue: readiness.cardsDue, events: planEvents, now: asOf });
  const currentGroup = GROUPS.find(group => group.modes.includes(mode)) ?? GROUPS[0];
  const [cramStarted, setCramStarted] = useState(initialMode === "cram");
  function navigate(nextMode: Mode, topicId: string | null = null) {
    setFocusTopicId(topicId);
    setMode(nextMode);
    if (nextMode === "cram") setCramStarted(true);
    window.history.replaceState(null, "", `${window.location.pathname}?mode=${nextMode}`);
  }
  function startPlannedAction(action: StudyAction) { navigate(action.mode, action.topicId); }


  return (
    <div className="roomDevice" data-shell={roomShellFor(room.id)}>
    <div className="roomWorkspace" data-tone={mode}>
      <header className="workspaceTopbar">
        <div className="workspaceTitle">
          <i className="roomGem roomGemLarge" data-tone={roomShellFor(room.id)} aria-hidden="true" />
          <div>
            <span className="crumb">
              {[room.subject, room.course_name].filter(Boolean).join(" / ").toUpperCase() ||
                "STUDY ROOM"}
            </span>
            <strong>{room.title}</strong>
          </div>
        </div>
        <div className="topbarRight">
          <span className="sourceCount">
            {readyDocuments.length} of {documents.length}{" "}
            {documents.length === 1 ? "source" : "sources"} ready
          </span>
          <StudyGuideDownloadButton roomId={room.id} />
          <button
            className="iconButton"
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-expanded={settingsOpen}
            aria-label="Room settings"
          >
            •••
          </button>
        </div>
      </header>

      {settingsOpen && <RoomSettings room={room} onClose={() => setSettingsOpen(false)} />}

      <div className="studyNavigation">
        <nav className="studyGroups" aria-label="Study Room sections">
          {GROUPS.map(group => <button key={group.name} type="button" aria-current={currentGroup.name===group.name?"page":undefined} onClick={()=>navigate(group.modes[0])}>{group.name}</button>)}
        </nav>
        <nav className="studySubnav" aria-label={`${currentGroup.name} modes`}>
          {MODES.filter(item=>currentGroup.modes.includes(item.id)).map(item=><button key={item.id} type="button" data-tone={item.id} title={item.copy} aria-current={mode===item.id?"page":undefined} onClick={()=>navigate(item.id)}><span className="keycap"><ModeGlyph name={item.id} /></span>{item.name}</button>)}
        </nav>
      </div>

      <div className="modeSurface">
        {mode === "materials" && (
          <MaterialsPanel roomId={room.id} documents={documents} onChanged={refresh} />
        )}
        {mode === "ask" && (
          <AskPanel roomId={room.id} readyCount={readyDocuments.length} onOpenMaterials={() => setMode("materials")} />
        )}
        {mode === "coach" && (
          <CoachPanel roomId={room.id} readyCount={readyDocuments.length} topics={topics} onOpenMaterials={() => setMode("materials")} />
        )}
        {mode === "learn" && (
          <LearnPanel
            roomId={room.id}
            topics={focusTopicId ? topics.filter(t=>t.id===focusTopicId) : topics}
            hasMaterials={readyDocuments.length > 0}
            onChanged={refresh}
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
        {mode === "test" && <PracticeTestPanel roomId={room.id} topicCount={topics.length} onGraded={refresh} onReviewTopic={id=>navigate("learn",id)}/>}
        {mode === "plan" && <StudyPlanPanel roomId={room.id} days={plan} testDate={room.test_date} onStart={startPlannedAction} onChanged={refresh} onSetDate={()=>setSettingsOpen(true)}/>}
        {(mode === "cram" || cramStarted) && <div hidden={mode!=="cram"}><CramPanel roomId={room.id} topics={topics} areas={areas} testDate={room.test_date} onChanged={refresh}/></div>}

      </div>
    </div>
    </div>
  );
}
