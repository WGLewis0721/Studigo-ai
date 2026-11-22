// Renders frames from the Rive project with the CLI and advances one instance through time.
// Usage: node scripts/living-companion/rive-capture-frames.mjs <outDir> <seconds> <fps> [size=480] [startTick=0]
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const [dir, secondsArg, fpsArg, sizeArg = "480", startArg = "0"] = process.argv.slice(2);
if (!dir || !secondsArg || !fpsArg) throw new Error("usage: <outDir> <seconds> <fps> [size] [startTick]");
const seconds = Number(secondsArg), fps = Number(fpsArg), size = Number(sizeArg);
mkdirSync(dir, { recursive: true });
const lines = [];
let previous = 0;
const start = Number(startArg);
if (start > 0) { lines.push(`advance ${start}`); previous = start; }
const total = Math.round(seconds * fps);
for (let frame = 0; frame <= total; frame++) {
  const tick = start + Math.round(frame * 60 / fps);
  if (tick > previous) lines.push(`advance ${tick - previous}`);
  previous = tick;
  lines.push(`screenshot ${dir}/frame-${String(frame).padStart(4, "0")}.png`);
}
const run = spawnSync("rive", ["design/living-companion/rive/studigo", "--commands", `--viewport=${size}x${size}`, "--fit=contain"], {
  input: lines.join("\n") + "\n", encoding: "utf8", shell: true, maxBuffer: 1 << 28,
});
const shots = (run.stdout + run.stderr).split("\n").filter((l) => l.includes("ok screenshot")).length;
console.log(JSON.stringify({ frames: shots, expected: total + 1, status: run.status }));
if (shots !== total + 1) { console.error((run.stdout + run.stderr).split("\n").slice(-12).join("\n")); process.exit(1); }
