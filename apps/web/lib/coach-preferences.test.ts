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
import {
  LEARN_MODE_OPTIONS,
  compileLearnPreferences,
  normalizeLearnPreferences
} from "./learn-preferences";
import {
  applyCoachPreferences,
  applyLearnPreferences,
  readCoachPreferences,
  readLearnPreferences
} from "./coach-preferences-store";

type Level = "simpler" | "standard" | "deeper";
function store() {
  let row: {
    coach_preferences: Record<string, unknown>;
    learn_preferences: Record<string, unknown>;
    explain_level: Level;
  } = {
    coach_preferences: { style: "default", tradition: "tradition-default", practice: "adaptive" },
    learn_preferences: { mode: "step_by_step" },
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

test("each Coach mode keeps the same global explanation level contract", () => {
  for (const option of COACH_MODE_OPTIONS) {
    const prefs = { ...DEFAULT_COACH_PREFERENCES, coach_mode: option.id, explainLevel: "simpler" as const };
    assert.ok(validCoachPreferences(prefs));
    const compiled = compileCoachPreferences(prefs);
    assert.equal(compiled.mode, option.id);
    assert.match(compiled.directives.find(item => item.name === "Coach mode")!.instruction, new RegExp(`mode=${option.id}`));
    assert.match(compiled.directives.find(item => item.name === "Explanation level")!.instruction, /plain everyday words/);
  }
});

test("Coach and Learn both read the single room-wide explanation level", async () => {
  const db = store();
  db.row().explain_level = "deeper";
  assert.equal((await readCoachPreferences(db.supabase, "room-a")).explainLevel, "deeper");
  assert.equal((await readLearnPreferences(db.supabase, "room-a")).mode, "step_by_step");
});

test("Coach Apply changes Coach mode but never writes explanation level", async () => {
  const db = store();
  db.row().explain_level = "deeper";
  const before = await readCoachPreferences(db.supabase, "room-a");
  const chosen = { ...before, coach_mode: "challenge" as const };
  const saved = await applyCoachPreferences(db.supabase, "room-a", "user-a", chosen);
  assert.equal(saved.coach_mode, "challenge");
  assert.equal(saved.explainLevel, "deeper");
  assert.equal(db.row().explain_level, "deeper");
  assert.deepEqual(db.row().coach_preferences, {
    coach_mode: "challenge",
    style: "default",
    tradition: "tradition-default",
    practice: "transfer"
  });
  assert.deepEqual(db.row().learn_preferences, { mode: "step_by_step" });
});

test("Learn Apply changes only Learn presentation mode and never writes explanation level or Coach", async () => {
  const db = store();
  db.row().explain_level = "simpler";
  const saved = await applyLearnPreferences(db.supabase, "room-a", "user-a", { mode: "examples_first" });
  assert.equal(saved.mode, "examples_first");
  assert.equal(db.row().explain_level, "simpler");
  assert.deepEqual(db.row().coach_preferences, { style: "default", tradition: "tradition-default", practice: "adaptive" });
  assert.deepEqual(db.row().learn_preferences, { mode: "examples_first" });
});

test("Learn modes change presentation order only and never claim adaptive authority", () => {
  assert.equal(LEARN_MODE_OPTIONS.length, 3);
  for (const option of LEARN_MODE_OPTIONS) {
    const compiled = compileLearnPreferences({ mode: option.id }, "standard");
    assert.equal(compiled.mode, option.id);
    assert.match(compiled.directives.find(item => item.name === "Learn mode")!.instruction, new RegExp(`mode=${option.id}`));
    const guardrail = compiled.directives.find(item => item.name === "Learn guardrail")!.instruction;
    assert.match(guardrail, /never changes source scope, factual truth, reasoning demand, grading, mastery, challenge progression, or the adaptive game director/);
  }
  assert.equal(normalizeLearnPreferences(null).mode, "step_by_step");
});

test("canonical hidden Coach strategy values are derived from mode, not stale learner settings", () => {
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
  assert.equal(describeCoaching(stale).label, "Show me");
});

test("Apply never reports success for a denied/missing row or database failure", async () => {
  for (const mode of ["hide", "fail"] as const) {
    const db = store(); db[mode]();
    await assert.rejects(applyCoachPreferences(db.supabase, "room-b", "user-a", DEFAULT_COACH_PREFERENCES));
    await assert.rejects(applyLearnPreferences(db.supabase, "room-b", "user-a", { mode: "overview" }));
    await assert.rejects(readCoachPreferences(db.supabase, "room-b"));
    await assert.rejects(readLearnPreferences(db.supabase, "room-b"));
  }
});
