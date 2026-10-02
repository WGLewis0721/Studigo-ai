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
import { applyCoachPreferences, applyLearnPreferences, readCoachPreferences } from "./coach-preferences-store";

type Level = "simpler" | "standard" | "deeper";
function store() {
  let row: {
    coach_preferences: Record<string, unknown>;
    explain_level: Level;
    coach_explain_level: Level | null;
    learn_explain_level: Level | null;
  } = {
    coach_preferences: { style: "default", tradition: "tradition-default", practice: "adaptive" },
    explain_level: "standard",
    coach_explain_level: "standard",
    learn_explain_level: "standard"
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

test("each learner-facing Coach mode compiles to one distinct delivery contract", () => {
  for (const option of COACH_MODE_OPTIONS) {
    const prefs = { ...DEFAULT_COACH_PREFERENCES, coach_mode: option.id, explainLevel: "simpler" as const };
    assert.ok(validCoachPreferences(prefs));
    const compiled = compileCoachPreferences(prefs);
    assert.equal(compiled.mode, option.id);
    assert.match(compiled.directives.find(item => item.name === "Coach mode")!.instruction, new RegExp(`mode=${option.id}`));
    assert.match(compiled.directives.find(item => item.name === "Explanation level")!.instruction, /plain everyday words/);
  }
});

test("surface reads use independent effective explanation levels", async () => {
  const db = store();
  db.row().coach_explain_level = "deeper";
  db.row().learn_explain_level = "simpler";
  assert.equal((await readCoachPreferences(db.supabase, "room-a", "coach")).explainLevel, "deeper");
  assert.equal((await readCoachPreferences(db.supabase, "room-a", "learn")).explainLevel, "simpler");
});

test("Coach Apply recalibrates Coach only by default", async () => {
  const db = store();
  const before = await readCoachPreferences(db.supabase, "room-a", "coach");
  const chosen = { ...before, coach_mode: "challenge" as const, explainLevel: "simpler" as const };
  const saved = await applyCoachPreferences(db.supabase, "room-a", "user-a", chosen, false);
  assert.equal(saved.preferences.coach_mode, "challenge");
  assert.equal(saved.preferences.explainLevel, "simpler");
  assert.equal(saved.learnExplainLevel, "standard");
  assert.equal(db.row().coach_explain_level, "simpler");
  assert.equal(db.row().learn_explain_level, "standard");
  assert.equal(db.row().explain_level, "standard");
  assert.deepEqual(db.row().coach_preferences, {
    coach_mode: "challenge",
    style: "default",
    tradition: "tradition-default",
    practice: "transfer"
  });
});

test("Learn Apply recalibrates Learn only by default", async () => {
  const db = store();
  const result = await applyLearnPreferences(db.supabase, "room-a", "user-a", "deeper", false);
  assert.equal(result.learnExplainLevel, "deeper");
  assert.equal(result.coachPreferences.explainLevel, "standard");
  assert.equal(db.row().learn_explain_level, "deeper");
  assert.equal(db.row().coach_explain_level, "standard");
  assert.equal(db.row().explain_level, "standard");
});

test("apply-to-both synchronizes both surfaces and the room-wide default", async () => {
  const db = store();
  const coach = await readCoachPreferences(db.supabase, "room-a", "coach");
  await applyCoachPreferences(db.supabase, "room-a", "user-a", { ...coach, explainLevel: "simpler" }, true);
  assert.equal(db.row().coach_explain_level, "simpler");
  assert.equal(db.row().learn_explain_level, "simpler");
  assert.equal(db.row().explain_level, "simpler");

  await applyLearnPreferences(db.supabase, "room-a", "user-a", "deeper", true);
  assert.equal(db.row().coach_explain_level, "deeper");
  assert.equal(db.row().learn_explain_level, "deeper");
  assert.equal(db.row().explain_level, "deeper");
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
});

test("Apply never reports success for a denied/missing row or database failure", async () => {
  for (const mode of ["hide", "fail"] as const) {
    const db = store(); db[mode]();
    await assert.rejects(applyCoachPreferences(db.supabase, "room-b", "user-a", DEFAULT_COACH_PREFERENCES));
    await assert.rejects(applyLearnPreferences(db.supabase, "room-b", "user-a", "standard"));
    await assert.rejects(readCoachPreferences(db.supabase, "room-b"));
  }
});
