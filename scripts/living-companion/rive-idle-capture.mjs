#!/usr/bin/env node
/*
 * Headless capture of the Studigo Rive idle, with a loop-seam and pop check.
 *
 * One `rive <project> --commands` session advances the rig in 60 Hz ticks and
 * writes a PNG per capture step. The frames are then measured in raw RGB:
 *   seam    first vs last frame of a loop, frame N vs N + loop length for every N,
 *           and the step across each loop boundary (with its distance from frame 0)
 *   motion  the step from each frame to the one before; a pop is a step over
 *           3x the median step. A fast blink or tail flick can exceed that, so the
 *           flagged frames are where to look, not a verdict.
 * ffmpeg then writes an H.264 MP4 and a one-loop WebP preview, plus contact
 * sheets every 0.5 s. Only the JSON summary, the motion CSV and the contact
 * sheets go to --evidence; the frames, MP4 and preview stay in --out.
 *
 *   node scripts/living-companion/rive-idle-capture.mjs [options]
 *
 * Run --help for the options. Memory: the loop check holds one loop of RGB frames,
 * about (loop frames + 1) x size x size x 3 bytes (about 240 MB for 540 px at 30 fps
 * over a 9 s loop). The loop length comes from `rive inspect` unless --loop-ticks is set.
 */

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_PROJECT = "design/living-companion/rive/studigo";
const TICKS_PER_SECOND = 60;
const POP_FACTOR = 3;
const PREVIEW_LIMIT_BYTES = 2 * 1024 * 1024;
const PREVIEW_ATTEMPTS = [
  { width: 360, quality: 70 },
  { width: 360, quality: 55 },
  { width: 320, quality: 45 },
  { width: 280, quality: 40 },
  { width: 240, quality: 35 },
];
const SHEET_COLUMNS = 6;
const SHEET_THUMBS = 30;
const OPTION_NAMES = new Set(["project", "animation", "seconds", "fps", "size", "data", "loop-ticks", "out", "evidence", "rive", "ffmpeg", "font"]);

const USAGE = `Usage: node scripts/living-companion/rive-idle-capture.mjs [options]

  --project <dir>      Rive project (default ${DEFAULT_PROJECT})
  --animation <name>   looping LinearAnimation to check (default Idle)
  --seconds <n>        capture length in seconds, 1-600 (default 30)
  --fps <n>            capture rate, a divisor of 60 (default 30)
  --size <px>          square render size (default 540, the artboard)
  --data <path=value>  view model value written before the first frame (repeatable)
  --loop-ticks <n>     loop length in 60 Hz ticks, instead of the value read from the rig
  --out <dir>          frames, MP4 and preview; must be outside the repo (default <tmp>/rive-capture)
  --evidence <dir>     summary JSON, motion CSV and contact sheets (default --out)
  --rive <path>        rive executable (default rive)
  --ffmpeg <path>      ffmpeg executable (default ffmpeg)
  --font <path>        font for contact-sheet labels, without a drive letter
                       (default /Windows/Fonts/consola.ttf on Windows, none elsewhere)
`;

class UsageError extends Error {}

const round = (value, digits = 4) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);
const toRivePath = (path) => path.replaceAll("\\", "/");
const isInside = (child, parent) => {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};
const repoRelative = (path) => (isInside(path, repoRoot) ? relative(repoRoot, path).replaceAll("\\", "/") : null);
const mean = (values) => {
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
};
function median(values) {
  const sorted = Float64Array.from(values).sort();
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
const defaultFontFile = () => {
  if (process.platform !== "win32") return null;
  return `${(process.env.SystemRoot ?? "C:\\Windows").replace(/^[A-Za-z]:/, "").replaceAll("\\", "/")}/Fonts/consola.ttf`;
};

function parseArgs(argv) {
  const values = { data: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (!match || !OPTION_NAMES.has(match[1])) throw new UsageError(`unknown option ${arg}`);
    const [, name] = match;
    let value = match[2];
    if (value === undefined) {
      value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) throw new UsageError(`${arg} needs a value`);
      i += 1;
    }
    if (name === "data") values.data.push(value);
    else values[name] = value;
  }
  return values;
}

