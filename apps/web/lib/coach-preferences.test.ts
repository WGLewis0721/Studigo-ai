import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { compileCoachPreferences, DEFAULT_COACH_PREFERENCES, normalizeCoachPreferences, STYLES, TRADITIONS, PRACTICE_PROTOCOLS, validCoachPreferences } from "./coach-preferences";
import { applyCoachPreferences, readCoachPreferences } from "./coach-preferences-store";

function store() {
  let row = { coach_preferences: { style: "default", tradition: "tradition-default", practice: "adaptive" }, explain_level: "standard" };
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
  return { supabase, filters, writes: () => writes, fail: () => { error = { message: "offline" }; }, hide: () => { missing = true; } };
}

test("all UI settings compile into delivery instructions and reject unknown IDs", () => {
  for (const style of STYLES) for (const tradition of TRADITIONS) for (const practice of PRACTICE_PROTOCOLS) {
    const preferences = { style: style.id, tradition: tradition.id, practice: practice.id, explainLevel: "simpler" as const };
    assert.ok(validCoachPreferences(preferences));
    const compiled = compileCoachPreferences(preferences);
    assert.ok(compiled.directives.some(item => item.instruction === style.instruction));
    assert.ok(compiled.directives.some(item => item.instruction === tradition.instruction));
    assert.ok(compiled.directives.some(item => item.instruction === practice.instruction));
    assert.match(compiled.directives[3].instruction, /plain everyday words/);
  }
  for (const field of Object.keys(DEFAULT_COACH_PREFERENCES)) {
    assert.equal(validCoachPreferences({ ...DEFAULT_COACH_PREFERENCES, [field]: "invalid" }), false);
  }
  assert.deepEqual(normalizeCoachPreferences(null), DEFAULT_COACH_PREFERENCES);
  assert.match(compileCoachPreferences({ ...DEFAULT_COACH_PREFERENCES, explainLevel: "deeper" }).directives[3].instruction, /precise subject vocabulary/);
});

test("Apply persists the Coach choices, never the room's explanation level, scoped to owner and room", async () => {
  const db = store();
  const chosen = { style: "socratic", tradition: "tradition-montessori", practice: "transfer", explainLevel: "simpler" as const };
  assert.deepEqual(await readCoachPreferences(db.supabase, "room-a"), DEFAULT_COACH_PREFERENCES);
  assert.equal(db.writes(), 0);
  // The level is a Room Settings choice; a Coach Apply must leave it as it was.
  const saved = { ...chosen, explainLevel: "standard" as const };
  assert.deepEqual(await applyCoachPreferences(db.supabase, "room-a", "user-a", chosen), saved);
  assert.deepEqual(db.filters, { id: "room-a", owner_id: "user-a" });
  assert.deepEqual(await readCoachPreferences(db.supabase, "room-a"), saved);
  assert.equal(db.writes(), 1);
});

test("Apply never reports success for a denied/missing row or database failure", async () => {
  for (const mode of ["hide", "fail"] as const) {
    const db = store(); db[mode]();
    await assert.rejects(applyCoachPreferences(db.supabase, "room-b", "user-a", DEFAULT_COACH_PREFERENCES));
    await assert.rejects(readCoachPreferences(db.supabase, "room-b"));
    assert.equal(db.writes(), 0);
  }
});

test("every style, tradition and practice says what the learner will notice, and replies are told to show it", async () => {
  const { describeCoaching } = await import("./coach-preferences");
  for (const option of [...STYLES, ...TRADITIONS, ...PRACTICE_PROTOCOLS]) assert.ok(option.expect.length > 20, option.id);
  assert.equal(new Set(STYLES.map(o => o.expect)).size, STYLES.length);
  const prefs = { style: "socratic", tradition: "tradition-singapore", practice: "transfer", explainLevel: "simpler" as const };
  assert.equal(describeCoaching(prefs).label, "Socratic coach · Singapore Math-inspired");
  const combine = compileCoachPreferences(prefs).directives.find(d => d.name === "How these combine");
  assert.match(combine!.instruction, /Socratic coach/);
  assert.match(combine!.instruction, /only the wording/);
});
