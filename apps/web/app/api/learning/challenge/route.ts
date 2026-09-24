import { requireApiUser } from '@/lib/auth';
import { ACTIVITIES, LEARNING_ROUTES, nextChallenge, type LearningActivity, type LearningRoute } from '@/lib/learning';
import { loadConceptLearningState } from '@/lib/learning/persistence';

export const runtime = 'nodejs';

/** Read-only director boundary. Clients choose route/activity, never learner state. */
export async function GET(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const query = new URL(request.url).searchParams;
  const roomId = query.get('roomId');
  const topicId = query.get('topicId');
  const activity = query.get('activity') ?? 'coach';
  const route = query.get('route') ?? 'studigo_default';
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!roomId || !topicId || !uuid.test(roomId) || !uuid.test(topicId)
    || !ACTIVITIES.includes(activity as LearningActivity) || !LEARNING_ROUTES.includes(route as LearningRoute)) {
    return Response.json({ error: 'Choose a valid room, concept, activity and route.' }, { status: 400 });
  }
  const { data: topic, error } = await supabase.from('topics').select('id,title,objective')
    .eq('id', topicId).eq('room_id', roomId).eq('owner_id', user.id).eq('active', true).maybeSingle();
  if (error) return Response.json({ error: 'Could not load the concept.' }, { status: 503 });
  if (!topic) return Response.json({ error: 'Concept not found.' }, { status: 404 });
  try {
    const key = { userId: user.id, roomId, topicId };
    const { state, events } = await loadConceptLearningState(supabase, key);
    const challenge = nextChallenge({ concept: { ...key, objective: topic.objective || topic.title },
      learnerState: state, recentEvents: [...events].sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt) || a.id.localeCompare(b.id)).slice(0,12),
      activity: activity as LearningActivity, route: route as LearningRoute, now: new Date().toISOString() });
    return Response.json({ challenge, evidence: { independentSuccesses: state.independentSuccessCount,
      transferSuccesses: state.successfulTransferCount, recoveries: state.recoveryCount,
      mastery: state.masteryEvidence, signals: state.signals, rematch: state.rematch } },
    { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'Learning history is unavailable. Please retry.' }, { status: 503 });
  }
}
