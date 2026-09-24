"use client";
import { useState } from 'react';
import type { PlanDay, StudyAction } from '@/lib/study-planning';
export function StudyPlanPanel({roomId,days,testDate,onStart,onChanged,onSetDate}:{roomId:string;days:PlanDay[];testDate:string|null;onStart:(a:StudyAction)=>void;onChanged:()=>void;onSetDate:()=>void}) {
  const [saving,setSaving]=useState<string|null>(null);const [error,setError]=useState<string|null>(null);
  async function mark(day:string,actionKey:string,status:'completed'|'skipped'){
    const key=`${day}:${actionKey}`;setSaving(key);setError(null);
    try{const r=await fetch('/api/study-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomId,day,actionKey,status})});const p=await r.json();if(!r.ok)throw new Error(p.error);onChanged();}
    catch(e){setError(e instanceof Error?e.message:'Plan did not save.');}finally{setSaving(null);}
  }
  return <section className="studyPlanPanel"><header className="studySectionHeading"><div><span className="tinyLabel">A LITTLE EACH DAY</span><h2>{testDate?`Your route to ${new Date(testDate).toLocaleDateString(undefined,{month:'short',day:'numeric'})}.`:'Make the next few days count.'}</h2><p>Recomputed from your current study scope, practice results and due cards. Skipped work returns to the plan; completed tasks stay recorded.</p></div><button className="buttonQuiet planDateButton" onClick={onSetDate} aria-label={testDate ? "Change test date" : "Set test date"}><span aria-hidden="true">◷</span><span>{testDate ? "Change date" : "Set date"}</span></button></header>
    {error&&<p className="formError" role="alert">{error}</p>}
    {!days.length&&<div className="modeEmpty"><p>Add a study guide and set an upcoming test date to plan your next sessions.</p></div>}
    <div className="planTimeline">{days.map(day=><section key={day.date} className="planDay"><div className="planDayLabel"><strong>{day.label}</strong><small>{day.actions.reduce((sum,a)=>sum+a.minutes,0)} min planned</small></div><div className="planDayActions">{!day.actions.length&&<p>Planned work complete. Rest, or revisit a weak topic if you have time.</p>}{day.actions.map(a=><article key={a.key}><span className="tinyLabel">{a.mode==='test'?'PRACTICE TEST':a.mode.toUpperCase()} / {a.minutes} MIN</span><h3>{a.title}</h3><p>{a.reason}</p><div className="planActionButtons"><button className="buttonPrimary" onClick={()=>onStart(a)}>Start →</button><button disabled={saving!==null} onClick={()=>void mark(day.date,a.key,'completed')}>Mark done</button><button disabled={saving!==null} onClick={()=>void mark(day.date,a.key,'skipped')}>Skip / replan</button></div></article>)}</div></section>)}</div>
    <p className="hintText">Checking off a plan never adds mastery. Only saved practice performance does. Dates use the Study Room's test-date calendar.</p>
  </section>;
}
