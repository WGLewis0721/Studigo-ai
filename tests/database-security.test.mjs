import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';

// Execute the actual migrations in embedded PostgreSQL, including pgvector,
// grants, RLS and transactional functions. Supabase auth/storage catalogs are
// minimal fixtures; hosted Auth and Storage HTTP behavior still needs live verification.
let db;
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
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
    create table storage.buckets(id text primary key, name text, public boolean);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
    grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
    grant all on storage.objects to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `);
  for (const file of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()) {
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
