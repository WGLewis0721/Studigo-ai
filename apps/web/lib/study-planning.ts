import type { Topic } from './rooms';

export type PracticeEvidence = { topic_id: string | null; source: 'quiz' | 'flashcard'; score: number; is_correct: boolean; created_at: string; confidence?: number | null };
export type WeakArea = { topic: Topic; urgency: number; reasons: string[]; recommendation: 'learn' | 'quiz' | 'cards'; label: string; recentMisses: number; recentQuizCount: number; daysSincePractice: number | null; blindSpots: number };
export type StudyAction = { key: string; mode: 'learn' | 'quiz' | 'cards' | 'test' | 'cram'; title: string; topicId: string | null; minutes: number; reason: string };
export type PlanEvent = { plan_day: string; action_key: string; status: 'completed' | 'skipped' };
export type PlanDay = { date: string; label: string; actions: StudyAction[] };
const DAY = 86_400_000;

/** Decision support, not a replacement for the existing earned mastery score. */
export function rankWeakAreas(topics: Topic[], evidence: PracticeEvidence[], now = Date.now()): WeakArea[] {
  return topics.map((topic): WeakArea => {
    const recent = evidence.filter(a => a.topic_id === topic.id).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,12);
    const quiz = recent.filter(a=>a.source === 'quiz').slice(0,3);
    const misses = quiz.filter(a=>!a.is_correct).length;
    const cards = recent.filter(a=>a.source === 'flashcard').slice(0,3);
    const recallMisses = cards.filter(a=>Number(a.score)<60).length;
    const last = recent[0]?.created_at ?? topic.last_practiced_at;
    const days = last ? Math.max(0,Math.floor((now-Date.parse(last))/DAY)) : null;
    const unpracticed = !topic.last_practiced_at && !recent.length;
    // Answered wrongly while feeling sure: the learner does not know this and
    // does not know that they do not know it. That is the costliest gap.
    const blindSpots = recent.filter(a=>a.source==='quiz' && !a.is_correct && a.confidence===3).length;
    const reasons: string[] = [];
    if (unpracticed) reasons.push('Not practiced yet — understanding has not been measured.');
    if (blindSpots) reasons.push(`${blindSpots} confident ${blindSpots===1?'answer was':'answers were'} wrong — a blind spot, not a gap you already know about.`);
    if (quiz.length && misses) reasons.push(`${misses} of the last ${quiz.length} quiz questions missed.`);
    if (recallMisses) reasons.push(`${recallMisses} of the last ${cards.length} flashcard recalls missed (self-reported).`);
    if (topic.priority >= 90) reasons.push('High priority in the current study scope.');
    if (days !== null && days >= 3) reasons.push(`Last practiced ${days} days ago.`);
    if (!unpracticed && Number(topic.mastery_score)<85) reasons.push(`${Math.round(Number(topic.mastery_score))}% earned mastery; more successful recall is needed.`);
    const urgency = (100-Number(topic.mastery_score))*0.42 + topic.priority*0.18 + (unpracticed?18:0)
      + (quiz.length ? misses/quiz.length*22 : 0) + recallMisses*4 + Math.min(14,days??0)
      + Math.min(20,blindSpots*10);
    const recommendation = unpracticed ? 'learn' : recallMisses>0 && misses===0 ? 'cards' : 'quiz';
    return { topic, urgency: Math.round(urgency), reasons, recommendation,
      label: blindSpots ? 'Blind spot' : unpracticed ? 'Not practiced' : topic.status === 'mastered' && misses===0 && recallMisses===0 ? 'Recall check' : 'Needs work',
      recentMisses: misses, recentQuizCount: quiz.length, daysSincePractice: days, blindSpots };
  }).filter(area=>area.topic.status!=='mastered' || area.recentMisses>0 || area.blindSpots>0 || area.reasons.some(r=>r.includes('self-reported')) || (area.daysSincePractice??0)>=7)
    .sort((a,b)=>b.urgency-a.urgency || b.topic.priority-a.topic.priority || a.topic.id.localeCompare(b.topic.id));
}

/** Cover as many topics as the question budget permits, then distribute extras
 * by teacher priority without letting one high-priority topic swallow the test. */
