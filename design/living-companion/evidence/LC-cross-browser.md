# LC cross-browser QA and 10-minute heap soak (H-N)

Scope: QA scripts and evidence only. No product code was changed. Branch `lc/cross-browser`, based on `origin/claude/studigo-living-companion-upgrade-ee0706` at 66c1b56.

## Result

- Chromium default runs of all three scripts exit 0 and reproduce the committed evidence counts exactly.
- WebKit 26.5 and Firefox 153.0 ran all three scripts with real results. Neither engine is clean.
  - WebKit: 6 FAIL verdicts come from one configuration issue, a report-only CSP with no report target (`apps/web/next.config.ts:28`). 6 more calm FAIL verdicts on desktop look like frame starvation: the WebKit companion renders at about 2 fps on this host.
  - Firefox: 5 companion FAIL verdicts. Four are phone drag or drop checks that fail under Firefox touch emulation, where mouse input produces no pointer events. One is a bring-back tab race that Chromium also shows intermittently.
- Heap soak (Chromium, 10 minutes): GROWING by the pre-declared full-window rule, 47.3 KB/min. The rise is warm-up: from minute 4 to minute 10 the post-GC heap is flat at +4.1 KB/min, and the two-snapshot diff shows no growing constructor.

## Environment

| Item | Value |
|---|---|
| Node / pnpm | v22.23.5 / 10.0.0 |
| Playwright | 1.62.1 |
| Dev server | Next.js 16.4.6 (Turbopack) on 127.0.0.1:3321, `NEXT_PUBLIC_STUDIGO_PHASE3_FOUNDATION_UI=1`, motion and companion on |
| Chromium | 151.0.7922.34, ms-playwright chromium-1234 (Playwright default) |
| Firefox | 153.0, ms-playwright firefox-1538, installed with `pnpm exec playwright install firefox` (no deps, no admin) |
| WebKit | 26.5, ms-playwright webkit-2359, launched through `PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH` |

WebKit note: Playwright 1.62.1 expects WebKit revision 2336 (`playwright-core/browsers.json`, product version 26.5). Only webkit-2359 is installed, so it was used by explicit path and not replaced. Both report WebKit 26.5.

WebGL is available on all three engines, so the rig drew everywhere (see `*-LC-21-desktop-V01-rest.png`). No engine fell back to sprites on its own. The sprite path is exercised by the NO_WEBGL init script in each script.

## Script change

`--browser=chromium|webkit|firefox` (default `chromium`) was added to `scripts/lc-companion-qa.mjs`, `scripts/lc-calm-qa.mjs` and `scripts/lc-rollback-qa.mjs`.

- Each launches the chosen engine headless. `executablePath` comes from `PLAYWRIGHT_<ENGINE>_EXECUTABLE_PATH` when set. The companion script already read the Chromium variable.
- The only Chromium-only API in these scripts is `context.newCDPSession`, used for CDP touch input in `touchDragBy` (UI01 phone branch). On WebKit and Firefox that branch is recorded as OPEN with its reason, never PASS. On Chromium it runs unchanged.
- No Chromium-only launch flags (`--use-angle`, `--autoplay-policy`) are used in these scripts.
- Reports gain `browser: {name, version}`. The `chromium` key is written for Chromium runs only.
- Output text: the A07 row note and the rollback console line now name the engine. Otherwise Chromium default output matches the committed evidence.

## Runs

Commands, each run from the worktree with `STUDIGO_QA_BASE=http://127.0.0.1:3321` and `LC_QA_SERVER_ENV` recorded:

```
node scripts/lc-rollback-qa.mjs --expect=motion [--browser=webkit|firefox]
node scripts/lc-calm-qa.mjs [--browser=webkit|firefox]
node scripts/lc-companion-qa.mjs [--browser=webkit|firefox]
```

WebKit runs also set `PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH` to the webkit-2359 binary. Jobs ran one at a time. After each job its result JSON and image were copied here and the tracked folders LC-9, LC-19 and LC-21 were restored with `git restore`, so the committed evidence there is unchanged and no untracked files are left.

| Job | Exit | Result |
|---|---|---|
| chromium LC-9, `--expect=motion` | 0 | 48 of 48 checks passed |
| chromium LC-19 calm | 0 | PASS 54, PASS (control) 22, OBSERVED 22; A02 literal PASS, spec section 12 PASS |
| chromium LC-21 companion | 0 | PASS 39, FAIL 0, OPEN 30 |
| webkit LC-9, `--expect=motion` | 1 | 44 of 48 (4 FAIL) |
| webkit LC-19 calm | 1 | PASS 50, PASS (control) 20, FAIL (control) 2, FAIL 4, OBSERVED 22; A02 literal FAIL, spec section 12 FAIL |
| webkit LC-21 companion | 1 | PASS 37, FAIL 2, OPEN 30 |
| firefox LC-9, `--expect=motion` | 0 | 48 of 48 checks passed |
| firefox LC-19 calm | 0 | PASS 54, PASS (control) 22, OBSERVED 22; A02 literal PASS, spec section 12 PASS |
| firefox LC-21 companion | 1 | PASS 34, FAIL 5, OPEN 30 |

