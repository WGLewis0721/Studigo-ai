import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { OUTFITS } from "./companion-logic";
import { createDirector, type MotionFrame } from "./companion-motion/director";
import { OUTFIT_LAYERS, outfitTransform } from "./companion-motion/outfits";
import { RIG, RIG_SIZE } from "./companion-motion/rig";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/** He as he was drawn: nothing moving. */
function restFrame(): MotionFrame {
  return createDirector({ random: () => 0.5 }).advance(0);
}

/** He looks to the right and holds it for two seconds at 120 Hz. */
function turnedRight(): MotionFrame {
  const director = createDirector({ random: () => 0.5 });
  director.advance(0);
  director.lookAt(1, 0, 5000);
  let frame = director.advance(0);
  for (let i = 1; i <= 240; i += 1) frame = director.advance((i * 1000) / 120);
  return frame;
}

/** Every element opens and closes in order, so a hand-written drawing is never left half-finished. */
function assertWellFormed(source: string, id: string) {
  const open: string[] = [];
  for (const [, closing, name, selfClosing] of source.matchAll(/<(\/?)([A-Za-z][\w:.-]*)[^<>]*?(\/?)>/g)) {
    if (selfClosing) continue;
    if (closing) assert.equal(open.pop(), name, `${id}: </${name}> does not close the element it should`);
    else open.push(name);
  }
  assert.deepEqual(open, [], `${id}: never closed ${open.join(", ")}`);
}

test("every outfit is one layer on a real slot, sized and anchored inside its own box", () => {
  assert.deepEqual(Object.keys(OUTFIT_LAYERS).sort(), [...OUTFITS].sort());
  for (const id of OUTFITS) {
    const layer = OUTFIT_LAYERS[id];
    assert.ok(["head", "eyes", "neck"].includes(layer.slot), `${id} rides ${layer.slot}`);
    assert.equal(layer.src, `/mascot/companion/outfits/${id}.svg`);
    assert.ok(layer.w > 0 && layer.w <= RIG_SIZE && layer.h > 0 && layer.h <= RIG_SIZE, `${id} is ${layer.w} x ${layer.h}`);
    assert.ok(layer.anchor.x >= 0 && layer.anchor.x <= 1 && layer.anchor.y >= 0 && layer.anchor.y <= 1, `${id} anchor is outside its box`);
  }
});