function resolveConfig(values) {
  const integer = (name, fallback, min, max) => {
    if (values[name] === undefined) return fallback;
    const value = Number(values[name]);
    if (!Number.isInteger(value) || value < min || value > max) throw new UsageError(`--${name} must be an integer from ${min} to ${max}`);
    return value;
  };
  const fps = integer("fps", 30, 1, TICKS_PER_SECOND);
  if (TICKS_PER_SECOND % fps !== 0) throw new UsageError("--fps must divide 60");
  for (const write of values.data) {
    if (!/^[^=\s]+=\S.*$/.test(write)) throw new UsageError(`--data expects path=value, got "${write}"`);
  }
  const outDir = values.out ? resolve(values.out) : join(tmpdir(), "rive-capture");
  if (isInside(outDir, repoRoot)) throw new UsageError("--out must be outside the repository");
  const evidenceDir = values.evidence ? resolve(values.evidence) : outDir;
  return {
    projectDir: resolve(values.project ?? join(repoRoot, DEFAULT_PROJECT)),
    animation: values.animation ?? "Idle",
    seconds: integer("seconds", 30, 1, 600),
    fps,
    size: integer("size", 540, 64, 2048),
    loopTicksOverride: values["loop-ticks"] === undefined ? null : integer("loop-ticks", 0, 1, 1_000_000),
    dataWrites: values.data,
    outDir,
    framesDir: join(outDir, "frames"),
    evidenceDir,
    rive: values.rive ?? "rive",
    ffmpeg: values.ffmpeg ?? "ffmpeg",
    fontFile: values.font ?? defaultFontFile(),
  };
}

function run(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => rejectPromise(new Error(`could not start ${command}: ${error.message}`)));
    child.on("close", (code) => resolvePromise({ code, stdout, stderr }));
  });
}

async function execOrThrow(command, args, label) {
  const result = await run(command, args);
  if (result.code !== 0) {
    const tail = result.stderr.trim().split("\n").slice(-4).join(" | ");
    throw new Error(`${label} exited ${result.code}${tail ? `: ${tail}` : ""}`);
  }
  return result;
}

function collectObjects(node, type, found = []) {
  if (Array.isArray(node)) {
    for (const item of node) collectObjects(item, type, found);
  } else if (node && typeof node === "object") {
    if (node.type === type) found.push(node);
    for (const value of Object.values(node)) collectObjects(value, type, found);
  }
  return found;
}

const isLooping = (animation) => animation.loopValue === 1 || animation.enums?.loopValue === "loop";

async function readLoop(config) {
  const { stdout } = await execOrThrow(config.rive, ["inspect", toRivePath(config.projectDir), "--json"], "rive inspect");
  const inspect = JSON.parse(stdout.slice(stdout.indexOf("{")));
  const blocking = (inspect.problems ?? []).filter((problem) => problem.severity !== "warning");
  if (blocking.length) throw new Error(`rive inspect reported ${blocking.length} problem(s)`);
  const animations = collectObjects(inspect, "LinearAnimation");
  const animation = animations.find((item) => item.name === config.animation);
  if (!animation) {
    const loops = animations.filter(isLooping).map((item) => item.name);
    throw new Error(`no LinearAnimation named "${config.animation}"; looping animations: ${loops.join(", ") || "none"}`);
  }
  if (!isLooping(animation)) throw new Error(`"${animation.name}" is not a looping animation`);
  const fps = animation.fps ?? TICKS_PER_SECOND;
  return {
    name: animation.name,
    durationFrames: animation.duration,
    fps,
    loopTicks: (animation.duration * TICKS_PER_SECOND) / fps,
    enableWorkArea: animation.enableWorkArea === true,
    artboard: inspect.defaultArtboard?.name ?? null,
  };
}

