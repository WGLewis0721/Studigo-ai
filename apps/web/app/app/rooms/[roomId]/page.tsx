import type { Metadata } from "next";
import { loadStudyEvidence } from "@/lib/study-evidence";
import { requireUser } from "@/lib/auth";
import { getRoom, getRoomReadiness, listDocuments, listTopics } from "@/lib/rooms";
import { RoomWorkspace } from "@/components/room/workspace";

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
  searchParams: Promise<{ mode?: string }>;
}) {
  await requireUser();
  const { roomId } = await params;
  const { mode } = await searchParams;

  const room = await getRoom(roomId);
  const [documents, topics, readiness, studyEvidence] = await Promise.all([
    listDocuments(roomId),
    listTopics(roomId),
    getRoomReadiness(roomId),
    loadStudyEvidence(roomId)
  ]);

  return (
    <RoomWorkspace
      room={room}
      phase3Frame={(process.env.PHASE3_ROOM0_ROOM_IDS ?? "").split(",").map((id) => id.trim()).includes(room.id)}
      phase3Materials={(process.env.PHASE3_ROOM1_ROOM_IDS ?? "").split(",").map((id) => id.trim()).includes(room.id)}
      documents={documents}
      topics={topics}
      readiness={readiness}
      initialMode={mode}
      {...studyEvidence}
    />
  );
}
