import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { deriveSourceBlocks } from "../packages/documents/src/source-blocks.ts";
import { renderGuideFacts, validateGuideContent, generateGroundedEdition } from "../packages/ai/src/guide-content.ts";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const room = "10000000-0000-4000-8000-00000000c150";
const doc = "10000000-0000-4000-8000-00000000c151";
let db: PGlite;

const pages = [
  {
    pageNumber: 1,
    text: [
      "Three Branches of Government",
      "The legislative branch makes laws. Citizens elect representatives who debate and write statutes.",
      "The executive branch enforces laws. The president carries out the laws Congress passes.",
      "The judicial branch reviews laws. The Supreme Court belongs to the judicial branch.",
      "For example, Congress writes a statute and the president carries it out."
    ].join("\n\n")
  },
  { pageNumber: 2, text: "Every Vote Counts - A citizen's vote helps choose representatives." }
];

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
  await db.query("insert into study_rooms(id, owner_id, title) values($1,$2,'Government')", [room, owner]);
  await db.query(
    `insert into documents(id, room_id, owner_id, name, mime_type, size_bytes, storage_path, status, active_revision)
     values($1,$2,$3,'guide.pdf','application/pdf',10,$4,'ready',1)`,
    [doc, room, owner, `${owner}/${room}/guide.pdf`]
  );
});

after(async () => { await db.close(); });

test("C15 government edition quotes the source and stores one object", async () => {
  const derived = deriveSourceBlocks(pages);
  const blocks = derived.map((block) => ({
    blockKey: block.blockKey, pageNumber: block.pageNumber, text: block.text, kind: block.kind
  }));
  const built = await generateGroundedEdition({ roomId: room, level: "general", topicIds: ["branches"], blocks });
  assert.equal(built.status, "ready");
  if (built.status !== "ready") return;
  assert.equal(validateGuideContent(built.content, blocks), null);
  const facts = renderGuideFacts(built.content);
  assert.ok(facts.includes("The legislative branch makes laws."));
  assert.ok(facts.includes("The executive branch enforces laws."));
  assert.ok(facts.includes("The judicial branch reviews laws."));
  assert.equal(new Set(facts.filter((fact) => /branch/.test(fact))).size >= 3, true);
  const chapter = built.content.chapters[0];
  assert.match(chapter.examples[0].text, /For example, Congress writes a statute/);
  assert.equal(chapter.terms[0].term, "Every Vote Counts");
  assert.equal(chapter.terms[0].definition, "A citizen's vote helps choose representatives.");
  const prompts = chapter.practice.map((question) => question.prompt);
  assert.ok(prompts.includes("What does the legislative branch do?"));
  assert.ok(prompts.includes("What is Every Vote Counts?"));
  for (const answer of chapter.answers) {
    const question = chapter.practice.find((item) => item.id === answer.questionId);
    assert.equal(question?.answerId, answer.id);
    assert.ok(blocks.some((block) => block.text.includes(answer.text)));
  }

  for (const block of derived) {
    await db.query(
      `insert into source_blocks(document_id, room_id, owner_id, revision, block_key, kind, page_number, reading_order, raw_text, normalized_text, coverage, fingerprint)
       values($1,$2,$3,1,$4,$5,$6,$7,$8,$9,'readable',$10)`,
      [doc, room, owner, block.blockKey, block.kind, block.pageNumber, block.readingOrder, block.rawText, block.text, block.fingerprint]
    );
  }
  await db.exec("set role service_role; select set_config('request.jwt.claim.role', 'service_role', false);");
  const key = `c15:${built.content.sourceSnapshot}`;
  await db.query("select publish_guide_edition($1,$2,$3,$4::jsonb)", [room, owner, key, JSON.stringify(built.content)]);
  await db.query("select publish_guide_edition($1,$2,$3,$4::jsonb)", [room, owner, key, JSON.stringify({ version: 1, chapters: [] })]);
  const stored = (await db.query("select content from guide_editions where owner_id=$1", [owner])).rows[0].content;
  assert.deepEqual(stored.chapters[0].facts.map((fact: { text: string }) => fact.text), facts);
  assert.equal((await db.query("select count(*)::int as n from guide_editions")).rows[0].n, 1);
  await db.exec("reset role");
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${other}', false); select set_config('request.jwt.claim.role', 'authenticated', false);`);
  assert.equal((await db.query("select id from guide_editions")).rows.length, 0);
  await db.exec("reset role");
});
