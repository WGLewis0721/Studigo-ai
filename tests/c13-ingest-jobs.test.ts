import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { visibleIngestStage } from "../apps/web/lib/ingest-jobs.ts";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const room = "10000000-0000-4000-8000-00000000c130";
const doc = "10000000-0000-4000-8000-00000000c131";
let db: PGlite;

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
  await db.query("insert into auth.users(id) values($1),($2)", [owner, other]);
  await db.query("insert into study_rooms(id, owner_id, title) values($1,$2,'Jobs')", [room, owner]);
  await db.query(
    `insert into documents(id, room_id, owner_id, name, mime_type, size_bytes, storage_path, status, active_revision)
     values($1,$2,$3,'notes.pdf','application/pdf',10,$4,'uploaded',0)`,
    [doc, room, owner, `${owner}/${room}/notes.pdf`]
  );
});

after(async () => { await db.close(); });

test("C13 repeated processing reuses one queued job and a reload still says queued", async () => {
  await db.exec(`set role service_role; select set_config('request.jwt.claim.role', 'service_role', false); select set_config('request.jwt.claim.sub', '${owner}', false);`);
  const first = await db.query("select enqueue_ingest_job($1,$2,'process:notes') as id", [doc, owner]);
  const second = await db.query("select enqueue_ingest_job($1,$2,'process:notes') as id", [doc, owner]);
  assert.equal(second.rows[0].id, first.rows[0].id);
  assert.equal((await db.query("select count(*)::int as n from ingest_jobs where document_id=$1", [doc])).rows[0].n, 1);
  await db.exec("reset role");
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${owner}', false); select set_config('request.jwt.claim.role', 'authenticated', false);`);
  const reloaded = (await db.query("select stage from ingest_jobs where id=$1", [first.rows[0].id])).rows[0];
  assert.equal(reloaded.stage, "queued");
  assert.equal(visibleIngestStage(reloaded.stage), "queued");
  assert.notEqual(visibleIngestStage(reloaded.stage), "done");
  await db.exec("reset role");
});

test("C13 another learner cannot read or enqueue the job", async () => {
  await db.exec(`set role service_role; select set_config('request.jwt.claim.role', 'service_role', false); select set_config('request.jwt.claim.sub', '${owner}', false);`);
  const created = await db.query("select enqueue_ingest_job($1,$2,'process:notes') as id", [doc, owner]);
  const job = created.rows[0].id;
  await db.exec("reset role");
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${other}', false); select set_config('request.jwt.claim.role', 'authenticated', false);`);
  assert.equal((await db.query("select id from ingest_jobs where id=$1", [job])).rows.length, 0);
  await db.exec("reset role");
  await db.exec(`set role service_role; select set_config('request.jwt.claim.role', 'service_role', false);`);
  await assert.rejects(db.query("select enqueue_ingest_job($1,$2,'process:notes')", [doc, other]), /Document not found/);
  await db.exec("reset role");
});
