import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sessionOperation,readSessionBody} from './durable-session-policy';
const id='00000000-0000-4000-8000-000000000001';
const valid={roomId:id,sessionId:id,requestId:id,expectedRevision:0,action:'start',mode:'study',minutes:30};
test('session input accepts choices but refuses supplied identity, mastery, plan and clocks',()=>{
 assert.equal(sessionOperation(valid).selectedTopicId,null);
 for(const key of ['userId','owner_id','elapsedSeconds','now','started_at','mastery','plan','pendingTopicId'])assert.throws(()=>sessionOperation({...valid,[key]:0}));
 for(const patch of [{expectedRevision:-1},{expectedRevision:0.5},{minutes:'30'},{mode:'bad'},{roomId:'no'},{action:'grade'},{selectedTopicId:'bad'}])assert.throws(()=>sessionOperation({...valid,...patch}));
 assert.equal(sessionOperation({...valid,action:'select',selectedTopicId:null}).selectedTopicId,null);
 assert.throws(()=>sessionOperation({...valid,action:'recommend',selectedTopicId:id}));
});
test('session body enforces byte limit on chunked requests including Unicode',async()=>{
 const request=(body:string)=>new Request('http://localhost',{method:'POST',body});
 assert.deepEqual(await readSessionBody(request(JSON.stringify(valid))),valid);
 await assert.rejects(readSessionBody(request(JSON.stringify({text:'é'.repeat(2200)}))),RangeError);
 await assert.rejects(readSessionBody(request('invalid')),SyntaxError);
 await assert.rejects(readSessionBody(new Request('http://localhost',{method:'POST',body:'{}',headers:{'Content-Length':'4097'}})),RangeError);
});
