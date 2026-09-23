import { RoomWorkspace } from '@/components/room/workspace';
import type { Topic } from '@/lib/rooms';

// TEMP testing surface: synthetic-fixture coach with no account, no Supabase,
// and no persistence. Exposed in production so the coach can be tested without
// signing in (mirrors the temporary guest bypass). Revert to a dev-only 404 to
// re-lock it. Try it at /dev/study?mode=coach.
export default async function StudyFixture({searchParams}:{searchParams:Promise<{mode?:string;phone?:string}>}) {
  const {mode='coach',phone}=await searchParams;
  if(phone) return <main style={{padding:16}}><p>Local visual fixture · 390px phone viewport</p><iframe title="Phone viewport" src={`/dev/study?mode=${encodeURIComponent(mode)}`} style={{width:390,height:850,border:'1px solid #172637'}}/></main>;
  const now=Date.parse('2026-09-12T12:00:00Z');
  const topics:Topic[]=[
    {id:'instinct-learned',title:'Instinctive and learned behaviors',mastery_score:42,status:'learning',priority:100,last_practiced_at:'2026-09-08T12:00:00Z'},
    {id:'inherited-environment',title:'Inherited traits and environment',mastery_score:0,status:'not_started',priority:95,last_practiced_at:null},
    {id:'variation-survival',title:'Variation and survival advantages',mastery_score:35,status:'learning',priority:90,last_practiced_at:'2026-09-11T12:00:00Z'},
    {id:'fossils-rock-layers',title:'Fossils and rock layers',mastery_score:63,status:'learning',priority:80,last_practiced_at:'2026-09-11T12:00:00Z'},
    {id:'phase-changes',title:'Phase changes and conservation of matter',mastery_score:0,status:'not_started',priority:75,last_practiced_at:null},
    {id:'dissolving',title:'Variables that affect dissolving',mastery_score:92,status:'mastered',priority:70,last_practiced_at:'2026-09-12T10:00:00Z'},
    {id:'solar-system',title:'Solar system objects and motion',mastery_score:63,status:'learning',priority:60,last_practiced_at:'2026-09-11T12:00:00Z'},
    {id:'forces',title:'Balanced and unbalanced forces',mastery_score:25,status:'learning',priority:55,last_practiced_at:'2026-09-10T12:00:00Z'}
  ].map((t,i)=>({...t,room_id:'fixture',objective:`I can explain and apply ${t.title.toLowerCase()} using evidence from the study guide.`,key_terms:[],order_index:i,origin:'study_guide',learner_edited:false})) as Topic[];
  return <main style={{maxWidth:1180,margin:'24px auto',padding:'0 16px'}}><p className="hintText">LOCAL VISUAL FIXTURE · Synthetic evidence · Saving and AI require a configured project</p>
    <RoomWorkspace initialMode={mode} room={{id:'fixture',title:'Fifth Grade Science · Year-at-a-Glance',subject:'Life, physical & earth science',course_name:'2022–2023 scope and sequence',test_date:'2026-09-18',explain_level:'standard',created_at:new Date(now).toISOString(),updated_at:new Date(now).toISOString()}}
      topics={topics} documents={[{id:'source',room_id:'fixture',name:'2022–2023 Fifth Grade Science study guide.pdf',mime_type:'application/pdf',size_bytes:1000,source_type:'study_guide',status:'ready',error_message:null,page_count:12,page_label:'Page',ocr_page_count:0,chunk_count:24,created_at:new Date(now).toISOString()}]}
      readiness={{readiness:49,averageMastery:66,topicCount:4,practicedTopicCount:3,masteredCount:1,questionsAnswered:12,correctAnswers:8,cardsDue:6}}
      evidence={[0,0,100].map((score,i)=>({topic_id:'tornado',source:'quiz' as const,score,is_correct:score===100,created_at:`2026-09-08T12:0${i}:00Z`}))} planEvents={[]} asOf={now}/>
  </main>;
}
