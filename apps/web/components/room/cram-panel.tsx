"use client";
import { useEffect, useRef, useState } from 'react';
import type { Topic } from '@/lib/rooms';
import { buildCramPlan, type StudyAction, type WeakArea } from '@/lib/study-planning';
import { LearnPanel } from './learn-panel';
import { QuizPanel } from './quiz-panel';
import { CardsPanel } from './cards-panel';
import { StudigoMascot } from '@/components/studigo-mascot';
export function CramPanel({roomId,topics,areas,testDate,onChanged}:{roomId:string;topics:Topic[];areas:WeakArea[];testDate:string|null;onChanged:()=>void}) {
  const [minutes,setMinutes]=useState(30);const [session,setSession]=useState<StudyAction[]|null>(null);const [index,setIndex]=useState(0);
  const [remaining,setRemaining]=useState(0);const [running,setRunning]=useState(false);const deadline=useRef(0);const [done,setDone]=useState(false);
  const preview=buildCramPlan(areas,topics,minutes,testDate);const step=session?.[index];
  useEffect(()=>{
    if(!running)return;
    const timer=setInterval(()=>{const left=Math.max(0,Math.ceil((deadline.current-Date.now())/1000));setRemaining(left);if(left===0)setRunning(false);},500);
    return ()=>clearInterval(timer);
  },[running]);
  function begin(){if(!preview.length)return;setSession(preview);setIndex(0);setDone(false);setRemaining(preview[0].minutes*60);deadline.current=Date.now()+preview[0].minutes*60000;setRunning(true);}
  function advance(){if(!session)return;if(index+1>=session.length){setDone(true);setRunning(false);onChanged();return;}const next=index+1;setIndex(next);setRemaining(session[next].minutes*60);deadline.current=Date.now()+session[next].minutes*60000;setRunning(true);}
  if(done) return <section className="modeEmpty"><StudigoMascot state="celebrate" size={80}/><span className="tinyLabel">FOCUSED SESSION COMPLETE</span><h2>You made time count.</h2><p>Only your saved quiz answers and card reviews changed mastery. Reading and completing the plan do not earn points.</p><button className="buttonPrimary" onClick={()=>{setSession(null);setDone(false);}}>Reassess my next session →</button></section>;
  if(session&&step) return <section className="cramSession">
    <header className="cramTimerBar"><div><span className="tinyLabel">FOCUS / {index+1} OF {session.length}</span><h2>{step.title}</h2></div><div className="cramClock"><strong aria-label="Time remaining">{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</strong><button onClick={()=>{if(!running){deadline.current=Date.now()+Math.max(remaining,60)*1000;setRemaining(v=>Math.max(v,60));}setRunning(v=>!v);}}>{running?'Pause':remaining===0?'Add one minute':'Resume'}</button></div></header>
    <ol className="cramTrack">{session.map((s,i)=><li key={s.key} aria-current={i===index?'step':undefined}><span>{i+1}</span>{s.title}<small>{s.minutes} min</small></li>)}</ol>
    {!remaining&&<p className="formNotice" role="status">Time for the next step. Finish your current answer before moving on.</p>}
    <p className="hintText">{step.reason}</p>
    <div className="cramActivity" key={`${index}:${step.topicId}`}>
      {step.mode==='learn'&&<LearnPanel roomId={roomId} topics={topics.filter(t=>t.id===step.topicId)} hasMaterials onChanged={onChanged}/>}
      {step.mode==='quiz'&&<QuizPanel roomId={roomId} topics={topics} hasMaterials initialTopicId={step.topicId} onGraded={onChanged}/>}
      {step.mode==='cards'&&<CardsPanel roomId={roomId} topics={topics} hasMaterials initialTopicId={step.topicId} onReviewed={onChanged}/>}
    </div>
    <footer className="cramFooter"><p>Save or grade your response before continuing.</p><button className="buttonPrimary" onClick={advance}>{index+1===session.length?'Finish session':'Next step'} →</button></footer>
  </section>;
  return <section className="cramSetup"><header className="studySectionHeading"><div><span className="tinyLabel">TIME IS SHORT. FOCUS IS EVERYTHING.</span><h2>How much time have you got?</h2><p>{testDate?`Test date: ${new Date(testDate).toLocaleDateString()}. `:''}Start with the highest-priority gaps, then check what stuck.</p></div><StudigoMascot state="explain" size={80}/></header>
    <div className="timeChoices" role="group" aria-label="Available study time">{[15,30,60,120].map(n=><button key={n} aria-pressed={minutes===n} onClick={()=>setMinutes(n)}>{n<60?`${n} min`:`${n/60} hour${n===120?'s':''}`}</button>)}</div>
    <ol className="cramPreview">{preview.map(s=><li key={s.key}><div><strong>{s.title}</strong><p>{s.reason}</p></div><b>{s.minutes} min</b></li>)}</ol>
    {!preview.length?<p>Add your study guide and build a topic map first.</p>:<button className="buttonPrimary" onClick={begin}>Start {minutes}-minute session <span>→</span></button>}
    <p className="hintText">Each step opens the actual lesson, quiz, or flashcards here. The timer guides pacing; it never submits an answer for you. Keep this page open during the session.</p>
  </section>;
}
