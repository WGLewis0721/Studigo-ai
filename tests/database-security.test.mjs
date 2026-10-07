import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { createHash } from 'node:crypto';

// Execute the actual migrations in embedded PostgreSQL, including pgvector,
// grants, RLS and transactional functions. Supabase auth/storage catalogs are
// minimal fixtures; hosted Auth and Storage HTTP behavior still needs live verification.
let db;
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const PRE_MIGRATION = '00000000-0000-4000-8000-000000000004';
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function as(role, uid, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await fn(); } finally { await db.exec('reset role'); }
}
const one = async (q, args=[]) => (await db.query(q,args)).rows[0];
before(async () => {
  db = new PGlite({ extensions: { vector } });
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
    grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
    grant all on storage.objects to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `);
  for (const file of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()) {
    if (file === '20261007180000_beta_retention.sql') {
      await db.query('insert into auth.users(id) values($1)', [PRE_MIGRATION]);
    }
    const sql = await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8');
    // Core PG has gen_random_uuid; the pgcrypto extension is not packaged in PGlite.
    await db.exec(sql.replace('create extension if not exists pgcrypto;', ''));
  }
  await db.query('insert into auth.users(id) values($1),($2)',[A,B]);
  for (const [owner,n] of [[A,1],[B,2]]) {
    await db.query('insert into study_rooms(id,owner_id,title) values($1,$2,$3)',[id(n),owner,`Room ${n}`]);
    await db.query(`insert into documents(id,room_id,owner_id,name,mime_type,size_bytes,storage_path,status) values($1,$2,$3,'chapter.pdf','application/pdf',10,$4,'ready')`,[id(n+10),id(n),owner,`${owner}/${id(n)}/chapter.pdf`]);
    await db.query(`insert into document_chunks(id,document_id,room_id,owner_id,chunk_index,content,page_number) values($1,$2,$3,$4,0,'Photosynthesis uses sunlight.',2)`,[id(n+20),id(n+10),id(n),owner]);
    await db.query(`insert into topics(id,room_id,owner_id,title,objective,source_document_ids) values($1,$2,$3,'Photosynthesis','Explain photosynthesis',array[$4::uuid])`,[id(n+30),id(n),owner,id(n+10)]);
    await db.query(`insert into conversations(id,room_id,owner_id) values($1,$2,$3)`,[id(n+40),id(n),owner]);
    await db.query(`insert into messages(id,conversation_id,role,content) values($1,$2,'user','Explain it')`,[id(n+50),id(n+40)]);
    await db.query(`insert into quiz_questions(id,room_id,owner_id,topic_id,prompt,choices,correct_choice,expected_answer,explanation) values($1,$2,$3,$4,'Energy source?','["Sun","Moon","Wind","Rock"]',0,'Sun','Sunlight supplies energy')`,[id(n+60),id(n),owner,id(n+30)]);
    await db.query(`insert into quiz_attempts(id,room_id,owner_id,topic_id,is_correct,score) values($1,$2,$3,$4,true,100)`,[id(n+70),id(n),owner,id(n+30)]);
    await db.query(`insert into flashcards(id,room_id,owner_id,topic_id,front,back) values($1,$2,$3,$4,'Energy?','Sun')`,[id(n+80),id(n),owner,id(n+30)]);
    await db.query(`insert into storage.objects(bucket_id,name) values('study-materials',$1)`,[`${owner}/${id(n)}/chapter.pdf`]);
  }
});
after(async()=> { await db?.close(); });

test('Coaching settings persist for the room owner and remain isolated', async()=>{
  const chosen = JSON.stringify({coach_mode:'challenge',style:'default',tradition:'tradition-default',practice:'transfer'});
  await as('authenticated',A,async()=>{
    const saved = await one(`update study_rooms set coach_preferences=$1, explain_level='simpler' where id=$2 returning coach_preferences, explain_level`,[chosen,id(1)]);
    assert.equal(saved.coach_preferences.coach_mode,'challenge');
    assert.equal(saved.coach_preferences.style,'default');
    assert.equal(saved.explain_level,'simpler');
    assert.equal((await db.query(`update study_rooms set coach_preferences=$1 where id=$2 returning id`,[chosen,id(2)])).rows.length,0);
    await assert.rejects(db.query(`update study_rooms set coach_preferences='{}' where id=$1`,[id(1)]),e=>e.code==='23514');
    await assert.rejects(db.query(`update study_rooms set coach_preferences='{"style":null,"tradition":"tradition-default","practice":"adaptive"}' where id=$1`,[id(1)]),e=>e.code==='23514');
    await assert.rejects(db.query(`update study_rooms set coach_preferences='{"style":"unknown","tradition":"tradition-default","practice":"adaptive"}' where id=$1`,[id(1)]),e=>e.code==='23514');
    await assert.rejects(db.query(`update study_rooms set coach_preferences='{"coach_mode":"expert","style":"default","tradition":"tradition-default","practice":"adaptive"}' where id=$1`,[id(1)]),e=>e.code==='23514');
    await db.query(`update study_rooms set coach_preferences='{"coach_mode":"coach","style":"default","tradition":"tradition-default","practice":"adaptive"}' where id=$1`,[id(1)]);
    await db.query(`update study_rooms set explain_level='standard' where id=$1`,[id(1)]);
  });
  assert.equal((await one('select coach_preferences from study_rooms where id=$1',[id(2)])).coach_preferences.style,'default');
});

test('Learn preferences are owner-scoped and do not create a second explanation level', async()=>{
  await as('authenticated',A,async()=>{
    const own=await one(`update study_rooms
      set learn_preferences='{"mode":"examples_first"}'
      where id=$1 returning explain_level,learn_preferences`,[id(1)]);
    assert.equal(own.explain_level,'standard');
    assert.equal(own.learn_preferences.mode,'examples_first');
    assert.equal((await db.query(`update study_rooms set learn_preferences='{"mode":"overview"}' where id=$1 returning id`,[id(2)])).rows.length,0);
    await assert.rejects(db.query(`update study_rooms set learn_preferences='{"mode":"adaptive"}' where id=$1`,[id(1)]),e=>e.code==='23514');
    await assert.rejects(db.query(`update study_rooms set learn_preferences='{}' where id=$1`,[id(1)]),e=>e.code==='23514');
    await db.query(`update study_rooms set learn_preferences='{"mode":"step_by_step"}' where id=$1`,[id(1)]);
  });
  const row=await one('select explain_level,learn_preferences from study_rooms where id=$1',[id(1)]);
  assert.equal(row.explain_level,'standard');
  assert.equal(row.learn_preferences.mode,'step_by_step');
});

for (const [table,offset,column] of [
  ['study_rooms',0,'title'],['documents',10,'name'],['document_chunks',20,'content'],
  ['topics',30,'mastery_score'],['conversations',40,'title'],['messages',50,'content'],
  ['quiz_questions',60,'prompt'],['quiz_attempts',70,'score'],['flashcards',80,'front']
]) {
  test(`User A cannot read, update or delete User B ${table}`, async()=>{
    await as('authenticated', A, async()=>{
      assert.equal((await db.query(`select id from ${table} where id=$1`,[id(offset+2)])).rows.length,0);
      assert.equal((await db.query(`select id from ${table} where id=$1`,[id(offset+1)])).rows.length,1);
      for(const sql of [`update ${table} set ${column}=${column} where id=$1 returning id`,`delete from ${table} where id=$1 returning id`]) {
        try { assert.equal((await db.query(sql,[id(offset+2)])).rows.length,0); }
        catch(e) { if (e.code !== '42501') throw e; }
      }
    });
    assert.ok(await one(`select id from ${table} where id=$1`,[id(offset+2)]));
  });
}
test('Browser cannot select any private quiz answer column, even on own questions', async()=>{
  await as('authenticated',A,async()=>{
    for(const col of ['correct_choice','expected_answer','explanation','citations','*'])
      await assert.rejects(db.query(`select ${col} from quiz_questions where id=$1`,[id(61)]),e=>e.code==='42501');
  });
});
test('Browser cannot forge chunks, mastery, attempts or card schedules',async()=>{
  await as('authenticated',A,async()=>{
    for(const sql of [
      `insert into document_chunks(document_id,room_id,owner_id,chunk_index,content) values('${id(12)}','${id(1)}','${A}',4,'Injected')`,
      `insert into quiz_attempts(room_id,owner_id,topic_id,is_correct,score) values('${id(1)}','${A}','${id(31)}',true,100)`,
      `update quiz_attempts set score=100 where owner_id='${A}'`,
      `update topics set mastery_score=100 where owner_id='${A}'`,
      `update flashcards set repetitions=100 where owner_id='${A}'`,
      `update documents set attempts=0 where owner_id='${A}'`,
      `select review_flashcard('${id(81)}','${A}',3,gen_random_uuid())`,
      `select record_quiz_attempt('${id(61)}','${A}',null,0,100,true,'forged',3)`,
      `select claim_document('${id(11)}','${A}')`,
      `select recalculate_mastery('${id(31)}')`
    ]) await assert.rejects(db.exec(sql),e=>e.code==='42501');
  });
});
test('Composite ownership constraints reject a service-written mismatched chunk',async()=>{
  await as('service_role',A,async()=>{
    await assert.rejects(db.query(`insert into document_chunks(document_id,room_id,owner_id,chunk_index,content) values($1,$2,$3,2,'bad')`,[id(12),id(1),A]),e=>e.code==='23503');
  });
});
test('Room and conversation reassignment cannot cross owners',async()=>{
  await as('authenticated',A,async()=>{
    await assert.rejects(db.query(`insert into study_rooms(owner_id,title) values($1,'Bad')`,[B]),e=>e.code==='42501');
    await assert.rejects(db.query(`update study_rooms set owner_id=$1 where id=$2`,[B,id(1)]),e=>e.code==='42501');
    await assert.rejects(db.query(`update conversations set room_id=$1 where id=$2`,[id(2),id(41)]),e=>['42501','23503'].includes(e.code));
    await assert.rejects(db.query(`insert into messages(conversation_id,role,content) values($1,'user','bad')`,[id(42)]),e=>e.code==='42501');
  });
});
test('Coach state and message identity are server-owned',async()=>{
  await as('authenticated',A,async()=>{
    await assert.rejects(
      db.query(`update conversations set coach_state='{"version":1,"kind":"idle","forged":true}'::jsonb where id=$1`,[id(41)]),
      e=>e.code==='42501'
    );
    await assert.rejects(
      db.query(`insert into messages(conversation_id,role,content) values($1,'assistant','forged history')`,[id(41)]),
      e=>e.code==='42501'
    );
    await assert.rejects(
      db.query(`insert into conversations(room_id,owner_id,title,coach_state) values($1,$2,'Forged','{"version":1,"kind":"idle","forged":true}'::jsonb)`,[id(1),A]),
      e=>e.code==='42501'
    );
    const shell=await one(`insert into conversations(room_id,owner_id,title) values($1,$2,'Learner title') returning id,coach_state`,[id(1),A]);
    assert.deepEqual(shell.coach_state,{version:1,kind:'idle'});
    await db.query(`update conversations set title='Renamed by learner' where id=$1`,[shell.id]);
    assert.equal((await one(`select title from conversations where id=$1`,[shell.id])).title,'Renamed by learner');
    await db.query(`delete from conversations where id=$1`,[shell.id]);
  });
  await as('service_role',A,async()=>{
    await db.query(`update conversations set coach_state='{"version":1,"kind":"idle"}'::jsonb where id=$1`,[id(41)]);
    await db.query(`insert into messages(conversation_id,role,content) values($1,'assistant','trusted history')`,[id(41)]);
  });
});

test('Stored-original policies prevent cross-owner listing, creation and deletion',async()=>{
  await as('authenticated',A,async()=>{
    assert.equal((await db.query(`select name from storage.objects`)).rows.length,1);
    assert.equal((await db.query(`delete from storage.objects where name like $1 returning id`,[`${B}/%`])).rows.length,0);
    await assert.rejects(db.query(`insert into storage.objects(bucket_id,name) values('study-materials',$1)`,[`${B}/stolen.pdf`]),e=>e.code==='42501');
  });
});
test('Anonymous Auth sessions cannot create rooms, conversations, plan events or stored originals',async()=>{
  await db.exec(`select set_config('request.jwt.claims','{"is_anonymous":true}',false)`);
  try {
    await as('authenticated',A,async()=>{
      await assert.rejects(db.query(`insert into study_rooms(owner_id,title) values($1,'Anon room')`,[A]),e=>e.code==='42501');
      await assert.rejects(db.query(`insert into conversations(room_id,owner_id,title) values($1,$2,'Anon chat')`,[id(1),A]),e=>e.code==='42501');
      await assert.rejects(db.query(`insert into study_plan_events(room_id,owner_id,plan_day,action_key,status) values($1,$2,'2026-10-07','anon','completed')`,[id(1),A]),e=>e.code==='42501');
      await assert.rejects(db.query(`insert into storage.objects(bucket_id,name) values('study-materials',$1)`,[`${A}/anon.pdf`]),e=>e.code==='42501');
      // Existing owner-scoped reads are unchanged.
      assert.equal((await db.query(`select id from study_rooms`)).rows.length,1);
    });
  } finally { await db.exec(`select set_config('request.jwt.claims','',false)`); }
  await as('authenticated',A,async()=>{
    const room=(await db.query(`insert into study_rooms(owner_id,title) values($1,'Real room') returning id`,[A])).rows[0].id;
    await db.query(`delete from study_rooms where id=$1`,[room]);
  });
  const bucket=await one(`select file_size_limit, allowed_mime_types from storage.buckets where id='study-materials'`);
  assert.equal(Number(bucket.file_size_limit),52428800);
  assert.ok(bucket.allowed_mime_types.includes('application/pdf'));
  assert.ok(!bucket.allowed_mime_types.includes('text/html'));
});
test('Atomic ingestion claim enforces 3 attempts and excludes simultaneous claims',async()=>{
  await db.query(`update documents set status='queued',attempts=0 where id=$1`,[id(11)]);
  await as('service_role',A,async()=>{
    for(let n=1;n<=3;n++){
      assert.equal((await one('select claim_document($1,$2) as claimed',[id(11),A])).claimed,true);
      if(n<3) assert.equal((await one('select claim_document($1,$2) as claimed',[id(11),A])).claimed,false);
      await db.query(`update documents set status='failed' where id=$1`,[id(11)]);
    }
    await assert.rejects(db.query('select claim_document($1,$2)',[id(11),A]),/retry limit/);
  });
  assert.equal((await one('select attempts from documents where id=$1',[id(11)])).attempts,3);
});
test('Review commits once and retry cannot inflate mastery',async()=>{
  const request=id(100);
  await as('service_role',A,async()=>{
    const result=(await one('select review_flashcard($1,$2,3,$3) as result',[id(81),A,request])).result;
    assert.equal(result.intervalDays,1); assert.ok(result.mastery>0);
    const replay=(await one('select review_flashcard($1,$2,3,$3) as result',[id(81),A,request])).result;
    assert.equal(replay.alreadySaved,true);
    await assert.rejects(db.query('select review_flashcard($1,$2,3,$3)',[id(81),A,id(101)]),/already been reviewed/);
  });
  assert.equal((await one('select count(*)::int as n from quiz_attempts where request_id=$1',[request])).n,1);
});
test('Failure during mastery calculation rolls back both schedule and attempt',async()=>{
  await db.exec(`create function public.fail_mastery_test() returns trigger language plpgsql as $$ begin raise exception 'forced mastery failure'; end $$;
    create trigger fail_mastery_test before update on topics for each row execute function public.fail_mastery_test();`);
  const prior=await one('select repetitions,due_at from flashcards where id=$1',[id(82)]);
  try {
    await as('service_role',B,()=>assert.rejects(db.query('select review_flashcard($1,$2,3,$3)',[id(82),B,id(102)]),/forced mastery failure/));
    assert.deepEqual(await one('select repetitions,due_at from flashcards where id=$1',[id(82)]),prior);
    assert.equal((await one('select count(*)::int as n from quiz_attempts where request_id=$1',[id(102)])).n,0);
  } finally { await db.exec('drop trigger fail_mastery_test on topics; drop function fail_mastery_test();'); }
});
test('Quiz retries return original grade, not another mastery-producing attempt',async()=>{
  await as('service_role',A,async()=>{
    for(const score of [0,100]) {
      const r=(await one('select record_quiz_attempt($1,$2,null,1,$3,false,\'Wrong\') as r',[id(61),A,score])).r;
      assert.equal(r.score,0);
    }
  });
  assert.equal((await one('select count(*)::int as n from quiz_attempts where question_id=$1',[id(61)])).n,1);
});
test('Whole practice tests hide keys, reject cross-user access and commit grading exactly once',async()=>{
  await db.query(`insert into topics(id,room_id,owner_id,title,objective) values($1,$2,$3,'Respiration','Explain respiration')`,[id(120),id(1),A]);
  const questions=[id(31),id(120)].map((topic_id,i)=>({topic_id,kind:i?'short_answer':'multiple_choice',prompt:'Explain energy',choices:i?[]:['Sun','Moon','Wind','Rock'],correct_choice:i?null:0,expected_answer:i?'Sunlight':null,explanation:'Energy comes from sunlight.',citations:[],difficulty:'core'}));
  const exam=await as('service_role',A,async()=>(await one('select create_practice_test($1,$2,$3,$4) as id',[id(1),A,'[]',JSON.stringify(questions)])).id);
  await as('authenticated',B,async()=>{
    assert.equal((await db.query('select * from practice_tests where id=$1',[exam])).rows.length,0);
    assert.equal((await db.query('select id,prompt from quiz_questions where practice_test_id=$1',[exam])).rows.length,0);
    await assert.rejects(db.query(`insert into study_plan_events(room_id,owner_id,plan_day,action_key,status) values($1,$2,'2026-09-12','learn:a','completed')`,[id(1),B]),e=>['42501','23503'].includes(e.code));
  });
  await as('authenticated',A,async()=>{
    assert.equal((await one('select result from practice_tests where id=$1',[exam])).result,null);
    assert.equal((await db.query('select id,prompt,choices from quiz_questions where practice_test_id=$1',[exam])).rows.length,2);
    await assert.rejects(db.query('select expected_answer from quiz_questions where practice_test_id=$1',[exam]),e=>e.code==='42501');
    await assert.rejects(db.query(`update practice_tests set status='submitted',result='{"score":100}' where id=$1`,[exam]),e=>e.code==='42501');
    await assert.rejects(db.query('select submit_practice_test($1,$2,$3,$4)',[exam,A,'[]','{}']),e=>e.code==='42501');
    await db.query(`insert into study_plan_events(room_id,owner_id,plan_day,action_key,status) values($1,$2,'2026-09-12','learn:a','completed')`,[id(1),A]);
  });
  await as('authenticated',B,async()=>assert.equal((await db.query('select * from study_plan_events where room_id=$1',[id(1)])).rows.length,0));
  const rows=(await db.query('select id from quiz_questions where practice_test_id=$1 order by test_position',[exam])).rows;
  const grades=rows.map((q,i)=>({id:q.id,response:i?'Sunlight':'',selected_choice:i?null:0,score:i?0:100,is_correct:!i,feedback:'Feedback'}));
  await as('service_role',A,()=>assert.rejects(db.query('select submit_practice_test($1,$2,$3,$4)',[exam,A,JSON.stringify(grades.slice(0,1)),'{}']),/exactly once/));
  await db.exec(`create function public.fail_test_grade() returns trigger language plpgsql as $$ begin if new.id='${id(120)}' then raise exception 'forced second topic failure'; end if; return new; end $$;
    create trigger fail_test_grade before update on topics for each row execute function public.fail_test_grade();`);
  try {
    await as('service_role',A,()=>assert.rejects(db.query('select submit_practice_test($1,$2,$3,$4)',[exam,A,JSON.stringify(grades),'{}']),/forced second topic failure/));
    assert.equal((await one('select count(*)::int as n from quiz_attempts where question_id=any($1::uuid[])',[rows.map(q=>q.id)])).n,0);
    assert.equal((await one('select status from practice_tests where id=$1',[exam])).status,'draft');
  } finally { await db.exec('drop trigger fail_test_grade on topics; drop function fail_test_grade();'); }
  await as('service_role',A,async()=>{
    const result=(await one('select submit_practice_test($1,$2,$3,$4) as result',[exam,A,JSON.stringify(grades),'{}'])).result;
    assert.equal(result.score,50);assert.equal(result.topics.length,2);assert.equal(result.reviews.length,2);
    const replay=(await one('select submit_practice_test($1,$2,$3,$4) as result',[exam,A,'[]','{}'])).result;
    assert.deepEqual(replay,result);
  });
  assert.equal((await one('select count(*)::int as n from quiz_attempts where question_id=any($1::uuid[])',[rows.map(q=>q.id)])).n,2);
});
test('Revised study scope preserves matching mastery, refreshes sources, deactivates removed topics',async()=>{
  await db.query(`update documents set status='ready',source_type='study_guide' where id=$1`,[id(11)]);
  await db.query(`insert into topics(id,room_id,owner_id,title,objective) values($1,$2,$3,'Obsolete','Gone')`,[id(110),id(1),A]);
  const old=await one('select mastery_score from topics where id=$1',[id(31)]);
  const map=[{title:'Photosynthesis',objective:'Explain photosynthesis',keyTerms:['Sun'],priority:100,evidence:[]}];
  await as('service_role',A,()=>db.query('select refresh_topic_map($1,$2,$3,true,$4)',[id(1),A,id(11),JSON.stringify(map)]));
  assert.equal((await one('select active from topics where id=$1',[id(110)])).active,false);
  const updated=await one('select mastery_score,source_document_ids from topics where id=$1',[id(31)]);
  assert.equal(updated.mastery_score,old.mastery_score); assert.deepEqual(updated.source_document_ids,[id(11)]);
  map[0].objective='Explain a different skill';
  await as('service_role',A,()=>db.query('select refresh_topic_map($1,$2,$3,true,$4)',[id(1),A,id(11),JSON.stringify(map)]));
  assert.equal((await one('select active from topics where id=$1',[id(31)])).active,false);
  assert.equal(Number((await one('select mastery_score from topics where room_id=$1 and active',[id(1)])).mastery_score),0);
  await as('authenticated',A,async()=>assert.equal((await one('select * from room_readiness($1)',[id(1)])).topic_count,1));
});
test('Deletion cascades atomically retain storage references in inaccessible cleanup outbox',async()=>{
  await as('authenticated',B,()=>db.query('delete from study_rooms where id=$1',[id(2)]));
  const queued=await one('select storage_path from storage_cleanup_jobs where owner_id=$1',[B]);
  assert.equal(queued.storage_path,`${B}/${id(2)}/chapter.pdf`);
  await as('authenticated',B,()=>assert.rejects(db.exec('select * from storage_cleanup_jobs'),e=>e.code==='42501'));
});

// These cases own their fixtures: earlier tests deliberately retire topic 31.
const T = id(95), CARD = id(96), TF = id(97), BLANK = id(98), REMOVED = id(99);
const OTHER_ROOM = id(92), OTHER_T = id(93), OTHER_CARD = id(94);
let fixtures;
const withFixtures = () => (fixtures ??= (async()=>{
  await db.query(`insert into topics(id,room_id,owner_id,title,objective,source_document_ids) values($1,$2,$3,'Cell energy','Explain ATP',array[$4::uuid])`,[T,id(1),A,id(11)]);
  await db.query(`insert into flashcards(id,room_id,owner_id,topic_id,front,back) values($1,$2,$3,$4,'ATP?','Cell energy currency')`,[CARD,id(1),A,T]);
  // User B equivalents in a room of their own, so cross-owner attempts have a
  // known target regardless of what earlier cases did to B's original room.
  await db.query(`insert into study_rooms(id,owner_id,title) values($1,$2,'B room')`,[OTHER_ROOM,B]);
  await db.query(`insert into topics(id,room_id,owner_id,title,objective) values($1,$2,$3,'B cell energy','Explain ATP')`,[OTHER_T,OTHER_ROOM,B]);
  await db.query(`insert into flashcards(id,room_id,owner_id,topic_id,front,back) values($1,$2,$3,$4,'B ATP?','B answer')`,[OTHER_CARD,OTHER_ROOM,B,OTHER_T]);
})());

test('The new question types are storable and their answer keys stay server-side',async()=>{
  await withFixtures();
  await as('service_role',A,async()=>{
    await db.query(`insert into quiz_questions(id,room_id,owner_id,topic_id,kind,prompt,choices,correct_choice,explanation) values($1,$2,$3,$4,'true_false','ATP stores energy.','["True","False"]',0,'It does')`,[TF,id(1),A,T]);
    await db.query(`insert into quiz_questions(id,room_id,owner_id,topic_id,kind,prompt,expected_answer,accepted_answers,explanation) values($1,$2,$3,$4,'fill_blank','Cells store energy as ____.','ATP',array['atp','adenosine triphosphate'],'Chapter 2')`,[BLANK,id(1),A,T]);
    await assert.rejects(db.query(`insert into quiz_questions(room_id,owner_id,topic_id,kind,prompt,explanation) values($1,$2,$3,'essay','Discuss','x')`,[id(1),A,T]),e=>e.code==='23514');
  });
  await as('authenticated',A,async()=>{
    // The learner may read the stem; the accepted spellings are answer key.
    assert.ok(await one(`select prompt from quiz_questions where id=$1`,[BLANK]));
    await assert.rejects(db.query(`select accepted_answers from quiz_questions where id=$1`,[BLANK]),e=>e.code==='42501');
  });
});

test('Confidence is recorded with the attempt and only by a trusted writer',async()=>{
  await withFixtures();
  await as('service_role',A,async()=>{
    const graded=await one(`select record_quiz_attempt($1,$2,null,0,100,true,'ok',3) as result`,[TF,A]);
    assert.equal(graded.result.confidence,3);
    // Out-of-range ratings are dropped rather than stored or thrown.
    const loose=await one(`select record_quiz_attempt($1,$2,'ATP',null,100,true,'ok',9) as result`,[BLANK,A]);
    assert.equal(loose.result.confidence,null);
  });
  await as('authenticated',A,async()=>{
    await assert.rejects(db.exec(`update quiz_attempts set confidence=1 where owner_id='${A}'`),e=>e.code==='42501');
  });
});

test('A learner edits their own topics and cards only through the trusted writer',async()=>{
  await withFixtures();
  await as('authenticated',A,async()=>{
    for(const sql of [
      `select update_topic('${T}','${A}','Hacked',null,50)`,
      `select set_topic_active('${T}','${A}',false)`,
      `select create_topic('${id(1)}','${A}','Hacked',null,50)`,
      `select update_flashcard('${CARD}','${A}','Hacked','Hacked')`,
      `select delete_flashcard('${CARD}','${A}')`
    ]) await assert.rejects(db.exec(sql),e=>e.code==='42501');
  });
  await as('service_role',A,async()=>{
    // Another learner's rows are invisible to these functions.
    for(const sql of [
      `select update_topic('${OTHER_T}','${A}','Stolen',null,50)`,
      `select set_topic_active('${OTHER_T}','${A}',false)`,
      `select update_flashcard('${OTHER_CARD}','${A}','Stolen','Stolen')`,
      `select delete_flashcard('${OTHER_CARD}','${A}')`
    ]) await assert.rejects(db.exec(sql),e=>/not found/i.test(e.message));
    assert.equal((await one(`select title,active from topics where id=$1`,[OTHER_T])).title,'B cell energy');
    assert.equal((await one(`select front from flashcards where id=$1`,[OTHER_CARD])).front,'B ATP?');
    await assert.rejects(db.exec(`select update_topic('${T}','${A}','',null,50)`),e=>/needs a title/.test(e.message));
  });
});

test('Editing a card keeps the recall schedule it has already earned',async()=>{
  await withFixtures();
  await as('service_role',A,async()=>{
    await db.query(`update flashcards set repetitions=4,interval_days=9,ease=2.7 where id=$1`,[CARD]);
    await db.query(`select update_flashcard($1,$2,'ATP?','The cell energy currency')`,[CARD,A]);
    const card=await one(`select back,repetitions,interval_days,learner_edited from flashcards where id=$1`,[CARD]);
    assert.equal(card.back,'The cell energy currency');
    assert.equal(card.repetitions,4,'a typo fix must not reset recall history');
    assert.equal(card.interval_days,9);
    assert.equal(card.learner_edited,true);
  });
});

test('Re-ingesting a guide keeps the learner wording and does not resurrect a removed topic',async()=>{
  await withFixtures();
  await as('service_role',A,async()=>{
    await db.query(`select update_topic($1,$2,'Cell energy','My own wording',95)`,[T,A]);
    await db.query(`insert into topics(id,room_id,owner_id,title,objective) values($1,$2,$3,'Fermentation','Explain respiration')`,[REMOVED,id(1),A]);
    await db.query(`select set_topic_active($1,$2,false)`,[REMOVED,A]);

    const refreshed=`[{"title":"Cell energy","objective":"Model answer from the guide","keyTerms":["atp"],"priority":40,"evidence":[]},
      {"title":"Fermentation","objective":"Explain respiration","keyTerms":[],"priority":80,"evidence":[]}]`;
    await db.query(`select refresh_topic_map($1,$2,$3,true,$4::jsonb)`,[id(1),A,id(11),refreshed]);

    const edited=await one(`select objective,priority,key_terms,learner_edited from topics where id=$1`,[T]);
    assert.equal(edited.objective,'My own wording','the learner wording survives a re-ingest');
    assert.equal(Number(edited.priority),95,'and so does the priority they set');
    assert.deepEqual(edited.key_terms,['atp'],'while fresh key terms are still re-linked');
    assert.equal((await one(`select active from topics where id=$1`,[REMOVED])).active,false,'a removed topic stays removed');
  });
});

test('Re-adding a removed topic restores the original row rather than duplicating it',async()=>{
  await withFixtures();
  await as('service_role',A,async()=>{
    const created=await one(`select create_topic($1,$2,'Fermentation','Back in scope',70) as result`,[id(1),A]);
    assert.equal(created.result.id,REMOVED);
    const restored=await one(`select active,learner_removed,objective from topics where id=$1`,[REMOVED]);
    assert.equal(restored.active,true);
    assert.equal(restored.learner_removed,false);
    assert.equal(restored.objective,'Back in scope');
    assert.equal((await one(`select count(*)::int as n from topics where room_id=$1 and title='Fermentation'`,[id(1)])).n,1);
  });
});

test('Explanation level is constrained and defaults to standard',async()=>{
  await withFixtures();
  assert.equal((await one(`select explain_level from study_rooms where id=$1`,[id(1)])).explain_level,'standard');
  await as('authenticated',A,async()=>{
    await db.query(`update study_rooms set explain_level='simpler' where id=$1`,[id(1)]);
    await assert.rejects(db.query(`update study_rooms set explain_level='genius' where id=$1`,[id(1)]),e=>e.code==='23514');
  });
  assert.equal((await one(`select explain_level from study_rooms where id=$1`,[id(1)])).explain_level,'simpler');
});

const observation = (overrides={}) => ({ id:'learning-1',owner_id:A,room_id:id(1),topic_id:id(901),
  encounter_id:'encounter-1',activity:'coach',challenge_kind:'transfer',result:'correct',
  scaffold_used:0,evidence:'assessed',context_id:'new-context',new_context:true,
  misconception_id:null,created_at:'2026-09-24T10:00:00Z',...overrides });

test('Learning history reuses authoritative quiz/card/test attempts and isolates two users',async()=>{
  await db.query(`insert into study_rooms(id,owner_id,title) values($1,$2,'Other room') on conflict do nothing`,[id(2),B]);
  await db.query(`insert into topics(id,room_id,owner_id,title) values($1,$2,$3,'Adaptive test'),($4,$5,$6,'Other learner')`,[id(901),id(1),A,id(902),id(2),B]);
  await as('service_role',A,async()=>{
    await db.query(`select record_learning_event($1::jsonb)`,[JSON.stringify(observation())]);
    await db.query(`select record_learning_event($1::jsonb)`,[JSON.stringify(observation({owner_id:B,room_id:id(2),topic_id:id(902)}))]);
    await db.query(`insert into quiz_questions(id,room_id,owner_id,topic_id,prompt,correct_choice,choices)
      values($1,$2,$3,$4,'Question','0','["A","B"]')`,[id(903),id(1),A,id(901)]);
    await db.query(`select record_quiz_attempt($1,$2,null,0,100,true,'Correct',3)`,[id(903),A]);
    await db.query(`select record_quiz_attempt($1,$2,null,0,100,true,'Correct',3)`,[id(903),A]);
    await db.query(`insert into flashcards(id,room_id,owner_id,topic_id,front,back) values($1,$2,$3,$4,'Front','Back')`,[id(904),id(1),A,id(901)]);
    await db.query(`select review_flashcard($1,$2,3,$3)`,[id(904),A,id(905)]);
    await db.query(`select review_flashcard($1,$2,3,$3)`,[id(904),A,id(905)]);
    await db.query(`insert into practice_tests(id,room_id,owner_id,title) values($1,$2,$3,'Exam')`,[id(906),id(1),A]);
    await db.query(`insert into quiz_questions(id,room_id,owner_id,topic_id,prompt,correct_choice,choices,practice_test_id,test_position)
      values($1,$2,$3,$4,'Test question',0,'["A","B"]',$5,0)`,[id(907),id(1),A,id(901),id(906)]);
    const grades=JSON.stringify([{id:id(907),score:100,is_correct:true,feedback:'Correct',selected_choice:0}]);
    await db.query(`select submit_practice_test($1,$2,$3::jsonb,'{}'::jsonb)`,[id(906),A,grades]);
    await db.query(`select submit_practice_test($1,$2,$3::jsonb,'{}'::jsonb)`,[id(906),A,grades]);
  });
  await as('authenticated',A,async()=>{
    const result=(await one(`select read_concept_learning_history($1,$2) as history`,[id(1),id(901)])).history;
    assert.equal(result.observations.length,1);
    assert.equal(result.attempts.length,3,'retries do not duplicate source evidence');
    assert.equal(result.attempts.filter(a=>a.practice_test_id).length,1);
    assert.equal(result.attempts.filter(a=>a.source==='flashcard').length,1);
    assert.ok(result.attempts.every(a=>!('response' in a)&&!('expected_answer' in a)&&!('feedback' in a)));
    assert.deepEqual((await one(`select read_concept_learning_history($1,$2) as history`,[id(2),id(902)])).history,{attempts:[],observations:[]});
    assert.equal((await one(`select count(*)::int n from learning_events`)).n,1);
  });
});

test('Learning writes are idempotent, conflicts rollback, and ownership is enforced for trusted writers',async()=>{
  await as('service_role',A,async()=>{
    const first=await one(`select record_learning_event($1::jsonb) as saved`,[JSON.stringify(observation())]);
    const retry=await one(`select record_learning_event($1::jsonb) as saved`,[JSON.stringify(observation())]);
    assert.deepEqual(first,retry);
    await assert.rejects(db.query(`select record_learning_event($1::jsonb)`,[JSON.stringify(observation({result:'incorrect'}))]),/Conflicting/);
    await assert.rejects(db.query(`select record_learning_event($1::jsonb)`,[JSON.stringify(observation({id:'foreign',topic_id:id(902)}))]),/active study scope/);
    await assert.rejects(db.query(`insert into learning_events select * from jsonb_populate_record(null::learning_events,$1::jsonb)`,[JSON.stringify(observation({id:'foreign-fk',topic_id:id(902)}))]),e=>e.code==='23503');
    await assert.rejects(db.query(`select record_learning_event($1::jsonb)`,[JSON.stringify(observation({id:'duplicate-source',activity:'quiz'}))]),e=>e.code==='23514');
    await assert.rejects(db.query(`select record_learning_event($1::jsonb)`,[JSON.stringify(observation({id:'bad-level',scaffold_used:6}))]),e=>e.code==='23514');
    await assert.rejects(db.query(`select record_learning_event($1::jsonb)`,[JSON.stringify(observation({id:'bad-context',context_id:null}))]),e=>e.code==='23514');
    await assert.rejects(db.query(`update learning_events set result='incorrect' where owner_id=$1`,[A]),e=>e.code==='42501');
    assert.equal((await one(`select count(*)::int n from learning_events where owner_id=$1`,[A])).n,1);
    assert.equal((await one(`select result from learning_events where owner_id=$1`,[A])).result,'correct');
  });
});

test('Clients cannot forge observations, call privileged writes, or access history anonymously',async()=>{
  for(const role of ['anon','authenticated']) await as(role,A,async()=>{
    await assert.rejects(db.query(`select record_learning_event($1::jsonb)`,[JSON.stringify(observation({id:'forged'}))]),e=>e.code==='42501');
    for(const sql of [
      `insert into learning_events select * from jsonb_populate_record(null::learning_events,$1::jsonb)`,
      `update learning_events set result='correct' where id=($1::jsonb->>'id')`,
      `delete from learning_events where id=($1::jsonb->>'id')`
    ]) await assert.rejects(db.query(sql,[JSON.stringify(observation())]),e=>e.code==='42501');
    if(role==='anon') await assert.rejects(db.query(`select read_concept_learning_history($1,$2)`,[id(1),id(901)]),e=>e.code==='42501');
  });
});

test('adaptive Coach issuance and assessed turn commit atomically with revision and retry protection',async()=>{
  const conversation=id(1001),first=id(1002),answer=id(1003),encounter='atomic-encounter-1';
  await db.query('insert into conversations(id,room_id,owner_id) values($1,$2,$3)',[conversation,id(1),A]);
  await db.query("insert into messages(id,conversation_id,role,content) values($1,$2,'user','start'),($3,$2,'user','Sun')",[first,conversation,answer]);
  await db.query('insert into topics(id,room_id,owner_id,title) values($1,$2,$3,$4)',[id(1004),id(1),A,'Atomic fixture']);
  const pending={version:1,kind:'awaiting_answer',question:'Energy source?',topicId:id(1004),askedAt:'2026-10-01T12:00:00Z',expectedConcepts:[{id:'sun',description:'Sunlight',weight:1,critical:true}],sourceChunkIds:[id(21)],issuedChallenge:{encounterId:encounter,scaffoldUsed:0,contextId:null,spec:{concept:{userId:A,roomId:id(1),topicId:id(1004)},challengeKind:'recall'}}};
  const commit=(interaction,revision,state,events=[])=>one('select commit_adaptive_coach_turn($1,$2,$3,$4,$5::jsonb,$6::jsonb) as result',[conversation,A,interaction,revision,JSON.stringify(state),JSON.stringify(events)]);
  await as('service_role',null,async()=>{
    const issued=await commit(first,0,pending);assert.equal(issued.result.revision,1);
    assert.equal((await commit(first,0,pending)).result.duplicate,true);
    const semantic={intent:'answer',concepts:[{id:'sun',status:'demonstrated'}]};
    const accept=(evaluation,fingerprint={response:'Sun'})=>one('select accept_adaptive_semantic_evidence($1,$2,$3,$4::jsonb,$5::jsonb,$6) as evaluation',[answer,encounter,A,JSON.stringify(fingerprint),JSON.stringify(evaluation),'semantic-concepts-1']);
    assert.deepEqual((await accept(semantic)).evaluation,semantic);
    assert.deepEqual((await accept({intent:'answer',concepts:[]})).evaluation,semantic);
    await assert.rejects(()=>accept(semantic,{response:'Moon'}),/Conflicting semantic retry/);
    const event={id:'atomic-answer-1',owner_id:A,room_id:id(1),topic_id:id(1004),encounter_id:encounter,activity:'coach',challenge_kind:'recall',result:'correct',scaffold_used:0,evidence:'assessed',context_id:null,new_context:false,misconception_id:null,created_at:'2026-10-01T12:00:01Z'};
    const done={version:1,kind:'awaiting_control',action:'more_practice',topicId:id(1004),sourceChunkIds:[id(21)],issuedChallenge:pending.issuedChallenge};
    const result=await commit(answer,1,done,[event]);assert.equal(result.result.revision,2);
    assert.equal((await commit(answer,1,done,[event])).result.duplicate,true);
    assert.equal((await one('select count(*)::int as count from learning_events where id=$1',[event.id])).count,1);
    await assert.rejects(()=>commit(answer,1,{version:1,kind:'idle'},[event]),/Conflicting turn retry/);
  });
  await as('authenticated',A,async()=>{
    await assert.rejects(()=>db.query('select issued_state from adaptive_encounters'),/permission denied/);
    await assert.rejects(()=>db.query('select committed_state from adaptive_turn_receipts'),/permission denied/);
    const rows=await db.query('select evaluation from adaptive_semantic_evidence where interaction_id=$1',[answer]);assert.equal(rows.rows.length,1);
    await assert.rejects(()=>commit(answer,1,pending),/permission denied/);
  });
  await as('authenticated',B,async()=>assert.equal((await db.query('select evaluation from adaptive_semantic_evidence where interaction_id=$1',[answer])).rows.length,0));
});

test('stale or out-of-scope Coach writes roll back all evidence and conversation state',async()=>{
  const conversation=id(1011),first=id(1012),second=id(1013);
  await db.query('insert into conversations(id,room_id,owner_id) values($1,$2,$3)',[conversation,id(1),A]);
  await db.query("insert into messages(id,conversation_id,role,content) values($1,$2,'user','first'),($3,$2,'user','second')",[first,conversation,second]);
  await as('service_role',null,async()=>{
    const commit=(interaction,revision,events=[])=>one('select commit_adaptive_coach_turn($1,$2,$3,$4,$5::jsonb,$6::jsonb) as result',[conversation,A,interaction,revision,JSON.stringify({version:1,kind:'idle'}),JSON.stringify(events)]);
    await commit(first,0);
    await assert.rejects(()=>commit(second,0),/Stale Coach revision/);
    await assert.rejects(()=>commit(second,1,[{id:'forged-atomic-event',owner_id:B,room_id:id(2),topic_id:id(32),encounter_id:'foreign'}]),/Event encounter scope mismatch/);
    assert.equal((await one('select learning_revision from conversations where id=$1',[conversation])).learning_revision,1);
    assert.equal((await one("select count(*)::int as count from learning_events where id='forged-atomic-event'")).count,0);
  });
});

// Durable sessions execute the real additive migration, not a mocked storage layer.
async function sessionFixture(n) {
 const room=id(n),doc=id(n+1),topic=id(n+2),chunk=id(n+3);
 await db.query(`insert into study_rooms(id,owner_id,title) values($1,$2,'Durable room')`,[room,A]);
 await db.query(`insert into documents(id,room_id,owner_id,name,mime_type,size_bytes,storage_path,status) values($1,$2,$3,'source','text/plain',1,$4,'ready')`,[doc,room,A,`${A}/${room}/source`]);
 await db.query(`insert into topics(id,room_id,owner_id,title,source_document_ids) values($1,$2,$3,'Durable topic',array[$4::uuid])`,[topic,room,A,doc]);
 await db.query(`insert into document_chunks(id,document_id,room_id,owner_id,chunk_index,content) values($1,$2,$3,$4,0,'Usable evidence')`,[chunk,doc,room,A]);
 const plan={schemaVersion:1,policyVersion:'session-1',mode:'study',budgetMinutes:30,status:'ready',topicId:topic,activity:'coach',stateRevision:0,reasons:['cover_teacher_scope'],offerTopicChange:false};
 const call=(sid,rid,revision=0,action='start',extra={})=>one(`select commit_learning_session($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as snapshot`,[extra.owner??A,room,sid,rid,revision,action,extra.mode??'study',30,extra.selected??null,JSON.stringify(extra.plan??plan)]).then(r=>r.snapshot);
 return {room,doc,topic,chunk,plan,call};
}
test('durable start timestamps, exact retries, conflicting IDs and atomic optimistic revisions',async()=>{
 const f=await sessionFixture(8000),sid=id(8010),rid=id(8011);
 await as('service_role',A,async()=>{
  const start=await f.call(sid,rid);assert.equal(start.revision,0);assert.equal(start.schema_version,1);
  assert.ok(Number.isFinite(Date.parse(start.started_at)));assert.equal(start.started_at,start.updated_at);
  // Regenerated plan is deliberately different: retry returns the original committed receipt.
  assert.deepEqual(await f.call(sid,rid,0,'start',{plan:{...f.plan,reasons:['regenerated']}}),start);
  await assert.rejects(f.call(sid,rid,0,'recommend'),e=>e.code==='40001');
  await assert.rejects(f.call(sid,id(8012)),e=>e.code==='40001');
  const competing=await Promise.allSettled([f.call(sid,id(8013),0,'recommend'),f.call(sid,id(8014),0,'recommend')]);
  assert.equal(competing.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(competing.find(r=>r.status==='rejected').reason.code,'40001');
  assert.equal((await one('select revision from learning_sessions where id=$1',[sid])).revision,1);
  assert.equal((await one('select count(*)::integer as n from learning_session_receipts where session_id=$1',[sid])).n,2);
  const ended=await f.call(sid,id(8015),1,'end',{plan:{...f.plan,status:'complete',topicId:null}});assert.equal(ended.ended,true);
  await assert.rejects(f.call(sid,id(8016),2,'recommend'),e=>e.code==='40001');
 });
});
test('durable session RLS prevents browser writes, private receipts and cross-owner access',async()=>{
 const f=await sessionFixture(8100),sid=id(8110),rid=id(8111);
 await as('service_role',A,()=>f.call(sid,rid));
 await as('authenticated',B,async()=>assert.equal((await db.query('select id from learning_sessions where id=$1',[sid])).rows.length,0));
 await as('authenticated',A,async()=>{
  assert.equal((await db.query('select id from learning_sessions where id=$1',[sid])).rows.length,1);
  await assert.rejects(db.query('update learning_sessions set revision=99 where id=$1',[sid]),e=>e.code==='42501');
  await assert.rejects(db.query('select * from learning_session_receipts'),e=>e.code==='42501');
  await assert.rejects(f.call(sid,rid),e=>e.code==='42501');
 });
 await as('service_role',B,async()=>{
  await assert.rejects(f.call(sid,id(8112),0,'recommend',{owner:B}),e=>e.code==='42501');
  await assert.rejects(db.query(`insert into learning_sessions(id,room_id,owner_id,mode,minutes,plan) values($1,$2,$3,'study',30,'{}')`,[id(8113),f.room,B]),e=>e.code==='23503');
 });
});
test('source scope requires owned ready nonblank chunks and failed commits leave no session or receipt',async()=>{
 const f=await sessionFixture(8200),sid=id(8210),rid=id(8211);
 const read=()=>one('select read_session_source_scope($1) as ids',[f.room]);
 await as('authenticated',A,async()=>assert.deepEqual((await read()).ids,[f.doc]));
 await as('authenticated',B,async()=>assert.deepEqual((await read()).ids,[]));
 await db.query(`update document_chunks set content=E' \\n\\t ' where id=$1`,[f.chunk]);
 await as('authenticated',A,async()=>assert.deepEqual((await read()).ids,[]));
 await as('service_role',A,async()=>{
  await assert.rejects(f.call(sid,rid),e=>e.code==='22023');
  assert.equal((await db.query('select id from learning_sessions where id=$1',[sid])).rows.length,0);
  assert.equal((await db.query('select id from learning_session_receipts where id=$1',[rid])).rows.length,0);
 });
 await db.query(`update document_chunks set content='Usable again' where id=$1`,[f.chunk]);
 await db.query(`update documents set status='failed' where id=$1`,[f.doc]);
 await as('service_role',A,async()=>await assert.rejects(f.call(sid,rid),e=>e.code==='22023'));
 await db.query(`update documents set status='ready' where id=$1`,[f.doc]);
 await as('service_role',A,async()=>{
  await f.call(sid,rid);
  await db.query('delete from document_chunks where id=$1',[f.chunk]);
  await assert.rejects(f.call(sid,id(8212),0,'recommend'),e=>e.code==='22023');
  assert.equal((await one('select revision from learning_sessions where id=$1',[sid])).revision,0);
  assert.equal((await db.query('select id from learning_session_receipts where id=$1',[id(8212)])).rows.length,0);
  assert.equal((await f.call(sid,rid)).revision,0); // lost response remains recoverable after deletion
 });
});
test('session choice retains explicit selection, supports clearing it, and rejects cross-room topics',async()=>{
 const f=await sessionFixture(8300),sid=id(8310),rid=id(8311);
 await as('service_role',A,async()=>{
  const start=await f.call(sid,rid,0,'start',{selected:f.topic});assert.equal(start.selected_topic_id,f.topic);
  const recommend=await f.call(sid,id(8312),0,'recommend');assert.equal(recommend.selected_topic_id,f.topic);
  await assert.rejects(f.call(sid,id(8313),1,'select',{selected:id(32)}),e=>e.code==='22023');
  const cleared=await f.call(sid,id(8314),1,'select');assert.equal(cleared.selected_topic_id,null);
 });
});

async function responseFixture(n) {
 const f=await sessionFixture(n),conversation=id(n+4),interaction=id(n+5),encounter=`response-${n}`;
 const content='Usable evidence with "quotes",\nnewlines and café.';
 await db.query('update document_chunks set content=$1 where id=$2',[content,f.chunk]);
 await db.query('insert into conversations(id,room_id,owner_id) values($1,$2,$3)',[conversation,f.room,A]);
 await db.query("insert into messages(id,conversation_id,role,content) values($1,$2,'user','start')",[interaction,conversation]);
 const pending={version:1,kind:'awaiting_answer',question:'Question?',topicId:f.topic,askedAt:'2026-10-02T00:00:00Z',expectedConcepts:[{id:'idea',description:'Grounded idea',weight:1,critical:true}],sourceChunkIds:[f.chunk],
   issuedChallenge:{schemaVersion:1,encounterId:encounter,scaffoldUsed:0,contextId:null,sourceRevisions:[{id:f.chunk,sha256:createHash('sha256').update(JSON.stringify([f.doc,content,null])).digest('hex')}],
   spec:{concept:{userId:A,roomId:f.room,topicId:f.topic},stateRevision:0,activity:'coach',challengeKind:'recall',constraints:{requireNewContext:false}}}};
 const answer={text:'Original question and reply',citations:[],grounded:false};
 const commit=(iid=interaction,revision=0,state=pending,events=[],reply=answer,projections=[])=>one('select commit_adaptive_coach_response($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb) as result',[conversation,A,iid,revision,JSON.stringify(state),JSON.stringify(events),JSON.stringify(projections),JSON.stringify(reply)]).then(r=>r.result);
 return {...f,conversation,interaction,encounter,content,pending,answer,commit};
}
test('atomic Coach replies persist once and old retries return the original result after newer turns',async()=>{
 const f=await responseFixture(8400),next=id(8410);
 await as('service_role',A,async()=>{
  const saved=await f.commit();assert.deepEqual(saved.answer,f.answer);assert.equal(saved.revision,1);
  await db.query("insert into messages(id,conversation_id,role,content) values($1,$2,'user','stop')",[next,f.conversation]);
  await f.commit(next,1,{version:1,kind:'idle'});
  // Generated outputs, current revisions and source state cannot rewrite a committed reply.
  await db.query('delete from document_chunks where id=$1',[f.chunk]);
  const retry=await f.commit(f.interaction,999,{version:1,kind:'idle'},[],{...f.answer,text:'different'});
  assert.deepEqual(retry.answer,f.answer);assert.equal(retry.duplicate,true);assert.equal(retry.revision,1);
  assert.equal((await one("select count(*)::int as n from messages where conversation_id=$1 and role='assistant'",[f.conversation])).n,2);
  assert.equal((await one('select learning_revision from conversations where id=$1',[f.conversation])).learning_revision,2);
 });
 await as('authenticated',A,async()=>{
  await assert.rejects(db.query('select answer from adaptive_turn_receipts'),e=>e.code==='42501');
  await assert.rejects(f.commit(),e=>e.code==='42501');
 });
});
test('source mutation during grading rolls back reply, evidence and state but retains immutable accepted evaluation',async()=>{
 const f=await responseFixture(8500),iid=id(8510);
 await as('service_role',A,async()=>{
  await f.commit();
  await db.query("insert into messages(id,conversation_id,role,content) values($1,$2,'user','idea')",[iid,f.conversation]);
  const event={id:'source-race-attempt',owner_id:A,room_id:f.room,topic_id:f.topic,encounter_id:f.encounter,activity:'coach',challenge_kind:'recall',result:'correct',scaffold_used:0,evidence:'assessed',context_id:null,new_context:false,misconception_id:null,created_at:'2026-10-02T00:00:01Z'};
  const next={version:1,kind:'awaiting_control',action:'more_practice',topicId:f.topic,sourceChunkIds:[f.chunk],issuedChallenge:f.pending.issuedChallenge};
  await assert.rejects(f.commit(iid,1,next,[event]),/Accepted evaluation required/);
  const semantic={intent:'answer',concepts:[{id:'idea',status:'demonstrated'}]};
  await db.query('select accept_adaptive_semantic_evidence($1,$2,$3,$4::jsonb,$5::jsonb,$6)',[iid,f.encounter,A,JSON.stringify({response:'idea'}),JSON.stringify(semantic),'semantic-concepts-1']);
  await db.query("update document_chunks set content='Changed after prefetch' where id=$1",[f.chunk]);
  await assert.rejects(f.commit(iid,1,next,[event]),e=>e.code==='40001');
  assert.equal((await one('select learning_revision from conversations where id=$1',[f.conversation])).learning_revision,1);
  assert.equal((await db.query('select id from learning_events where id=$1',[event.id])).rows.length,0);
  assert.equal((await db.query('select interaction_id from adaptive_turn_receipts where interaction_id=$1',[iid])).rows.length,0);
  assert.equal((await one("select count(*)::int as n from messages where conversation_id=$1 and role='assistant'",[f.conversation])).n,1);
  assert.deepEqual((await one('select evaluation from adaptive_semantic_evidence where interaction_id=$1',[iid])).evaluation,semantic);
  await db.query('update document_chunks set content=$1 where id=$2',[f.content,f.chunk]);
  await f.commit(iid,1,next,[event]);
  assert.equal((await one('select learning_revision from conversations where id=$1',[f.conversation])).learning_revision,2);
 });
});
test('pending Coach rubric is immutable and source status or active topic loss fails closed',async()=>{
 const f=await responseFixture(8600),iid=id(8610);
 await as('service_role',A,async()=>{
  await f.commit();
  await db.query("insert into messages(id,conversation_id,role,content) values($1,$2,'user','help')",[iid,f.conversation]);
  await assert.rejects(f.commit(iid,1,{...f.pending,expectedConcepts:[{id:'other',description:'Other idea',weight:1,critical:true}]}),/rubric/);
  await db.query("update documents set status='processing' where id=$1",[f.doc]);
  await assert.rejects(f.commit(iid,1,f.pending),e=>e.code==='40001');
  await db.query("update documents set status='ready' where id=$1",[f.doc]);
  await db.query('update topics set active=false where id=$1',[f.topic]);
  await assert.rejects(f.commit(iid,1,f.pending),e=>e.code==='40001');
  // Invalidating a stale pending task remains possible without manufacturing a skip/grade.
  await f.commit(iid,1,{version:1,kind:'idle'});
 });
});
test('Coach issuance and session recommendations reject stale canonical concept revisions',async()=>{
 const f=await responseFixture(8700);
 await as('service_role',A,async()=>{
  await db.query('select record_learning_event($1::jsonb)',[JSON.stringify(observation({id:'competing-concept',room_id:f.room,topic_id:f.topic,encounter_id:'other-encounter',challenge_kind:'recall',context_id:null,new_context:false}))]);
  await assert.rejects(f.commit(),e=>e.code==='40001');
  await assert.rejects(f.call(id(8710),id(8711)),e=>e.code==='40001');
  assert.equal((await one('select learning_revision from conversations where id=$1',[f.conversation])).learning_revision,0);
  assert.equal((await db.query('select interaction_id from adaptive_turn_receipts where interaction_id=$1',[f.interaction])).rows.length,0);
  const pending=structuredClone(f.pending);pending.issuedChallenge.spec.stateRevision=1;
  await f.commit(f.interaction,0,pending);
  assert.equal((await f.call(id(8710),id(8711),0,'start',{plan:{...f.plan,stateRevision:1}})).revision,0);
 });
});
test('an atomic skip and its new task use one evidence revision and competing replies commit once',async()=>{
 const f=await responseFixture(8800),iid=id(8810),competing=id(8811);
 await as('service_role',A,async()=>{
  await f.commit();
  await db.query("insert into messages(id,conversation_id,role,content) values($1,$3,'user','harder'),($2,$3,'user','next')",[iid,competing,f.conversation]);
  const next=structuredClone(f.pending);next.issuedChallenge.encounterId='after-skip';next.issuedChallenge.spec.stateRevision=1;
  const skipped={id:'skip-before-issue',owner_id:A,room_id:f.room,topic_id:f.topic,encounter_id:f.encounter,activity:'coach',challenge_kind:'recall',result:'skipped',scaffold_used:0,evidence:'assessed',context_id:null,new_context:false,misconception_id:null,created_at:'2026-10-02T00:00:01Z'};
  const results=await Promise.allSettled([f.commit(iid,1,next,[skipped]),f.commit(competing,1,{version:1,kind:'idle'})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'40001');
  assert.equal((await one("select count(*)::int as n from messages where conversation_id=$1 and role='assistant'",[f.conversation])).n,2);
  assert.equal((await one('select count(*)::int as n from learning_events where id=$1',[skipped.id])).n,1);
 });
});

test('teacher source boost keeps the historical priority/1000 magnitude', async () => {
  assert.equal(Number((await one('select public.teacher_source_boost(1000) as boost')).boost), 1);
  assert.equal(Number((await one('select public.teacher_source_boost(null) as boost')).boost), 0);
  const body = (await one("select pg_get_functiondef('public.match_study_chunks(uuid,extensions.vector,integer,double precision,uuid)'::regprocedure) as def")).def;
  assert.match(body, /teacher_source_boost/);
  assert.doesNotMatch(body, /\/ 1000\.0/);
});

test('daily AI budget allows one call and denies the call past the cap', async () => {
  await as('authenticated', A, async () => {
    assert.equal((await one('select public.consume_ai_budget($1,1,10,1,100) as ok', [A])).ok, true);
    assert.equal((await one('select public.consume_ai_budget($1,1,10,1,100) as ok', [A])).ok, false);
    assert.equal((await one('select public.consume_ai_budget($1,1,10,5,100) as ok', [B])).ok, false);
  });
});

test('deleting a document removes its chunks so match_study_chunks cannot return them', async () => {
  const doc = id(9100);
  const chunk = id(9101);
  const embedding = `[1,${Array(1535).fill(0).join(',')}]`;
  await db.query(
    `insert into documents(id,room_id,owner_id,name,mime_type,size_bytes,storage_path,status)
     values($1,$2,$3,'cascade.pdf','application/pdf',10,$4,'ready')`,
    [doc, id(1), A, `${A}/${id(1)}/cascade.pdf`]
  );
  await db.query(
    `insert into document_chunks(id,document_id,room_id,owner_id,chunk_index,content,embedding)
     values($1,$2,$3,$4,0,'Cascade proof sentence about leaves.', $5::extensions.vector)`,
    [chunk, doc, id(1), A, embedding]
  );
  await as('authenticated', A, async () => {
    const before = await db.query(
      'select chunk_id from public.match_study_chunks($1, $2::extensions.vector, 8, 0.35, $3)',
      [id(1), embedding, A]
    );
    assert.ok(before.rows.some((row) => row.chunk_id === chunk));
    assert.equal((await db.query('delete from documents where id=$1 returning id', [doc])).rows.length, 1);
    assert.equal((await db.query('select id from document_chunks where document_id=$1', [doc])).rows.length, 0);
    const after = await db.query(
      'select chunk_id from public.match_study_chunks($1, $2::extensions.vector, 8, 0.35, $3)',
      [id(1), embedding, A]
    );
    assert.equal(after.rows.some((row) => row.chunk_id === chunk), false);
  });
});

test('a new account is wiped five days later and an older account is not', async () => {
  const C = '00000000-0000-4000-8000-000000000003';
  const room = id(9300);
  const doc = id(9301);
  assert.equal((await one('select count(*)::int as n from account_retention where user_id=$1', [PRE_MIGRATION])).n, 0);
  await db.query('insert into auth.users(id) values($1)', [C]);
  const enrolled = await one('select expires_at from account_retention where user_id=$1', [C]);
  assert.ok(enrolled.expires_at);
  assert.ok(new Date(enrolled.expires_at).getTime() > Date.now());
  await db.query('insert into study_rooms(id,owner_id,title) values($1,$2,$3)', [room, C, 'Beta']);
  await db.query(
    `insert into documents(id,room_id,owner_id,name,mime_type,size_bytes,storage_path,status)
     values($1,$2,$3,'notes.pdf','application/pdf',10,$4,'ready')`,
    [doc, room, C, `${C}/${room}/notes.pdf`]
  );
  await db.query(
    `insert into document_chunks(id,document_id,room_id,owner_id,chunk_index,content)
     values($1,$2,$3,$4,0,'Beta notes about cells.')`,
    [id(9302), doc, room, C]
  );
  await db.query(`insert into storage.objects(bucket_id,name) values('study-materials',$1)`, [`${C}/${room}/notes.pdf`]);
  await as('service_role', null, async () => {
    assert.equal((await one('select public.purge_expired_accounts() as n')).n, 0);
  });
  await assert.rejects(
    as('authenticated', C, () => db.query('select public.purge_expired_accounts()')),
    (error) => error.code === '42501'
  );
  await db.query(`update account_retention set expires_at = now() - interval '1 minute' where user_id=$1`, [C]);
  await as('service_role', null, async () => {
    assert.equal((await one('select public.purge_expired_accounts() as n')).n, 1);
  });
  assert.equal((await one('select count(*)::int as n from auth.users where id=$1', [C])).n, 0);
  assert.equal((await one('select count(*)::int as n from study_rooms where owner_id=$1', [C])).n, 0);
  assert.equal((await one('select count(*)::int as n from documents where owner_id=$1', [C])).n, 0);
  assert.equal((await one('select count(*)::int as n from document_chunks where owner_id=$1', [C])).n, 0);
  assert.equal((await one("select count(*)::int as n from storage.objects where name like $1", [`${C}/%`])).n, 1);
  assert.equal((await one('select count(*)::int as n from storage_cleanup_jobs where owner_id=$1 and storage_path=$2', [C, `${C}/${room}/notes.pdf`])).n, 1);
  assert.equal((await one('select count(*)::int as n from auth.users where id=$1', [A])).n, 1);
  assert.equal((await one('select count(*)::int as n from study_rooms where id=$1', [id(1)])).n, 1);
});