Chromium against the committed evidence: LC-21 committed 39/0/30, LC-19 committed 54 PASS, 22 control and 22 observed with A02 PASS, LC-9 committed motion 48/48. All on 151.0.7922.34.

Not run: `--expect=sprites` and `--expect=off`. They need servers built with `NEXT_PUBLIC_STUDIGO_COMPANION_MOTION=off` or `NEXT_PUBLIC_STUDIGO_COMPANION=off`.

## Failures

Each FAIL with its repro. "Class" says whether the evidence points at configuration, the test input path, or product code.

### WebKit

**W1. CSP console error on every page load (configuration).** LC-9 `--expect=motion` FAIL "no uncaught page errors or console errors" on quiz and quiz-phase3, at 1440x900 and 390x844 (all 4 route sessions). All 10 WebKit sessions log:

> The Content Security Policy 'default-src 'self'; ...' was delivered in report-only mode, but does not specify a 'report-to' ... the policy will have no effect.

- Cause: `apps/web/next.config.ts:28` sends `Content-Security-Policy-Report-Only` (value built at lines 13-24) with no `report-uri` or `report-to`. Chromium and Firefox log nothing.
- Repro: WebKit 26.5, open `/dev/study?mode=quiz`, read the console.

**W2. Same message on navigation (configuration).** LC-21 L05 FAIL on desktop and phone (phase3 quiz). The message appears again on the navigation to coach mode, so "no console or page errors across the navigations" fails. Cause as W1.

**W3. Calm controls fail on desktop normal condition (environment, not confirmed).** LC-19 `desktop/a` FAIL (control) on "reactions create sparks" (setDone 30, tickle 18, celebrate 0) and on "scaleX sign flip (spin)" (setDone and tickle flip, celebrate does not; min feet slope 0.963). The celebrate pose was drawn (hop 15.8 px, roll 3.53 deg), but no particles appeared in the 3 s window. Chromium and Firefox pass both controls.

- The WebKit companion renders at about 2 fps on this host (frame table below). The samples are wall-clock windows while the rig draws per frame, so a 3 s window holds only a handful of frames. Suspected cause, not confirmed.
- Consequence: on WebKit the calm negatives (no sparks, no spin) pass without a working control, so they are not evidence.

**W4. Idle beat and head roll in calm (not established).** LC-19 `desktop/b` and `desktop/c` FAIL: "idle 20 s: beat-driven drawings" (a `support` drawing appeared) and "idle 20 s: no tail sway and no head roll" (head roll 1.73 deg against 0.2 deg). The measured values are identical in b and c. Phone calm passes. Chromium and Firefox pass. Frame starvation (W3) is the first suspect. An owner check on real Safari is needed.

### Firefox

**F1. Phone-emulated grip drag never starts (test input path).** LC-21 UI01 phone legacy and phone phase3 FAIL "frame follows the pointer mid-drag (0, 0 px)". Legacy also fails "the drop lands where the pointer let go".

- Probe 1 (`diagnostics-engine-probe-1.json`): with `isMobile` and `hasTouch`, the grip hit-tests correctly, but Firefox delivers only `mousedown` and `mouseup` to the page. No `pointerdown` or `pointermove` arrives, so the grip never starts. The grip is pointer-event only (`apps/web/components/companion/engine.ts:822-826`).
- Probe 2 (`diagnostics-engine-probe-2.json`): the same mouse drag with touch emulation off works on Firefox (pointer events arrive, the window moves 136 px). WebKit and Chromium deliver pointer events under touch emulation.
- Class: Firefox touch emulation does not give mouse input pointer events, so this drag cannot be tested that way. Not shown to be a product defect. Real Firefox touch input was not tested. Recommend OPEN for the two phone UI01 rows on Firefox until a device check. The script still records FAIL.

**F2. Phone drop checks fail as a consequence of F1.** LC-21 UI02 phone legacy: expected centre (228, 367), got (302, 690), which is the default bottom-right dock; "no normalized non-corner position saved" (savedPos null). UI02 phone phase3: expected (154, 354), got (306, 354), savedPos null. The phase-3 note "Phase 3 seats him in a corner..." is hardcoded in `scripts/lc-companion-qa.mjs` (lines 490-492), not measured. The same run's phase-3 mid-drag did not move (F1), so placement was never tested.

**F3. Bring-back tab press loses the click (intermittent product race, seen on Chromium too).** LC-21 UI04 desktop phase3 quiz (no safe corner) FAIL "the bring-back tab summons him again" (`summoned: false` after `page.click('.cmpTab')`).

