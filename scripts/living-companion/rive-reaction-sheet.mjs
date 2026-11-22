// Renders Studigo's reactions from the Rive project into contact sheets, one row per intent, so a rig change can
// be checked by eye in seconds. Run from the repository root:
//   node scripts/living-companion/rive-reaction-sheet.mjs <outDir> [intents=8,9,11,12,16,17,26] [frames=14] [step=6]
//   extra rows: talk (0, 0.3, 0.8) and growth (0, 0.5, 1) are always added at the end.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";

const [out, intentsArg = "8,9,11,12,16,17,26", framesArg = "14", stepArg = "6"] = process.argv.slice(2);
if (!out) throw new Error("usage: <outDir> [intents] [frames] [step]");
const intents = intentsArg.split(",").map(Number), frames = Number(framesArg), step = Number(stepArg);
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
mkdirSync(out, { recursive: true });

const cmds = ["advance 30"];
for (const n of intents) {
  cmds.push(`data intent=${n}`);
  for (let f = 0; f < frames; f++) cmds.push(`advance ${step}`, `screenshot ${out}/i${n}-${String(f).padStart(2, "0")}.png`);
  cmds.push("data intent=0", "advance 150");
}
cmds.push("data mode=2", "advance 4");
[0, 0.3, 0.8].forEach((v, i) => cmds.push(`data talk=${v}`, "advance 2", `screenshot ${out}/talk-${i}.png`));
cmds.push("data talk=0");
[0, 0.5, 1].forEach((v, i) => cmds.push(`data growth=${v}`, "advance 2", `screenshot ${out}/growth-${i}.png`));
cmds.push("quit");
const run = spawnSync("rive", ["design/living-companion/rive/studigo", "--commands", "--viewport=240x240", "--fit=contain"], { input: cmds.join("\n") + "\n", encoding: "utf8", shell: true, maxBuffer: 1 << 28 });
if (run.status !== 0) { console.error(run.stdout + run.stderr); process.exit(1); }

const ff = (args) => execFileSync(ffmpeg, ["-loglevel", "error", "-y", ...args]);
for (const n of intents) ff(["-framerate", "10", "-i", `${out}/i${n}-%02d.png`, "-vf", `scale=140:-1,tile=${frames}x1`, "-frames:v", "1", `${out}/row-${n}.png`]);
ff(["-i", `${out}/talk-0.png`, "-i", `${out}/talk-1.png`, "-i", `${out}/talk-2.png`, "-i", `${out}/growth-0.png`, "-i", `${out}/growth-1.png`, "-i", `${out}/growth-2.png`, "-filter_complex", "hstack=6,scale=840:-1", `${out}/row-inputs.png`]);
const rows = intents.map((n) => `${out}/row-${n}.png`);
ff([...rows.flatMap((r) => ["-i", r]), "-filter_complex", `vstack=${rows.length}`, `${out}/reactions.jpg`]);
console.log(JSON.stringify({ sheet: `${out}/reactions.jpg`, inputs: `${out}/row-inputs.png`, intents, files: readdirSync(out).length }));
