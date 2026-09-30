import type { Metadata } from "next";
import { listRooms } from "@/lib/rooms";
import { CreateRoomForm } from "@/components/create-room-form";
import { StudigoMascot } from "@/components/studigo-mascot";
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

export default async function RoomsPage() {
  const rooms = await listRooms();

  return (
    <div className="pageWrap">
      <header className="pageHeader">
        <div>
          <span className="tinyLabel">YOUR STUDY ROOMS</span>
          <h1 className="pageTitle">What are you studying for?</h1>
          <p className="pageLede">
            Each Study Room holds one test&apos;s worth of material — and gets its own color.
          </p>
        </div>
      </header>

      <div className="roomsLayout">
        <section className="roomsGrid" aria-label="Study rooms">
          {rooms.length === 0 && (
            <div className="firstRun" data-tone="tangerine">
              <StudigoMascot state="welcome" size={96} />
              <div>
                <h2>Let&apos;s set up your first Study Room.</h2>
                <p>
                  Create one for the next thing you&apos;re tested on — “Biology Midterm”, “Weather
                  Unit”, “ELA Week 4” — then drop the study guide in.
                </p>
                <ol className="firstRunSteps">
                  <li><b>01</b>Name the room for your next test</li>
                  <li><b>02</b>Add the study guide, notes and slides</li>
                  <li><b>03</b>Learn, quiz, and see what you know</li>
                </ol>
              </div>
            </div>
          )}

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
