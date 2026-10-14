import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { admitThread, archiveDecision, type ConversationRow } from "../apps/web/lib/conversation-surface";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const room = "33333333-3333-4333-8333-333333333333";
const conversation = "44444444-4444-4444-8444-444444444444";
const topic = "55555555-5555-4555-8555-555555555555";

test("C02 start-fresh keeps the Coach receipt, message, and mastery", async () => {
  const db = new PGlite();
  await db.exec(`
    create table studigo_ai_guard_receipts (
      owner_id uuid not null, operation text not null, request_key text not null,
      request_fingerprint text not null, state text not null,
      primary key (owner_id, operation, request_key)
    );
    create table topics (id uuid primary key, mastery_score numeric not null);
    create table conversations (
      id uuid primary key, room_id uuid not null, owner_id uuid not null,
      surface text, archived_at timestamptz
    );
    create table messages (
      id uuid primary key, conversation_id uuid not null references conversations(id),
      role text not null, content text not null
    );
  `);
  await db.query(
    `insert into studigo_ai_guard_receipts values ($1,'coach','receipt-1','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','completed')`,
    [owner]
  );
  await db.query(`insert into topics values ($1, 72)`, [topic]);
  await db.query(`insert into conversations values ($1,$2,$3,'coach',null)`, [conversation, room, owner]);
  await db.query(`insert into messages values ('66666666-6666-4666-8666-666666666666',$1,'user','What does the legislative branch do?')`, [conversation]);

  const before = await db.query<ConversationRow>(`select id, owner_id, room_id, surface, archived_at::text from conversations where id = $1`, [conversation]);
  const decision = archiveDecision({ row: before.rows[0], ownerId: owner, roomId: room, surface: "coach" });
  assert.equal(decision.ok, true);
  if (decision.ok && !decision.already) {
    await db.query(`update conversations set archived_at = now() where id = $1`, [conversation]);
  }
  const again = await db.query<ConversationRow>(`select id, owner_id, room_id, surface, archived_at::text from conversations where id = $1`, [conversation]);
  const repeat = archiveDecision({ row: again.rows[0], ownerId: owner, roomId: room, surface: "coach" });
  assert.equal(repeat.ok && repeat.already, true);

  const receipt = await db.query<{ state: string }>(`select state from studigo_ai_guard_receipts`);
  const mastery = await db.query<{ mastery_score: string }>(`select mastery_score::text from topics`);
  const messages = await db.query(`select content from messages`);
  assert.equal(receipt.rows[0].state, "completed");
  assert.equal(Number(mastery.rows[0].mastery_score), 72);
  assert.equal(messages.rows.length, 1);
  assert.ok(again.rows[0].archived_at);
  await db.close();
});

test("C02 wrong owner, room, or surface is refused with no provider call", () => {
  const row: ConversationRow = { id: conversation, owner_id: owner, room_id: room, surface: "coach", archived_at: null };
  let providerCalls = 0;
  const provider = () => { providerCalls += 1; };
  for (const attempt of [
    admitThread({ conversationId: conversation, row, ownerId: other, roomId: room, surface: "coach" }),
    admitThread({ conversationId: conversation, row, ownerId: owner, roomId: other, surface: "coach" }),
    admitThread({ conversationId: conversation, row, ownerId: owner, roomId: room, surface: "learn" }),
    admitThread({ conversationId: conversation, row: { ...row, surface: null }, ownerId: owner, roomId: room, surface: "coach" })
  ]) {
    assert.equal(attempt.ok, false);
    if (attempt.ok) provider();
  }
  assert.equal(providerCalls, 0);
});
