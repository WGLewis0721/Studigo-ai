import { randomUUID } from 'node:crypto';
import { betaStore, BetaError } from '@/lib/local-beta';
import { localBetaAllowed } from '@/lib/local-beta-access';
import { localSessionId } from '@/lib/local-beta-context';
import { integratedOperation, integratedDocuments } from '@/lib/integrated-beta';
import { buildStudyGuidePdf } from '@/lib/study-guide-pdf';

export const runtime='nodejs';
function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});}
async function handle(request:Request) {
  if(!localBetaAllowed(request)||request.headers.has('authorization'))return json({error:'Not found'},404);
  const id=localSessionId(request.headers.get('cookie')?.match(/(?:^|;\s*)studigo_beta=([^;]+)/)?.[1]);
  if(!id)return json({error:'Open the local beta first.'},401);
  const url=new URL(request.url),path=url.searchParams.get('_path')??'';
  const now=new Date().toISOString(),store=betaStore();
  try {
    if(request.method==='POST'&&path==='/documents/upload') {
      const form=await request.formData();const file=form.get('file');const roomId=String(form.get('roomId')??'');
      if(!(file instanceof File)||file.size>50000||!file.size||!/\.(?:txt|md|markdown)$/i.test(file.name))throw new BetaError('The credential-free beta accepts text/Markdown up to 50 KB. PDF, scans and Office parsing need the configured ingestion worker.',415);
      const prior=store.read(id);if(!prior.rooms[roomId])throw new BetaError('Study Room not found',404);
      const state=store.transact(id,'upload:'+randomUUID(),{roomId,name:file.name},state=>{
        state.currentRoomId=roomId;
        const text=String(form.get('sourceType')??'');if(!['study_guide','teacher_material','worksheet','presentation','student_notes','textbook','other'].includes(text))throw new BetaError('Invalid source type');
        const documentId=randomUUID();
        state.rooms[roomId].sources.push({id:documentId,name:file.name,text:'',page:1});
        return {state,response:{documentId}};
      });
      const text=await file.text();
      // Text parsing is bounded and lightweight. Never infer a grading rubric from an upload.
      const result=store.transact(id,'upload-content:'+state.documentId,{roomId,text},current=>{
        const room=current.rooms[roomId];const source=room.sources.find(s=>s.id===state.documentId)!;source.text=text;
        room.room.topics.push({id:state.documentId,title:file.name.replace(/\.(txt|md|markdown)$/i,''),objective:'Read this source.',priority:90,order:room.room.topics.length,active:true,documentId:state.documentId,page:1,source:text,explanations:{simpler:text,standard:text,deeper:text},tasks:{} as never});
        return {state:current,response:{document:integratedDocuments(current,roomId).find(d=>d.id===state.documentId)}};
      });return json(result);
    }
    const body:Record<string,unknown>=request.method==='GET'?Object.fromEntries([...url.searchParams].filter(([k])=>k!=='_path')):await request.json();
    if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>70000)throw new BetaError('Invalid request');
    if(path==='/documents/download'||path==='/study-guide/download') {
      const state=store.read(id);
      const room=path==='/study-guide/download'?state.rooms[String(body.roomId)]:Object.values(state.rooms).find(r=>r.sources.some(s=>s.id===body.documentId||s.id.startsWith(String(body.documentId)+':')));
      if(!room)throw new BetaError('Source not found',404);
      const selected=path==='/documents/download'?room.sources.filter(s=>s.id===body.documentId||s.id.startsWith(String(body.documentId)+':')):room.sources;
      if(path==='/documents/download') {
        return new Response(selected.map(s=>'Page '+s.page+'\n'+s.text).join('\n\n'),{headers:{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
      }
      const pdf=buildStudyGuidePdf({title:room.room.title,subject:room.room.subject,topics:room.room.topics.filter(t=>t.active&&t.source).map(t=>({title:t.title,objective:t.objective,keyTerms:[],sourceNotes:[{text:t.source,documentName:selected.find(s=>s.id===t.documentId||s.id===t.documentId+':'+t.page)?.name??room.room.title,pageNumber:t.page}]}))});
      return new Response(new Uint8Array(pdf),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Studigo-Study-Guide.pdf"','Cache-Control':'private, no-store'}});
    }
    if(path==='/documents/process') {
      const state=store.read(id);const room=Object.values(state.rooms).find(r=>r.sources.some(s=>s.id===body.documentId||s.id.startsWith(String(body.documentId)+':')));
      if(!room)throw new BetaError('Document not found',404);return json({status:'ready',chunkCount:1,topicsCreated:1});
    }
    if(/^\/documents\/[^/]+$/.test(path)&&request.method==='DELETE') {
      const documentId=path.split('/')[2];const response=store.transact(id,'delete:'+randomUUID(),{documentId},state=>{
        const room=Object.values(state.rooms).find(r=>r.sources.some(s=>s.id===documentId||s.id.startsWith(documentId+':')));
        if(!room)throw new BetaError('Document not found',404);
        room.sources=room.sources.filter(s=>s.id!==documentId&&!s.id.startsWith(documentId+':'));
        room.room.topics.filter(t=>t.documentId===documentId).forEach(t=>{t.active=false;});
        return {state,response:{deleted:true}};
      });return json(response);
    }
    const result=integratedOperation(store,id,path,request.method,body,now);
    if(path==='/chat') {
      const answer=result as {text:string;citations:unknown[];grounded:boolean;conversationId:null};
      return new Response('data: '+JSON.stringify({type:'start',conversationId:null})+'\n\ndata: '+JSON.stringify({type:'done',...answer})+'\n\n',{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'private, no-store'}});
    }
    return json(result);
  }catch(error){if(error instanceof BetaError)return json({error:error.message},error.status);if(error instanceof SyntaxError)return json({error:'Invalid JSON'},400);console.error('Integrated beta operation failed',{path,type:error instanceof Error?error.name:'unknown'});return json({error:'Could not finish this operation.'},500);}
}
export const GET=handle;export const POST=handle;export const PATCH=handle;export const DELETE=handle;
