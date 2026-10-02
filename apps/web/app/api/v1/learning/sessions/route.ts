import { requireApiUser } from '@/lib/auth';
import { assertRoomAccess } from '@/lib/retrieval';
import { createServiceSupabaseClient } from '@/lib/supabase/service';
import { sessionOperation,validSessionId,readSessionBody } from '@/lib/durable-session-policy';
import { readDurableSession,operateDurableSession } from '@/lib/learning/durable-session';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request) {
  if(process.env.STUDIGO_DURABLE_SESSIONS!=='1')return Response.json({error:'Sessions unavailable'},{status:404});
  const {supabase,user,unauthorized}=await requireApiUser();if(!user)return unauthorized;
  const q=new URL(request.url).searchParams,roomId=q.get('roomId'),sessionId=q.get('sessionId');
  if(!validSessionId(roomId)||!validSessionId(sessionId))return Response.json({error:'Invalid session scope'},{status:400});
  if(!await assertRoomAccess(supabase,roomId))return Response.json({error:'Study Room not found'},{status:404});
  try {
    const result=await readDurableSession(createServiceSupabaseClient(),user.id,roomId,sessionId);
    return result.session?Response.json({schemaVersion:1,...result},{headers}):Response.json({error:'Session not found'},{status:404});
  }catch{return Response.json({error:'Session unavailable'},{status:503});}
}
export async function POST(request:Request) {
  if(process.env.STUDIGO_DURABLE_SESSIONS!=='1')return Response.json({error:'Sessions unavailable'},{status:404});
  const {supabase,user,unauthorized}=await requireApiUser();if(!user)return unauthorized;
  let op;
  try {
    op=sessionOperation(await readSessionBody(request));
  }catch(error){return Response.json({error:'Invalid session request'},{status:error instanceof RangeError?413:400});}
  if(!await assertRoomAccess(supabase,op.roomId))return Response.json({error:'Study Room not found'},{status:404});
  try {return Response.json({schemaVersion:1,session:await operateDurableSession(supabase,createServiceSupabaseClient(),user.id,op)},{headers});}
  catch(error) {
    const code=(error as {code?:string}).code;
    const status=code==='40001'?409:code==='P0002'?404:code==='22023'?400:code==='42501'?404:503;
    return Response.json({error:status===409?'Session changed. Resume before retrying.':'Session operation unavailable'},{status});
  }
}
