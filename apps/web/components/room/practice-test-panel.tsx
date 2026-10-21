"use client";
import { AnswerChoices } from "./answer-choices";
import { TestQuestionPrompt } from "./test-question-prompt";
import { PracticeTestResults, type PracticeTestResult } from "./practice-test-results";
import { AssessmentModePicker } from "./assessment-mode-picker";
import { ReadAloudControl } from "./read-aloud-control";
import { ASSESSMENT_MODES, TEST_QUESTION_COUNTS, spokenQuestion, type AssessmentMode } from "@/lib/practice-assessment";
import { ActivityProgress } from "./activity-progress";
import { useCallback, useEffect, useRef, useState } from 'react';
import { createGestureBook, operationHeaders } from '@/lib/ai-operation-client';
import { ChipSelect, HeaderChip, HeaderMascot } from './mode-header';
import { TopicReadout } from './topic-readout';
import type { Topic } from '@/lib/rooms';
import './phase3-rooms.css';
type Answer={selectedChoice:number|null;response:string};
type Question={id:string;kind:'multiple_choice'|'short_answer'|'true_false'|'fill_blank';prompt:string;choices:string[];topic_id:string};
const usesChoices=(kind:Question['kind'])=>kind==='multiple_choice'||kind==='true_false';
type Result=PracticeTestResult;
type Test={id:string;status:'draft'|'submitted';created_at:string;draft_answers?:Record<string,Answer>;result:Result|null;topic_snapshot:Array<{id:string;title:string;questions:number}>};

