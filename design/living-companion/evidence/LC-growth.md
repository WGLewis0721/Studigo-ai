# LC-growth: Studigo grows and can be customized as the child studies

Status: built, tested, and checked in a browser on the local dev server. Not pushed, merged or deployed. Open for the owner: the outfit art is still placeholder (LC-DEC-028, LC-DEC-037), and the stage cues need an owner look (see Judgement calls).

Task H-H2 (LC-DEC-033 to LC-DEC-035, LC-DEC-039). Branch `lc/growth-ui`, cut from `origin/claude/studigo-living-companion-upgrade-ee0706` at `537c037`.

Machine: local Windows 11 workstation, Node 22.23.5 (nvm), pnpm from the repo lockfile, Playwright 1.62.1 with the installed Chromium.

## Commands and exit codes

| Step | Command (working directory) | Exit | Result |
|---|---|---|---|
| Branch | `git fetch origin && git switch -c lc/growth-ui origin/claude/studigo-living-companion-upgrade-ee0706` (worktree) | 0 | HEAD `537c037` |
| Install | `pnpm install --frozen-lockfile` (repo root) | 0 | lockfile up to date, 89 packages added |
| Baseline LC tests | `node --import tsx --test lib/companion-*.test.ts lib/quiet-feedback.test.ts lib/mobile-lessons.test.ts` (apps/web), before any change | 0 | 145 pass, 0 fail |
| LC tests | same command (apps/web), final tree | 0 | 163 pass, 0 fail: 145 existing, 18 new |
| Typecheck | `npx tsc --noEmit -p .` (apps/web) | 0 | no errors |
| Lint (card) | `pnpm --filter @studigo/web lint` (repo root) | 0 | ai provider boundary ok |
| Lint (root) | `pnpm lint` (repo root) | 0 | ai boundary ok, engineering paths ok (33), design inventory verified |
| Dev server | `node apps/web/node_modules/next/dist/bin/next dev apps/web --hostname 127.0.0.1 -p 3306` (repo root, background) | ready | Next 16.4.6 (Turbopack); stopped after the checks |
| Browser checks | scratch scripts (outside the repo, not committed) on `/dev/study?mode=quiz` | 0 | see Browser results |

## What changed

- [companion-growth.ts](../../../apps/web/lib/companion-growth.ts): child-facing names for unlocks and tricks, `growthView` (stage, bar, next line, outfit and trick status), `wearableOutfit`, `studyTasks`, `FLAME_BOOST`.
- [companion-growth-store.ts](../../../apps/web/lib/companion-growth-store.ts) (new): device-wide localStorage key `studigo.companion.growth`, `readGrowth`, `writeGrowth`, `subscribeGrowth`, and the `useCompanionGrowth` hook. Storage errors are caught; growth just is not kept.
- [engine.ts](../../../apps/web/components/companion/engine.ts): every committed `event()` adds its points and saves, including while he is seated. A new unlock is celebrated when he is out (celebrate beat, sparks, badge, and a speech line only when speech is on), and counts as seen once its badge has had three seconds. The menu card gets Growing, Tricks and the outfit list. `grow(points)` is added for dev and QA.
- [director.ts](../../../apps/web/lib/companion-motion/director.ts): `setTricks` (idle vignettes come only from known tricks) and `setFlameBoost` (multiplies the drawn flame, kept between 0.5 and 2).
- [companion.tsx](../../../apps/web/components/companion/companion.tsx): Room Settings shows the same Growing, Tricks and outfit list.
- [companion.css](../../../apps/web/components/companion/companion.css): the badge, one static cue per stage, and the growth and outfit styles.
- Tests: [companion-motion.test.ts](../../../apps/web/lib/companion-motion.test.ts) (+3) and [companion-growth-store.test.ts](../../../apps/web/lib/companion-growth-store.test.ts) (new, 15).

## Browser results

Main check, desktop 1440x900, final run (exit 0, 24 steps, 0 page errors):

| Step | Result |
|---|---|
| Zero points | Stage 1 of 7 (Hatchling). "3 more study tasks until the Science goggles!" All seven outfits disabled, each with "Unlocks after N more study tasks". Two starter tricks known, three listed as coming. |
| First `setDone` (5 points) | Badge on, kind outfit, text "New!" with "New: Science goggles!" for screen readers. After 3.6 s the badge is off and saved `seen` holds `outfit:goggles`. |
| Two more `setDone` (15 points) | `data-stage="1"`. Badge on, kind trick, "New: Sniff!". |
| Menu after the unlock | Goggles enabled, the other six disabled. Lock notes read 8, 38, 60, 185, 350 and 258 more study tasks. Sniff known. |
| Choose goggles | Outfit shown on him. Room prefs save `"outfit":"goggles"`. A disabled visor input cannot be checked. |
| `grow(515)` (530 points) | `data-stage="5"` (Champion). Badge "8 new!" for eight unlocks at once; all marked seen after 3 s. |
| Room Settings at 530 points | "Stage 6 of 7: Champion", "93 more study tasks until the Music headphones!", all five tricks known, goggles checked, headphones disabled. |
| Phone width 390 px | Menu card: `scrollWidth` 390 equals `innerWidth` 390, so no sideways scroll. |

