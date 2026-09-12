"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { CitationChips, type Citation } from './citations';
import { StudigoMascot } from '@/components/studigo-mascot';
type Answer={selectedChoice:number|null;response:string};
type Question={id:string;kind:'multiple_choice'|'short_answer';prompt:string;choices:string[];topic_id:string};
type Review=Question&{score:number;is_correct:boolean;feedback:string;explanation:string;expected_answer:string|null;correct_choice:number|null;citations:Citation[];response:string|null;selected_choice:number|null};
type Result={score:number;questionCount:number;topics:Array<{topic_id:string;title:string;questions:number;score:number;misses:number}>;reviews:Review[]};
type Test={id:string;status:'draft'|'submitted';created_at:string;draft_answers?:Record<string,Answer>;result:Result|null;topic_snapshot:Array<{id:string;title:string;questions:number}>};

export function PracticeTestPanel({roomId,topicCount,onGraded,onReviewTopic}:{roomId:string;topicCount:number;onGraded:()=>void;onReviewTopic:(id:string)=>void}) {
  const [tests,setTests]=useState<Test[]>([]);const [active,setActive]=useState<Test|null>(null);const [questions,setQuestions]=useState<Question[]>([]);
  const [answers,setAnswers]=useState<Record<string,Answer>>({});const [index,setIndex]=useState(0);const [count,setCount]=useState(10);
  const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);const [saveState,setSaveState]=useState('');const [confirmSubmit,setConfirmSubmit]=useState(false);
  const operation=useRef(false);const saveChain=useRef<Promise<void>>(Promise.resolve());const saveVersion=useRef(0);
  useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(saveState==='Saving…'||saveState.startsWith('Draft not saved'))event.preventDefault();};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[saveState]);
  const loadList=useCallback(async()=>{try{const r=await fetch(`/api/practice-tests?roomId=${encodeURIComponent(roomId)}`);const p=await r.json();if(!r.ok)throw new Error(p.error);setTests(p.tests);}catch(e){setError(e instanceof Error?e.message:'Could not load tests.');}},[roomId]);
  useEffect(()=>{void loadList();},[loadList]);
  async function open(testId:string) {
    setBusy(true);setError(null);
    try {const r=await fetch(`/api/practice-tests?testId=${encodeURIComponent(testId)}`);const p=await r.json();if(!r.ok)throw new Error(p.error);setActive(p.test);setQuestions(p.questions);setAnswers(p.test.draft_answers??{});setIndex(0);setConfirmSubmit(false);setSaveState('');}
    catch(e){setError(e instanceof Error?e.message:'Could not open test.');}finally{setBusy(false);}
  }
  async function build() {
    if(operation.current)return;operation.current=true;setBusy(true);setError(null);
    try {const r=await fetch('/api/practice-tests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomId,count})});const p=await r.json();if(!r.ok)throw new Error(p.error);await open(p.testId);await loadList();}
    catch(e){setError(e instanceof Error?e.message:'Could not build test.');}finally{operation.current=false;setBusy(false);}
  }
  function change(id:string,value:Answer) {
    const next={...answers,[id]:value};const version=++saveVersion.current;setAnswers(next);setSaveState('Saving…');
    // Serialize autosaves so an older response cannot overwrite a newer draft.
    saveChain.current=saveChain.current.catch(()=>{}).then(async()=>{
      if(version!==saveVersion.current)return;
      const r=await fetch('/api/practice-tests',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({testId:active?.id,answers:next})});
      if(!r.ok){setSaveState('Draft not saved — keep this test open and retry.');return;}
      if(version===saveVersion.current)setSaveState('Draft saved');
    }).catch(()=>{setSaveState('Draft not saved — check your connection.');});
  }
  async function submit() {
    if(!active||operation.current)return;operation.current=true;setBusy(true);setError(null);
    try {
      await saveChain.current;
      const r=await fetch('/api/practice-tests/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testId:active.id,answers})});const p=await r.json();if(!r.ok)throw new Error(p.error);
      setActive({...active,status:'submitted',result:p.result});setConfirmSubmit(false);onGraded();await loadList();
    }catch(e){setError(e instanceof Error?e.message:'Submission failed. Retry with your answers intact.');}finally{operation.current=false;setBusy(false);}
  }
  const answered=(q:Question)=>q.kind==='multiple_choice'?Number.isInteger(answers[q.id]?.selectedChoice):Boolean(answers[q.id]?.response.trim());
  const completed=questions.filter(answered).length;const current=questions[index];
  if(active?.result) return <section className="testResults">
    <header className="studySectionHeading"><div><span className="tinyLabel">PRACTICE TEST / COMPLETE</span><h2>{active.result.score>=80?'A strong rehearsal.':'Now you know where to focus.'}</h2><p>These graded answers have updated your topic mastery. Review the explanation and original source for each miss.</p></div><StudigoMascot state={active.result.score>=80?'celebrate':'explain'} size={88}/></header>
    <div className="testScore"><strong>{active.result.score}%</strong><span>{active.result.questionCount} questions · full test submitted</span></div>
    <div className="testTopicResults">{active.result.topics.map(t=><div key={t.topic_id}><strong>{t.title}</strong><span>{t.score}% · {t.misses} missed / {t.questions}</span><button onClick={()=>onReviewTopic(t.topic_id)}>{t.misses?'Review concept':'Keep practicing'} →</button></div>)}</div>
    <h3>Every answer, with its evidence.</h3>
    {active.result.reviews.map((q,i)=><details key={q.id} className="testReview" open={!q.is_correct}><summary><span>{i+1}. {q.prompt}</span><b>{q.score}%</b></summary><p><strong>Your answer:</strong> {q.kind==='multiple_choice'?(q.selected_choice===null?'Unanswered':q.choices[q.selected_choice]):q.response||'Unanswered'}</p><p><strong>Expected:</strong> {q.kind==='multiple_choice'?q.choices[q.correct_choice??0]:q.expected_answer}</p><p>{q.feedback}</p><p>{q.explanation}</p><CitationChips citations={q.citations??[]}/></details>)}
    <button className="buttonPrimary" onClick={()=>{setActive(null);setQuestions([]);}}>Back to practice tests →</button>
  </section>;
  if(active&&current) return <section className="testSession">
    <div className="testSessionTop"><div><span className="tinyLabel">PRACTICE TEST / NO ANSWERS UNTIL SUBMISSION</span><h2>Question {index+1} of {questions.length}</h2></div><span role="status">{completed}/{questions.length} answered · {saveState}</span></div>
    <nav className="testQuestionNav" aria-label="Test questions">{questions.map((q,i)=><button key={q.id} disabled={busy} aria-current={i===index?'step':undefined} className={answered(q)?'answered':''} aria-label={`Question ${i+1}${answered(q)?', answered':', unanswered'}`} onClick={()=>setIndex(i)}>{i+1}</button>)}</nav>
    <div className="testQuestion"><span className="tinyLabel">{current.kind==='short_answer'?'SHORT RESPONSE':'MULTIPLE CHOICE'}</span><h3>{current.prompt}</h3>
      {current.kind==='multiple_choice'?<fieldset disabled={busy}><legend className="srOnly">Choose one answer</legend>{current.choices.map((choice,i)=><label key={i} className="testChoice"><input type="radio" name={current.id} checked={answers[current.id]?.selectedChoice===i} onChange={()=>change(current.id,{selectedChoice:i,response:''})}/><span>{choice}</span></label>)}</fieldset>:
      <textarea aria-label="Your answer" rows={5} maxLength={4000} disabled={busy} value={answers[current.id]?.response??''} placeholder="Explain the idea in your own words…" onChange={e=>change(current.id,{selectedChoice:null,response:e.target.value})}/>}
    </div>
    {error&&<p role="alert" className="formError">{error}</p>}
    <div className="testSessionActions"><button disabled={index===0||busy} onClick={()=>setIndex(i=>i-1)}>← Previous</button>{index<questions.length-1?<button className="buttonPrimary" disabled={busy} onClick={()=>setIndex(i=>i+1)}>Next question →</button>:<button className="buttonPrimary" disabled={busy} onClick={()=>setConfirmSubmit(true)}>Finish test →</button>}</div>
    <button className="buttonQuiet" disabled={busy} onClick={()=>setConfirmSubmit(true)}>Review and submit entire test</button>
    {confirmSubmit&&<div className="testSubmitReview" role="region" aria-label="Submit full test"><h3>Ready to submit?</h3><p>{questions.length-completed?`${questions.length-completed} unanswered questions will count as zero.`:'Every question has an answer.'} Submission is final for this test.</p><button disabled={busy} onClick={()=>setConfirmSubmit(false)}>Keep working</button><button className="buttonPrimary" disabled={busy} onClick={()=>void submit()}>{busy?'Grading the full test…':'Submit all answers'}</button></div>}
  </section>;
  return <section className="practiceTestSetup"><header className="studySectionHeading"><div><span className="tinyLabel">REHEARSE THE REAL THING</span><h2>A whole test. One honest result.</h2><p>Multiple topics, weighted toward teacher priorities. A mix of multiple-choice and written answers. Feedback waits until you submit.</p></div></header>
    <label className="field"><span>Questions</span><select value={count} onChange={e=>setCount(Number(e.target.value))} disabled={busy}>{[6,10,15,20].map(n=><option key={n} value={n}>{n} questions</option>)}</select></label>
    <p className="hintText">Covers up to {Math.min(count,topicCount)} of {topicCount} current topics. Choose more questions to cover a larger scope.</p>
    <button className="buttonPrimary" disabled={busy||topicCount<2} onClick={()=>void build()}>{busy?'Building a grounded test…':'Build practice test'} <span>→</span></button>
    {topicCount<2&&<p className="hintText">Add a study guide with at least two topics first. Quiz works for a single topic.</p>}
    {error&&<p className="formError" role="alert">{error}</p>}
    {tests.length>0&&<section className="savedTests"><h3>Your tests</h3>{tests.map(t=><button key={t.id} disabled={busy} onClick={()=>void open(t.id)}><span>{t.status==='draft'?'Continue draft':'Review completed test'}</span><small>{new Date(t.created_at).toLocaleDateString()} · {t.topic_snapshot.length} topics {t.result?`· ${t.result.score}%`:''}</small><span>→</span></button>)}</section>}
  </section>;
}