export function PracticeTestPanel({roomId,topicCount,topics=[],onGraded,onReviewTopic}:{roomId:string;topicCount:number;topics?:Topic[];onGraded:()=>void;onReviewTopic:(id:string)=>void}) {
  const [tests,setTests]=useState<Test[]>([]);const [active,setActive]=useState<Test|null>(null);const [questions,setQuestions]=useState<Question[]>([]);
  const [answers,setAnswers]=useState<Record<string,Answer>>({});const [index,setIndex]=useState(0);const [count,setCount]=useState(10);
  const [modes,setModes]=useState<AssessmentMode[]>([...ASSESSMENT_MODES]);
  const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);const [saveState,setSaveState]=useState('');const [confirmSubmit,setConfirmSubmit]=useState(false);
  const operation=useRef(false);const saveChain=useRef<Promise<void>>(Promise.resolve());const saveVersion=useRef(0);const gestures=useRef(createGestureBook());
  useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(saveState==='Saving…'||saveState.startsWith('Draft not saved'))event.preventDefault();};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[saveState]);
  const loadList=useCallback(async()=>{try{const r=await fetch(`/api/practice-tests?roomId=${encodeURIComponent(roomId)}`);const p=await r.json();if(!r.ok)throw new Error(p.error);setTests(p.tests);}catch(e){setError(e instanceof Error?e.message:'Could not load tests.');}},[roomId]);
  useEffect(()=>{void loadList();},[loadList]);
  async function open(testId:string) {
    setBusy(true);setError(null);
    try {const r=await fetch(`/api/practice-tests?testId=${encodeURIComponent(testId)}`);const p=await r.json();if(!r.ok)throw new Error(p.error);setActive(p.test);setQuestions(p.questions);setAnswers(p.test.draft_answers??{});setIndex(0);setConfirmSubmit(false);setSaveState('');}
    catch(e){setError(e instanceof Error?e.message:'Could not open test.');}finally{setBusy(false);}
  }
  async function build() {
    if(operation.current||!modes.length)return;const body=JSON.stringify({roomId,count,kinds:modes});const attempt=gestures.current.begin('practice-build',body);if(!attempt.started)return;operation.current=true;setBusy(true);setError(null);
    try {const r=await fetch('/api/practice-tests',{method:'POST',headers:operationHeaders(attempt.id),body});gestures.current.finish('practice-build',r.status);const p=await r.json();if(r.status===202||r.status===409||!r.ok)throw new Error(p.error);await open(p.testId);await loadList();}
    catch(e){gestures.current.abort('practice-build');setError(e instanceof Error?e.message:'Could not build test.');}finally{operation.current=false;setBusy(false);}
  }
  function change(id:string,value:Answer) {
    if(operation.current)return;
    const next={...answers,[id]:value};const version=++saveVersion.current;setAnswers(next);setSaveState('Saving…');
    // Serialize autosaves so an older response cannot overwrite a newer draft.
    saveChain.current=saveChain.current.catch(()=>{}).then(async()=>{
      if(version!==saveVersion.current)return;
      const r=await fetch('/api/practice-tests',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({testId:active?.id,answers:next})});
      if(!r.ok){setSaveState('Draft not saved. Keep this test open and retry.');return;}
      if(version===saveVersion.current)setSaveState('Draft saved');
    }).catch(()=>{setSaveState('Draft not saved. Check your connection.');});
  }
  async function submit() {
    if(!active||operation.current)return;const body=JSON.stringify({testId:active.id,answers});const attempt=gestures.current.begin(`practice-submit:${active.id}`,body);if(!attempt.started)return;operation.current=true;setBusy(true);setError(null);
    try {
      await saveChain.current;
      const r=await fetch('/api/practice-tests/submit',{method:'POST',headers:operationHeaders(attempt.id),body});gestures.current.finish(`practice-submit:${active.id}`,r.status);const p=await r.json();if(r.status===202||r.status===409||!r.ok)throw new Error(p.error);
      setActive({...active,status:'submitted',result:p.result});setConfirmSubmit(false);onGraded();await loadList();
    }catch(e){gestures.current.abort(`practice-submit:${active.id}`);setError(e instanceof Error?e.message:'Submission failed. Retry with your answers intact.');}finally{operation.current=false;setBusy(false);}
  }
  const answered=(q:Question)=>usesChoices(q.kind)?Number.isInteger(answers[q.id]?.selectedChoice):Boolean(answers[q.id]?.response.trim());
  const completed=questions.filter(answered).length;const current=questions[index];
  if(active?.result) return <PracticeTestResults key={active.id} result={active.result} createdAt={active.created_at}
    onReviewTopic={onReviewTopic} onBack={()=>{setActive(null);setQuestions([]);}} />;
  if(active&&current) return <section className="testSession roomStudioTest">
    <div className="testSessionTop"><div><span className="tinyLabel">INDEPENDENT REHEARSAL / ANSWERS AFTER SUBMISSION</span><h2>Question {index+1} of {questions.length}</h2></div><span role="status">{completed}/{questions.length} answered · {saveState}</span></div>
    <ActivityProgress current={index+1} total={questions.length} completed={completed} label="Question"/>
    <nav className="testQuestionNav" aria-label="Test questions">{questions.map((q,i)=><button key={q.id} disabled={busy} aria-current={i===index?'step':undefined} className={answered(q)?'answered':''} aria-label={`Question ${i+1}${answered(q)?', answered':', unanswered'}`} onClick={()=>setIndex(i)}>{i+1}</button>)}</nav>
    <div className="testQuestion"><span className="tinyLabel">{current.kind==='short_answer'?'SHORT RESPONSE':current.kind==='fill_blank'?'FILL IN THE BLANK':current.kind==='true_false'?'TRUE OR FALSE':'MULTIPLE CHOICE'}</span><TestQuestionPrompt prompt={current.prompt} kind={current.kind} />
      <ReadAloudControl key={current.id} text={spokenQuestion(current)} label="Read question and choices aloud"/><p className="roomStudioInstruction">This is a draft until you submit the full test. You can revisit any question.</p>
      {usesChoices(current.kind)?<AnswerChoices choices={current.choices} binary={current.kind==='true_false'} selected={answers[current.id]?.selectedChoice??null} disabled={busy} onSelect={i=>change(current.id,{selectedChoice:i,response:''})}/>:
      current.kind==='fill_blank'?<input className="blankInput" aria-label="Fill in the blank" maxLength={120} autoComplete="off" disabled={busy} value={answers[current.id]?.response??''} placeholder="Missing word or phrase…" onChange={e=>change(current.id,{selectedChoice:null,response:e.target.value})}/>:
      <textarea aria-label="Your answer" rows={5} maxLength={4000} disabled={busy} value={answers[current.id]?.response??''} placeholder="Explain the idea in your own words…" onChange={e=>change(current.id,{selectedChoice:null,response:e.target.value})}/>}
    </div>
    {error&&<p role="alert" className="formError">{error}</p>}
    <div className="testSessionActions"><button disabled={index===0||busy} onClick={()=>setIndex(i=>i-1)}>← Previous</button>{index<questions.length-1?<button className="buttonPrimary" disabled={busy} onClick={()=>setIndex(i=>i+1)}>Next question →</button>:<button className="buttonPrimary" disabled={busy} onClick={()=>setConfirmSubmit(true)}>Finish test →</button>}</div>
    {saveState.startsWith('Draft not saved')&&<p className="formError" role="alert">{saveState} <button type="button" disabled={busy} onClick={()=>change(current.id,answers[current.id]??{selectedChoice:null,response:''})}>Retry saving draft</button></p>}
    <button className="buttonQuiet" disabled={busy} onClick={()=>setConfirmSubmit(true)}>Review and submit entire test</button>
    {confirmSubmit&&<div className="testSubmitReview" role="region" aria-label="Submit full test"><h3>Ready to submit?</h3><p>{questions.length-completed?`${questions.length-completed} unanswered questions will count as zero.`:'Every question has an answer.'} Submission is final for this test.</p><button disabled={busy} onClick={()=>setConfirmSubmit(false)}>Keep working</button><button className="buttonPrimary" disabled={busy} onClick={()=>void submit()}>{busy?'Grading the full test…':'Submit all answers'}</button></div>}
  </section>;
  return <section className="practiceTestSetup roomStudioSetup">
    <div className="setupMain">
    <HeaderChip><ChipSelect label={`${count} questions`} ariaLabel="Number of test questions" value={String(count)} onChange={v=>setCount(Number(v))} disabled={busy}>{TEST_QUESTION_COUNTS.map(n=><option key={n} value={n}>{n} questions</option>)}</ChipSelect></HeaderChip>
    <div className="setupHeading"><span className="tinyLabel">PRACTICE STUDIO / FULL REHEARSAL</span><h3>{count} questions</h3></div>
    <p className="setupLead">A full test, graded when you submit.</p>
    <p className="hintText">Covers up to {Math.min(count,topicCount)} of {topicCount} current topics. Choose more questions to cover a larger scope.</p>
    <AssessmentModePicker value={modes} onChange={setModes} disabled={busy} />
    <button className="buttonPrimary" disabled={busy||topicCount<2||modes.length===0} onClick={()=>void build()}>{busy?'Building a grounded test…':'Build practice test'} <span>→</span></button>
    {topicCount<2&&<p className="hintText">Add a study guide with at least two topics first. Quiz works for a single topic.</p>}
    {error&&<p className="formError" role="alert">{error}</p>}
    </div>
    <div className="setupAside">
    <TopicReadout topics={topics} heading="TOPICS IN SCOPE"/>
    {tests.length>0&&<section className="savedTests"><h3>Your tests</h3>{tests.map(t=><button key={t.id} disabled={busy} onClick={()=>void open(t.id)}><span>{t.status==='draft'?'Continue draft':'Review completed test'}</span><small>{new Date(t.created_at).toLocaleDateString()} · {t.topic_snapshot.length} topics {t.result?`· ${t.result.score}%`:''}</small><span>→</span></button>)}</section>}
    </div>
  </section>;
}
