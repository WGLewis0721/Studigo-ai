// Rebuilds Studigo's whole rig from the generators, in order, then verifies and publishes the .riv.
// Run from the repository root:  node scripts/living-companion/build-studigo-all.mjs [--no-publish]
import { execFileSync } from "node:child_process";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const steps = ["idle", "touch", "expressions", "gestures", "face", "growth", "boost", "turns"];
for (const step of steps) {
  process.stdout.write(`${step}: `);
  execFileSync(process.execPath, [`scripts/living-companion/build-studigo-${step}.mjs`], { stdio: "inherit" });
}
const rive = (arg) => execFileSync("rive", ["design/living-companion/rive/studigo", arg], { stdio: "inherit", shell: true });
rive("--verify");
if (!process.argv.includes("--no-publish")) {
  rive("--publish=local");
  copyFileSync("design/living-companion/rive/studigo/build/studigo.riv", "apps/web/public/mascot/rive/studigo.riv");
  const v = createHash("sha256").update(readFileSync("apps/web/public/mascot/rive/studigo.riv")).digest("hex").slice(0, 12);
  writeFileSync("apps/web/components/companion/studigo-rive-version.ts", `// Written by scripts/living-companion/build-studigo-all.mjs on every rig publish. Bumping it changes the
// asset URL, so browsers never keep an old rig after a rebuild.
export const STUDIGO_RIVE_VERSION = "${v}";
`);
  console.log("published apps/web/public/mascot/rive/studigo.riv " + v);
}
