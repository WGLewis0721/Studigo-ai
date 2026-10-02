import { randomUUID } from 'node:crypto';
import type { LocalBetaStore } from './local-beta';
import { applyBetaAction,BetaError } from './local-beta';
type Local={id:string;store:LocalBetaStore};
export function createLocalRoom(local:Local,title:string) {
  return local.store.transact(local.id,'create-room:'+randomUUID(),{title},state=>{
    const next=applyBetaAction(state,{action:'createRoom',interactionId:randomUUID(),revision:state.revision,title},new Date().toISOString());
    return {state:next,response:next.currentRoomId};
  });
}
export function updateLocalRoom(local:Local,input:{id:string;title:string;subject:string|null;courseName:string|null;testDate:string|null;level:string}) {
  return local.store.transact(local.id,'room-settings:'+randomUUID(),input,state=>{
    const room=state.rooms[input.id];if(!room)throw new BetaError('Room not found',404);
    if(!input.title.trim()||input.title.length>160||!['simpler','standard','deeper'].includes(input.level))throw new BetaError('Invalid room settings');
    room.room.title=input.title;room.room.subject=input.subject??'';room.explainLevel=input.level as typeof room.explainLevel;
    Object.assign(room,{testDate:input.testDate,courseName:input.courseName});
    const data=(state as typeof state&{integration?:{preferences:Record<string,{explainLevel:string}>}}).integration;
    if(data?.preferences[input.id])data.preferences[input.id].explainLevel=input.level;
    return {state,response:true};
  });
}
export function deleteLocalRoom(local:Local,id:string) {
  local.store.transact(local.id,'delete-room:'+randomUUID(),{id},state=>{
    if(!state.rooms[id])throw new BetaError('Room not found',404);delete state.rooms[id];state.currentRoomId=Object.keys(state.rooms)[0]??'';
    const data=(state as typeof state&{integration?:{questions:Record<string,{encounter:{spec:{concept:{roomId:string}}}}>;
      tests:Record<string,{roomId:string}>;cards:Record<string,{roomId:string}>;preferences:Record<string,unknown>;learnPreferences?:Record<string,unknown>;plan:Record<string,unknown>;activeBatch:string[]|null}}).integration;
    if(data){for(const [key,q] of Object.entries(data.questions))if(q.encounter.spec.concept.roomId===id)delete data.questions[key];
      for(const [key,t] of Object.entries(data.tests))if(t.roomId===id)delete data.tests[key];for(const [key,c] of Object.entries(data.cards))if(c.roomId===id)delete data.cards[key];
      delete data.preferences[id];if(data.learnPreferences)delete data.learnPreferences[id];delete data.plan[id];data.activeBatch=data.activeBatch?.filter(key=>Boolean(data.questions[key]))??null;}
    return {state,response:true};
  });
}
