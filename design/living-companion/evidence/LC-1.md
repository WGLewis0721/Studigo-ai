# LC-1 feasibility: layered rig result

Status: IN PROGRESS. Measurements and the go/no-go recommendation are added by task H-A. Physical-device rows stay `OPEN (human)`.

Rive research lives in [rive-licensing-notes.md](rive-licensing-notes.md). The Rive candidate (A) has not been built; only the mesh rig (B) exists.

## Baseline on laptop 2026-11-20

Machine: owner's Windows 11 laptop, local worktree `studigo-living-companion-upgrade-ee0706`. Node 22.23.5 (nvm; `.nvmrc` says 22). pnpm 10.0.0 (`packageManager` pnpm@10.0.0).

Branch `claude/studigo-living-companion-upgrade-ee0706` at `261496a` (fast-forwarded from `e55bc2d`; the two new commits are status docs from aws-dev-wgl). Distance from `origin/main`: 0 behind, 57 ahead. `main` is still `056066f` (#266), so there is nothing in companion code, `mode-header.tsx` or the room header to reconcile.

| Check | Command (repo root unless noted) | Exit | Result |
|---|---|---|---|
| Install | `pnpm install --frozen-lockfile` | 0 | lockfile unchanged |
| Typecheck | `pnpm --filter @studigo/web typecheck` | 0 | clean |
| Lint | `pnpm --filter @studigo/web lint` (AI provider boundary) | 0 | `ai provider boundary ok` |
| LC unit tests | from `apps/web`: `node --import tsx --test lib/companion-mood.test.ts lib/companion-logic.test.ts lib/companion-motion.test.ts lib/companion-mouth.test.ts lib/companion-outfits.test.ts lib/quiet-feedback.test.ts lib/mobile-lessons.test.ts` | 0 | 102 pass, 0 fail |
| Full web suite | from `apps/web`: `node --import tsx --test lib/*.test.ts` | 1 | 558 pass, 1 fail: `C19 Word file matches the PDF edition and stays editable` (needs `pymupdf`; known, unrelated, not fixed) |
| Build | `pnpm --filter @studigo/web build` | 0 | Next 16.4.6 production build succeeds |

Rive CLI (`rive doctor`, 2026-11-20): version 1.9.2 ok (1.10.0 available, not installed); **auth: not logged in** (the 2026-11-16 handoff recorded auth ok); live-link port 9640 ok; no `rive.yaml` project; adb missing (not needed). Nothing was installed or signed in.

PR #268 checks at this SHA (from `gh pr checks`, 2026-11-20): validate pass, postgres-multisession pass, Vercel pass, synthetic-four-width pending at time of reading.

## Measurements 2026-11-20

Status after H-A: measured on the owner's laptop in Chromium. Physical-device rows stay `OPEN (human)`. Raw numbers: [LC-1/perf.json](LC-1/perf.json). Script: [scripts/lc-companion-perf.mjs](../../../scripts/lc-companion-perf.mjs). No phone or tablet was used; the phone rows are an emulated proxy.

### Setup

| Item | Value |
|---|---|
| Machine | Windows 11 Home 10.0.26200 laptop. CPU 12th Gen Intel Core i5-1235U (12 logical cores). RAM 7.73 GiB. `wmic` is not installed on this build, so the CPU name comes from `Win32_Processor` (CIM). |
| GPU | Intel Iris Xe Graphics, ANGLE Direct3D11, WebGL 1.0 (`UNMASKED_RENDERER_WEBGL` via `WEBGL_debug_renderer_info`). |
| Browser | Chromium 151.0.7922.34, Playwright 1.62.1, headless, args `--use-angle=d3d11 --ignore-gpu-blocklist --enable-gpu-rasterization`. Headless without these args draws WebGL with SwiftShader (software); those runs were discarded. |
| Node, pnpm, Next | v22.23.5, pnpm 10.0.0, Next 16.4.6 |
| Commit | Measured at `1e999f6` on `lc/11-measurements`. No product code changed. |
| Builds | On: `pnpm --filter @studigo/web build`, exit 0 (also exit 0 on the rebuild). Off: `NEXT_PUBLIC_STUDIGO_COMPANION=off pnpm --filter @studigo/web build`, exit 0. Both production. |
| Server | `node apps/web/node_modules/next/dist/bin/next start apps/web --hostname 127.0.0.1 -p 3310`, one at a time, stopped by PID after each batch; port 3310 confirmed free. |
| Page | `/demo/room?mode=quiz`: public synthetic room with the same `RoomWorkspace` and companion as `/dev/study`, which production gates off. |
| Desktop | 1440x900, DPR 1, no CPU throttle. |
| Phone proxy | 390x844, DPR 3, mobile emulation, CDP `Emulation.setCPUThrottlingRate` 4x. |
| Hook | `window.studigoCompanion` is set only in development ([companion.tsx](../../../apps/web/components/companion/companion.tsx)). Production runs read the same `CompanionHandle` from React's fiber tree (read-only) and call its `event()`. |
| Harness | A rAF collector, a timer around each frame callback that calls WebGL `bufferSubData` (the companion), and WebGL uniform wrappers that log the face channels. Test code only. The memory suite runs with logging off. |
| Director tests | `node --import tsx --test lib/companion-motion.test.ts` in `apps/web`: 34 pass, 0 fail, exit 0. |

Suite revisions: the first on-build pass ran before the memory suite gained its quiet flag and the per-suite hash stamp; those edits do not change any other suite's behaviour. Each suite in `perf.json` carries `scriptSha256` where it was recorded after that change.

### Frame time and companion cost

Idle is 20 s with him out in his window. Events are ten committed events (`correct`, `wrong`, `correct`, `setDone`, `cardGood`, `blindspot`, `correct`, `hintOpened`, `cardMiss`, `missionComplete`) spaced 1.5 s apart. Desktop has three runs per build; the phone has one run per build.

| Measure (ms unless noted) | Desktop, companion on (runs 1 / 2 / 3) | Desktop, companion off (runs 1 / 2 / 3) | Phone proxy, on | Phone proxy, off |
|---|---|---|---|---|
| Frame interval, idle, p95 | 18.0 / 18.0 / 17.9 | 41.1 / 18.1 / 46.0 | 18.2 | 19.4 |
| Frame interval, idle, mean | 16.69 / 17.05 / 17.02 | 16.91 / 16.76 / 20.14 | 16.78 | 17.29 |
| Frame interval, idle, max | 52.8 / 369.7 / 351.8 | 61.8 / 102 / 627.8 | 65.5 | 100.6 |
| Frames over 33.4 ms, idle | 1 / 3 / 2 | 107 / 3 / 69 | 5 | 27 |
| Frame interval, events, p95 / max | 17.9 / 23.8 (run 1) | n/a | 18.7 / 31.3 | n/a |
| Long tasks over 50 ms, idle | 0 / 0 / 0 | 0 / 0 / 0 | 0 | 4 (max 72) |
| Companion frame callback, idle, mean / p95 / max | 0.158 / 0.3 / 0.7 · 0.516 / 0.8 / 4.0 · 0.474 / 0.7 / 4.1 | n/a | 1.261 / 2.9 / 10.4 | n/a |
| Companion frame callback, events, mean / p95 / max | 0.182 / 0.3 / 1.2 (run 1) | n/a | 1.015 / 2.6 / 8.8 | n/a |
| Main-thread task time, idle (ms per s) | 37.6 / 88.4 / 78.2 | 26.4 / 13.0 / 85.4 | 205.2 | 107.2 |
| Script time, idle (ms per s) | 11.1 / 35.5 / 32.4 | 3.1 / 1.7 / 17.8 | 87.7 | 13.7 |
| Network requests during the ten events | 0 | n/a | 0 | n/a |

Reading the table:
- The on build's desktop p95 was 17.9 to 18.0 ms in all three runs. The off build ranged from 18.1 to 46.0 ms, with stalls up to 628 ms. Laptop noise is larger than any companion frame effect, so no frame-time penalty is resolvable here.
- The companion callback is the reliable cost: 0.16 to 0.52 ms per frame on desktop, p95 0.3 to 0.8 ms. Its timing includes WebGL calls, which can wait on the driver, so the higher runs may be the realistic figure.
- The phone proxy (4x CPU) averages 1.26 ms per callback (p95 2.9 ms). The mean is under the 2 ms budget; the p95 is above it.
- Profile (desktop, on, 20 s idle, 500 us sampling): busy time 2.6% of wall time. The companion chunk [`3l64rezdyqovi.js`](LC-1/perf.json) takes 76.9 ms, 14.6% of busy time or 0.38% of one core. The JS sampler does not count native WebGL calls, which the callback timing includes, so the two methods differ.

### Blend, face and reduced motion

Blend is the `correct` event to the drawing crossfade completing (opacity 1 on `.cmpRigBody .cmpPose.on`). Face is the smile channel read from the WebGL uniform stream, i.e. what the GPU drew, until it is within 0.02 of its plateau. The 160 ms and 300 ms constants are `FACE_FADE_MS` and `FACE_FADE_CALM_MS` in [director.ts](../../../apps/web/lib/companion-motion/director.ts); the settle times below are measured, not read from code.

| Measure (ms) | Desktop, on (n) | Phone proxy, on (n) | Desktop, OS reduced motion (n) |
|---|---|---|---|
| Drawing crossfade complete, mean / p95 / max | 155.9 / 165.7 / 165.7 (10) | 178.1 / 202 / 202 (5) | 29.2 / 32.3 / 32.3 (5) |
| Drawing class added, mean / max | 10.2 / 16.7 | 20.3 / 41.5 | 12.6 / 15.8 |
| Face settled, mean / p95 | 160.6 / 165.9 (9) | 172.6 / 176.1 (4) | 279.5 / 282.8 (5) |
| Largest per-frame change in the smile channel, mean / p95 | 0.162 / 0.221 | 0.156 / 0.160 | 0.083 / 0.083 |

- On desktop one of ten repetitions had a sample gap in the trace and is left out of the face statistic (n=9); the phone has n=4 for the same reason. The 202 ms phone repetition is the one with the gap.
- Under OS reduced motion, [globals.css](../../../apps/web/app/globals.css) (lines 3754 to 3757) sets `transition-duration: .001ms !important` on every element. The drawing swap therefore lands in about one frame instead of 130 ms. The face fade is JS-driven and still runs 300 ms. LC-DEC-040 keeps "expression fades", so the owner should confirm that a cut for drawings is intended.

Reduced motion (desktop, same three events, 18 s):

| Measure | Normal | Reduced (emulated) |
|---|---|---|
| Largest centroid offset from its median, CSS px (p95) | 15.0 (9.8) | 1.8 (1.3) |
| Particles added to `.cmpFx` | 54 | 0 |
| `data-calm` set | no | yes |

### Renderer fallbacks, tab behaviour, frame rates

| Measure | Result (n) |
|---|---|
| WebGL blocked: sprites visible from navigation start, mean / p95 | 544 / 609 ms (3) |
| WebGL available: rig visible from navigation start, mean / p95 | 776 / 883 ms (3) |
| Lost context: `loseContext()` to sprites visible, mean / p95 | 11.6 / 17.5 ms (3) |
| Restore: `restoreContext()` to rig visible, mean / p95 | 24.6 / 30.3 ms (3) |
| First `correct` after restore shows the celebrate drawing, mean / p95 | 3.9 / 5.3 ms (3) |
| Hidden tab for 10 s: companion frame callbacks while hidden | 0 |
| Tab return: first step, rig px | 0; next five steps 0.11 to 0.16 (normal step p95 0.47 rig px = 0.13 CSS px) |

- Director tests, same file as above: "30, 60 and 120 Hz displays see the same motion and the same drawings" (line 121), "a hidden tab stops the clock and resumes without a jump" (line 253), "one long frame cannot throw him across the screen" (line 265). All pass.
- In the browser the celebrate beat (drawing 0 to 700 ms, rig to 1400 ms, drawing to 2300 ms) landed at 27, 686, 1403, 2292 ms at a 30 Hz rAF shim, and at 13, 723, 1438, 2313 ms at 60 Hz. The shim is timer-driven and averaged 38 ms per frame (about 26 fps), so it is slower than 30 fps but the beats still finish on time. No page errors in either run.
- A second celebrate near 2.5 s in both runs is the growth-unlock celebration: `celebrate()` in [engine.ts](../../../apps/web/components/companion/engine.ts) calls `director.play("celebrate")` on a new unlock.

### Memory and bundle

Memory, desktop, quiet run, forced GC before each reading:

| | Companion off | Companion on |
|---|---|---|
| JS heap used, start (bytes) | 6,715,636 (after load) | 7,048,504 (after mount) |
| JS heap used, after 60 s (bytes) | 6,744,916 | 7,541,540 |
| Change over 60 s (bytes) | +29,280 | +493,036 |
| Rig canvas backing store (bytes) | 0 | 518,400 (360x360x4). A DPR 3 phone would be 600x600x4 = 1,440,000 (computed, not measured) |
| Decoded drawings, 15 `.cmpPose` elements (bytes, summed per element) | 0 | 9,600,000 (shared decodes would lower this) |

The first on-build memory pass, before the quiet flag, read +1.38 MB; most of that was the harness's own uniform log. The quiet run replaced it. The +0.49 MB per 60 s on the on build is not explained yet (the off build rose 0.03 MB in the same window). A 10-minute soak is needed to separate GC noise from growth.

Bundle, route JS for `/demo/room`:

| | Companion off | Companion on | Delta |
|---|---|---|---|
| Route JS, raw / gzip bytes (12 chunks) | 2,006,697 / 615,343 | 2,072,287 / 638,398 | +65,590 / +23,055 (+3.3% / +3.7%) |
| Companion-marked chunk, raw / gzip | `2i44l2zg5yezt.js`: 12,830 / 4,919 (markers "Giggly", "studigo.companion."; prefs and settings code) | `3l64rezdyqovi.js`: 79,743 / 28,396 (markers cmpRigBody, cmpSill, Giggly, studigo.companion., Studigo's rig, webglcontextlost) | +66,913 / +23,477 |

Attribution is per chunk, and a flagged chunk can hold other route code. Gzip is zlib default level 6.

Art requested when the room is ready, on build: 13 WebP files, 401,530 bytes. `center.webp` is 33,054 (the rig texture). The other 12 drawings total 368,476 (celebrate, down, down-right, lean, left, pet, poke, right, sleep, support, up, up-right). The 15 pose elements map to these 13 files, because mirrored poses reuse a file. So the drawings are not lazy: they load at room ready. The seven outfit SVGs (5,820 bytes) load only when an outfit is picked; none were requested on load. The rig mesh is not an image and adds no transfer.

### Spec section 14 checklist

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | At least 6 expressions, crossfade ≤200 ms, no popping | PARTIAL | Fourteen expressions, pinned by the test "there are fourteen faces and every beat names real ones" in [companion-motion.test.ts](../../../apps/web/lib/companion-motion.test.ts). Face crossfade measured 160.6 ms on desktop and 172.6 ms on the phone proxy (GPU trace). Largest per-frame step 0.22. The visual no-popping review is OPEN (human). |
| 2 | Interrupted reaction back to REST within 400 ms (50 random sequences) | NOT MEASURED | The 50-sequence interrupt test was not built in this pass. Code bounds: cut fade 150 ms (`CUT_FADE_MS`), face fade 160 ms (300 ms calm). |
| 3 | 60 fps sustained (p95 ≤16.7 ms, companion ≤2 ms/frame) on iPhone 12 Safari and Moto G Chrome; ≥30 fps floor | PARTIAL | Desktop companion callback 0.16 to 0.52 ms mean, p95 at most 0.8 ms (meets 2 ms). Desktop frame p95 17.9 to 18.0 ms over three on runs, about 1 ms above 16.7, which laptop noise does not let us separate. Phone proxy (4x CPU) callback mean 1.26 ms, p95 2.9 ms (p95 over 2 ms). Physical devices: OPEN (human). |
| 4 | Rive file ≤300 KB, runtime ≤250 KB gz, memory ≤40 MB added | N/A for file and runtime (no Rive; the in-repo WebGL rig, LC-DEC-024 and LC-DEC-031). Memory MET (estimate) | Desktop estimate about 10 MB: heap +0.33 MB at mount, canvas 0.52 MB, decoded drawings up to 9.6 MB. Phone canvas 1.44 MB (computed). The +0.49 MB per 60 s heap growth is unexplained; soak OPEN. |
| 5 | Reduced motion: no translation over 8 px, no particles | MET | Emulated `prefers-reduced-motion`: largest centroid offset 1.8 CSS px (normal 15.0), 0 particles (normal 54). The centroid is a proxy for whole-body translation. Desktop only. |
| 6 | Lip-sync within 80 ms of TTS | N/A | No voice or TTS in v1. The mouth driver is an input with no audio source. |
| 7 | Zero writes to mastery or grade tables; a test asserts no API mutations | MET (proxy) | Zero network requests during the ten events, desktop and phone. No fetch, Supabase, XHR or beacon in the companion modules (grep). The source scan at [companion-motion.test.ts](../../../apps/web/lib/companion-motion.test.ts) line 36 fails if a motion module references fetch, localStorage, supabase, window, document, Date.now or Math.random. Growth and prefs use localStorage only (LC-DEC-035). Gap: no single test covers the React host or the growth store. |
| 8 | William and two kids rate "feels alive" at least 4/5 | OPEN (human) | Needs the owner and the children. |

Other QA rows touched here: V08 is MET for the director (34 of 34 tests) and for beat timing at 30 and 60 Hz in the browser. A04 is MET in simulation: the companion makes no callbacks while hidden and resumes without a jump. A08 is PARTIAL: CPU, frame, memory, bundle and WebGL fallback are measured; scroll and text-input responsiveness are NOT MEASURED. A09 is covered by LC-9 (dev only); the production rehearsal stays OPEN there.

Simulated hidden state: `bringToFront()` did not hide the first page in headless Chromium, so the hidden state is simulated by overriding `document.visibilityState` and `document.hidden` and dispatching `visibilitychange`. That runs the engine's own handler.

### Caveats

- Headless Chromium on a real Iris Xe GPU through D3D11. The phone is an emulation with a 4x CPU throttle, not a low-end Android. Chromium only; Safari was not run.
- Frame-interval comparisons are dominated by laptop noise: off-build stalls reached 628 ms and on-build stalls 370 ms. Companion cost rests on the companion's own callback timing and the per-chunk CPU profile.
- The 60 Hz browser window had a 50 ms p95 and an 82 ms max within one 3.3 s window that contained the event; it was not reproduced in the 20 s idle or 15 s events windows.
- Not measured: iPhone and Android devices, scroll and text-input responsiveness, the 50-sequence interrupt test, 200% zoom, slow network, phone GPU cost, a 10-minute heap soak, and a browser run at 120 Hz (the director test covers it).

### Recommendation

**GO** for the hybrid mesh rig as the v1 renderer. The measurements support LC-DEC-031. Several gates stay open before release.

Measured on the laptop (Chromium): the companion costs 0.16 to 0.52 ms per frame on desktop and 1.26 ms mean on the 4x phone proxy. Memory adds about 10 MB on the desktop estimate, under the 40 MB budget. The room adds about 23 KB gzip of companion code. Fallbacks are fast: sprites about 12 ms after context loss, the rig back in about 25 ms, and beats on time at 30 and 60 Hz. Reduced motion keeps translation under 2 px and adds no particles.

Open before any release:
1. Physical iPhone 12 Safari and a low-end Android: frame p95 and companion cost on the device (OPEN, human).
2. A 10-minute heap soak on desktop and phone, to decide whether +0.49 MB per minute is growth.
3. The 50-sequence interruption test (item 2).
4. A visual no-popping review of the face fades (item 1) and the "feels alive" rating (item 8).
5. The owner's decision on the reduced-motion drawing cut (see the blend notes).

Biggest performance risk: the always-on 60 fps WebGL redraw on phones. The rig redraws a 600x600 canvas at DPR 3 every frame while he is out, and phone GPU cost is not measured. On the 4x CPU proxy the companion costs about 75 ms of main-thread time per second (1.26 ms mean at 60 frames). The frame p95 stayed near 18 ms, so the risk is energy and GPU cost on real phones, not visible frame drops in this test.

Cheapest mitigation: cap the rig backing store at 2x DPR. On DPR 3 phones that is 480 px instead of 600 px, 36% fewer pixels; the estimate follows from the size formula in [rig-renderer.ts](../../../apps/web/components/companion/rig-renderer.ts). Step the director at 30 Hz on low-end devices or in calm mode; the director is already tested at 30 Hz. Both are small changes and neither is measured yet. A second cheap win: load the 12 extra drawings on first use instead of at room ready. That removes about 368 KB of transfer and most of the decoded bitmaps at room start (up to 9.6 MB by the element sum).
