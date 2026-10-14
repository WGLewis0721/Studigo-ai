import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  THREAD_MESSAGE_WINDOW,
  assembleRestoredThreads,
  latestMessagesSql,
  savePointerDecision,
  shouldAutoResumeStoredTurn,
  type ThreadConversation,
  type ThreadMessage,
  type ThreadPointer
} from "../apps/web/lib/thread-restore";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const room = "33333333-3333-4333-8333-333333333333";
const otherRoom = "99999999-9999-4999-8999-999999999999";
const learnId = "44444444-4444-4444-8444-444444444444";
const coachId = "55555555-5555-4555-8555-555555555555";
const topics = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6"];

function stamp(index: number) {
  return new Date(Date.UTC(2026, 9, 14, 12, 0, index)).toISOString();
}

test("C20 Learn and Coach reload their own topic and Clear stays empty", async () => {
  const db = new PGlite();
  await db.exec(`
    create table conversations (
      id uuid primary key, room_id uuid not null, owner_id uuid not null,
      surface text, archived_at timestamptz, coach_state jsonb
    );
    create table messages (
      id uuid primary key, conversation_id uuid not null, role text not null,
      content text not null, citations jsonb not null default '[]', created_at timestamptz not null
    );
    create table chat_thread_pointers (
      owner_id uuid not null, room_id uuid not null, surface text not null,
      conversation_id uuid, cursor_index integer not null, topic_ids uuid[] not null,
      primary key (owner_id, room_id, surface)
    );
  `);
  await db.query(`insert into conversations values ($1,$2,$3,'learn',null,'{"version":1,"kind":"idle"}')`, [learnId, room, owner]);
  await db.query(`insert into conversations values ($1,$2,$3,'coach',null,'{"version":1,"kind":"idle"}')`, [coachId, room, owner]);
  for (let index = 0; index < 45; index += 1) {
    const citations = index === 44 ? JSON.stringify([{ documentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", documentName: "Government guide", pageNumber: 2, pageLabel: "page" }]) : "[]";
    await db.query(
      `insert into messages values ($1,$2,'assistant',$3,$4::jsonb,$5::timestamptz)`,
      [`${(index + 1).toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`, learnId, `learn-${index}`, citations, stamp(index)]
    );
  }
  await db.query(
    `insert into messages values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',$1,'user','Coach the executive branch','[]'::jsonb,$2::timestamptz)`,
    [coachId, stamp(1)]
  );
  await db.query(
    `insert into messages values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',$1,'assistant','Try one check on the executive branch.','[]'::jsonb,$2::timestamptz)`,
    [coachId, stamp(2)]
  );
  await db.query(
    `insert into chat_thread_pointers values ($1,$2,'learn',$3,3,$4::uuid[])`,
    [owner, room, learnId, topics]
  );
  await db.query(
    `insert into chat_thread_pointers values ($1,$2,'coach',$3,1,$4::uuid[])`,
    [owner, room, coachId, [topics[0], topics[1]]]
  );

  const loaded = await loadRoom(db, owner, room);
  assert.equal(loaded.denied, false);
  assert.equal(loaded.learn.topicIds[3], topics[3]);
  assert.equal(loaded.learn.cursorIndex, 3);
  assert.equal(loaded.learn.messages.length, THREAD_MESSAGE_WINDOW);
  assert.equal(loaded.learn.messages[0].content, "learn-5");
  assert.equal(loaded.learn.messages.at(-1)?.content, "learn-44");
  assert.equal(loaded.learn.messages.some((message) => message.content === "learn-0"), false);
  assert.equal(loaded.learn.messages.at(-1)?.citations[0]?.documentName, "Government guide");
  assert.equal(loaded.learn.messages.at(-1)?.citations[0]?.pageNumber, 2);
  assert.deepEqual(loaded.learn.messages.map((message) => message.createdAt).slice().sort(), loaded.learn.messages.map((message) => message.createdAt));
  assert.equal(loaded.coach.topicIds[1], topics[1]);
  assert.equal(loaded.coach.cursorIndex, 1);
  assert.deepEqual(loaded.coach.messages.map((message) => message.content), ["Coach the executive branch", "Try one check on the executive branch."]);
  assert.notEqual(loaded.learn.conversationId, loaded.coach.conversationId);

  await db.query(`update conversations set archived_at = now() where id = $1`, [coachId]);
  const cleared = await loadRoom(db, owner, room);
  assert.equal(cleared.coach.conversationId, null);
  assert.equal(cleared.coach.messages.length, 0);
  assert.equal(JSON.stringify(cleared.coach).includes("executive branch"), false);
  assert.equal(cleared.coach.topicIds[0], topics[0]);
  assert.equal(cleared.learn.messages.at(-1)?.content, "learn-44");
  assert.equal(cleared.learn.cursorIndex, 3);

  const kept = savePointerDecision({
    ownerId: owner, roomId: room, surface: "learn", roomOwned: true, cursorIndex: 3, topicIds: topics,
    conversationId: learnId, conversation: loaded.learn.conversationId ? { id: learnId, owner_id: owner, room_id: room, surface: "learn", archived_at: null } : null
  });
  assert.equal(kept.ok, true);
  const archived = savePointerDecision({
    ownerId: owner, roomId: room, surface: "coach", roomOwned: true, cursorIndex: 1, topicIds: [topics[0], topics[1]],
    conversationId: coachId, conversation: { id: coachId, owner_id: owner, room_id: room, surface: "coach", archived_at: new Date().toISOString() }
  });
  assert.equal(archived.ok, false);

  const route = readFileSync(new URL("../apps/web/app/api/chat/thread/route.ts", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../apps/web/components/room/coach-panel.tsx", import.meta.url), "utf8");
  const clear = readFileSync(new URL("../apps/web/app/api/chat/clear/route.ts", import.meta.url), "utf8");
  assert.match(route, /ascending:\s*false/);
  assert.match(route, /THREAD_MESSAGE_WINDOW/);
  assert.match(route, /eq\("owner_id", user\.id\)/);
  assert.match(route, /eq\("room_id", roomId\)/);
  assert.equal(panel.includes("localStorage"), false);
  assert.match(clear, /chat_thread_pointers/);
  assert.match(clear, /conversation_id: null/);
  await db.close();
});

test("C20 interrupted Coach is not graded and a different owner is denied", async () => {
  const db = new PGlite();
  await db.exec(`
    create table studigo_ai_guard_receipts (
      owner_id uuid not null, operation text not null, request_key text not null, state text not null
    );
    create table topics (id uuid primary key, mastery_score numeric not null);
    create table conversations (
      id uuid primary key, room_id uuid not null, owner_id uuid not null,
      surface text, archived_at timestamptz, coach_state jsonb
    );
    create table messages (
      id uuid primary key, conversation_id uuid not null, role text not null,
      content text not null, citations jsonb not null default '[]', created_at timestamptz not null
    );
    create table chat_thread_pointers (
      owner_id uuid not null, room_id uuid not null, surface text not null,
      conversation_id uuid, cursor_index integer not null, topic_ids uuid[] not null,
      primary key (owner_id, room_id, surface)
    );
  `);
  const interactionId = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
  const secret = "My interrupted answer about the legislative branch";
  await db.query(`insert into studigo_ai_guard_receipts values ($1,'coach',$2,'completed')`, [owner, interactionId]);
  await db.query(`insert into topics values ($1, 40)`, [topics[0]]);
  await db.query(
    `insert into conversations values ($1,$2,$3,'coach',null,'{"version":1,"kind":"awaiting_answer"}')`,
    [coachId, room, owner]
  );
  await db.query(
    `insert into messages values ($1,$2,'user',$3,'[]'::jsonb,$4::timestamptz)`,
    [interactionId, coachId, secret, stamp(3)]
  );
  await db.query(`insert into chat_thread_pointers values ($1,$2,'coach',$3,0,$4::uuid[])`, [owner, room, coachId, [topics[0]]]);

  const restored = await loadRoom(db, owner, room);
  let submitted = 0;
  let graded = 0;
  if (restored.coach.autoSubmit || shouldAutoResumeStoredTurn()) submitted += 1;
  if (restored.coach.grade) graded += 1;
  assert.equal(restored.coach.turn, "interrupted");
  assert.equal(restored.coach.retryInteractionId, interactionId);
  assert.equal(restored.coach.messages.at(-1)?.role, "user");
  assert.equal(submitted, 0);
  assert.equal(graded, 0);

  const pendingId = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";
  const pendingConversation = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
  const pending = assembleRestoredThreads({
    requesterId: owner,
    roomId: room,
    roomOwnerId: owner,
    pointers: [{ owner_id: owner, room_id: room, surface: "coach", conversation_id: pendingConversation, cursor_index: 0, topic_ids: [topics[0]] }],
    conversations: [{ id: pendingConversation, owner_id: owner, room_id: room, surface: "coach", archived_at: null, coach_state: { version: 1, kind: "awaiting_answer" } }],
    messagesByConversation: {
      [pendingConversation]: [
        { id: "ffffffff-ffff-4fff-8fff-fffffffffff1", role: "assistant", content: "What does the executive branch do?", citations: [], created_at: stamp(4) }
      ]
    }
  });
  if (pending.coach.autoSubmit || pending.coach.grade || shouldAutoResumeStoredTurn()) graded += 1;
  assert.equal(pending.coach.turn, "pending");
  assert.equal(graded, 0);
  assert.equal(pendingId.length > 0, true);

  const receipt = await db.query<{ state: string }>(`select state from studigo_ai_guard_receipts`);
  const mastery = await db.query<{ mastery_score: string }>(`select mastery_score::text from topics`);
  assert.equal(receipt.rows[0].state, "completed");
  assert.equal(Number(mastery.rows[0].mastery_score), 40);

  const denied = assembleRestoredThreads({
    requesterId: other,
    roomId: room,
    roomOwnerId: owner,
    pointers: restoredPointers(owner),
    conversations: [{ id: coachId, owner_id: owner, room_id: room, surface: "coach", archived_at: null, coach_state: { kind: "awaiting_answer" } }],
    messagesByConversation: { [coachId]: [{ id: interactionId, role: "user", content: secret, citations: [], created_at: stamp(3) }] }
  });
  assert.equal(denied.denied, true);
  assert.equal(denied.coach.messages.length, 0);
  assert.equal(JSON.stringify(denied).includes(secret), false);
  assert.equal(savePointerDecision({
    ownerId: other, roomId: room, surface: "coach", roomOwned: false, cursorIndex: 0, topicIds: [topics[0]], conversation: null
  }).ok, false);

  const wrongRoom = assembleRestoredThreads({
    requesterId: owner,
    roomId: otherRoom,
    roomOwnerId: owner,
    pointers: restoredPointers(owner),
    conversations: [{ id: coachId, owner_id: owner, room_id: room, surface: "coach", archived_at: null }],
    messagesByConversation: { [coachId]: [{ id: interactionId, role: "user", content: secret, citations: [], created_at: stamp(3) }] }
  });
  assert.equal(wrongRoom.coach.messages.length, 0);
  assert.equal(JSON.stringify(wrongRoom).includes(secret), false);

  const panel = readFileSync(new URL("../apps/web/components/room/coach-panel.tsx", import.meta.url), "utf8");
  const loader = panel.slice(panel.indexOf("async function loadStoredThreads"), panel.indexOf("async function teachSelected"));
  assert.equal(loader.includes("void coach("), false);
  assert.equal(loader.includes("retryInterrupted"), false);
  assert.equal(loader.includes("gradeAnswer"), false);
  assert.match(panel, /onClick=\{\(\) => void retryInterrupted\(\)\}/);
  assert.match(panel, /retryInteractionId \?\? crypto\.randomUUID\(\)/);
  await db.close();
});

function restoredPointers(ownerId: string): ThreadPointer[] {
  return [{ owner_id: ownerId, room_id: room, surface: "coach", conversation_id: coachId, cursor_index: 0, topic_ids: [topics[0]] }];
}

async function loadRoom(db: PGlite, requesterId: string, roomId: string) {
  const pointers = await db.query<ThreadPointer>(
    `select owner_id, room_id, surface, conversation_id, cursor_index, topic_ids from chat_thread_pointers where owner_id = $1 and room_id = $2`,
    [requesterId, roomId]
  );
  const conversations = await db.query<ThreadConversation>(
    `select id, owner_id, room_id, surface, archived_at::text as archived_at, coach_state from conversations where owner_id = $1 and room_id = $2`,
    [requesterId, roomId]
  );
  const messagesByConversation: Record<string, ThreadMessage[]> = {};
  for (const row of pointers.rows) {
    if (!row.conversation_id) continue;
    const messages = await db.query<ThreadMessage>(latestMessagesSql(), [row.conversation_id]);
    messagesByConversation[row.conversation_id] = messages.rows;
  }
  const roomOwner = await db.query<{ owner_id: string }>(`select owner_id from conversations where room_id = $1 limit 1`, [roomId]);
  return assembleRestoredThreads({
    requesterId,
    roomId,
    roomOwnerId: roomOwner.rows[0]?.owner_id ?? null,
    pointers: pointers.rows,
    conversations: conversations.rows,
    messagesByConversation
  });
}
