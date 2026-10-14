import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";

const owner = "00000000-0000-4000-8000-000000000001";
const room = "10000000-0000-4000-8000-0000000000c9";
const doc = "10000000-0000-4000-8000-0000000000e1";
const other = "10000000-0000-4000-8000-0000000000e2";
const embedding = `[${Array(1536).fill(0).join(",")}]`;
let db;

async function asRole(role) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${owner}', false); select set_config('request.jwt.claim.role', '${role}', false);`);
}

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
  await db.query("insert into study_rooms(id, owner_id, title) values($1,$2,'Reindex')", [room, owner]);
});

after(async () => { await db?.close(); });

async function insertDoc(id, name, content, chunkId) {
  await db.query(
    `insert into documents(id, room_id, owner_id, name, mime_type, size_bytes, storage_path, source_type, status)
     values($1,$2,$3,$4,'application/pdf',10,$5,'study_guide','ready')`,
    [id, room, owner, name, `${owner}/${room}/${name}`]
  );
  await db.query(
    `insert into document_chunks(id, document_id, room_id, owner_id, chunk_index, page_number, content, embedding, revision)
     values($1,$2,$3,$4,0,1,$5,$6::extensions.vector,1)`,
    [chunkId, id, room, owner, content, embedding]
  );
}

test("C09 concurrent claim and stale token cannot replace the active revision", async () => {
  await insertDoc(doc, "guide.pdf", "The legislative branch makes laws.", "10000000-0000-4000-8000-0000000000f1");
  await asRole("service_role");
  const first = await db.query("select public.claim_forced_studigo_reindex($1,$2,900) as claim", [doc, owner]);
  const claim = first.rows[0].claim;
  assert.equal(claim.claimed, true);
  const second = await db.query("select public.claim_forced_studigo_reindex($1,$2,900) as claim", [doc, owner]);
  assert.equal(second.rows[0].claim.reason, "processing");
  await db.query(
    `insert into document_chunks(id, document_id, room_id, owner_id, chunk_index, page_number, content, embedding, revision)
     values($1,$2,$3,$4,0,1,'A staged replacement that must not publish.',$5::extensions.vector,$6)`,
    ["10000000-0000-4000-8000-0000000000f2", doc, room, owner, embedding, claim.revision]
  );
  const stale = await db.query(
    "select public.activate_document_revision($1,$2,$3,$4) as result",
    [doc, owner, "00000000-0000-4000-8000-00000000aaaa", claim.revision]
  );
  assert.equal(stale.rows[0].result.reason, "stale");
  const row = await db.query("select active_revision, storage_path from documents where id=$1", [doc]);
  assert.equal(Number(row.rows[0].active_revision), 1);
  assert.equal(row.rows[0].storage_path, `${owner}/${room}/guide.pdf`);
  const live = await db.query("select content from document_chunks where document_id=$1 and revision=1", [doc]);
  assert.equal(live.rows[0].content, "The legislative branch makes laws.");
  await db.exec("reset role");
});

test("C09 a failed refresh keeps the old source, then a later success publishes only the new one", async () => {
  const existing = await db.query("select id from documents where id=$1", [doc]);
  if (!existing.rows.length) {
    await insertDoc(doc, "guide.pdf", "The legislative branch makes laws.", "10000000-0000-4000-8000-0000000000f1");
  }
  await insertDoc(other, "notes.pdf", "Untouched notes stay available.", "10000000-0000-4000-8000-0000000000f3");
  await db.query("update documents set status='ready', publish_token=null, last_forced_reindex_at=null where id=$1", [doc]);
  await db.query("delete from document_chunks where document_id=$1 and revision<>1", [doc]);
  await asRole("service_role");
  const claim = (await db.query("select public.claim_forced_studigo_reindex($1,$2,900) as claim", [doc, owner])).rows[0].claim;
  assert.equal(claim.claimed, true);
  await db.query(
    `insert into document_chunks(id, document_id, room_id, owner_id, chunk_index, page_number, content, embedding, revision)
     values($1,$2,$3,$4,0,1,'Broken derivation that must be discarded.',$5::extensions.vector,$6)`,
    ["10000000-0000-4000-8000-0000000000f4", doc, room, owner, embedding, claim.revision]
  );
  const aborted = await db.query("select public.abort_document_revision($1,$2,$3,$4) as result", [doc, owner, claim.token, "derivation failed"]);
  assert.equal(aborted.rows[0].result.preserved, true);
  await asRole("authenticated");
  const kept = await db.query(
    "select content from public.match_study_chunks($1, $2::extensions.vector, 8, 0.35, $3) where document_id=$4",
    [room, embedding, owner, doc]
  );
  assert.deepEqual(kept.rows.map((row) => row.content), ["The legislative branch makes laws."]);
  const untouched = await db.query(
    "select content from public.match_study_chunks($1, $2::extensions.vector, 8, 0.35, $3) where document_id=$4",
    [room, embedding, owner, other]
  );
  assert.deepEqual(untouched.rows.map((row) => row.content), ["Untouched notes stay available."]);

  await asRole("service_role");
  await db.query("update documents set last_forced_reindex_at=null where id=$1", [doc]);
  const again = (await db.query("select public.claim_forced_studigo_reindex($1,$2,900) as claim", [doc, owner])).rows[0].claim;
  assert.equal(again.claimed, true);
  await db.query(
    `insert into document_chunks(id, document_id, room_id, owner_id, chunk_index, page_number, content, embedding, revision)
     values($1,$2,$3,$4,0,1,'The executive branch enforces laws.',$5::extensions.vector,$6)`,
    ["10000000-0000-4000-8000-0000000000f5", doc, room, owner, embedding, again.revision]
  );
  const activated = await db.query("select public.activate_document_revision($1,$2,$3,$4) as result", [doc, owner, again.token, again.revision]);
  assert.equal(activated.rows[0].result.published, true);
  const committed = await db.query(
    `select public.commit_document_revision($1,$2,$3,$4,'ready',3,'page',0,1,'[]'::jsonb,null) as result`,
    [doc, owner, again.token, again.revision]
  );
  assert.equal(committed.rows[0].result.published, true);
  await asRole("authenticated");
  const published = await db.query(
    "select content from public.match_study_chunks($1, $2::extensions.vector, 8, 0.35, $3) where document_id=$4",
    [room, embedding, owner, doc]
  );
  assert.deepEqual(published.rows.map((row) => row.content), ["The executive branch enforces laws."]);
  const still = await db.query(
    "select content from public.match_study_chunks($1, $2::extensions.vector, 8, 0.35, $3) where document_id=$4",
    [room, embedding, owner, other]
  );
  assert.deepEqual(still.rows.map((row) => row.content), ["Untouched notes stay available."]);
  const path = await db.query("select storage_path from documents where id=$1", [doc]);
  assert.equal(path.rows[0].storage_path, `${owner}/${room}/guide.pdf`);
  await db.exec("reset role");
});

