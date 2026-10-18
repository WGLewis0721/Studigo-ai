import assert from 'node:assert/strict';
import {test} from 'node:test';
import {topicEvidenceLabel,practiceCoverage} from './progress-view';
import type {Topic} from './rooms';
const topic={last_practiced_at:null,mastery_score:0,status:'not_started'} as Topic;
const canonical={schemaVersion:1,revision:3,stage:'independent',reviewDue:false,needsCheck:false,dueAt:null,reasoningLevel:2,scaffoldLevel:0,rematchAt:null,supported:true} as const;
test('canonical stage replaces compatibility percentages even when numbers disagree',()=>{
 assert.equal(topicEvidenceLabel({...topic,mastery_score:100,canonical}), 'Independent recall');
 assert.equal(topicEvidenceLabel({...topic,canonical:{...canonical,needsCheck:true}}),'Needs another check');
 assert.equal(topicEvidenceLabel({...topic,canonical:{...canonical,supported:false}}),'Source unavailable');
});
test('unpracticed topics never claim a score; legacy practice scores name their meaning',()=>{
 assert.equal(topicEvidenceLabel({...topic,mastery_score:99}),'Not practiced');
 assert.equal(topicEvidenceLabel({...topic,last_practiced_at:'2026-10-17',mastery_score:63}),'63% saved practice score');
});
test('coverage is a count of topics practiced, not readiness or a predicted grade',()=>{
 assert.equal(practiceCoverage(3,8),38);assert.equal(practiceCoverage(0,0),0);assert.equal(practiceCoverage(9,8),100);
});
