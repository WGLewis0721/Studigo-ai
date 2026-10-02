import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCases } from './cases.mjs';
import { scoreRun,selectArchitecture,hash } from './score.mjs';
function fixture() {
  const cases=buildCases();for(const c of cases)c.review={status:'reviewed',reviewer:'unit-test-only'};
  const results=cases.map(c=>({caseId:c.id,abstained:c.expected.abstain,retrieved:[...c.permitted],claims:c.expected.abstain?[]:[{id:'1',text:c.expected.answer,sources:[c.permitted[0]]}],toolCalls:[],latencyMs:100,costUsd:.001}));
  const reviews=results.map(r=>({caseId:r.caseId,answerHash:hash({abstained:r.abstained,claims:r.claims}),reviewer:'unit-test-only',useful:true,correctAbstention:true,claims:r.claims.map(c=>({claimId:c.id,textHash:hash(c.text),supported:true}))}));
  return {cases,run:{schemaVersion:1,adapter:'typescript',corpusHash:hash(cases),config:{model:'fixture',embeddingHash:'fixture',promptHash:'fixture',temperature:0},results},reviews};
}
test('120 authored cases cover both bands, three subject groups and source threats',()=>{
  const cases=buildCases();assert.equal(cases.length,120);assert.equal(new Set(cases.map(c=>c.id)).size,120);assert.ok(cases.every(c=>c.review.status==='pending'));
  for(const band of ['3-5','6-8'])assert.equal(cases.filter(c=>c.band===band).length,60);
  assert.equal(cases.filter(c=>c.scenario==='deleted').every(c=>!c.permitted.length),true);
});
test('equivalent reviewed fixtures retain TypeScript; missing review cannot pass',()=>{
  const {cases,run,reviews}=fixture(),a=scoreRun(cases,run,reviews),b=scoreRun(cases,{...run,adapter:'python-langchain'},reviews);
  assert.equal(selectArchitecture(a,b).choice,'typescript');assert.equal(selectArchitecture(a,scoreRun(cases,{...run,adapter:'python-langchain'},[])).choice,'pending');
});
test('foreign retrieval, changed revisions and tool calls block selection even with citations',()=>{
  const {cases,run,reviews}=fixture();run.results[0].retrieved.push({id:'foreign',revision:1});run.results[0].toolCalls=['award_mastery'];run.results[1].claims[0].sources=[{...run.results[1].claims[0].sources[0],revision:999}];
  const a=scoreRun(cases,run,reviews);assert.ok(a.violations>=3);assert.equal(selectArchitecture(a,{...a,adapter:'python-langchain'}).choice,'pending');
});
test('citation marker membership alone does not establish claim support',()=>{
  const {cases,run,reviews}=fixture();for(const r of reviews)for(const c of r.claims)c.supported=false;
  assert.equal(scoreRun(cases,run,reviews).citationSupport,0);
});
test('duplicate/missing cases and unequal model or prompt settings cannot be compared',()=>{
  const {cases,run,reviews}=fixture();assert.throws(()=>scoreRun(cases,{...run,results:run.results.slice(1)},reviews));
  const a=scoreRun(cases,run,reviews);assert.throws(()=>selectArchitecture(a,{...a,adapter:'python-langchain',configHash:'different'}));
});
test('performance benefit obeys the two-point aggregate and grade-band regression boundary',()=>{
  const {cases,run,reviews}=fixture(),a=scoreRun(cases,run,reviews);
  for(const metric of ['citationSupport','abstentionAccuracy','quality']) {
    for(const delta of [.01,.02,.021]) {
      const b={...a,adapter:'python-langchain',p95Ms:50,[metric]:a[metric]-delta};
      assert.equal(selectArchitecture(a,b).choice,delta>.02?'typescript':'python-candidate');
    }
  }
  const bands=structuredClone(a.bands);bands['3-5'].useful-=2;
  assert.equal(selectArchitecture(a,{...a,adapter:'python-langchain',p95Ms:50,bands}).choice,'typescript');
  bands['3-5'].useful++;
  assert.equal(selectArchitecture(a,{...a,adapter:'python-langchain',p95Ms:50,bands}).choice,'python-candidate');
  assert.equal(selectArchitecture(a,{...a,adapter:'python-langchain',p95Ms:50}).choice,'python-candidate');
});
test('matching case counts cannot conceal a different permission corpus',()=>{
  const {cases,run,reviews}=fixture(),a=scoreRun(cases,run,reviews);
  assert.throws(()=>selectArchitecture(a,{...a,adapter:'python-langchain',corpusHash:'different'}),/settings differ/);
});
