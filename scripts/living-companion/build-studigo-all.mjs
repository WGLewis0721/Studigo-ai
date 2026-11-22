// Rebuilds Studigo's whole rig from the generators, in order, then verifies and publishes the .riv.
// Run from the repository root:  node scripts/living-companion/build-studigo-all.mjs [--no-publish]
import { execFileSync } from "node:child_process";
import { copyFileSync } from "node:fs";

const steps = ["idle", "touch", "expressions", "gestures", "mouth", "growth", "boost"];
for (const step of steps) {
  process.stdout.write(`${step}: `);
  execFileSync(process.execPath, [`scripts/living-companion/build-studigo-${step}.mjs`], { stdio: "inherit" });
}
const rive = (arg) => execFileSync("rive", ["design/living-companion/rive/studigo", arg], { stdio: "inherit", shell: true });
rive("--verify");
if (!process.argv.includes("--no-publish")) {
  rive("--publish=local");
  copyFileSync("design/living-companion/rive/studigo/build/studigo.riv", "apps/web/public/mascot/rive/studigo.riv");
  console.log("published apps/web/public/mascot/rive/studigo.riv");
}
