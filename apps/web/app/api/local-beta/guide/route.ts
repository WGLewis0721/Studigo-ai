import { buildStudyGuidePdf } from '@/lib/study-guide-pdf';
import { FIXTURE_ROOMS } from '@/lib/beta-fixtures';
import { localBetaAllowed } from '@/lib/local-beta-access';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (!localBetaAllowed(request)) return new Response(null, { status: 404 });
  const room = FIXTURE_ROOMS.find(r => r.id === new URL(request.url).searchParams.get('roomId'));
  if (!room) return Response.json({ error: 'Choose a synthetic demo room.' }, { status: 400 });
  const pdf = buildStudyGuidePdf({ title: room.title, subject: room.subject, topics: room.topics.map(t => ({
    title: t.title, objective: t.objective, keyTerms: [],
    sourceNotes: [{ text: t.source, documentName: room.title + ' synthetic study guide', pageNumber: t.page }]
  })) });
  return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf',
    'Content-Disposition': 'attachment; filename="Studigo-Demo-Study-Guide.pdf"', 'Cache-Control': 'private, no-store' } });
}
