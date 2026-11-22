# LC-9 Rollback rehearsal (local)

Status: LOCAL PASS for the three rollback levers, run on `lc/23-rollback`. Production rehearsal on Vercel: OPEN (owner; needs Vercel env access and a deploy).

Plan step 23. Covers the local part of QA rows A05 (recovery) and A09, and release gate 7 in [QA_RELEASE_ACCEPTANCE.md](../QA_RELEASE_ACCEPTANCE.md). Gate 7 stays open until the production rehearsal is done. Lever definitions come from [INTEGRATION_MAP.md](../INTEGRATION_MAP.md) section 7, with corrections in the caveats.

## Under test

| Item | Value |
| --- | --- |
| Product code | `25f0dd9` (the living-companion branch tip). No product file changed on this branch. |
| QA script | [scripts/lc-rollback-qa.mjs](../../../scripts/lc-rollback-qa.mjs), committed as `56b32d2`. This is the `headSha` in every run JSON. Script sha256 `abad0dfe0abd...` is in each JSON. |
| Branch | `lc/23-rollback`, created from `origin/claude/studigo-living-companion-upgrade-ee0706`. The worktree had been on `056066f`, which does not contain `25f0dd9`. |
| Setup | `pnpm install --frozen-lockfile` at the repo root, exit 0. Node v22.23.5. Playwright 1.62.1, Chromium 151.0.7922.34, headless, Windows 11. |
| Server | `node apps/web/node_modules/next/dist/bin/next dev apps/web --hostname 127.0.0.1 -p 3305` from the repo root. One server at a time. `apps/web/.next` deleted before each start. Readiness: `curl` to `/dev/study?mode=quiz` returned 200 each time. |
| Viewports | 1440x900 and 390x844 |
| Routes | `/dev/study?mode=quiz` and `/dev/study?mode=quiz&ui=phase3` (synthetic fixture, room id `fixture`) |

## Runs

| Run | Server env | Script command | Exit | Checks | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1. Default (motion on) | none | `node scripts/lc-rollback-qa.mjs --expect=motion` | 0 | 48/48 | [motion.json](LC-9/motion.json), [motion-1440x900.png](LC-9/motion-1440x900.png), [motion-390x844.png](LC-9/motion-390x844.png) |
| 2. Motion off | `NEXT_PUBLIC_STUDIGO_COMPANION_MOTION=off` | `node scripts/lc-rollback-qa.mjs --expect=sprites` | 0 | 36/36 | [sprites.json](LC-9/sprites.json), [sprites-1440x900.png](LC-9/sprites-1440x900.png), [sprites-390x844.png](LC-9/sprites-390x844.png) |
| 3. Companion off | `NEXT_PUBLIC_STUDIGO_COMPANION=off` | `node scripts/lc-rollback-qa.mjs --expect=off` | 0 | 30/30 | [off.json](LC-9/off.json), [off-1440x900.png](LC-9/off-1440x900.png), [off-390x844.png](LC-9/off-390x844.png) |

All runs used `STUDIGO_QA_BASE=http://127.0.0.1:3305`. Each server's process tree was killed before the next server started, and port 3305 was confirmed free each time. Each run JSON records the `headSha`, script hash, server env, every check with its detail, and the page errors, console errors, warnings and failed responses per session.

## 1. Motion off: original WebP drawings

Procedure: set `NEXT_PUBLIC_STUDIGO_COMPANION_MOTION=off` and redeploy.

Restores: the fifteen stacked WebP drawings and the two CSS eyelids of the original renderer. No WebGL canvas is created. Reactions use the legacy path.

Verified (run 2, [sprites.json](LC-9/sprites.json)), both viewports, both routes:
- `.cmp` has no `data-motion`. No `.cmpRig`. 15 `.cmpPose` drawings. 2 `.cmpLid` eyelids.
- The center drawing decoded.
- `event("correct")` shows `.cmpPose.on[data-pose=celebrate]` within 1 s (measured 6 to 10 ms).
- No uncaught page errors, console errors or failed responses.
- The flag took effect from the page itself: run 1 on the same routes had `data-motion` and a ready rig.

## 2. Automatic fallback: WebGL failure or lost context

Procedure: none. The fallback is automatic.

Restores: the same state as lever 1, without a reload. Code: `fallBack()` in [engine.ts](../../../apps/web/components/companion/engine.ts) (lines 159 to 172), and the rig's handlers in [rig-renderer.ts](../../../apps/web/components/companion/rig-renderer.ts) (`getContext` null check at line 186, `webglcontextlost` at line 188, `art.onerror` at line 232).

Verified (run 1, [motion.json](LC-9/motion.json)):
- WebGL unavailable (an init script makes `getContext("webgl")` and `"webgl2"` return null): sprite markup appears, with no rig canvas, no `data-motion`, 15 drawings and 2 eyelids. `correct` still reacts (11 to 16 ms). The console warning "Studigo's rig could not start; using his drawings." appears twice per page, because dev StrictMode mounts the effect twice. No uncaught errors.
- Lost context mid-session (`WEBGL_lose_context.loseContext()` on `.cmpRig`): sprites replace the rig within 1 s (9 to 12 ms). `correct` still reacts afterwards. No uncaught errors.

