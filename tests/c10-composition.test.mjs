import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";

const owner = "00000000-0000-4000-8000-000000000001";
const room = "10000000-0000-4000-8000-00000000c100";
const guide = "10000000-0000-4000-8000-00000000c101";
const notes = "10000000-0000-4000-8000-00000000c102";
const slides = "10000000-0000-4000-8000-00000000c103";
const otherGuide = "10000000-0000-4000-8000-00000000c104";
let db;

before(async () => {
  db = new PGlite({ extensions: { vector } });
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth."role"() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;
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
  for (const file of (await readdir(new URL("../supabase/migrations/", import.meta.url))).filter((name) => name.endsWith(".sql")).sort()) {
    const sql = await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8");
    await db.exec(sql.replaceAll("create extension if not exists pgcrypto;", ""));
  }
  await db.query("insert into auth.users(id) values($1)", [owner]);
  await db.query("insert into study_rooms(id, owner_id, title) values($1,$2,'Composition')", [room, owner]);
  for (const [id, name, source] of [[guide, "guide.pdf", "study_guide"], [notes, "notes.pdf", "student_notes"], [slides, "slides.pdf", "presentation"], [otherGuide, "guide-b.pdf", "study_guide"]]) {
    await db.query(
      `insert into documents(id, room_id, owner_id, name, mime_type, size_bytes, storage_path, source_type, status)
       values($1,$2,$3,$4,'application/pdf',10,$5,$6,'ready')`,
      [id, room, owner, name, `${owner}/${room}/${name}`, source]
    );
  }
  await db.exec(`set role service_role; select set_config('request.jwt.claim.sub', '${owner}', false); select set_config('request.jwt.claim.role', 'service_role', false);`);
});

after(async () => { await db?.close(); });

const topic = (title, objective, evidence) => [{ title, objective, keyTerms: ["branch"], priority: 80, evidence }];

test("C10 guide, notes, and slides compose, and replacing notes drops only that support", async () => {
  await db.query("select refresh_topic_map($1,$2,$3,true,$4::jsonb)", [room, owner, guide, JSON.stringify(topic("Branches", "Name the three branches", [{ pageNumber: 1, claim: "Legislative, executive, judicial" }]))]);
  await db.query("select refresh_topic_map($1,$2,$3,false,$4::jsonb)", [room, owner, notes, JSON.stringify([{ title: "Unlisted note", objective: "This must not become a test objective", keyTerms: [], priority: 1, evidence: [{ pageNumber: 9, claim: "extra" }] }])]);
  assert.equal((await db.query("select id from topics where title='Unlisted note'")).rows.length, 0);
  await db.query("select refresh_topic_map($1,$2,$3,false,$4::jsonb)", [room, owner, notes, JSON.stringify(topic("Branches", "Name the three branches", [{ pageNumber: 2, claim: "Congress writes statutes" }]))]);
  await db.query("select refresh_topic_map($1,$2,$3,false,$4::jsonb)", [room, owner, slides, JSON.stringify(topic("Branches", "Name the three branches", [{ pageNumber: 3, claim: "The president enforces laws" }]))]);
  const row = (await db.query("select id, objective_document_ids, support_document_ids from topics where room_id=$1 and active and title='Branches'", [room])).rows[0];
  assert.deepEqual(row.objective_document_ids, [guide]);
  assert.equal(row.support_document_ids.includes(notes), true);
  assert.equal(row.support_document_ids.includes(slides), true);
  await db.query("select refresh_topic_map($1,$2,$3,false,$4::jsonb)", [room, owner, notes, JSON.stringify(topic("Branches", "Name the three branches", [{ pageNumber: 4, claim: "A bill becomes a statute" }]))]);
  const next = (await db.query("select evidence, support_document_ids from topics where id=$1", [row.id])).rows[0];
  const claims = next.evidence.map((entry) => entry.claim);
  assert.equal(claims.includes("Congress writes statutes"), false);
  assert.equal(claims.includes("A bill becomes a statute"), true);
  assert.equal(claims.includes("Legislative, executive, judicial"), true);
  assert.equal(claims.includes("The president enforces laws"), true);
  assert.equal(next.support_document_ids.includes(slides), true);
});

test("C10 edits, removals, conflicts, and a second guide keep history", async () => {
  await db.query("select refresh_topic_map($1,$2,$3,true,$4::jsonb)", [room, owner, guide, JSON.stringify(topic("Branches", "Name the three branches", [{ pageNumber: 1, claim: "Teacher: three branches" }]))]);
  const original = (await db.query("select id from topics where room_id=$1 and title='Branches'", [room])).rows[0];
  await db.query("update topics set mastery_score=40, learner_edited=true, objective='My wording' where id=$1", [original.id]);
  await db.query("select refresh_topic_map($1,$2,$3,true,$4::jsonb)", [room, owner, guide, JSON.stringify(topic("Branches", "Name the three branches", [{ pageNumber: 1, claim: "Teacher: three branches" }]))]);
  const edited = (await db.query("select objective, mastery_score, active from topics where id=$1", [original.id])).rows[0];
  assert.equal(edited.objective, "My wording");
  assert.equal(Number(edited.mastery_score), 40);
  await db.query("update topics set learner_edited=false, learner_removed=true, active=false where id=$1", [original.id]);
  await db.query("select refresh_topic_map($1,$2,$3,true,$4::jsonb)", [room, owner, guide, JSON.stringify(topic("Branches", "Name the three branches", [{ pageNumber: 1, claim: "Teacher: three branches" }]))]);
  assert.equal((await db.query("select active from topics where id=$1", [original.id])).rows[0].active, false);
  await db.query("update topics set learner_removed=false, active=true where id=$1", [original.id]);
  await db.query("select refresh_topic_map($1,$2,$3,false,$4::jsonb)", [room, owner, notes, JSON.stringify(topic("Branches", "Name the three branches", [{ pageNumber: 2, claim: "Notes disagree: only two branches" }]))]);
  const evidence = (await db.query("select evidence from topics where id=$1", [original.id])).rows[0].evidence;
  assert.equal(evidence[0].role, "objective");
  assert.equal(evidence.some((entry) => entry.claim === "Notes disagree: only two branches"), true);
  await db.query("select refresh_topic_map($1,$2,$3,true,$4::jsonb)", [room, owner, otherGuide, JSON.stringify(topic("Voting", "Explain who can vote", [{ pageNumber: 1, claim: "Citizens vote" }]))]);
  assert.equal((await db.query("select active from topics where id=$1", [original.id])).rows[0].active, true);
  assert.equal((await db.query("select count(*)::int as n from topics where room_id=$1 and title='Voting' and active", [room])).rows[0].n, 1);
  await db.query("select refresh_topic_map($1,$2,$3,true,$4::jsonb)", [room, owner, guide, JSON.stringify(topic("Branches", "Explain a different skill", [{ pageNumber: 1, claim: "New skill" }]))]);
  assert.equal((await db.query("select active, mastery_score from topics where id=$1", [original.id])).rows[0].active, false);
  assert.equal(Number((await db.query("select mastery_score from topics where id=$1", [original.id])).rows[0].mastery_score), 40);
  const replacement = (await db.query("select id, mastery_score from topics where room_id=$1 and active and objective='Explain a different skill'", [room])).rows[0];
  assert.notEqual(replacement.id, original.id);
  assert.equal(Number(replacement.mastery_score), 0);
});

