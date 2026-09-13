// Asset-prep script for the hero mascot cursor-tracking poses.
//
// Two problems with the raw frames in assets/mouse-tracking/:
//
// 1. They were rendered on inconsistent canvases (different resolutions; feet
//    position ranged 92.7%-99.4% of canvas height; character height ranged
//    83%-94% of canvas). Swapping between them made the mascot visibly grow,
//    shrink, rise and sink as poses changed.
// 2. They are full-body, but the hero companion renders inside a ~150px
//    circular badge, where a full-body character leaves the head around 35px
//    and makes head-turns unreadable.
//
// So each frame is first registered into a shared body space (identical feet
// baseline, centre-X and character height), then a fixed head-and-shoulders
// window is cropped out of that space. Because the crop is applied after
// registration, the window is identical for every pose - the head moves inside
// the frame, the frame itself never shifts.
//
// The crop is sized so the widest ear-flare (union across poses spans x 84-528
// in registered space) stays clear of the circular mask.
//
// Re-run with `node apps/web/scripts/normalize-mascot-frames.mjs` when the
// source frames change. frame-12 (down-right-far) is intentionally excluded:
// mismatched export with the wrong head orientation and a baked-in ground
// shadow. That corner is synthesized at runtime by blending right-far, down
// and down-right-near.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SRC_DIR = path.join(ROOT, "assets/mouse-tracking");
const OUT_DIR = path.join(ROOT, "apps/web/public/mascot/cursor-tracking");

const ALPHA_BBOX_THRESHOLD = 16;
const ALPHA_CLEAN_THRESHOLD = 24; // drops faint background-removal fringe pixels

// Shared body-registration space.
const TARGET_BBOX_H = 620;
const REG_FEET_Y = 710;
const REG_CENTER_X = 310;

// Head-and-shoulders window inside that space.
const CROP_X0 = 26;
const CROP_Y0 = 30;
const OUT_SIZE = 560;

const POSES = {
  "studigo-cursor-frame-01-up-left.png": "up-left",
  "studigo-cursor-frame-02-up.png": "up",
  "studigo-cursor-frame-03-up-right.png": "up-right",
  "studigo-cursor-frame-04-left-far.png": "left-far",
  "studigo-cursor-frame-05-left-near.png": "left-near",
  "studigo-cursor-frame-06-center.png": "center",
  "studigo-cursor-frame-07-right-near.png": "right-near",
  "studigo-cursor-frame-08-right-far.png": "right-far",
  "studigo-cursor-frame-09-down-left.png": "down-left",
  "studigo-cursor-frame-10-down.png": "down",
  "studigo-cursor-frame-11-down-right-near.png": "down-right-near"
};

function decodePng(filePath) {
  const buf = fs.readFileSync(filePath);
  let offset = 8;
  const idatChunks = [];
  let width, height, bitDepth, colorType;
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.slice(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
    } else if (type === "IDAT") {
      idatChunks.push(data);
    }
    offset += 8 + len + 4;
  }
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const bpp = channels * (bitDepth / 8);
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let pos = 0;
  let prevLine = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[pos];
    pos++;
    const line = raw.slice(pos, pos + stride);
    pos += stride;
    const outLine = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? outLine[x - bpp] : 0;
      const b = prevLine[x];
      const c = x >= bpp ? prevLine[x - bpp] : 0;
      let val = line[x];
      if (filter === 1) val = (val + a) & 0xff;
      else if (filter === 2) val = (val + b) & 0xff;
      else if (filter === 3) val = (val + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        val = (val + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
      outLine[x] = val;
    }
    outLine.copy(out, y * stride);
    prevLine = outLine;
  }
  return { width, height, channels, data: out };
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function encodePng(width, height, rgba) {
  const bpp = 4;
  const stride = width * bpp;
  const raw = Buffer.alloc((stride + 1) * height);
  let prevLine = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const line = rgba.slice(y * stride, y * stride + stride);
    const rowOut = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = prevLine[x];
      const c = x >= bpp ? prevLine[x - bpp] : 0;
      rowOut[x] = (line[x] - paethPredictor(a, b, c)) & 0xff;
    }
    raw[y * (stride + 1)] = 4; // filter type Paeth
    rowOut.copy(raw, y * (stride + 1) + 1);
    prevLine = line;
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  const chunks = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])];
  let crcTable;
  function crc32(buf) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c;
      }
    }
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return c ^ 0xffffffff;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  chunks.push(chunk("IHDR", ihdr));
  chunks.push(chunk("IDAT", idat));
  chunks.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

function sampleAt(img, x, y) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return [0, 0, 0, 0];
  const i = (y * img.width + x) * img.channels;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.channels === 4 ? img.data[i + 3] : 255];
}

function bilinear(img, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const p00 = sampleAt(img, x0, y0);
  const p10 = sampleAt(img, x0 + 1, y0);
  const p01 = sampleAt(img, x0, y0 + 1);
  const p11 = sampleAt(img, x0 + 1, y0 + 1);
  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const top = p00[c] * (1 - fx) + p10[c] * fx;
    const bot = p01[c] * (1 - fx) + p11[c] * fx;
    out[c] = top * (1 - fy) + bot * fy;
  }
  return out;
}

function computeBBox(img) {
  let minX = img.width, maxX = 0, minY = img.height, maxY = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const a = img.data[(y * img.width + x) * img.channels + 3];
      if (a > ALPHA_BBOX_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { h: maxY - minY, centerX: (minX + maxX) / 2, feetY: maxY };
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const report = [];
for (const [srcFile, poseName] of Object.entries(POSES)) {
  const img = decodePng(path.join(SRC_DIR, srcFile));
  const bbox = computeBBox(img);
  const scale = TARGET_BBOX_H / bbox.h;

  const outRgba = Buffer.alloc(OUT_SIZE * OUT_SIZE * 4);
  for (let oy = 0; oy < OUT_SIZE; oy++) {
    for (let ox = 0; ox < OUT_SIZE; ox++) {
      // output pixel -> registered body space -> source pixel
      const rx = ox + CROP_X0;
      const ry = oy + CROP_Y0;
      const sx = (rx - REG_CENTER_X) / scale + bbox.centerX;
      const sy = (ry - REG_FEET_Y) / scale + bbox.feetY;
      const [r, g, b, a] = bilinear(img, sx, sy);
      const i = (oy * OUT_SIZE + ox) * 4;
      if (a < ALPHA_CLEAN_THRESHOLD) {
        outRgba[i] = 0; outRgba[i + 1] = 0; outRgba[i + 2] = 0; outRgba[i + 3] = 0;
      } else {
        outRgba[i] = Math.round(r); outRgba[i + 1] = Math.round(g); outRgba[i + 2] = Math.round(b); outRgba[i + 3] = Math.round(a);
      }
    }
  }

  const png = encodePng(OUT_SIZE, OUT_SIZE, outRgba);
  fs.writeFileSync(path.join(OUT_DIR, `${poseName}.png`), png);
  report.push({ poseName, scale: scale.toFixed(4), kb: Math.round(png.length / 1024) });
}

console.table(report);