export function allocateTestQuestions(topics: Topic[], count: number) {
  const ordered=[...topics].sort((a,b)=>b.priority-a.priority || a.order_index-b.order_index || a.id.localeCompare(b.id)).slice(0,count);
  if (!ordered.length) return [];
  const allocations=ordered.map(topic=>({topic,count:1}));
  for(let remaining=count-ordered.length;remaining>0;remaining--) {
    const best=[...allocations].sort((a,b)=>(Math.max(1,b.topic.priority)/(b.count+1))-(Math.max(1,a.topic.priority)/(a.count+1)) || a.topic.order_index-b.topic.order_index)[0];
    best.count++;
  }
  return allocations;
}

export function buildCramPlan(areas: WeakArea[], topics: Topic[], minutes: number, testDate: string | null = null, now = Date.now()): StudyAction[] {
  const budget=[15,30,60,120].includes(minutes)?minutes:30;
  const ranked=areas.length?areas.map(a=>a.topic):[...topics].sort((a,b)=>b.priority-a.priority);
  if (!ranked.length) return [];
  const chosen=ranked.slice(0,Math.min(ranked.length,budget===15?2:budget===30?3:budget===60?5:8));
  const recallMinutes=budget===15?2:budget===30?3:5;
  const daysToTest=testDate?(Date.parse(testDate)-now)/DAY:null;
  const imminent=daysToTest!==null && daysToTest>=-1 && daysToTest<=2;
  const quizMinutes=Math.min(25,Math.max(4,Math.round(budget*(imminent?.35:.25))));
  let studyMinutes=budget-recallMinutes-quizMinutes;
  const actions: StudyAction[]=chosen.map((topic,index)=>{
    const allocated=Math.floor(studyMinutes/(chosen.length-index)); studyMinutes-=allocated;
    const area=areas.find(a=>a.topic.id===topic.id);
    return { key:`learn:${topic.id}`, mode:'learn', title:topic.title, topicId:topic.id, minutes:allocated,
      reason:area?.reasons[0]??'Refresh a high-priority topic from your materials.' };
  });
  actions.push({key:'quiz:mixed',mode:'quiz',title:'Check your weakest topic',topicId:chosen[0].id,minutes:quizMinutes,reason:imminent?'Your test is close: spend more of this session checking recall without notes.':'Try questions without looking at your notes.'});
  actions.push({key:'cards:recall',mode:'cards',title:'Rapid recall',topicId:chosen[0].id,minutes:recallMinutes,reason:'Review due cards; missed cards return sooner.'});
  return actions;
}

