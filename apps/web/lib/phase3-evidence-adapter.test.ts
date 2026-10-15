import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { adaptPhase3Evidence, phase3MaterialsEvidenceEnabled, type Phase3EvidenceInput } from "./phase3-evidence-adapter";

const here = dirname(fileURLToPath(import.meta.url));

const ready: Phase3EvidenceInput = {
  documentId: "doc-1",
  title: "Government vocabulary packet",
  blockKey: "block-2",
  pageNumber: 2,
  pageLabel: null,
  revision: 4,
  currentRevision: 4,
  present: true,
  access: "allowed",
  ocr: "ready",
  excerpt: "They choose representatives by voting in elections.",
  excerptVerified: true
};

test("a verified current excerpt becomes a ticket with the exact passage", () => {
  const view = adaptPhase3Evidence(ready);
  assert.equal(view.kind, "ticket");
  if (view.kind !== "ticket") return;
  assert.equal(view.passage, ready.excerpt);
  assert.equal(view.page, "Page 2");
  assert.equal(view.eyebrow, "FROM YOUR MATERIAL");
  assert.match(view.originalHref, /documentId=doc-1/);
  assert.match(view.originalHref, /inline=1/);
  assert.match(view.originalHref, /page=2/);
  assert.match(view.note, /original file/);
});

test("an unverified excerpt does not leak into the recovery view", () => {
  const view = adaptPhase3Evidence({ ...ready, excerptVerified: false });
  assert.equal(view.kind, "recovery");
  if (view.kind !== "recovery") return;
  assert.equal(view.state, "missing");
  assert.equal(JSON.stringify(view).includes(ready.excerpt!), false);
});

test("a revision mismatch is stale and hides the excerpt", () => {
  const view = adaptPhase3Evidence({ ...ready, currentRevision: 5 });
  assert.equal(view.kind, "recovery");
  if (view.kind !== "recovery") return;
  assert.equal(view.state, "stale");
  assert.equal(view.originalHref, null);
  assert.equal(JSON.stringify(view).includes(ready.excerpt!), false);
});

test("partial OCR points at the original file without a quotation", () => {
  const view = adaptPhase3Evidence({ ...ready, ocr: "partial", excerptVerified: false, excerpt: "partial scan text" });
  assert.equal(view.kind, "recovery");
  if (view.kind !== "recovery") return;
  assert.equal(view.state, "partial");
  assert.match(view.originalHref ?? "", /documentId=doc-1/);
  assert.equal(JSON.stringify(view).includes("partial scan text"), false);
});

test("uncertain OCR stays uncertain", () => {
  const view = adaptPhase3Evidence({ ...ready, ocr: "uncertain", excerptVerified: false });
  assert.equal(view.kind, "recovery");
  if (view.kind !== "recovery") return;
  assert.equal(view.state, "uncertain");
  assert.ok(view.originalHref);
});

test("denied access wins over a verified excerpt", () => {
  const view = adaptPhase3Evidence({ ...ready, access: "denied" });
  assert.equal(view.kind, "recovery");
  if (view.kind !== "recovery") return;
  assert.equal(view.state, "denied");
  assert.equal(JSON.stringify(view).includes(ready.excerpt!), false);
});

test("the materials evidence flag is off unless explicitly set", () => {
  const previous = process.env.NEXT_PUBLIC_PHASE3_MATERIALS_EVIDENCE;
  delete process.env.NEXT_PUBLIC_PHASE3_MATERIALS_EVIDENCE;
  assert.equal(phase3MaterialsEvidenceEnabled(), false);
  process.env.NEXT_PUBLIC_PHASE3_MATERIALS_EVIDENCE = "1";
  assert.equal(phase3MaterialsEvidenceEnabled(), true);
  if (previous === undefined) delete process.env.NEXT_PUBLIC_PHASE3_MATERIALS_EVIDENCE;
  else process.env.NEXT_PUBLIC_PHASE3_MATERIALS_EVIDENCE = previous;
});

test("production materials do not call the Phase 3 evidence adapter", () => {
  const materials = readFileSync(join(here, "../components/room/materials-panel.tsx"), "utf8");
  const workspace = readFileSync(join(here, "../components/room/workspace.tsx"), "utf8");
  assert.equal(materials.includes("phase3-evidence-adapter"), false);
  assert.equal(materials.includes("Phase3EvidenceSlot"), false);
  assert.equal(workspace.includes("Phase3EvidenceSlot"), false);
  assert.equal(workspace.includes("phase3/ui"), false);
});

test("the adapter source does not grade or write mastery", () => {
  const source = readFileSync(join(here, "phase3-evidence-adapter.ts"), "utf8");
  assert.equal(/mastery|grade|supabase/i.test(source), false);
});