Stage cues (2x, fresh browser context per stage, exit 0): `data-stage` is 0 at 0 points, 1 at 15, 2 at 55, 3 at 135, 4 at 275, 5 at 530 and 6 at 945. No page errors.

Edge checks (exit 0):

| Check | Result |
|---|---|
| Badge hit test | `pointer-events: none`; the element under the badge centre is never the badge. |
| Seated | No badge while seated; growth saved (5 points, nothing seen). Brought out with the tab: badge shows; after 3.4 s `seen` holds `outfit:goggles`. |
| Speech on | The speech bubble shows "New: Science goggles!". |
| Storage blocked (reads and writes of the growth key throw) | No badge, no page error. Growth is not kept in that browser. |
| Network during growth (four `setDone`) | No requests. |
| Saved outfit not reached (explorer at 0 points) | Not worn; None checked; room prefs still hold `"outfit":"explorer"`. |

Room Settings at 30 points with explorer saved: None, goggles and explorer (checked) enabled; visor, reader, beret, headphones and sash disabled.

## Screenshots

Folder: [LC-growth/](LC-growth/)

- [growth-unlock-badge.png](LC-growth/growth-unlock-badge.png): the badge pop when the first study task unlocks the goggles (1x, window crop).
- [growth-menu-1440x900.png](LC-growth/growth-menu-1440x900.png): the menu card at Sprout (15 points), with the stage line, progress bar, next-unlock line and Tricks. The outfit list sits below the fold; its states are in the table above.
- [growth-champion-window.png](LC-growth/growth-champion-window.png): Champion (530 points) with goggles worn, at 2x: warm glow behind him and faint gold sparkles.

## Console

Four Chromium GPU driver messages ("GPU stall due to ReadPixels", type warning) appeared when WebGL started. They are driver performance notices, not app errors. The web app makes no pixel readback (no `readPixels`, `getImageData` or `toDataURL` in `apps/web`). They appeared in one run without screenshots and not in another, so the screenshots did not cause them. No errors were logged.

## Judgement calls

1. The outfit `select` is now a radio list. A native select cannot show a lock or an "Unlocks after" note per option. Labels still come from `OUTFIT_LABELS`, which an existing test checks in both UIs.
2. The learner's pick and the outfit he wears are kept apart. A locked outfit shows none, and the pick returns if growth reaches it again.
3. The badge sits above the window, or below it when he is docked at the top. It never takes a click. Several unlocks at once read "N new!", and the line says "N new things unlocked!".
4. The speech line appears only when speech is on.
5. An unlock counts as seen when its badge ends. Leaving the room during those three seconds means it shows again on the next visit.
6. Seated, he waits and shows the unlock when he comes out. No badge while he is seated.
7. When storage is blocked, growth is not kept at all. There is no in-memory fallback; say if you want one.
8. The Growing bar fills from the last unlock to the next, so it starts empty right after each unlock.
9. Stage cues, all static CSS: Sprout gets a tinted inner edge on his screen; from Explorer (55 points) up he has a warm glow behind him, which strengthens through Scholar and Adventurer; Champion adds faint gold sparkles; Legend adds a gold inner edge. Scholar and Adventurer only strengthen the glow. That is a thin cue, so it needs an owner look.
10. The flame boost (1.15 bright, 1.3 blazing) affects only the rig. The original drawings have no flame.
11. Without a `setTricks` call the director keeps every trick, so other callers are unchanged.
12. The commit trailer follows the task card (Claude Opus 5.5).

## Not verified and not done

- Strip mode, calm mode and reduced motion were not run in the browser; their CSS was written but only read, not seen.
- Not pushed, merged or deployed. No production flags changed.
- Outfit art is still placeholder. Approval is open under LC-DEC-028 and LC-DEC-037.
- Growth lives on the device only. Server sync needs a migration and an RLS review first (LC-DEC-035).
- ENGINEERING.md is not updated, because the card limits the files to the list above. The new store module belongs in its ownership map.
- The prune pass due before release (LC-DEC-039) has not started.
