import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { OUTFITS } from "./companion-logic";
import { OUTFIT_TEXTURES } from "./companion-motion/outfits";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");
const centerFile = join(publicDir, "mascot", "companion", "center.webp");
/** The rig maps every drawing with the same texture coordinates, so each outfit is drawn at centre's size. */
const FRAME = 400;
const MAX_BYTES = 60 * 1024;

/** The pixel size of a WebP from its RIFF chunks. A VP8X canvas and the VP8 or VP8L bitstream must agree. */
function webpSize(bytes: Buffer): { width: number; height: number; format: string } {
  assert.equal(bytes.toString("latin1", 0, 4), "RIFF", "not a RIFF file");
  assert.equal(bytes.toString("latin1", 8, 12), "WEBP", "not a WebP");
  let canvas: { width: number; height: number } | null = null, stream: { width: number; height: number; format: string } | null = null;
  for (let at = 12; at + 8 <= bytes.length && !stream;) {
    const format = bytes.toString("latin1", at, at + 4), size = bytes.readUInt32LE(at + 4), data = at + 8;
    if (format === "VP8X") canvas = { width: bytes.readUIntLE(data + 4, 3) + 1, height: bytes.readUIntLE(data + 7, 3) + 1 };
    if (format === "VP8 ") {
      assert.deepEqual([...bytes.subarray(data + 3, data + 6)], [0x9d, 0x01, 0x2a], "VP8 start code");
      stream = { width: bytes.readUInt16LE(data + 6) & 0x3fff, height: bytes.readUInt16LE(data + 8) & 0x3fff, format: "VP8" };
    }
    if (format === "VP8L") {
      assert.equal(bytes[data], 0x2f, "VP8L signature");
      const bits = bytes.readUInt32LE(data + 1);
      stream = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, format: "VP8L" };
    }
    at = data + size + (size % 2);
  }
  assert.ok(stream, "no VP8 or VP8L bitstream in the WebP");
  if (canvas) assert.deepEqual(canvas, { width: stream.width, height: stream.height }, "the VP8X canvas and the bitstream disagree");
  return { ...stream, format: canvas ? `VP8X+${stream.format}` : stream.format };
}

test("the outfit table names every outfit once, each with a drawing of its own in the dressed folder", () => {
  assert.deepEqual(Object.keys(OUTFIT_TEXTURES).sort(), [...OUTFITS].sort());
  for (const id of OUTFITS) assert.equal(OUTFIT_TEXTURES[id], `/mascot/companion/dressed/${id}.webp`);
  assert.equal(new Set(Object.values(OUTFIT_TEXTURES)).size, OUTFITS.length, "two outfits point at one drawing");
});

test("every outfit has a dressed WebP on disk: 400 x 400, under 60 KB, the same size as centre.webp", () => {
  const centre = webpSize(readFileSync(centerFile));
  assert.deepEqual([centre.width, centre.height], [FRAME, FRAME], "center.webp is not 400 x 400");
  for (const id of OUTFITS) {
    const file = join(publicDir, OUTFIT_TEXTURES[id]);
    assert.ok(existsSync(file), `${id}: no drawing at ${file}`);
    const bytes = statSync(file).size;
    assert.ok(bytes < MAX_BYTES, `${id} is ${bytes} bytes`);
    const size = webpSize(readFileSync(file));
    assert.deepEqual([size.width, size.height], [FRAME, FRAME], `${id} is ${size.width} x ${size.height} (${size.format})`);
  }
});

test("each dressed drawing is its own picture, not a copy of centre or of another outfit", () => {
  const digests = [centerFile, ...OUTFITS.map((id) => join(publicDir, OUTFIT_TEXTURES[id]))]
    .map((file) => createHash("sha256").update(readFileSync(file)).digest("hex"));
  assert.equal(new Set(digests).size, digests.length);
});

test("the outfit table is pure: no DOM, network, storage or clock, and only its own contracts imported", () => {
  const source = readFileSync(join(here, "companion-motion", "outfits.ts"), "utf8");
  for (const [, path] of source.matchAll(/from\s+"([^"]+)"/g)) assert.equal(path, "../companion-logic", `outfits.ts imports ${path}`);
  assert.doesNotMatch(source, /\b(fetch|localStorage|document|window|supabase|requestAnimationFrame|Date\.now|performance\.now|Math\.random)\b/);
});
