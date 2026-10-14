import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const materials = readFileSync(join(here, "../components/room/materials-panel.tsx"), "utf8");
const reindexRoute = readFileSync(join(here, "../app/api/documents/reindex/route.ts"), "utf8");
const ingest = readFileSync(join(here, "ingest.ts"), "utf8");
const admissionSql = readFileSync(join(here, "../../../supabase/migrations/20261008100000_ai_resource_admission.sql"), "utf8");

test("Materials exposes an explicit Study Guide refresh control beside upload", () => {
  assert.match(materials, /Refresh study guide/);
  assert.match(materials, /\/api\/documents\/reindex/);
  assert.match(materials, /rebuild its search index and topic map/);
  assert.match(materials, /Practice history is kept/);
});

test("Study Guide refresh forces a fresh ingestion pass of the stored original", () => {
  assert.match(reindexRoute, /source_type", "study_guide"/);
  assert.match(reindexRoute, /processDocument\(\{/);
  assert.match(reindexRoute, /force: true/);
});

test("forced ingestion uses one atomic SQL claim without resetting an active worker", () => {
  assert.match(ingest, /if \(args\.force\)/);
  assert.match(ingest, /claim_forced_studigo_reindex/);
  assert.doesNotMatch(ingest, /status: "queued"/);
  assert.doesNotMatch(ingest, /attempts: 0/);
  assert.match(admissionSql, /claim_forced_studigo_reindex/);
  assert.match(admissionSql, /for update/);
  assert.match(admissionSql, /last_forced_reindex_at = v_now/);
  assert.match(ingest, /document_chunks"\)\.delete\(\)\.eq\("document_id", document\.id\)/);
  assert.match(ingest, /buildTopicMap\(\{/);
});
