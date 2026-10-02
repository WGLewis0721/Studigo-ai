import { randomUUID,createHash } from 'node:crypto';
import { projectConcept, migrateCoachMode } from '@studigo/learning';
import { applyBetaAction, BetaError, issue, record, gradeFixture, type LocalBetaState, type Encounter, type LocalBetaStore } from './local-beta';
import { canonicalCoachPreferences, validCoachPreferences, type CoachPreferences } from './coach-preferences';
import { normalizeLearnPreferences, validLearnPreferences, type LearnPreferences } from './learn-preferences';
import type { StudyRoom, Topic, StudyDocument, RoomReadiness } from './rooms';
import type { PracticeEvidence, PlanEvent } from './study-planning';

type Answer = { selectedChoice: number|null; response: string };
type StoredQuestion = { encounter: Encounter; graded?: Record<string,unknown> };
type StoredTest = { id:string; roomId:string; status:'draft'|'submitted'; created_at:string;
  questionIds:string[]; draft_answers:Record<string,Answer>; result:Record<string,unknown>|null };
type StoredCard = { id:string; roomId:string; topicId:string; front:string; back:string; repetitions:number; dueAt:string; learner_edited:boolean };
type Integration = { questions:Record<string,StoredQuestion>; tests:Record<string,StoredTest>;
  cards:Record<string,StoredCard>; preferences:Record<string,CoachPreferences>; learnPreferences:Record<string,LearnPreferences>;
  plan:Record<string,PlanEvent[]>; activeBatch:string[]|null };
