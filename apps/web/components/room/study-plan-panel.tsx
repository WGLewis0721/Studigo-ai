"use client";
import { StudyRoomEmptyState } from './study-room-empty-state';
import { useRef, useState } from 'react';
import type { PlanDay, StudyAction } from '@/lib/study-planning';
import { ChipButton, HeaderChip } from './mode-header';
import './phase3-rooms.css';
export function StudyPlanPanel({roomId,days,testDate,onStart,onChanged,onSetDate,hasTopics,asOf,onOpenMaterials}:{roomId:string;days:PlanDay[];testDate:string|null;onStart:(a:StudyAction)=>void;onChanged:()=>void;onSetDate:()=>void;hasTopics:boolean;asOf:number;onOpenMaterials:()=>void}) {
  const [saving,setSaving]=useState<string|null>(null);const [error,setError]=useState<string|null>(null);const [notice,setNotice]=useState('');const saveLock=useRef(false);
  async function mark(day:string,actionKey:string,status:'completed'|'skipped'){
    if(saveLock.current)return;saveLock.current=true;setNotice('');
    const key=`${day}:${actionKey}`;setSaving(key);setError(null);
    try{const r=await fetch('/api/study-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomId,day,actionKey,status})});const p=await r.json();if(!r.ok)throw new Error(p.error);setNotice(status==='completed'?'Plan marked done. Your learning evidence is unchanged.':'Action skipped. Your plan will update.');onChanged();}
    catch(e){setError(e instanceof Error?e.message:'Plan did not save.');}finally{saveLock.current=false;setSaving(null);}
  }
  const pastTest=Boolean(testDate&&Date.parse(testDate.slice(0,10))+86400000<asOf);
  return <section className="studyPlanPanel"><HeaderChip><ChipButton onClick={onSetDate} label={testDate ? "Change test date" : "Set test date"}>{testDate?`Test ${new Date(testDate).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'})}`:'Set test date'} ▾</ChipButton></HeaderChip>
    <div className="roomSectionIntro"><span className="tinyLabel">PLANNING ROOM / DAILY ACTIONS</span><h2>Make the next session count.</h2><p>Start opens that activity. Marking a plan done records the plan only, not a grade or mastery.</p></div>
    {notice&&<p className="formNotice" role="status">{notice}</p>}
    {error&&<p className="formError" role="alert">{error}</p>}
    {!days.length&&<StudyRoomEmptyState title="Nothing scheduled yet." description={!hasTopics?"Add materials and build your topic map to plan your next sessions.":pastTest?"Your test date has passed. Set the next date to make a new plan.":"Set an upcoming test date or check your current materials."}><button className="buttonPrimary" type="button" onClick={!hasTopics?onOpenMaterials:onSetDate}>{!hasTopics?'Add materials':'Set test date'} →</button></StudyRoomEmptyState>}
    <div className="planTimeline">{days.map((day,index)=><details key={day.date} className="planDay" open={index===0}><summary className="planDayLabel"><strong>{day.label}</strong><small>{day.actions.reduce((sum,a)=>sum+a.minutes,0)} min planned · {day.actions.length} activities</small></summary><div className="planDayActions">{!day.actions.length&&<p>Planned work complete. Rest, or revisit a weak topic if you have time.</p>}{day.actions.map(a=><article key={a.key}><span className="tinyLabel">{a.mode==='test'?'PRACTICE TEST':a.mode.toUpperCase()} / {a.minutes} MIN</span><h3>{a.title}</h3><p>{a.reason}</p><div className="planActionButtons"><button type="button" className="buttonPrimary" aria-label={`Start ${a.title}`} onClick={()=>onStart(a)}>Start →</button><button type="button" disabled={saving!==null} aria-label={`Mark ${a.title} done`} onClick={()=>void mark(day.date,a.key,'completed')}>{saving===`${day.date}:${a.key}`?'Saving…':'Mark done'}</button><button type="button" disabled={saving!==null} aria-label={`Skip and replan ${a.title}`} onClick={()=>void mark(day.date,a.key,'skipped')}>Skip / replan</button></div></article>)}</div></details>)}</div>
    <p className="hintText">Checking off a plan never adds mastery. Only saved practice performance does. Dates use the Study Room's test-date calendar.</p>
  </section>;
}
