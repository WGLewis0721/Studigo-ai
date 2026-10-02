import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CreateRoomForm } from "@/components/create-room-form";
import { FirstRoomSetup, HomeHero } from "@/components/app-home";
import { RoomCardLink } from "@/components/room-card-link";
import { buildHomeNext, pickFocusRoom } from "@/lib/home-next";
import { rankWeakAreas } from "@/lib/study-planning";
import type { Topic } from "@/lib/rooms";

// Synthetic fixture for the app's Home and first-run setup. Local development only.
// ?first=1 shows the first-run setup; nothing is created.
export default async function HomeFixture({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { first } = await searchParams;
  const now = Date.now();
  const inDays = (days: number) => new Date(now + days * 86_400_000).toISOString();
  const rooms = [
    { id: "fixture", title: "Fifth Grade Science", subject: "Science", course_name: "Period 3", test_date: inDays(6), updated_at: inDays(-1), document_count: 2 },
    { id: "history", title: "US History: Reconstruction", subject: "History", course_name: null, test_date: inDays(12), updated_at: inDays(-2), document_count: 3 },
    { id: "algebra", title: "Algebra I", subject: "Math", course_name: null, test_date: null, updated_at: inDays(-4), document_count: 1 }
  ];
  const topics = [
    { id: "a", title: "Inherited traits and environment", mastery_score: 0, status: "not_started", priority: 95, last_practiced_at: null },
    { id: "b", title: "Instinctive and learned behaviors", mastery_score: 42, status: "learning", priority: 100, last_practiced_at: inDays(-3) },
    { id: "c", title: "Variables that affect dissolving", mastery_score: 92, status: "mastered", priority: 70, last_practiced_at: inDays(-1) }
  ].map((topic, index) => ({ ...topic, room_id: "fixture", objective: null, key_terms: [], order_index: index, origin: "study_guide", learner_edited: false })) as Topic[];
  const focus = pickFocusRoom(rooms, now)!;
  const next = buildHomeNext(focus, rankWeakAreas(topics, [], now), { topicCount: 3, practicedTopicCount: 2, masteredCount: 1 }, now);

  return (
    <AppShell initialCollapsed={false} rooms={rooms.map(({ id, title }) => ({ id, title }))} profile={{ initials: "WL", label: "fixture@example.com" }}>
      <div className="pageWrap">
        <p className="hintText">LOCAL VISUAL FIXTURE · Synthetic rooms · Nothing here is saved</p>
        {first ? <FirstRoomSetup fixture /> : (
          <>
            <HomeHero next={next} />
            <div className="roomsHeading"><div><span className="tinyLabel">YOUR STUDY ROOMS</span><h2>Each room holds one test.</h2></div></div>
            <div className="roomsLayout">
              <section className="roomsGrid" aria-label="Study rooms">
                {rooms.map((room) => (
                  <RoomCardLink key={room.id} roomId={room.id} href="/dev/study?mode=coach&shell=1">
                    <span className="roomCardMeta">{room.subject}</span>
                    <strong>{room.title}</strong>
                    <div className="roomCardFooter"><span>{room.document_count} sources</span></div>
                  </RoomCardLink>
                ))}
              </section>
              <CreateRoomForm />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
