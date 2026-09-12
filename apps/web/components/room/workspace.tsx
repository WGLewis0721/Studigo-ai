"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomReadiness, StudyDocument, StudyRoom, Topic } from "@/lib/rooms";
import { MaterialsPanel } from "./materials-panel";
import { AskPanel } from "./ask-panel";
import { LearnPanel } from "./learn-panel";
import { QuizPanel } from "./quiz-panel";
import { CardsPanel } from "./cards-panel";
import { MasteryPanel } from "./mastery-panel";
import { RoomSettings } from "./room-settings";

const MODES = [
  { id: "materials", icon: "◫", name: "Materials", copy: "Everything this room knows." },
  { id: "ask", icon: "?", name: "Ask", copy: "Explain anything from your materials." },
  { id: "learn", icon: "✦", name: "Learn", copy: "Walk the guide in the right order." },
  { id: "quiz", icon: "✓", name: "Quiz", copy: "Practice exactly what is testable." },
  { id: "cards", icon: "▤", name: "Flashcards", copy: "Drill the terms until they stick." },
  { id: "mastery", icon: "↗", name: "Mastery", copy: "Find weak spots before test day." }
] as const;

type Mode = (typeof MODES)[number]["id"];

export function RoomWorkspace({
  room,
  documents,
  topics,
  readiness,
  initialMode
}: {
  room: StudyRoom;
  documents: StudyDocument[];
  topics: Topic[];
  readiness: RoomReadiness;
  initialMode?: string;
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

  return (
    <div className="roomWorkspace">
      <header className="workspaceTopbar">
        <div>
          <span className="crumb">
            {[room.subject, room.course_name].filter(Boolean).join(" / ").toUpperCase() ||
              "STUDY ROOM"}
          </span>
          <strong>{room.title}</strong>
        </div>
        <div className="topbarRight">
          <span className="sourceCount">
            {readyDocuments.length} of {documents.length}{" "}
            {documents.length === 1 ? "source" : "sources"} ready
          </span>
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

      <nav className="modeDock roomModes" aria-label="Study modes">
        {MODES.map((item) => (
          <button
            className={`modeItem ${mode === item.id ? "modeItemActive" : ""}`}
            type="button"
            key={item.id}
            onClick={() => setMode(item.id)}
            aria-current={mode === item.id}
          >
            <span className="modeIcon" aria-hidden="true">
              {item.icon}
            </span>
            <span>
              <strong>{item.name}</strong>
              <small>{item.copy}</small>
            </span>
          </button>
        ))}
      </nav>

      <div className="modeSurface">
        {mode === "materials" && (
          <MaterialsPanel roomId={room.id} documents={documents} onChanged={refresh} />
        )}
        {mode === "ask" && (
          <AskPanel roomId={room.id} readyCount={readyDocuments.length} onOpenMaterials={() => setMode("materials")} />
        )}
        {mode === "learn" && (
          <LearnPanel
            roomId={room.id}
            topics={topics}
            hasMaterials={readyDocuments.length > 0}
            onChanged={refresh}
          />
        )}
        {mode === "quiz" && (
          <QuizPanel
            roomId={room.id}
            topics={topics}
            hasMaterials={readyDocuments.length > 0}
            initialTopicId={focusTopicId}
            onGraded={refresh}
          />
        )}
        {mode === "cards" && (
          <CardsPanel
            roomId={room.id}
            topics={topics}
            hasMaterials={readyDocuments.length > 0}
            onReviewed={refresh}
          />
        )}
        {mode === "mastery" && (
          <MasteryPanel
            topics={topics}
            readiness={readiness}
            onPractice={(topicId) => {
              setFocusTopicId(topicId);
              setMode("quiz");
            }}
          />
        )}
      </div>
    </div>
  );
}