async function prepareDirectories(config) {
  await mkdir(config.outDir, { recursive: true });
  await mkdir(config.evidenceDir, { recursive: true });
  await rm(config.framesDir, { recursive: true, force: true });
  await mkdir(config.framesDir, { recursive: true });
}

async function captureFrames(config, plan) {
  const commands = [
    ...config.dataWrites.map((write) => `data ${write}`),
    `data-dump ${toRivePath(plan.dataDumpPath)}`,
  ];
  for (let frame = 0; frame < plan.totalFrames; frame += 1) {
    if (frame > 0) commands.push(`advance ${plan.ticksPerFrame}`);
    commands.push(`screenshot ${toRivePath(plan.framePath(frame))}`);
  }
  commands.push("quit");

  const child = spawn(
    config.rive,
    [toRivePath(config.projectDir), "--commands", `--viewport=${config.size}x${config.size}`, "--fit=contain"],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  const output = [];
  const errors = [];
  let shots = 0;
  const onLine = (line) => {
    output.push(line);
    if (line.startsWith("ok screenshot:")) {
      shots += 1;
      if (shots % 150 === 0) console.error(`rendered ${shots}/${plan.totalFrames}`);
    } else if (line.startsWith("err ")) {
      errors.push(line);
    }
  };
  createInterface({ input: child.stdout }).on("line", onLine);
  createInterface({ input: child.stderr }).on("line", onLine);
  child.stdin.on("error", () => {});
  const closed = new Promise((resolveClose, rejectClose) => {
    child.on("error", (error) => rejectClose(new Error(`could not start ${config.rive}: ${error.message}`)));
    child.on("close", resolveClose);
  });
  child.stdin.end(`${commands.join("\n")}\n`);
  const code = await closed;
  await writeFile(join(config.outDir, "rive-commands.log"), `${output.join("\n")}\n`);
  if (code !== 0 || errors.length > 0 || shots !== plan.totalFrames) {
    throw new Error(`rive capture failed: exit ${code}, ${shots}/${plan.totalFrames} frames, errors: ${errors.slice(0, 3).join(" | ") || "none"}`);
  }
  return {
    exitCode: code,
    okScreenshots: shots,
    build: output.map((line) => /built \(([^)]*)\)/.exec(line)?.[1]).find(Boolean) ?? null,
    shownArtboard: output.map((line) => /showing (.+?) \[/.exec(line)?.[1]).find(Boolean) ?? null,
  };
}

async function readStartState(path, warnings) {
  try {
    const dump = JSON.parse(await readFile(path, "utf8"));
    return Object.fromEntries((dump.viewModel?.properties ?? []).map((property) => [property.name, property.value]));
  } catch (error) {
    warnings.push(`could not read view model state: ${error.message}`);
    return null;
  }
}

function diffStats(a, b) {
  let sum = 0;
  let max = 0;
  let changed = 0;
  for (let i = 0; i < a.length; i += 3) {
    let pixelMax = 0;
    for (let c = i; c < i + 3; c += 1) {
      const d = a[c] > b[c] ? a[c] - b[c] : b[c] - a[c];
      sum += d;
      if (d > pixelMax) pixelMax = d;
    }
    if (pixelMax > max) max = pixelMax;
    if (pixelMax > 0) changed += 1;
  }
  return { mad: sum / a.length, max, changedPct: (100 * changed) / (a.length / 3) };
}

// Frames stream in from ffmpeg as raw RGB. A ring of loop + 1 buffers holds
// every frame that a later comparison still needs (frame N and frame N + loop).
// The first frame is copied because its ring slot is reused later in the stream.
async function analyseFrames(config, plan) {
  const { totalFrames: total, loopFrames: loop, frameBytes } = plan;
  const ringSize = Math.min(total, loop + 1);
  const ring = new Array(ringSize);
  const slot = (frame) => {
    const index = frame % ringSize;
    ring[index] ??= Buffer.allocUnsafe(frameBytes);
    return ring[index];
  };
  const step = new Float64Array(total);
  const stepMax = new Float64Array(total);
  const stepChanged = new Float64Array(total);
  const pair = new Float64Array(total).fill(NaN);
  const pairMax = new Float64Array(total).fill(NaN);
  const pairChanged = new Float64Array(total).fill(NaN);
  const boundaryVsFirst = new Map();
  let first = null;
  let firstVsLast = null;

  const onFrame = (frame, buffer) => {
    if (frame === 0) first = Buffer.from(buffer);
    if (frame > 0) {
      const s = diffStats(ring[(frame - 1) % ringSize], buffer);
      step[frame] = s.mad;
      stepMax[frame] = s.max;
      stepChanged[frame] = s.changedPct;
    }
    if (loop >= 2 && frame === loop - 1) firstVsLast = diffStats(first, buffer);
    if (frame >= loop) {
      const s = diffStats(ring[(frame - loop) % ringSize], buffer);
      pair[frame - loop] = s.mad;
      pairMax[frame - loop] = s.max;
      pairChanged[frame - loop] = s.changedPct;
    }
    if (frame > 0 && frame % loop === 0) boundaryVsFirst.set(frame, diffStats(first, buffer));
  };

  const ff = spawn(
    config.ffmpeg,
    ["-v", "error", "-start_number", "0", "-framerate", String(config.fps), "-i", plan.framePattern, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let stderr = "";
  ff.stderr.setEncoding("utf8");
  ff.stderr.on("data", (chunk) => { stderr += chunk; });
  const exited = new Promise((resolveExit, rejectExit) => {
    ff.on("error", (error) => rejectExit(new Error(`could not start ${config.ffmpeg}: ${error.message}`)));
    ff.on("close", resolveExit);
  });

  let frame = 0;
  let fill = 0;
  let current = slot(0);
  for await (const chunk of ff.stdout) {
    let offset = 0;
    while (offset < chunk.length) {
      const take = Math.min(frameBytes - fill, chunk.length - offset);
      chunk.copy(current, fill, offset, offset + take);
      fill += take;
      offset += take;
      if (fill === frameBytes) {
        onFrame(frame, current);
        frame += 1;
        fill = 0;
        if (frame < total) current = slot(frame);
      }
    }
  }
  const exitCode = await exited;
  if (exitCode !== 0 || frame !== total) {
    throw new Error(`frame decode failed: ${frame}/${total} frames, exit ${exitCode} ${stderr.trim().slice(-300)}`);
  }

  const stepValues = step.subarray(1);
  const medianStep = median(stepValues);
  const threshold = POP_FACTOR * medianStep;
  const popFrames = [];
  if (medianStep > 0) {
    for (let n = 1; n < total; n += 1) {
      if (step[n] > threshold) {
        popFrames.push({
          frame: n,
          tick: n * plan.ticksPerFrame,
          tSeconds: round((n * plan.ticksPerFrame) / TICKS_PER_SECOND),
          stepMad: round(step[n]),
          stepMax: stepMax[n],
          ratioToMedian: round(step[n] / medianStep, 2),
        });
      }
    }
  }

  const pairCount = Math.max(0, total - loop);
  let loopPairs = null;
  if (pairCount > 0) {
    let worst = 0;
    let maxChannelDiff = 0;
    for (let m = 0; m < pairCount; m += 1) {
      if (pair[m] > pair[worst]) worst = m;
      if (pairMax[m] > maxChannelDiff) maxChannelDiff = pairMax[m];
    }
    loopPairs = {
      count: pairCount,
      firstFrames: [0, loop],
      first: { mad: round(pair[0]), max: pairMax[0], changedPct: round(pairChanged[0], 3) },
      meanMad: round(mean(pair.subarray(0, pairCount))),
      worst: { frames: [worst, worst + loop], mad: round(pair[worst]), max: pairMax[worst] },
      maxChannelDiff,
    };
  }

  const boundaries = [];
  for (let n = loop; n < total; n += loop) {
    const vs = boundaryVsFirst.get(n);
    boundaries.push({
      frame: n,
      tick: n * plan.ticksPerFrame,
      tSeconds: round((n * plan.ticksPerFrame) / TICKS_PER_SECOND),
      stepMad: round(step[n]),
      stepMax: stepMax[n],
      stepRatio: round(step[n] / medianStep, 3),
      vsFirstFrameMad: round(vs.mad),
      vsFirstFrameMax: vs.max,
      vsFirstFrameChangedPct: round(vs.changedPct, 3),
    });
  }

  return {
    step,
    stepMax,
    stepChanged,
    pair,
    medianStep,
    meanStep: mean(stepValues),
    threshold,
    popFrames,
    firstVsLast: firstVsLast && { mad: round(firstVsLast.mad), max: firstVsLast.max, changedPct: round(firstVsLast.changedPct, 3) },
    loopPairs,
    boundaries,
  };
}

async function encodeOutputs(config, plan) {
  const mp4Name = `idle-${config.seconds}s-${config.fps}fps.mp4`;
  await execOrThrow(config.ffmpeg, [
    "-v", "error", "-y", "-framerate", String(config.fps), "-start_number", "0", "-i", plan.framePattern,
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    join(config.outDir, mp4Name),
  ], "ffmpeg mp4");

  const previewFps = Math.min(config.fps, 15);
  const previewFrames = Math.min(
    Math.round((plan.loopFrames * previewFps) / config.fps),
    Math.round((plan.totalFrames * previewFps) / config.fps),
  );
  const previewName = "idle-preview-loop.webp";
  const previewPath = join(config.outDir, previewName);
  let attempt = null;
  let previewBytes = 0;
  for (const candidate of PREVIEW_ATTEMPTS) {
    await execOrThrow(config.ffmpeg, [
      "-v", "error", "-y", "-framerate", String(config.fps), "-start_number", "0", "-i", plan.framePattern,
      "-vf", `fps=${previewFps},scale=${candidate.width}:${candidate.width}:flags=lanczos`,
      "-frames:v", String(previewFrames), "-c:v", "libwebp", "-lossless", "0", "-q:v", String(candidate.quality),
      "-compression_level", "4", "-loop", "0", "-an", previewPath,
    ], "ffmpeg preview");
    previewBytes = (await stat(previewPath)).size;
    attempt = candidate;
    if (previewBytes < PREVIEW_LIMIT_BYTES) break;
  }
  return {
    mp4: mp4Name,
    preview: previewName,
    previewBytes,
    previewSeconds: round(previewFrames / previewFps, 3),
    previewWidth: attempt.width,
    previewQuality: attempt.quality,
  };
}

async function writeContactSheets(config, plan, warnings) {
  const every = config.fps / 2;
  const indices = [];
  for (let k = 0; Math.round(k * every) < plan.totalFrames; k += 1) indices.push(Math.round(k * every));
  const sheets = [];
  for (let start = 0, sheet = 1; start < indices.length; start += SHEET_THUMBS, sheet += 1) {
    const chunk = indices.slice(start, start + SHEET_THUMBS);
    const columns = Math.min(SHEET_COLUMNS, chunk.length);
    const rows = Math.ceil(chunk.length / columns);
    const select = chunk.map((frame) => `eq(n\\,${frame})`).join("+");
    const label = config.fontFile
      ? `,drawtext=fontfile=${config.fontFile}:text='t=%{eif\\:floor(t)\\:d}.%{eif\\:mod(round(t*10)\\,10)\\:d}s':x=6:y=6:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4`
      : "";
    const name = `idle-contact-${String(sheet).padStart(2, "0")}.jpg`;
    await execOrThrow(config.ffmpeg, [
      "-v", "error", "-y", "-framerate", String(config.fps), "-start_number", "0", "-i", plan.framePattern,
      "-vf", `select='${select}',scale=160:160:flags=lanczos${label},tile=${columns}x${rows}:padding=4:color=0x111111`,
      "-frames:v", "1", "-q:v", "5", join(config.evidenceDir, name),
    ], `contact sheet ${sheet}`);
    sheets.push({ file: name, fromSeconds: round(chunk[0] / config.fps, 2), toSeconds: round(chunk.at(-1) / config.fps, 2), thumbs: chunk.length });
  }
  if (!config.fontFile) warnings.push("no font for contact-sheet labels; sheets are unlabelled");
  return sheets;
}

function buildCsv(plan, analysis, medianStep) {
  const popped = new Set(analysis.popFrames.map((item) => item.frame));
  const lines = ["frame,tick,tSeconds,stepMad,stepMax,stepChangedPct,ratioToMedian,pop,loopPairMad"];
  for (let frame = 0; frame < plan.totalFrames; frame += 1) {
    const tick = frame * plan.ticksPerFrame;
    const moved = frame > 0;
    lines.push([
      frame,
      tick,
      (tick / TICKS_PER_SECOND).toFixed(4),
      moved ? analysis.step[frame].toFixed(4) : "",
      moved ? analysis.stepMax[frame].toFixed(0) : "",
      moved ? analysis.stepChanged[frame].toFixed(3) : "",
      moved && medianStep > 0 ? (analysis.step[frame] / medianStep).toFixed(3) : "",
      popped.has(frame) ? 1 : 0,
      Number.isNaN(analysis.pair[frame]) ? "" : analysis.pair[frame].toFixed(4),
    ].join(","));
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const values = parseArgs(process.argv.slice(2));
  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  const config = resolveConfig(values);
  const warnings = [];
  const riveVersion = /\d+\.\d+\.\d+/.exec((await execOrThrow(config.rive, ["--version"], "rive --version")).stdout)?.[0] ?? null;
  const loop = await readLoop(config);
  if (config.loopTicksOverride !== null) warnings.push(`loop length overridden to ${config.loopTicksOverride} ticks; the rig's ${loop.name} is ${loop.loopTicks}`);
  if (loop.enableWorkArea) warnings.push("the animation has a work area; the loop length is its full duration");
  const loopTicksExact = config.loopTicksOverride ?? loop.loopTicks;
  if (!Number.isInteger(loopTicksExact)) warnings.push(`loop length ${loopTicksExact} ticks is not whole; rounded`);
  const ticksPerFrame = TICKS_PER_SECOND / config.fps;
  const loopTicks = Math.round(loopTicksExact);
  const loopFrames = Math.round(loopTicks / ticksPerFrame);
  const totalFrames = config.seconds * config.fps;
  if (loopFrames < 2) throw new Error(`a loop of ${loopTicks} ticks is too short at ${config.fps} fps`);
  if (loopTicks % ticksPerFrame !== 0) warnings.push(`the loop ends between captures at ${config.fps} fps; the seam compares the nearest frames`);
  if (loopFrames >= totalFrames) warnings.push("the capture is not longer than one loop; the loop-pair check is skipped");

  const framesDir = config.framesDir;
  const plan = {
    totalFrames,
    ticksPerFrame,
    loopTicks,
    loopFrames,
    frameBytes: config.size * config.size * 3,
    framePattern: toRivePath(join(framesDir, "frame-%05d.png")),
    framePath: (frame) => join(framesDir, `frame-${String(frame).padStart(5, "0")}.png`),
    dataDumpPath: join(config.outDir, "data-start.json"),
  };

  await prepareDirectories(config);
  const captureStart = performance.now();
  const capture = await captureFrames(config, plan);
  const analysisStart = performance.now();
  const startState = await readStartState(plan.dataDumpPath, warnings);
  const analysis = await analyseFrames(config, plan);
  const encodeStart = performance.now();
  const outputs = await encodeOutputs(config, plan);
  const sheets = await writeContactSheets(config, plan, warnings);
  const encodeEnd = performance.now();

  const medianStep = analysis.medianStep;
  const seamFirstLast = analysis.firstVsLast && {
    frames: [0, loopFrames - 1],
    ticks: [0, (loopFrames - 1) * ticksPerFrame],
    ...analysis.firstVsLast,
  };
  if (medianStep === 0) warnings.push("median step is zero; the pop test is skipped");
  const csvName = "idle-capture-motion.csv";
  await writeFile(join(config.evidenceDir, csvName), buildCsv(plan, analysis, medianStep));

  const summary = {
    schema: 1,
    tool: "scripts/living-companion/rive-idle-capture.mjs",
    capturedAt: new Date().toISOString(),
    project: repoRelative(config.projectDir) ?? "(outside repo)",
    artboard: capture.shownArtboard ?? loop.artboard,
    rive: {
      version: riveVersion,
      exitCode: capture.exitCode,
      okScreenshots: capture.okScreenshots,
      build: capture.build,
    },
    animation: {
      name: loop.name,
      durationFrames: loop.durationFrames,
      fps: loop.fps,
      loopTicks,
      loopTicksSource: config.loopTicksOverride !== null ? "override" : "rive inspect",
      loopFrames,
    },
    capture: {
      seconds: config.seconds,
      fps: config.fps,
      frames: totalFrames,
      size: config.size,
      ticksPerFrame,
      lastTick: (totalFrames - 1) * ticksPerFrame,
      data: config.dataWrites,
      startState,
    },
    seam: {
      loopSeconds: round(loopTicks / TICKS_PER_SECOND, 4),
      loopAligned: loopTicks % ticksPerFrame === 0,
      firstVsLastFrame: seamFirstLast,
      loopPairs: analysis.loopPairs,
      boundaries: analysis.boundaries,
    },
    motion: {
      steps: totalFrames - 1,
      medianMad: round(medianStep),
      meanMad: round(analysis.meanStep),
      popFactor: POP_FACTOR,
      popThresholdMad: round(analysis.threshold),
      popCount: analysis.popFrames.length,
    },
    popFrames: analysis.popFrames,
    outputs: {
      frames: `frames/frame-00000.png to frame-${String(totalFrames - 1).padStart(5, "0")}.png (outside repo)`,
      video: outputs.mp4,
      preview: outputs.preview,
      previewBytes: outputs.previewBytes,
      previewSeconds: outputs.previewSeconds,
      previewWidth: outputs.previewWidth,
      previewQuality: outputs.previewQuality,
      motionCsv: csvName,
      contactSheets: sheets,
    },
    warnings,
    timingsMs: {
      capture: Math.round(analysisStart - captureStart),
      analysis: Math.round(encodeStart - analysisStart),
      encode: Math.round(encodeEnd - encodeStart),
    },
  };
  await writeFile(join(config.evidenceDir, "idle-capture-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

  const seamLine = seamFirstLast
    ? `first vs last (frames 0, ${loopFrames - 1}) mad ${seamFirstLast.mad} max ${seamFirstLast.max}`
    : "first vs last skipped";
  const pairLine = analysis.loopPairs
    ? `N vs N+loop: first mad ${analysis.loopPairs.first.mad}, mean ${analysis.loopPairs.meanMad}, worst ${analysis.loopPairs.worst.mad} at frames ${analysis.loopPairs.worst.frames.join("/")}`
    : "N vs N+loop skipped";
  const popList = analysis.popFrames.slice(0, 12).map((item) => item.frame).join(", ") || "none";
  console.log(`captured ${totalFrames} frames (${config.seconds} s at ${config.fps} fps) of ${loop.name}, loop ${loopTicks} ticks = ${loopFrames} frames`);
  console.log(`seam: ${seamLine}; ${pairLine}`);
  console.log(`motion: median step ${round(medianStep)}, pop threshold ${round(analysis.threshold)}, pops ${analysis.popFrames.length} (frames ${popList})`);
  console.log(`evidence: ${config.evidenceDir}`);
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  if (error instanceof UsageError) {
    console.error(`rive-idle-capture: ${error.message}\n\n${USAGE}`);
    process.exitCode = 2;
  } else {
    console.error(`rive-idle-capture failed: ${error.message}`);
    process.exitCode = 1;
  }
}
