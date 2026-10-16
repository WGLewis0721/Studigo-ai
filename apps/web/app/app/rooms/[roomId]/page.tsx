import type { Metadata } from "next";
import { loadStudyEvidence } from "@/lib/study-evidence";
import { requireUser } from "@/lib/auth";
import { getRoom, getRoomReadiness, listDocuments, listTopics } from "@/lib/rooms";
import { RoomWorkspace } from "@/components/room/workspace";
import { phase3UiEnabledForRoom, guidedLearnCanaryEnabledForRoom } from "@/lib/phase3-room-flag";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ roomId: string }>;
}): Promise<Metadata> {
  const { roomId } = await params;
  const room = await getRoom(roomId);
  return { title: `${room.title} · Studigo` };
}

export default async function RoomPage({
  params,
  searchParams
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ mode?: string; guided?: string }>;
}) {
  await requireUser();
  const { roomId } = await params;
  const { mode, guided } = await searchParams;

  const room = await getRoom(roomId);
  const [documents, topics, readiness, studyEvidence] = await Promise.all([
    listDocuments(roomId),
    listTopics(roomId),
    getRoomReadiness(roomId),
    loadStudyEvidence(roomId)
  ]);

  // Controlled owner-only inspection of the merged Guided Learn release.
  // Existing Learn remains default, and the mission API independently enforces
  // this same room allowlist and source/receipt admission.
  const phase3Learn = guidedLearnCanaryEnabledForRoom(
    room.id, guided, process.env.PHASE3_ROOM2_ROOM_IDS
  );
  const phase3FoundationUi = phase3UiEnabledForRoom(
    room.id,
    process.env.PHASE3_UI_ROOM_IDS,
    process.env.NEXT_PUBLIC_STUDIGO_PHASE3_FOUNDATION_UI === "1"
  );

  return (
    <RoomWorkspace
      room={room}
      documents={documents}
      topics={topics}
      readiness={readiness}
      initialMode={mode}
      phase3Learn={phase3Learn}
      phase3FoundationUi={phase3FoundationUi}
      {...studyEvidence}
    />
  );
}