export function buildStudyPlan(args: { topics: Topic[]; areas: WeakArea[]; testDate: string | null; cardsDue: number; events: PlanEvent[]; now?: number }): PlanDay[] {
  const now=args.now??Date.now();
  const today=new Date(now).toISOString().slice(0,10);
  const todayMs=Date.parse(`${today}T00:00:00Z`);
  const daysUntil=args.testDate?Math.ceil((Date.parse(args.testDate)-todayMs)/DAY):null;
  if (daysUntil!==null && daysUntil<0) return [];
  const horizon=Math.min(7,daysUntil===null?3:daysUntil+1);
  const ranked=args.areas.length?args.areas.map(a=>a.topic):args.topics;
  if (!ranked.length) return [];
  const result: PlanDay[]=[];
  for(let day=0;day<horizon;day++) {
    const date=new Date(todayMs+day*DAY).toISOString().slice(0,10);
    const testDay=daysUntil!==null && day===daysUntil;
    const beforeTest=daysUntil!==null && day===daysUntil-1;
    const topic=ranked[day%ranked.length];
    let actions: StudyAction[];
    if(testDay) actions=[{key:'cram:test-day',mode:'cram',title:'A focused final review',topicId:null,minutes:15,reason:'Prioritize weak and unpracticed topics; avoid cramming new scope.'}];
    else if(beforeTest && args.topics.length>=2) actions=[{key:'test:rehearsal',mode:'test',title:'Rehearse the whole test',topicId:null,minutes:25,reason:'Answer across the study-guide scope, then review your mistakes.'}];
    else actions=[
      {key:`learn:${topic.id}`,mode:'learn',title:topic.title,topicId:topic.id,minutes:10,reason:args.areas.find(a=>a.topic.id===topic.id)?.reasons[0]??'Keep this topic fresh.'},
      {key:`quiz:${topic.id}`,mode:'quiz',title:'Check what stuck',topicId:topic.id,minutes:8,reason:'Use real answers to update mastery.'}
    ];
    if(day===0 && args.cardsDue>0 && !testDay) actions.push({key:'cards:due',mode:'cards',title:`${args.cardsDue} cards due`,topicId:null,minutes:5,reason:'Recall these before their review interval grows.'});
    // Completion is plan bookkeeping only; it never creates mastery evidence.
    actions=actions.filter(a=>!args.events.some(e=>e.plan_day===date&&e.action_key===a.key&&(e.status==='completed'||e.status==='skipped')));
    const skipped=args.events.filter(e=>e.plan_day<=date&&e.status==='skipped');
    if(day===0 && skipped.length && actions[0]) actions[0]={...actions[0],reason:`Rebalanced after a skipped session. ${actions[0].reason}`};
    result.push({date,label:day===0?'Today':day===1?'Tomorrow':new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'}),actions});
  }
  // Carry intentionally skipped work into the next visible day. Recomputed
  // missed days naturally start from today's current weakest topics.
  for (const event of args.events.filter(e=>e.status==='skipped')) {
    const sourceDay=result.findIndex(day=>day.date===event.plan_day);
    const destination=sourceDay>=0?result[sourceDay+1]:null;
    if(!destination) continue;
    const [mode,topicId]=event.action_key.split(':');
    const topic=args.topics.find(t=>t.id===topicId);
    const alreadyHandled=args.events.some(e=>e.plan_day===destination.date&&e.action_key===event.action_key);
    if(topic && ['learn','quiz','cards'].includes(mode) && !alreadyHandled && !destination.actions.some(a=>a.key===event.action_key)) {
      destination.actions.unshift({key:event.action_key,mode:mode as 'learn'|'quiz'|'cards',title:topic.title,topicId:topic.id,minutes:8,reason:'Moved forward from a skipped session. Recheck this concept.'});
    }
  }
  return result;
}

export type Calibration = {
  /** Quiz answers that carried a reported confidence. */
  reported: number;
  /** Wrong while confident: the learner did not know they were guessing. */
  blindSpots: number;
  /** Right while guessing: knowledge they have but do not trust yet. */
  underconfident: number;
  /** 0-100. How well reported confidence matched the actual outcome. */
  accuracy: number | null;
  label: 'Well calibrated' | 'Overconfident' | 'Underconfident' | 'Not enough data';
  summary: string;
};

/**
 * Compares how sure the learner felt with how they actually did. Readiness says
 * what they know; calibration says whether they can trust their own sense of it,
 * which is what decides where revision time actually goes.
 */
export function summarizeCalibration(evidence: PracticeEvidence[]): Calibration {
  const rated = evidence.filter(a => a.source === 'quiz' && (a.confidence === 1 || a.confidence === 2 || a.confidence === 3));
  const blindSpots = rated.filter(a => a.confidence === 3 && !a.is_correct).length;
  const underconfident = rated.filter(a => a.confidence === 1 && a.is_correct).length;

  if (rated.length < 4) {
    return { reported: rated.length, blindSpots, underconfident, accuracy: null, label: 'Not enough data',
      summary: 'Answer a few more questions with a confidence rating and Studigo can tell you how well you read your own recall.' };
  }

  // Each answer's expected correctness from its rating, against the outcome.
  const expected = { 1: 0.25, 2: 0.6, 3: 0.95 } as const;
  const error = rated.reduce((total, a) => total + Math.abs(expected[a.confidence as 1|2|3] - (a.is_correct ? 1 : 0)), 0) / rated.length;
  const accuracy = Math.round((1 - error) * 100);
  const label = blindSpots / rated.length > 0.2 ? 'Overconfident'
    : underconfident / rated.length > 0.2 ? 'Underconfident'
    : 'Well calibrated';

  const summary = label === 'Overconfident'
    ? `You were sure on ${blindSpots} answer${blindSpots === 1 ? '' : 's'} you got wrong. Check those topics without your notes before the test.`
    : label === 'Underconfident'
      ? `You guessed correctly ${underconfident} time${underconfident === 1 ? '' : 's'}. You know more than you are giving yourself credit for — the recall is there.`
      : 'Your sense of what you know matches how you actually perform, so you can trust where you feel shaky.';

  return { reported: rated.length, blindSpots, underconfident, accuracy, label, summary };
}
