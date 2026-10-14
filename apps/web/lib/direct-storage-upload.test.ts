import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * Route-level contract for large learner uploads. This is deliberately a static
 * architecture check; hosted upload, permissions and file-size behavior still
 * require a real browser/Supabase verification.
 */
test("50 MB study materials use signed direct Storage upload, never Vercel multipart body", () => {
  const ui = readFileSync(new URL("../components/room/materials-panel.tsx", import.meta.url), "utf8");
  assert.match(ui, /uploadToSignedUrl\(/);
  assert.match(ui, /\/api\/documents\/upload\/prepare/);
  assert.match(ui, /\/api\/documents\/upload\/complete/);
  assert.doesNotMatch(ui, /fetch\("\/api\/documents\/upload"\s*,/);
  const prepare = readFileSync(new URL("../app/api/documents/upload/prepare/route.ts", import.meta.url), "utf8");
  assert.match(prepare, /guardAiRequest\(request, "document-upload", guardedPost\)/);
  assert.match(prepare, /createSignedUploadUrl\(storagePath\)/);
  assert.match(prepare, /eq\("id", roomId\)/);
  assert.doesNotMatch(prepare, /formData\(/);
});

test("signed upload must validate actual stored bytes, ownership and checksum before publication", () => {
  const route = readFileSync(new URL("../app/api/documents/upload/complete/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireApiUser\(/);
  assert.match(route, /document\.owner_id !== user\.id/);
  assert.match(route, /download\(document\.storage_path\)/);
  assert.match(route, /assertContentMatchesType\(document\.mime_type, buffer\)/);
  assert.match(route, /buffer\.byteLength !== Number\(document\.size_bytes\)/);
  assert.match(route, /sha256Hex\(buffer\)/);
  assert.match(route, /eq\("status", "uploaded"\)/);
  assert.match(route, /status: "queued"/);
});
