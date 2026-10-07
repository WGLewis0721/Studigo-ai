import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { assertContentMatchesType, assertSafeZip, UnsafeFileError } from "./file-safety";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const enc = (text: string) => new TextEncoder().encode(text);

async function zip(files: Record<string, string | Uint8Array>) {
  const archive = new JSZip();
  for (const [name, body] of Object.entries(files)) archive.file(name, body);
  return archive.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

test("real files pass their own type check", async () => {
  const pdf = await (await PDFDocument.create()).save();
  assertContentMatchesType("application/pdf", pdf);
  assertContentMatchesType(DOCX, await zip({ "[Content_Types].xml": "<x/>", "word/document.xml": "<w:document/>" }));
  assertContentMatchesType(PPTX, await zip({ "[Content_Types].xml": "<x/>", "ppt/presentation.xml": "<p/>" }));
  assertContentMatchesType("image/png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]));
  assertContentMatchesType("image/jpeg", Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]));
  assertContentMatchesType("image/webp", enc("RIFF\0\0\0\0WEBPVP8 "));
  assertContentMatchesType("text/markdown", enc("# Cells\n\nMitochondria — café"));
});

test("a renamed file is rejected by its bytes, not trusted by its extension or declared type", async () => {
  assert.throws(() => assertContentMatchesType("application/pdf", enc("<html><script>alert(1)</script>")), UnsafeFileError);
  assert.throws(() => assertContentMatchesType("image/png", enc("%PDF-1.7")), UnsafeFileError);
  assert.throws(() => assertContentMatchesType("text/plain", Uint8Array.from([0x4d, 0x5a, 0x00, 0x00])), UnsafeFileError);
  assert.throws(() => assertContentMatchesType("text/plain", Uint8Array.from([0xc3, 0x28])), UnsafeFileError);
  // A ZIP that is not a Word document (e.g. a PPTX uploaded as .docx, or any archive).
  await assert.rejects(async () => assertContentMatchesType(DOCX, await zip({ "ppt/presentation.xml": "<p/>" })), UnsafeFileError);
  await assert.rejects(async () => assertContentMatchesType(DOCX, await zip({ "payload.exe": "MZ" })), UnsafeFileError);
});

test("a PDF that also contains a web page is rejected", () => {
  assert.throws(
    () => assertContentMatchesType("application/pdf", enc("%PDF-1.7\n<html><script>alert(1)</script>")),
    UnsafeFileError
  );
});

test("a PNG larger than the edge cap is rejected when its header is readable", () => {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 9000);
  view.setUint32(20, 10);
  assert.throws(() => assertContentMatchesType("image/png", bytes), UnsafeFileError);
});

test("decompression bombs and oversized part counts are rejected before inflation", async () => {
  const bomb = await zip({ "word/document.xml": "a".repeat(5_000_000) });
  assert.ok(bomb.length < 50_000, "fixture is highly compressed");
  assert.throws(() => assertSafeZip(bomb), /expands too far/);
  assert.throws(() => assertSafeZip(bomb, { maxRatio: 1_000_000, maxUncompressedBytes: 1_000_000 }), /expands too far/);

  const many: Record<string, string> = {};
  for (let index = 0; index < 30; index++) many[`part${index}.xml`] = "x";
  const manyParts = await zip(many);
  assert.throws(() => assertSafeZip(manyParts, { maxEntries: 20 }), /too many internal parts/);
  assert.throws(() => assertSafeZip(enc("PK\u0003\u0004 not really a zip")), UnsafeFileError);
});
