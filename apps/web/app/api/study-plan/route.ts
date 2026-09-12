import { requireApiUser } from '@/lib/auth';
import { parseTestDate } from '@/lib/validation';
export async function POST(request: Request) {
  const {supabase,user,unauthorized}=await requireApiUser(); if(!user) return unauthorized;
  const body=await request.json().catch(()=>null);
  if(typeof body?.roomId!=='string'||typeof body?.actionKey!=='string'||body.actionKey.length>180||!['completed','skipped'].includes(body?.status)) return Response.json({error:'Invalid plan update.'},{status:400});
  try { if(!parseTestDate(body.day)) throw new Error(); } catch { return Response.json({error:'Choose a valid plan date.'},{status:400}); }
  const {error}=await supabase.from('study_plan_events').upsert({room_id:body.roomId,owner_id:user.id,plan_day:body.day,action_key:body.actionKey,status:body.status,updated_at:new Date().toISOString()});
  if(error) return Response.json({error:'Plan update did not save.'},{status:500});
  return Response.json({saved:true});
}
