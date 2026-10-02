import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COACH_MODE_OPTIONS,
  DEFAULT_COACH_PREFERENCES,
  canonicalCoachPreferences,
  compileCoachPreferences,
  describeCoaching,
  normalizeCoachPreferences,
  validCoachPreferences
} from "./coach-preferences";
import { applyCoachPreferences, readCoachPreferences } from "./coach-preferences-store";

function store() {
  let row: { coach_preferences: Record<string, unknown>; explain_level: "simpler" | "standard" | "deeper" } = {
    coach_preferences: { style: "default", tradition: "tradition-default", practice: "adaptive" },
    explain_level: "standard"
  };
  let error: unknown = null;
  let missing = false;
  const filters: Record<string, unknown> = {};
  let writes = 0;
  const supabase = { from: () => {
    let update: Partial<typeof row> | undefined;
    const query = {
      update: (value: Partial<typeof row>) => { update = value; return query; },
      select: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      maybeSingle: async () => {
        if (error || missing) return { data: null, error };
        if (update) { row = { ...row, ...update }; writes++; }
        return { data: row, error: null };
      }
    };
    return query;
  } } as unknown as SupabaseClient;
  return { supabase, filters, row: () => row, writes: () => writes, fail: () => { error = { message: "offline" }; }, hide: () => { missing = true; } };
}

test("legacy rooms migrate deterministically into the three V3 Coach modes", () => {
  assert.equal(normalizeCoachPreferences({ style: "direct", tradition: "tradition-default", practice: "adaptive" }).coach_mode, "show");
  assert.equal(normalizeCoachPreferences({ style: "visual", tradition: "tradition-default", practice: "adaptive" }).coach_mode, "show");
  assert.equal(normalizeCoachPreferences({ style: "drill", tradition: "tradition-default", practice: "adaptive" }).coach_mode, "challenge");
  assert.equal(normalizeCoachPreferences({ style: "socratic", tradition: "tradition-montessori", practice: "transfer" }).coach_mode, "coach");
  assert.equal(normalizeCoachPreferences(null).coach_mode, "coach");
});

test("each learner-facing Coach mode compiles to one distinct delivery contract while the room level stays separate", () => {
  for (const option of COACH_MODE_OPTIONS) {
    const prefs = { ...DEFAULT_COACH_PREFERENCES, coach_mode: option.id, explainLevel: "simpler" as const };
    assert.ok(validCoachPreferences(prefs));
    const compiled = compileCoachPreferences(prefs);
    assert.equal(compiled.mode, option.id);
    const mode = compiled.directives.find(item => item.name === "Coach mode");
    assert.ok(mode);
    assert.match(mode!.instruction, new RegExp(`mode=${option.id}`));
    const level = compiled.directives.find(item => item.name === "Explanation level");
    assert.match(level!.instruction, /plain everyday words/);
    assert.match(level!.instruction, /same source facts, concepts, reasoning demand and grading standard/);
  }
  assert.equal(new Set(COACH_MODE_OPTIONS.map(option => compileCoachPreferences({ ...DEFAULT_COACH_PREFERENCES, coach_mode: option.id }).directives.find(item => item.name === "Coach mode")!.instruction)).size, 3);
});

test("new Apply writes the V3 mode plus canonical hidden compatibility fields, never the room explanation level", async () => {
  const db = store();
  const before = await readCoachPreferences(db.supabase, "room-a");
  assert.equal(before.coach_mode, "coach");
  assert.equal(db.writes(), 0);

  const chosen = { ...before, coach_mode: "challenge" as const, explainLevel: "simpler" as const };
  const saved = await applyCoachPreferences(db.supabase, "room-a", "user-a", chosen);
  assert.equal(saved.coach_mode, "challenge");
  assert.equal(saved.explainLevel, "standard", "Coach Apply must preserve the room's existing global explanation level");
  assert.deepEqual(db.filters, { id: "room-a", owner_id: "user-a" });
  assert.deepEqual(db.row().coach_preferences, {
    coach_mode: "challenge",
    style: "default",
    tradition: "tradition-default",
    practice: "transfer"
  });
  assert.equal(db.writes(), 1);
});

test("canonical hidden strategy values are derived from mode, not stale learner settings", () => {
  const stale = {
    coach_mode: "show" as const,
    style: "socratic",
    tradition: "tradition-montessori",
    practice: "transfer",
    explainLevel: "deeper" as const
  };
  assert.deepEqual(canonicalCoachPreferences(stale), {
    coach_mode: "show",
    style: "direct",
    tradition: "tradition-default",
    practice: "adaptive",
    explainLevel: "deeper"
  });
  const description = describeCoaching(stale);
  assert.equal(description.label, "Show me");
  assert.match(description.expect, /show me an example/i);
});

test("Apply never reports success for a denied/missing row or database failure", async () => {
  for (const mode of ["hide", "fail"] as const) {
    const db = store(); db[mode]();
    await assert.rejects(applyCoachPreferences(db.supabase, "room-b", "user-a", DEFAULT_COACH_PREFERENCES));
    await assert.rejects(readCoachPreferences(db.supabase, "room-b"));
    assert.equal(db.writes(), 0);
  }
});
