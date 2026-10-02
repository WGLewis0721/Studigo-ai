import { performance } from 'node:perf_hooks';
import { initialLearningState, nextChallenge, planSession, projectConcept, type SessionConcept } from '@studigo/learning';
const now='2026-01-20T00:00:00Z',key={userId:'synthetic-learner',roomId:'synthetic-room',topicId:'0'};
const state=initialLearningState(key);
const concepts:SessionConcept[]=Array.from({length:200},(_,i)=>{
  const conceptKey={...key,topicId:String(i)};
  return {key:conceptKey,title:`Synthetic ${i}`,objective:'Check one authored concept',priority:i%5,order:i,active:true,supported:true,teacherScoped:true,projection:projectConcept(conceptKey,[])};
});
const samples:number[]=[];
for(let i=0;i<1100;i++) {
  const start=performance.now();
  nextChallenge({concept:{...key,objective:'Check one authored concept'},learnerState:state,recentEvents:[],activity:'coach',route:'studigo_default',challengeRequest:'normal',now});
  planSession({concepts,mode:'study',budgetMinutes:30,elapsedSeconds:10,now});
  if(i>=100)samples.push(performance.now()-start);
}
samples.sort((a,b)=>a-b);
const p95=samples[Math.ceil(samples.length*.95)-1];
console.log(JSON.stringify({schemaVersion:1,node:process.version,synthetic:true,scope:'one director call plus scheduling 200 preprojected concepts; database/network/replay excluded',samples:samples.length,p50Ms:samples[Math.ceil(samples.length*.5)-1],p95Ms:p95,targetMs:50,passes:p95<50,liveTurnLatency:null,providerCost:null},null,2));
if(p95>=50)process.exitCode=1;
