import { type SessionPlan } from '@studigo/learning';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type SessionOperation={roomId:string;sessionId:string;requestId:string;expectedRevision:number;action:'start'|'recommend'|'select'|'end';mode:SessionPlan['mode'];minutes:SessionPlan['budgetMinutes'];selectedTopicId:string|null};
export function sessionOperation(value:unknown):SessionOperation {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid session request');
  const v=value as Record<string,unknown>;
  const allowed=['roomId','sessionId','requestId','expectedRevision','action','mode','minutes','selectedTopicId'];
  if(Object.keys(v).some(k=>!allowed.includes(k))||!['roomId','sessionId','requestId'].every(k=>typeof v[k]==='string'&&uuid.test(v[k] as string))
    ||!Number.isSafeInteger(v.expectedRevision)||Number(v.expectedRevision)<0||!['start','recommend','select','end'].includes(String(v.action))
    ||!['study','cram'].includes(String(v.mode))||![15,30,60,120].includes(Number(v.minutes))||typeof v.minutes!=='number'
    ||(v.selectedTopicId!=null&&(typeof v.selectedTopicId!=='string'||!uuid.test(v.selectedTopicId)))
    ||(!['start','select'].includes(String(v.action))&&v.selectedTopicId!=null))throw new Error('Invalid session request');
  return {...v,roomId:(v.roomId as string).toLowerCase(),sessionId:(v.sessionId as string).toLowerCase(),requestId:(v.requestId as string).toLowerCase(),
    selectedTopicId:typeof v.selectedTopicId==='string'?v.selectedTopicId.toLowerCase():null} as SessionOperation;
}
export function validSessionId(value:string|null):value is string {return value!==null&&uuid.test(value);}
export async function readSessionBody(request:Request):Promise<unknown> {
  if(Number(request.headers.get('content-length')??0)>4096)throw new RangeError('Request too large');
  if(!request.body)throw new Error('Missing request');
  const reader=request.body.getReader(),decoder=new TextDecoder();let size=0,text='';
  try {
    while(true) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;if(size>4096){await reader.cancel();throw new RangeError('Request too large');}
      text+=decoder.decode(value,{stream:true});
    }
    return JSON.parse(text+decoder.decode());
  }finally {reader.releaseLock();}
}
