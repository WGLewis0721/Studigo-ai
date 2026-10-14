import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { deriveSourceBlocks } from "../packages/documents/src/source-blocks.ts";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const room = "10000000-0000-4000-8000-00000000c120";
const foreignRoom = "10000000-0000-4000-8000-00000000c121";
const doc = "10000000-0000-4000-8000-00000000c122";
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
  await db.query("insert into study_rooms(id, owner_id, title) values($1,$2,'Blocks'),($3,$4,'Other')", [room, owner, foreignRoom, other]);
  await db.query(
    `insert into documents(id, room_id, owner_id, name, mime_type, size_bytes, storage_path, status, active_revision)
     values($1,$2,$3,'guide.pdf','application/pdf',10,$4,'ready',1)`,
    [doc, room, owner, `${owner}/${room}/guide.pdf`]
  );
});

after(async () => { await db.close(); });

test("C12 blocks keep term and table locations and link to the active chunk", async () => {
  const blocks = deriveSourceBlocks([{
    pageNumber: 2,
    text: "Branches\n\nStatute - a law written by Congress.\n\nBranch | Role\nLegislative | Makes laws",
    rawText: "Branches\n\nStatute - a law written by Congress.\n\nBranch | Role\nLegislative | Makes laws"
  }]);
  assert.deepEqual(blocks.map((block) => block.kind), ["heading", "term", "table"]);
  assert.deepEqual(blocks.map((block) => block.pageNumber), [2, 2, 2]);
  const term = blocks[1];
  await db.exec("set role service_role");
  for (const block of blocks) {
    await db.query(
      `insert into source_blocks(document_id, room_id, owner_id, revision, block_key, kind, page_number, reading_order, raw_text, normalized_text, coverage, fingerprint)
       values($1,$2,$3,1,$4,$5,$6,$7,$8,$9,'readable',$10)`,
      [doc, room, owner, block.blockKey, block.kind, block.pageNumber, block.readingOrder, block.rawText, block.text, block.fingerprint]
    );
  }
  await db.query(
    `insert into document_chunks(id, document_id, room_id, owner_id, chunk_index, page_number, content, revision, block_key)
     values($1,$2,$3,$4,0,2,$5,1,$6)`,
    ["10000000-0000-4000-8000-00000000c123", doc, room, owner, term.text, term.blockKey]
  );
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${owner}', false); select set_config('request.jwt.claim.role', 'authenticated', false);`);
  const found = await db.query("select kind, page_number, normalized_text from read_source_block($1,$2,$3)", [room, doc, term.blockKey]);
  assert.equal(found.rows[0].kind, "term");
  assert.equal(found.rows[0].page_number, 2);
  assert.match(String(found.rows[0].normalized_text), /Statute/);
  const link = await db.query("select block_key from document_chunks where id=$1", ["10000000-0000-4000-8000-00000000c123"]);
  assert.equal(link.rows[0].block_key, term.blockKey);
  const path = await db.query("select storage_path from documents where id=$1", [doc]);
  assert.equal(path.rows[0].storage_path, `${owner}/${room}/guide.pdf`);
  await db.exec("reset role");
});

test("C12 a different learner cannot read another room's source block", async () => {
  const block = deriveSourceBlocks([{ pageNumber: 1, text: "Citizen - a person who can vote." }])[0];
  await db.exec("reset role");
  await db.query(
    `insert into source_blocks(document_id, room_id, owner_id, revision, block_key, kind, page_number, reading_order, raw_text, normalized_text, coverage, fingerprint)
     values($1,$2,$3,1,$4,$5,$6,$7,$8,$9,'readable',$10)
     on conflict (document_id, revision, block_key) do nothing`,
    [doc, room, owner, block.blockKey, block.kind, block.pageNumber, block.readingOrder, block.rawText, block.text, block.fingerprint]
  );
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${other}', false); select set_config('request.jwt.claim.role', 'authenticated', false);`);
  const denied = await db.query("select normalized_text from read_source_block($1,$2,$3)", [room, doc, block.blockKey]);
  assert.equal(denied.rows.length, 0);
  const table = await db.query("select id from source_blocks where document_id=$1", [doc]);
  assert.equal(table.rows.length, 0);
  await db.exec("reset role");
});
