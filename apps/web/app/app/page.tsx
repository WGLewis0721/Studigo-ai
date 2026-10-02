import type { Metadata } from "next";
import { getRoomReadiness, listRooms, listTopics } from "@/lib/rooms";
import { loadStudyEvidence } from "@/lib/study-evidence";
import { rankWeakAreas } from "@/lib/study-planning";
import { buildHomeNext, pickFocusRoom, type HomeNext } from "@/lib/home-next";
import { CreateRoomForm } from "@/components/create-room-form";
import { FirstRoomSetup, HomeHero } from "@/components/app-home";
import { RoomCardLink } from "@/components/room-card-link";

export const metadata: Metadata = { title: "Study rooms · Studigo" };
export const dynamic = "force-dynamic";

function formatTestDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  const label = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (days < 0) return `Test was ${label}`;
  if (days === 0) return "Test is today";
  return `${days} day${days === 1 ? "" : "s"} to ${label}`;
}

/** What Home leads with, from the focus room's real state. If that cannot be read, Home still says which room is next. */
async function loadNext(rooms: Awaited<ReturnType<typeof listRooms>>): Promise<HomeNext | null> {
  const now = Date.now();
  const room = pickFocusRoom(rooms, now);
  if (!room) return null;
  try {
    const [topics, readiness, study] = await Promise.all([listTopics(room.id), getRoomReadiness(room.id), loadStudyEvidence(room.id)]);
    return buildHomeNext(room, rankWeakAreas(topics, study.evidence, study.asOf), readiness, now);
  } catch {
    return buildHomeNext(room, [], { topicCount: 0, practicedTopicCount: 0, masteredCount: 0 }, now);
  }
}

export default async function RoomsPage() {
  const rooms = await listRooms();

  if (rooms.length === 0) {
    return (
      <div className="pageWrap">
        <FirstRoomSetup />
      </div>
    );
  }

  const next = await loadNext(rooms);

  return (
    <div className="pageWrap">
      {next && <HomeHero next={next} />}

      <div className="roomsHeading">
        <div>
          <span className="tinyLabel">YOUR STUDY ROOMS</span>
          <h2>Each room holds one test.</h2>
        </div>
      </div>

      <div className="roomsLayout">
        <section className="roomsGrid" aria-label="Study rooms">
          {rooms.map((room) => {
            const testLabel = formatTestDate(room.test_date);
            return (
              <RoomCardLink key={room.id} roomId={room.id} href={`/app/rooms/${room.id}`}>
                <span className="roomCardMeta">
                  {[room.subject, room.course_name].filter(Boolean).join(" · ") || "STUDY ROOM"}
                </span>
                <strong>{room.title}</strong>
                <div className="roomCardFooter">
                  <span>
                    {room.document_count} {room.document_count === 1 ? "source" : "sources"}
                  </span>
                  {testLabel && <b>{testLabel}</b>}
                </div>
              </RoomCardLink>
            );
          })}
        </section>

        <CreateRoomForm />
      </div>
    </div>
  );
}
