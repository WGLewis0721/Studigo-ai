import { randomUUID } from 'node:crypto';
import { BetaError, betaStore, publicBetaState, type BetaAction } from '@/lib/local-beta';
import { localBetaAllowed } from '@/lib/local-beta-access';
export const runtime = 'nodejs';
function sessionId(request: Request) {
  const value = request.headers.get('cookie')?.match(/(?:^|;\s*)studigo_beta=([a-f0-9-]{36})(?:;|$)/)?.[1];
  return value && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value) ? value : randomUUID();
}
function response(data: unknown, id: string, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store',
    'Set-Cookie': 'studigo_beta=' + id + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800' } });
}
export async function GET(request: Request) {
  if (!localBetaAllowed(request)) return Response.json({ error: 'Local beta is disabled.' }, { status: 404 });
  const id = sessionId(request);
  return response(publicBetaState(betaStore().read(id), new Date().toISOString()), id);
}
export async function POST(request: Request) {
  if (!localBetaAllowed(request)) return Response.json({ error: 'Local beta is disabled.' }, { status: 404 });
  const id = sessionId(request);
  try {
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new BetaError('JSON required', 415);
    const raw = await request.text();
    if (raw.length > 60000) throw new BetaError('Request is too large', 413);
    const input = JSON.parse(raw) as BetaAction;
    if (!input || typeof input !== 'object' || !/^[a-f0-9-]{36}$/.test(input.interactionId ?? '')
      || !Number.isSafeInteger(input.revision) || input.revision < 0) throw new BetaError('Invalid interaction');
    const now = new Date().toISOString();
    return response(publicBetaState(betaStore().commit(id, input, now), now), id);
  } catch (error) {
    if (error instanceof BetaError) return response({ error: error.message }, id, error.status);
    if (error instanceof SyntaxError) return response({ error: 'Invalid JSON' }, id, 400);
    console.error('Local beta request failed', { type: error instanceof Error ? error.name : 'unknown' });
    return response({ error: 'Could not save your session. Retry the same interaction.' }, id, 500);
  }
}
