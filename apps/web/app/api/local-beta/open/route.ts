import { randomUUID } from 'node:crypto';
import { localBetaAllowed } from '@/lib/local-beta-access';
export const runtime='nodejs';
export async function GET(request:Request) {
  if(!localBetaAllowed(request))return new Response(null,{status:404});
  const id=request.headers.get('cookie')?.match(/(?:^|;\s*)studigo_beta=([a-f0-9-]{36})(?:;|$)/)?.[1]??randomUUID();
  return new Response(null,{status:303,headers:{Location:'/app','Set-Cookie':'studigo_beta='+id+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800','Cache-Control':'no-store'}});
}
