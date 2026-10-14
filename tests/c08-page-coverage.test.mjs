import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";

const owner = "00000000-0000-4000-8000-000000000001";
const room = "10000000-0000-4000-8000-0000000000c8";
const partialDoc = "10000000-0000-4000-8000-0000000000c1";
const uncertainDoc = "10000000-0000-4000-8000-0000000000c2";
const embedding = `[${Array(1536).fill(0).join(",")}]`;
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
    await db.exec(sql.replace("create extension if not exists pgcrypto;", ""));
  }
  await db.query("insert into auth.users(id) values($1)", [owner]);
  await db.query("insert into study_rooms(id, owner_id, title) values($1,$2,'Coverage')", [room, owner]);
});

after(async () => { await db?.close(); });

test("C08 retrieval and session scope reject uncertain-page evidence", async () => {
  const coverage = JSON.stringify([
    { pageNumber: 1, state: "readable", reason: "verified_text" },
    { pageNumber: 2, state: "unreadable", reason: "missing_text" },
    { pageNumber: 3, state: "uncertain", reason: "uncertain_text" }
  ]);
  await db.query(
    `insert into documents(id, room_id, owner_id, name, mime_type, size_bytes, storage_path, status, page_coverage)
     values($1,$2,$3,'guide.pdf','application/pdf',10,$4,'partial',$5::jsonb)`,
    [partialDoc, room, owner, `${owner}/${room}/guide.pdf`, coverage]
  );
  await db.query(
    `insert into documents(id, room_id, owner_id, name, mime_type, size_bytes, storage_path, status, page_coverage)
     values($1,$2,$3,'bad.pdf','application/pdf',10,$4,'partial',$5::jsonb)`,
    [uncertainDoc, room, owner, `${owner}/${room}/bad.pdf`, JSON.stringify([{ pageNumber: 1, state: "uncertain", reason: "uncertain_text" }])]
  );
  const pages = [
    ["10000000-0000-4000-8000-0000000000d1", partialDoc, 0, 1, "The legislative branch makes laws."],
    ["10000000-0000-4000-8000-0000000000d2", partialDoc, 1, 2, "Unreadable page text must not be retrieved."],
    ["10000000-0000-4000-8000-0000000000d3", partialDoc, 2, 3, "Uncertain page text must not be retrieved."],
    ["10000000-0000-4000-8000-0000000000d4", uncertainDoc, 0, 1, "Only uncertain text."]
  ];
  for (const [id, documentId, index, page, content] of pages) {
    await db.query(
      `insert into document_chunks(id, document_id, room_id, owner_id, chunk_index, page_number, content, embedding)
       values($1,$2,$3,$4,$5,$6,$7,$8::extensions.vector)`,
      [id, documentId, room, owner, index, page, content, embedding]
    );
  }

  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${owner}', false); select set_config('request.jwt.claim.role', 'authenticated', false);`);
  const matched = await db.query(
    "select content, page_number from public.match_study_chunks($1, $2::extensions.vector, 8, 0.35, $3)",
    [room, embedding, owner]
  );
  assert.deepEqual(matched.rows.map((row) => row.page_number), [1]);
  assert.match(matched.rows[0].content, /legislative branch/);
  const scope = await db.query("select public.read_session_source_scope($1) as ids", [room]);
  assert.deepEqual(scope.rows[0].ids, [partialDoc]);
  await db.exec("reset role");
});