type State = LocalBetaState & { integration?: Integration };
function extras(state:State):Integration {
  const data=state.integration ??= {questions:{},tests:{},cards:{},preferences:{},learnPreferences:{},plan:{},activeBatch:null};
  data.learnPreferences??={};return data;
}
function roomOf(state:LocalBetaState,id:string) {
  const room=state.rooms[id]; if(!room)throw new BetaError('Study Room not found',404); return room;
}
function citation(state:LocalBetaState,roomId:string,topicId:string) {
  const room=roomOf(state,roomId); const t=room.room.topics.find(t=>t.id===topicId&&t.active);
  if(!t)throw new BetaError('Topic is unavailable',404);
  return [{marker:1,documentId:t.documentId,documentName:room.sources.find(s=>s.id===t.documentId||s.id.startsWith(t.documentId+':'))?.name??room.room.title+' study guide',pageNumber:t.page,pageLabel:'Page',sourceType:'study_guide'}];
}
export function integratedRooms(state:State):Array<StudyRoom&{document_count:number}> {
  return Object.values(state.rooms).map(r=>({id:r.room.id,title:r.room.title,subject:r.room.subject,course_name:(r as typeof r&{courseName?:string}).courseName??'Synthetic local beta',test_date:(r as typeof r&{testDate?:string}).testDate??null,
    explain_level:r.explainLevel,coach_preferences:extras(state).preferences[r.room.id],learn_preferences:extras(state).learnPreferences[r.room.id],
    created_at:'2026-10-01T00:00:00Z',updated_at:r.events.at(-1)?.createdAt??'2026-10-01T00:00:00Z',document_count:new Set(r.sources.map(s=>s.id.replace(/:\d+$/,''))).size}));
}
export function integratedTopics(state:State,roomId:string):Topic[] {
  const room=roomOf(state,roomId);
  return room.room.topics.filter(t=>t.active).map(t=>{
    const events=room.events.filter(e=>e.topicId===t.id);
    const projection=projectConcept({userId:'synthetic-local-learner',roomId,topicId:t.id},events);
    // Compatibility adapter for the unchanged main UI. The evidence stage remains authoritative.
    const score=projection.stage==='transfer'?100:projection.stage==='independent'?60:projection.stage==='practicing'?25:0;
    return {id:t.id,room_id:roomId,title:t.title,objective:t.objective,key_terms:[],priority:t.priority,order_index:t.order,origin:'study_guide',mastery_score:score,
      status:projection.stage==='transfer'?'mastered':events.length?'learning':'not_started',last_practiced_at:projection.state.lastPracticedAt,learner_edited:false};
  });
}
export function integratedDocuments(state:State,roomId:string):StudyDocument[] {
  const room=roomOf(state,roomId);
  return [...new Set(room.sources.map(s=>s.id.replace(/:\d+$/,'')))].map(id=>({id,room_id:roomId,name:room.sources.find(s=>s.id===id||s.id.startsWith(id+':'))!.name,mime_type:'text/plain',size_bytes:room.sources.filter(s=>s.id===id||s.id.startsWith(id+':')).reduce((n,s)=>n+Buffer.byteLength(s.text),0),source_type:'study_guide',status:'ready',error_message:null,page_count:room.sources.filter(s=>s.id===id||s.id.startsWith(id+':')).length,page_label:'Page',ocr_page_count:0,chunk_count:room.sources.filter(s=>s.id===id||s.id.startsWith(id+':')).length,created_at:'2026-10-01T00:00:00Z'}));
}
export function integratedEvidence(state:State,roomId:string):PracticeEvidence[] {
  return roomOf(state,roomId).events.filter(e=>e.result==='correct'||e.result==='incorrect'||e.result==='partial').map(e=>({topic_id:e.topicId,source:e.evidence==='self_reported'?'flashcard':'quiz',score:e.result==='correct'?100:e.result==='partial'?50:0,is_correct:e.result==='correct',created_at:e.createdAt}));
}
export function integratedReadiness(state:State,roomId:string):RoomReadiness {
  const topics=integratedTopics(state,roomId),evidence=integratedEvidence(state,roomId);
  const practiced=topics.filter(t=>t.last_practiced_at);
  const average=topics.length?topics.reduce((n,t)=>n+t.mastery_score,0)/topics.length:0;
  return {readiness:Math.round(average),averageMastery:Math.round(average),topicCount:topics.length,practicedTopicCount:practiced.length,masteredCount:topics.filter(t=>t.status==='mastered').length,
    questionsAnswered:evidence.filter(e=>e.source==='quiz').length,correctAnswers:evidence.filter(e=>e.source==='quiz'&&e.is_correct).length,cardsDue:Object.values(extras(state).cards).filter(c=>c.roomId===roomId&&Date.parse(c.dueAt)<=Date.now()).length};
}
export function integratedStudy(state:State,roomId:string) {
  return {evidence:integratedEvidence(state,roomId),planEvents:extras(state).plan[roomId]??[],asOf:Date.now()};
}
function publicQuestion(q:StoredQuestion) {
  const e=q.encounter;const match=e.task.prompt.match(/^(.*?)\s+A\)\s*(.*?)\s+B\)\s*(.*)$/s);
  return {id:e.id,topic_id:e.spec.concept.topicId,kind:match?'multiple_choice':'short_answer',prompt:match?match[1]:e.task.prompt,choices:match?[match[2],match[3]]:[],difficulty:e.spec.reasoningLevel};
}
function ensureIdle(state:State) {
  if(extras(state).activeBatch?.some(id=>!extras(state).questions[id]?.graded))throw new BetaError('Finish your active quiz or test before starting another encounter.',409);
  if(Object.values(state.rooms).some(r=>r.pending))throw new BetaError('Finish or explicitly skip your pending Coach question first.',409);
}
function batch(state:State,roomId:string,count:number,activity:'quiz'|'practice_test',topicId:string|undefined,now:string) {
  ensureIdle(state); const room=roomOf(state,roomId); state.currentRoomId=roomId;
  const topics=room.room.topics.filter(t=>t.active&&t.source&&Object.keys(t.tasks).length).sort((a,b)=>b.priority-a.priority||a.order-b.order||a.id.localeCompare(b.id));
  if(!topics.length)throw new BetaError('No authored practice is available. Imported materials can be read; generation requires the live provider.');
  if(topicId&&!topics.some(t=>t.id===topicId))throw new BetaError('Topic is unavailable',404);
  const selected=room.selectedTopicId;const ids:string[]=[];
  for(let i=0;i<count;i++) {
    room.selectedTopicId=topicId??topics[i%topics.length].id;
    issue(room,now,activity); const encounter=room.pending!;room.pending=null;
    // Test and quiz setups do not themselves deliver hints or examples.
    encounter.support=0;
    extras(state).questions[encounter.id]={encounter};ids.push(encounter.id);
  }
  room.selectedTopicId=selected;extras(state).activeBatch=ids;return ids;
}
function gradeQuestion(state:State,id:string,answer:Answer,now:string,eventId:string) {
  const stored=extras(state).questions[id];if(!stored)throw new BetaError('Question not found',404);
  const e=stored.encounter;const room=roomOf(state,e.spec.concept.roomId);
  const topic=room.room.topics.find(t=>t.id===e.spec.concept.topicId&&t.active);
  if(!topic||createHash('sha256').update(topic.source).digest('hex')!==e.source.revision
    ||topic.source!==room.sources.find(s=>s.id===topic.documentId||s.id===topic.documentId+':'+topic.page)?.text)throw new BetaError('Question source is no longer available.',409);
  const answerText=Number.isInteger(answer.selectedChoice)&&[0,1].includes(answer.selectedChoice!)?String.fromCharCode(65+answer.selectedChoice!):answer.response;
  const result=answerText?gradeFixture(e.task,answerText):'incorrect';
  if(result==='uncertain')throw new BetaError('The local exact-answer checker could not verify this wording. No evidence was recorded. Use a concise answer.',422);
  const graded={isCorrect:result==='correct',score:result==='correct'?100:0,feedback:result==='correct'?'Correct.':'Review the source and try a fresh question.',correctChoice:/^[AB]$/.test(e.task.answer)?e.task.answer.charCodeAt(0)-65:null,
    expectedAnswer:e.task.answer,explanation:topic.explanations[room.explainLevel],citations:citation(state,room.room.id,topic.id),topicId:topic.id};
  record(room,e,{action:'submit',interactionId:eventId,revision:state.revision},now,result);stored.graded=graded;
  // The returned explanation is help on the completed encounter, not on a future one.
  e.completed=true;return graded;
}
function boundedCount(value:unknown,max:number,defaultValue:number) {
  if(value===undefined)return defaultValue;if(!Number.isInteger(value)||Number(value)<1||Number(value)>max)throw new BetaError('Invalid question count');return Number(value);
}
/** Server-only compatibility layer: trusted authored sources and issued rubrics, never client evidence. */
export function integratedOperation(store:LocalBetaStore,sessionId:string,path:string,method:string,body:Record<string,unknown>,now:string) {
  const explicit=typeof body.interactionId==='string'?body.interactionId:typeof body.requestId==='string'?body.requestId:null;
  if(explicit&&!/^[a-f0-9-]{36}$/i.test(explicit))throw new BetaError('Invalid interaction ID');
  const operationId=path==='/quiz/attempt'?'quiz:'+String(body.questionId):path==='/practice-tests/submit'?'test:'+String(body.testId):'operation:'+(explicit??randomUUID());
  return store.transact(sessionId,operationId,{path,method,body},state=>{
    const result=operate(state as State,path,method,body,now,operationId);
    return {state,response:result};
  });
}
function operate(state:State,path:string,method:string,body:Record<string,unknown>,now:string,operationId:string):unknown {
  const roomId=typeof body.roomId==='string'?body.roomId:state.currentRoomId;
  const room=roomOf(state,roomId);const data=extras(state);
  if(path==='/coach/preferences') {
    if(!validCoachPreferences(body.preferences))throw new BetaError('Invalid coaching preferences');
    const p=canonicalCoachPreferences({...body.preferences,explainLevel:room.explainLevel});
    data.preferences[roomId]=p;room.coachMode=migrateCoachMode(p);return {preferences:p};
  }
  if(path==='/learn/preferences') {
    if(!validLearnPreferences(body.preferences))throw new BetaError('Choose valid Learn settings.');
    const preferences=normalizeLearnPreferences(body.preferences);data.learnPreferences[roomId]=preferences;
    return {preferences,status:'ready'};
  }
  if(path==='/quiz'&&method==='POST') {
    const ids=batch(state,roomId,boundedCount(body.count,20,5),'quiz',typeof body.topicId==='string'?body.topicId:undefined,now);
    return {questions:ids.map(id=>publicQuestion(data.questions[id]))};
  }
  if(path==='/quiz/attempt') {
    const q=data.questions[String(body.questionId)];if(!q||q.encounter.spec.activity!=='quiz')throw new BetaError('Quiz question not found',404);
    if(q.graded)throw new BetaError('This answer has already been committed.',409);
    return gradeQuestion(state,q.encounter.id,{selectedChoice:body.selectedChoice as number|null,response:typeof body.response==='string'?body.response:''},now,operationId);
  }
  if(path==='/practice-tests') {
    if(method==='GET') {
      if(body.testId) {
        const test=data.tests[String(body.testId)];if(!test)throw new BetaError('Test not found',404);
        return {test:{...test,topic_snapshot:[...new Set(test.questionIds.map(id=>data.questions[id].encounter.spec.concept.topicId))].map(id=>({id,title:roomOf(state,test.roomId).room.topics.find(t=>t.id===id)?.title,questions:test.questionIds.filter(q=>data.questions[q].encounter.spec.concept.topicId===id).length}))},questions:test.questionIds.map(id=>publicQuestion(data.questions[id]))};
      }
      return {tests:Object.values(data.tests).filter(t=>t.roomId===roomId).map(t=>({...t,topic_snapshot:room.room.topics.filter(topic=>t.questionIds.some(id=>data.questions[id].encounter.spec.concept.topicId===topic.id)).map(topic=>({id:topic.id,title:topic.title}))}))};
    }
    if(method==='PATCH') {
      const test=data.tests[String(body.testId)];if(!test||test.status!=='draft')throw new BetaError('Draft not found',404);
      test.draft_answers=readAnswers(body.answers,test.questionIds);return {saved:true};
    }
    const ids=batch(state,roomId,boundedCount(body.count,20,10),'practice_test',undefined,now);const id=randomUUID();
    data.tests[id]={id,roomId,status:'draft',created_at:now,questionIds:ids,draft_answers:{},result:null};return {testId:id};
  }
  if(path==='/practice-tests/submit') {
    const test=data.tests[String(body.testId)];if(!test||test.status!=='draft')throw new BetaError('Test not found',404);
    const answers=readAnswers(body.answers,test.questionIds);test.draft_answers=answers;
    const reviews=test.questionIds.map((id,i)=>{const answer=answers[id]??{selectedChoice:null,response:''};const graded=gradeQuestion(state,id,answer,new Date(Date.parse(now)+i).toISOString(),operationId+':'+id);
      return {...publicQuestion(data.questions[id]),...graded,is_correct:graded.isCorrect,correct_choice:graded.correctChoice,expected_answer:graded.expectedAnswer,response:answer.response,selected_choice:answer.selectedChoice};});
    const score=Math.round(reviews.reduce((n,q)=>n+q.score,0)/reviews.length);
    const topics=[...new Set(reviews.map(q=>q.topic_id))].map(id=>{const rows=reviews.filter(q=>q.topic_id===id);return {topic_id:id,title:roomOf(state,test.roomId).room.topics.find(t=>t.id===id)?.title,questions:rows.length,score:Math.round(rows.reduce((n,q)=>n+q.score,0)/rows.length),misses:rows.filter(q=>!q.is_correct).length};});
    test.status='submitted';test.result={score,questionCount:reviews.length,topics,reviews};return {result:test.result};
  }
  if(path==='/flashcards') {
    if(method==='POST') {
      for(const topic of room.room.topics.filter(t=>t.active&&Object.keys(t.tasks).length)) {
        if(Object.values(data.cards).some(c=>c.roomId===roomId&&c.topicId===topic.id))continue;
        const id=randomUUID();data.cards[id]={id,roomId,topicId:topic.id,front:topic.tasks.recall[0].prompt,back:topic.tasks.recall[0].answer,repetitions:0,dueAt:now,learner_edited:false};
      }
    }
    const cards=Object.values(data.cards).filter(c=>c.roomId===roomId&&Date.parse(c.dueAt)<=Date.parse(now)&&(!body.topicId||c.topicId===body.topicId)&&room.room.topics.some(t=>t.id===c.topicId&&t.active));
    return {cards:cards.map(c=>({...c,topic_id:c.topicId,citations:citation(state,roomId,c.topicId)}))};
  }
  if(path==='/flashcards/review') {
    const card=data.cards[String(body.cardId)];if(!card)throw new BetaError('Card not found',404);
    if(![1,2,3].includes(Number(body.rating)))throw new BetaError('Invalid recall rating');
    const target=roomOf(state,card.roomId);if(!target.room.topics.some(t=>t.id===card.topicId&&t.active))throw new BetaError('Topic removed',409);
    target.events.push({userId:'synthetic-local-learner',roomId:card.roomId,topicId:card.topicId,id:operationId,encounterId:card.id,activity:'flashcard',challengeKind:'recall',result:body.rating===3?'correct':'incorrect',scaffoldUsed:5,evidence:'self_reported',contextId:null,newContext:false,misconceptionId:null,createdAt:now});
    card.repetitions++;card.dueAt=new Date(Date.parse(now)+(body.rating===3?86400000:body.rating===2?600000:120000)).toISOString();return {saved:true};
  }
  if(path.startsWith('/flashcards/')) {
    const id=path.split('/')[2];const card=data.cards[id];if(!card)throw new BetaError('Card not found',404);
    if(method==='DELETE'){delete data.cards[id];return {deleted:true};}
    if(typeof body.front!=='string'||typeof body.back!=='string'||!body.front.trim()||!body.back.trim()||body.front.length>2000||body.back.length>4000)throw new BetaError('Invalid card');
    card.front=body.front.trim();card.back=body.back.trim();card.learner_edited=true;return {card};
  }
  if(path==='/learn'||path==='/learn/check') {
    const topic=room.room.topics.find(t=>t.id===body.topicId&&t.active);if(!topic)throw new BetaError('Topic not found',404);
    if(path==='/learn')return {explanation:topic.explanations[room.explainLevel],citations:citation(state,roomId,topic.id)};
    const task=topic.tasks.recall?.[0];if(!task)throw new BetaError('Formative generation for this source needs a configured provider.');
    if(!body.answer)return {question:task.prompt};
    const understood=gradeFixture(task,String(body.answer))==='correct';return {understood,feedback:understood?'That matches the source. This formative check does not award mastery.':task.hint,followUp:understood?null:task.prompt};
  }
  if(path==='/study-plan') {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(body.day))||!['completed','skipped'].includes(String(body.status))||typeof body.actionKey!=='string'||body.actionKey.length>200)throw new BetaError('Invalid plan action');
    const rows=data.plan[roomId]??=[];const existing=rows.find(e=>e.plan_day===body.day&&e.action_key===body.actionKey);
    if(existing)existing.status=body.status as PlanEvent['status'];else rows.push({plan_day:String(body.day),action_key:body.actionKey,status:body.status as PlanEvent['status']});return {saved:true};
  }
  if(path.startsWith('/topics/')) {
    const topic=room.room.topics.find(t=>t.id===path.split('/')[2]);if(!topic)throw new BetaError('Topic not found',404);
    if(Object.values(state.rooms).some(r=>r.pending?.spec.concept.topicId===topic.id)||data.activeBatch?.some(id=>!data.questions[id]?.graded&&data.questions[id]?.encounter.spec.concept.topicId===topic.id))throw new BetaError('Finish the pending encounter before editing this topic.',409);
    if(method==='DELETE'){topic.active=false;return {deleted:true};}
    if(typeof body.title!=='string'||!body.title.trim()||body.title.length>160)throw new BetaError('Invalid topic title');
    topic.title=body.title.trim();if(typeof body.objective==='string')topic.objective=body.objective.slice(0,1000);
    if(Number.isInteger(body.priority)&&Number(body.priority)>=0&&Number(body.priority)<=100)topic.priority=Number(body.priority);return {topic:integratedTopics(state,roomId).find(t=>t.id===topic.id)};
  }
  if(path==='/topics') {
    if(body.action==='add') {
      if(typeof body.title!=='string'||!body.title.trim())throw new BetaError('Topic title required');
      const id=randomUUID();room.room.topics.push({id,title:body.title.slice(0,160),objective:String(body.objective??'').slice(0,1000),priority:60,order:room.room.topics.length,active:true,documentId:id,page:1,source:'',explanations:{simpler:'',standard:'',deeper:''},tasks:{} as never});
    }
    return {topics:integratedTopics(state,roomId),topicsCreated:0};
  }
  if(path==='/chat')return chat(state,roomId,body,now,operationId);
  throw new BetaError('This operation is unavailable in the local beta.',404);
}
function readAnswers(value:unknown,ids:string[]):Record<string,Answer> {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new BetaError('Invalid test answers');
  const answers:Record<string,Answer>={};for(const [id,raw] of Object.entries(value)) {
    if(!ids.includes(id)||!raw||typeof raw!=='object')throw new BetaError('Invalid test question');
    const a=raw as Answer;if(a.selectedChoice!==null&&(!Number.isInteger(a.selectedChoice)||![0,1].includes(a.selectedChoice)))throw new BetaError('Invalid answer choice');
    if(typeof a.response!=='string'||a.response.length>3000)throw new BetaError('Invalid written answer');answers[id]={selectedChoice:a.selectedChoice,response:a.response};
  }return answers;
}
function chat(state:State,roomId:string,body:Record<string,unknown>,now:string,id:string) {
  if(typeof body.question!=='string'||!body.question.trim()||body.question.length>4000)throw new BetaError('A short question is required');
  const text=body.question.trim();state.currentRoomId=roomId;const room=roomOf(state,roomId);
  const apply=(action:string,extra:Record<string,unknown>={})=>{
    const next=applyBetaAction(state,{action,interactionId:id,revision:state.revision,...extra},now);Object.assign(state,next);
  };
  if(body.mode!=='coach') {
    apply('ask',{answer:text.slice(0,1000)});const source=room.sources.find(s=>s.id===state.answer?.sourceId);
    const topic=source?room.room.topics.find(t=>t.documentId===source.id||source.id===t.documentId+':'+t.page):null;
    return {text:topic?.explanations[room.explainLevel]??state.answer!.text,citations:topic?citation(state,roomId,topic.id):[],grounded:Boolean(source),conversationId:null};
  }
  if(extras(state).activeBatch?.some(id=>!extras(state).questions[id]?.graded))throw new BetaError('Finish the active quiz or practice test first.',409);
  let action:string;
  if(/^(?:hint|help|give me a hint|i need help)$/i.test(text))action='hint';
  else if(/^(?:skip|skip this question|change topic)$/i.test(text))action='skip';
  else if(/^(?:show me|show me the answer|reveal|reveal the answer)$/i.test(text))action='reveal';
  else if(room.pending)action='submit';
  else action=/^(?:challenge me|try a harder question)$/i.test(text)?'stretch':'start';
  if(action==='start'||action==='stretch') {
    const chosen=room.room.topics.find(t=>t.active&&text.toLowerCase().includes(t.title.toLowerCase()));
    room.selectedTopicId=chosen?.id??null;
  }
  apply(action,{answer:text,activity:'coach'});
  const current=roomOf(state,roomId);const pending=current.pending;
  const feedback=state.feedback?.text??'';
  const display=pending&&['start','stretch'].includes(action)?[pending.support>=3?current.room.topics.find(t=>t.id===pending.spec.concept.topicId)?.explanations[current.explainLevel]:null,pending.task.prompt].filter(Boolean).join('\n\n')
    :[feedback,pending&&action==='submit'?pending.task.prompt:null].filter(Boolean).join('\n\n');
  const topicId=pending?.spec.concept.topicId??current.events.at(-1)?.topicId;
  return {text:display,citations:topicId?citation(state,roomId,topicId):[],grounded:true,conversationId:null};
}
