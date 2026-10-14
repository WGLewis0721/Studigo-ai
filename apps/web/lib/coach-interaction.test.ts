import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ConversationLookupError, ConversationScopeError, requireActiveConversationSurface } from "./coach-interaction";

test("C02 conversation admission rejects wrong owner, room, surface, archived and legacy threads", async () => {
  const active = {
    id: "thread-a", room_id: "room-a", owner_id: "student-a", surface: "coach", archived_at: null
  };
  const cases = [
    { name: "wrong owner", row: { ...active, owner_id: "student-b" } },
    { name: "wrong room", row: { ...active, room_id: "room-b" } },
    { name: "wrong surface", row: { ...active, surface: "learn" } },
    { name: "archived", row: { ...active, archived_at: "2026-10-13T12:00:00Z" } },
    { name: "legacy unclassified", row: { ...active, surface: null } },
    { name: "not visible through RLS", row: null }
  ];

  for (const { name, row } of cases) {
    let downstreamCalls = 0;
    const supabase = {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() { return { data: row, error: null }; }
        };
      }
    } as unknown as SupabaseClient;
    await assert.rejects(async () => {
      await requireActiveConversationSurface({ supabase, conversationId: active.id, roomId: active.room_id, ownerId: active.owner_id, surface: "coach" });
      downstreamCalls += 1;
    }, ConversationScopeError, name);
    assert.equal(downstreamCalls, 0, `${name} must fail before provider admission`);
  }

  const supabase = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: active, error: null }; }
      };
    }
  } as unknown as SupabaseClient;
  assert.equal(await requireActiveConversationSurface({ supabase, conversationId: active.id, roomId: active.room_id, ownerId: active.owner_id, surface: "coach" }), active.id);

  const failing = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: null, error: { message: "temporary database fault" } }; }
      };
    }
  } as unknown as SupabaseClient;
  await assert.rejects(
    requireActiveConversationSurface({ supabase: failing, conversationId: active.id, roomId: active.room_id, ownerId: active.owner_id, surface: "coach" }),
    ConversationLookupError
  );
});