test("every outfit has a self-contained, well-formed SVG drawn at the size its layer says", () => {
  for (const id of OUTFITS) {
    const layer = OUTFIT_LAYERS[id];
    const file = join(publicDir, layer.src);
    assert.ok(existsSync(file), `${id}: no drawing at ${file}`);
    const source = readFileSync(file, "utf8").trim();
    assert.ok(source.startsWith("<svg"), `${id} does not start with <svg`);
    assert.ok(source.includes(SVG_NAMESPACE), `${id} is missing the SVG namespace`);
    const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(source);
    assert.ok(viewBox, `${id} has no viewBox`);
    assert.equal(Number(viewBox[1]), layer.w, `${id} viewBox width`);
    assert.equal(Number(viewBox[2]), layer.h, `${id} viewBox height`);
    assert.doesNotMatch(source, /<(script|text|foreignObject|image|style)\b/i, `${id} has script, text, markup or images it should not`);
    const urls = source.match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
    assert.ok(urls.every((url) => url === SVG_NAMESPACE), `${id} points outside itself: ${urls.join(", ")}`);
    assert.doesNotMatch(source, /url\(\s*["']?(?!#)/, `${id} loads something from outside`);
    assertWellFormed(source, id);
  }
});

test("at rest every outfit sits exactly on its slot, unturned", () => {
  const rest = restFrame();
  for (const id of OUTFITS) {
    const t = outfitTransform(id, rest), slot = RIG.slots[OUTFIT_LAYERS[id].slot];
    assert.ok(Math.abs(t.x - slot.x) < 1e-3 && Math.abs(t.y - slot.y) < 1e-3, `${id} at ${t.x}, ${t.y}; slot ${slot.x}, ${slot.y}`);
    assert.equal(t.rotate, 0, `${id} rotate`);
    assert.equal(t.scaleX, 1, `${id} scaleX`);
    assert.equal(t.scaleY, 1, `${id} scaleY`);
  }
});

test("turning his head right carries a head outfit right and narrows it; the chest does not turn", () => {
  const rest = restFrame(), turned = turnedRight();
  assert.ok(turned.headYaw > 0.5, `he only turned ${turned.headYaw.toFixed(2)}`);
  for (const id of OUTFITS.filter((id) => OUTFIT_LAYERS[id].slot !== "neck")) {
    const before = outfitTransform(id, rest), after = outfitTransform(id, turned);
    assert.ok(after.x - before.x > 5, `${id} moved only ${(after.x - before.x).toFixed(1)} px right`);
    assert.ok(after.scaleX < 0.99 && after.scaleX > 0.8, `${id} scaleX ${after.scaleX.toFixed(3)}`);
  }
  const sashRest = outfitTransform("sash", rest), sash = outfitTransform("sash", turned);
  assert.equal(sash.scaleX, 1, "the sash foreshortened with the head");
  assert.ok(Math.abs(sash.x - sashRest.x) < 5, "the sash moved with the head, not the body");
});

test("a tilted head rolls the head outfits with it, and the sash stays level", () => {
  const rest = restFrame();
  const tilted: MotionFrame = { ...rest, headTilt: 0.5 };
  for (const id of OUTFITS) {
    const t = outfitTransform(id, tilted);
    const expected = OUTFIT_LAYERS[id].followRoll ? 0.5 * 0.2 : 0;
    assert.ok(Math.abs(t.rotate - expected) < 1e-9, `${id} rotate ${t.rotate}`);
  }
  assert.equal(OUTFIT_LAYERS.sash.followRoll, false);
  assert.equal(outfitTransform("sash", tilted).x, outfitTransform("sash", rest).x);
});

test("outfits stretch with his body: they spin, squash, breathe and lean with him", () => {
  const rest = restFrame();
  assert.ok(Math.abs(outfitTransform("beret", { ...rest, spin: Math.PI / 2 }).scaleX) < 1e-9, "a quarter spin left the beret wide");
  const squashed = { ...rest, squash: 0.2 };
  assert.ok(Math.abs(outfitTransform("beret", squashed).scaleX - 1.14) < 1e-9, "squash did not widen the beret");
  assert.ok(Math.abs(outfitTransform("sash", squashed).scaleY - 0.8) < 1e-9, "squash did not flatten the sash");
  assert.ok(Math.abs(outfitTransform("visor", { ...rest, breath: 0.1 }).scaleY - 1.055) < 1e-9, "breath did not lift the visor");
  const leaning = { ...rest, lean: 1 };
  assert.ok(Math.abs(outfitTransform("beret", leaning).scaleX - 1.035) < 1e-9 && Math.abs(outfitTransform("beret", leaning).scaleY - 1.035) < 1e-9, "a lean did not bring the head nearer");
  assert.equal(outfitTransform("sash", leaning).scaleX, 1, "the chest is not part of the head's lean");
});

test("the outfit table is pure: no DOM, network, storage or clock, and only its own contracts imported", () => {
  const source = readFileSync(join(here, "companion-motion", "outfits.ts"), "utf8");
  for (const [, path] of source.matchAll(/from\s+"([^"]+)"/g)) assert.match(path, /^(\.\/[\w-]+|\.\.\/companion-logic)$/, `outfits.ts imports ${path}`);
  assert.doesNotMatch(source, /\b(fetch|localStorage|document|window|supabase|requestAnimationFrame|Date\.now|performance\.now|Math\.random)\b/);
});
