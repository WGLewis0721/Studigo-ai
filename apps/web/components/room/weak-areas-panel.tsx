"use client";
import type { WeakArea } from '@/lib/study-planning';
import { StudigoMascot } from '@/components/studigo-mascot';
export function WeakAreasPanel({areas,onStudy}:{areas:WeakArea[];onStudy:(mode:'learn'|'quiz'|'cards',topicId:string)=>void}) {
  return <section className="weakAreasPanel">
    <header className="studySectionHeading"><div><span className="tinyLabel">FOLLOW THE EVIDENCE</span><h2>What deserves your attention?</h2><p>Priority, recent recall, and time since practice help choose your next step. This ranking does not change your earned mastery.</p></div><StudigoMascot state="explain" size={80}/></header>
    {!areas.length?<div className="modeEmpty"><h3>No weak areas to rank right now.</h3><p>If you have topics, keep recall fresh with a practice test. Otherwise, add a study guide first.</p></div>:
      <ol className="weakAreaList">{areas.map((area,index)=><li key={area.topic.id}>
        <span className="priorityNumber">{String(index+1).padStart(2,'0')}</span>
        <div className="weakAreaBody"><span className="tinyLabel">{area.label}</span><h3>{area.topic.title}</h3><ul>{area.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul></div>
        <button type="button" className="buttonPrimary" onClick={()=>onStudy(area.recommendation,area.topic.id)}>{area.recommendation==='learn'?'Learn this':area.recommendation==='cards'?'Review cards':'Practice 5 questions'} <span>→</span></button>
      </li>)}</ol>}
  </section>;
}