- The release can land on another element. The click target is `roomWorkspace` or `modeSurface`, not `cmpTab`, so the summon handler (`apps/web/components/companion/engine.ts:949-957`) never runs.
- Mechanism (`diagnostics-tab-press-trace.json`, instrumented): `tab.hidden` is written by `positionSeatTab()` (`engine.ts:343`, called from `placeInRoom` at lines 350 and 356). It flips during a press. A flip to hidden between mousedown and mouseup sends the release to the surface.
- Frequency across attempts: Firefox failed 3 of 5 (the matrix run included), Chromium 2 of 5, WebKit 0 of 3. The matrix Chromium and WebKit runs passed.
- Class: intermittent product race on the bring-back tab, not Firefox-specific. Owner review.

**Firefox warning (not an error).** Firefox logs `WebGL context was lost.` once on page load as a JavaScript warning. The scripts count only errors. Probable source: the rig teardown calling `loseContext()` (`apps/web/components/companion/rig-renderer.ts:365-368`). Not verified.

Chromium logs GPU ReadPixels stall warnings only.

### Frame rate per engine (companion room, desktop)

| Engine | 3 s window, 1.5 s after load | 10 s window, 5 s after load (median frame gap, max gap) |
|---|---|---|
| Chromium | 49.2 fps | 55.1 fps (17 ms, 532 ms) |
| Firefox | 13.9 fps | 49.1 fps (17 ms, 116 ms) |
| WebKit | 0.3 fps | 2.0 fps (488 ms, 1108 ms) |

Source: `diagnostics-engine-probe-1.json`, `diagnostics-engine-probe-2.json`.

## Heap soak (Chromium 151.0.7922.34, 10 minutes)

Method: a scratch script outside the repo on `/dev/study?mode=quiz` at 1440x900, rig ready after 19.6 s. Over 600 s: a committed companion event every 20 s (29 events, rotating correct, wrong, setDone, cardGood); a pointer move every 2 s intended (231 moves recorded, about 2.6 s apart because each move takes time); a post-GC heap sample (`HeapProfiler.collectGarbage`, then `Runtime.getHeapUsage`) and DOM and `.fx` counts every 60 s (11 samples). Raw result: `chromium-heap-soak.json`.

| t (s) | used heap (KB) | DOM nodes | .fx nodes |
|---|---|---|---|
| 0 | 14059 | 396 | 0 |
| 60 | 14301 | 401 | 0 |
| 120 | 14482 | 405 | 0 |
| 180 | 14543 | 405 | 0 |
| 240 | 14641 | 405 | 0 |
| 300 | 14589 | 405 | 0 |
| 360 | 14665 | 405 | 0 |
| 420 | 14655 | 405 | 0 |
| 480 | 14745 | 405 | 0 |
| 540 | 14652 | 405 | 0 |
| 600 | 14611 | 405 | 0 |

- Full window (11 samples): slope 47.28 KB/min, R² 0.63. Rule: flat if |slope| < 10 KB/min. Result by that rule: GROWING.
- Warm-up: +582 KB between t=0 and t=240 s.
- After warm-up (t=240 to 600 s): slope +4.14 KB/min, start to end -30 KB, range 14589 to 14745 KB. Flat by the same rule.
- DOM nodes: 396 to 405 by 180 s, flat after that. `.fx` nodes were 0 at every sample instant, because samples land between bursts. Peak particle counts were not captured.
- Page errors 0. Console errors 0.
- Snapshot pair (the rule was exceeded, so the script took two CDP heap snapshots): A at 600 s, B 300 s later under the same activity, each after `collectGarbage`. Object-type nodes aggregated by constructor: total objects 389,620 to 369,708; self size 37,938 KB to 36,887 KB. No constructor shows a positive change in the top 25 rows by growth. Limit: only object-type nodes were aggregated (not closures, strings or arrays), and the raw snapshots were not kept.

Verdict: GROWING by the pre-declared full-window rule, but the growth is warm-up. In this run the post-GC heap is flat from minute 4 to minute 10, and the snapshot pair shows no growing constructor, so no sustained growth was seen. A slow leak below about 10 KB/min over six minutes cannot be excluded. A longer soak would be needed to rule it out.

## Not run or limited

- `--expect=sprites` and `--expect=off`: need other server builds (see above).
- Real Safari, Firefox touch hardware and Edge were not run. Owner rows A06 and A07 remain open.
- WebKit frame rate on this host makes its frame-timed results unreliable (W3, W4).
- WebKit ran from the webkit-2359 build, not the revision Playwright 1.62.1 expects.

## Files

- `LC-cross-browser/<engine>-LC-9-motion.json`, `<engine>-LC-19-results.json`, `<engine>-LC-21-results.json`: results per engine and script.
- `LC-cross-browser/<engine>-LC-21-desktop-V01-rest.png`: companion at rest on each engine.
- `LC-cross-browser/chromium-heap-soak.json`: soak samples, fit and snapshot diff.
- `LC-cross-browser/diagnostics-engine-probe-1.json`, `diagnostics-engine-probe-2.json`, `diagnostics-tab-press-trace.json`: probe outputs behind F1, F3 and the frame rates. The probe scripts are scratch files outside the repo and are not committed.
- Per-run console logs were not committed because `*.log` is gitignored. Each run's exit code and result line are in the Runs table.
