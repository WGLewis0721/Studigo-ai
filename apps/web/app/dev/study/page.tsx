import { notFound } from 'next/navigation';
import { RoomWorkspace } from '@/components/room/workspace';
import { AppShell } from '@/components/app-shell';
import type { Topic } from '@/lib/rooms';
import type { StudyGuideContent } from '@studigo/ai';

const fixtureGuide: StudyGuideContent = {
  version: 1, schemaVersion: 1, promptVersion: 1, level: 'standard', roomId: 'fixture', topicIds: ['instinct-learned'], sourceSnapshot: 'fixture-synthetic',
  chapters: [{ id: 'behavior', title: 'How animals respond', objective: 'Compare learned and inherited behaviors', objectiveEvidence: [{blockKey:'fixture-passage',pageNumber:3}],
    facts: [{id:'fact',text:'Some animal behaviors are inherited, while others are learned through experience.',evidence:[{blockKey:'fixture-passage',pageNumber:3}]}],
    terms: [{id:'instinct',term:'Instinct',definition:'A behavior an animal is born knowing how to do.',evidence:[{blockKey:'fixture-passage',pageNumber:3}]}],
    examples: [], practice: [{id:'question',prompt:'How is an instinct different from a learned behavior?',answerId:'answer',evidence:[{blockKey:'fixture-passage',pageNumber:3}]}],
    answers: [{id:'answer',questionId:'question',text:'An instinct is inherited; a learned behavior develops through experience.',evidence:[{blockKey:'fixture-passage',pageNumber:3}]}]
  }]
};

// Synthetic visual fixture for local development and Vercel PR previews only.
// This route is unavailable on production deployments.
export default async function StudyFixture({searchParams}:{searchParams:Promise<{mode?:string;phone?:string;bare?:string;shell?:string;rail?:string;frame?:string;materials?:string}>}) {
  if (process.env.NODE_ENV !== 'development' && process.env.VERCEL_ENV !== 'preview') notFound();
  const {mode='coach',phone,bare,shell,rail,frame,materials}=await searchParams;
  if(phone) return <main style={{padding:16}}><p>Local visual fixture · 390px phone viewport</p><iframe title="Phone viewport" src={`/dev/study?mode=${encodeURIComponent(mode)}&bare=1${frame==='phase3'?'&frame=phase3':''}${materials==='phase3'?'&materials=phase3':''}`} style={{width:390,height:850,border:'1px solid #172637'}}/></main>;
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
  const workspace=<RoomWorkspace initialMode={mode} phase3Frame={frame==='phase3'} phase3Materials={materials==='phase3'} materialsPreviewEdition={materials==='phase3'?fixtureGuide:undefined} room={{id:'fixture',title:'Fifth Grade Science · Year-at-a-Glance',subject:'Life, physical & earth science',course_name:'2022–2023 scope and sequence',test_date:'2026-09-18',explain_level:'standard',created_at:new Date(now).toISOString(),updated_at:new Date(now).toISOString()}}
      topics={topics} documents={[{id:'source',room_id:'fixture',name:'2022–2023 Fifth Grade Science study guide.pdf',mime_type:'application/pdf',size_bytes:1000,source_type:'study_guide',status:'ready',error_message:null,page_count:12,page_label:'Page',ocr_page_count:0,chunk_count:24,created_at:new Date(now).toISOString()}]}
      readiness={{readiness:49,averageMastery:66,topicCount:4,practicedTopicCount:3,masteredCount:1,questionsAnswered:12,correctAnswers:8,cardsDue:6}}
      evidence={[0,0,100].map((score,i)=>({topic_id:'tornado',source:'quiz' as const,score,is_correct:score===100,created_at:`2026-09-08T12:0${i}:00Z`}))} planEvents={[]} asOf={now}/>;
  // ?bare=1 mounts the room inside the same shell as the signed-in app (no fixture chrome), for phone checks.
  // ?shell=1 mounts the room inside the real sidebar (with sample rooms); ?rail=collapsed starts it collapsed.
  if(shell) return <AppShell initialCollapsed={rail==='collapsed'} rooms={[{id:'fixture',title:'Fifth Grade Science'},{id:'algebra',title:'Algebra I'},{id:'history',title:'US History: Reconstruction'}]} profile={{initials:'WL',label:'william@example.com'}}>{workspace}</AppShell>;
  if(bare) return <div className="appShell"><div className="appMain">{workspace}</div></div>;
  return <main style={{maxWidth:1180,margin:'24px auto',padding:'0 16px'}}><p className="hintText">VISUAL REVIEW FIXTURE · Synthetic materials and guide · Source, Coach and file actions are unavailable in a deployed preview</p>{workspace}</main>;
}
