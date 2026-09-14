import { notFound } from 'next/navigation';
import { RoomWorkspace } from '@/components/room/workspace';
import type { Topic } from '@/lib/rooms';

// Explicit local-only visual fixture. Production always returns 404.
export default async function StudyFixture({searchParams}:{searchParams:Promise<{mode?:string;phone?:string}>}) {
  if(process.env.NODE_ENV!=='development'||process.env.STUDIGO_VISUAL_QA!=='1') notFound();
  const {mode='weak',phone}=await searchParams;
  if(phone) return <main style={{padding:16}}><p>Local visual fixture · 390px phone viewport</p><iframe title="Phone viewport" src={`/dev/study?mode=${encodeURIComponent(mode)}`} style={{width:390,height:850,border:'1px solid #172637'}}/></main>;
  const now=Date.parse('2026-09-12T12:00:00Z');
  const topics:Topic[]=[
    {id:'tornado',title:'Tornado formation',mastery_score:42,status:'learning',priority:100,last_practiced_at:'2026-09-08T12:00:00Z'},
    {id:'radar',title:'Reading Doppler radar',mastery_score:0,status:'not_started',priority:90,last_practiced_at:null},
    {id:'instruments',title:'Weather instruments',mastery_score:92,status:'mastered',priority:70,last_practiced_at:'2026-09-12T10:00:00Z'},
    {id:'clouds',title:'Cloud types',mastery_score:63,status:'learning',priority:60,last_practiced_at:'2026-09-11T12:00:00Z'}
  ].map((t,i)=>({...t,room_id:'fixture',objective:`Explain ${t.title.toLowerCase()}`,key_terms:[],order_index:i,origin:'study_guide',learner_edited:false})) as Topic[];
  return <main style={{maxWidth:1180,margin:'24px auto',padding:'0 16px'}}><p className="hintText">LOCAL VISUAL FIXTURE · Synthetic evidence · Saving and AI require a configured project</p>
    <RoomWorkspace initialMode={mode} room={{id:'fixture',title:'Atmosphere & severe weather',subject:'Earth science',course_name:'Unit 4',test_date:'2026-09-18',created_at:new Date(now).toISOString(),updated_at:new Date(now).toISOString()}}
      topics={topics} documents={[{id:'source',room_id:'fixture',name:'Unit 4 study guide.pdf',mime_type:'application/pdf',size_bytes:1000,source_type:'study_guide',status:'ready',error_message:null,page_count:4,page_label:'Page',ocr_page_count:0,chunk_count:8,created_at:new Date(now).toISOString()}]}
      readiness={{readiness:49,averageMastery:66,topicCount:4,practicedTopicCount:3,masteredCount:1,questionsAnswered:12,correctAnswers:8,cardsDue:6}}
      evidence={[0,0,100].map((score,i)=>({topic_id:'tornado',source:'quiz' as const,score,is_correct:score===100,created_at:`2026-09-08T12:0${i}:00Z`}))} planEvents={[]} asOf={now}/>
  </main>;
}