Not verified here: a missing or failing rig image (the `art.onerror` path), and a restored context. There is no `webglcontextrestored` handler, so after a context loss he stays on sprites until the page reloads.

## 3. Companion off: no companion

Procedure: set `NEXT_PUBLIC_STUDIGO_COMPANION=off` and redeploy.

Restores: the room without his window. The flag is checked in [companion.tsx](../../../apps/web/components/companion/companion.tsx) (line 60) before any engine is created.

Verified (run 3, [off.json](LC-9/off.json)), both viewports, both routes:
- No `.cmp`. `.cmpHost` has no children. `window.studigoCompanion` is absent.
- The room renders. The "Study Room sections" navigation is visible. The quiz topic checkbox toggles and toggles back.
- No uncaught page errors, console errors or failed responses.

Not removed by this flag: the static header mascot. `StudigoMascot` renders unconditionally in [mode-header.tsx](../../../apps/web/components/room/mode-header.tsx) (line 259). The CSS hides it only while his window is out (`.roomWorkspace[data-seat="empty"]` in [companion.css](../../../apps/web/components/companion/companion.css), lines 245 and 246). With the flag off, the header dragon shows again ([off-1440x900.png](LC-9/off-1440x900.png)). Whether that is wanted at launch is a product decision.

## Malformed saved prefs (A05, all runs)

Procedure: `localStorage["studigo.companion.fixture"] = "{bad"`, then reload.

Verified in all three runs, both viewports: the bad value survives the reload and the room renders. In motion and sprites runs he mounts on defaults. His menu shows speech off, "Fade while I scroll" on, Calm off, floating window selected, and outfit None. No uncaught page errors. In the off run he stays absent, with no errors.

## Caveats

1. `NEXT_PUBLIC_*` values are compiled into the client bundle at build time. On Vercel, changing either variable has no effect until a new build is deployed. The dev server here recompiled because `.next` was deleted before each start.
2. Only the exact value `off` disables a lever. `motionEnabled()` in [renderers.ts](../../../apps/web/components/companion/renderers.ts) (line 73) tests `!== "off"`, so `false`, `0` or an empty value leaves motion on. The companion check (companion.tsx line 60) tests `=== "off"`, so any other value leaves him on.
3. Prefs are per-browser localStorage (`studigo.companion.<roomId>` and `studigo.companion.scale`). They do not sync between devices. Rolling back does not delete them.
4. Old builds ignore unknown fields on read. `parsePrefs` on `056066f` keeps only `speech`, `seated`, `tuck`, `dock` and `scale`. But that build's save (`writeCompanionPrefs` on `056066f`) writes only those fields, so a save from an old build drops `pos`, `host`, `outfit`, `calm` and `v` for that room. `dock` survives. Checked by reading `git show 056066f:apps/web/lib/companion-logic.ts` and `companion-prefs.ts`. Not exercised in a browser.
5. Documentation drift. [INTEGRATION_MAP.md](../INTEGRATION_MAP.md) section 7 says the motion flag is off by default and that the fallback is a Rive renderer. The code defaults it on (LC-DEC-025 in [DECISIONS.md](../DECISIONS.md)), and the renderer is the in-repo WebGL mesh rig in [rig-renderer.ts](../../../apps/web/components/companion/rig-renderer.ts). This rehearsal follows the code. `.env.example` does not list `NEXT_PUBLIC_STUDIGO_COMPANION_MOTION`.
6. These are development builds (`next dev`, `NODE_ENV=development`), so the `window.studigoCompanion` hook and `/dev/study` were available. Not tested here: a production build, Mobile Safari or iPadOS (A06 stays OPEN, human), 200% zoom, the OS reduced-motion setting, real study data, and the rest of the QA matrix.
7. Not checked: the "byte-identical behavior" target for the off state against `056066f` (INTEGRATION_MAP section 7). Only the observable checks above were run.
8. In the 1440x900 motion session, Chromium logged GL driver performance messages ("GPU stall due to ReadPixels"). They are warnings, not page console errors, and were not counted as failures.

## Production rehearsal on Vercel: OPEN

Owner. Needs Vercel environment access and a deploy. When it is run:
1. Record the current Production values of `NEXT_PUBLIC_STUDIGO_COMPANION` and `NEXT_PUBLIC_STUDIGO_COMPANION_MOTION` (names and values only, no secrets).
2. Set `NEXT_PUBLIC_STUDIGO_COMPANION_MOTION=off`, redeploy, and confirm the legacy drawings on the production URL: no `data-motion`, no rig canvas, and the celebrate drawing on a real correct answer.
3. Restore the variable, redeploy, and confirm the rig is back. Then repeat with `NEXT_PUBLIC_STUDIGO_COMPANION=off`.
4. Record the deployment URL, commit SHA, and dated screenshots in this folder.

[scripts/lc-rollback-qa.mjs](../../../scripts/lc-rollback-qa.mjs) cannot run against production unchanged. `/dev/study` returns 404 outside development unless the deployment is a Vercel preview with the Phase 3 flag set or the explore preview ([page.tsx](../../../apps/web/app/dev/study/page.tsx)), and `window.studigoCompanion` is set only in development (companion.tsx line 75). A production run needs a signed-in room or a flagged preview, with the correct answer submitted through a real quiz.
