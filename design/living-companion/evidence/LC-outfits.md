# LC-outfits: outfits are on-model textures on the rig

Task card H-K, under LC-DEC-037. Branch `lc/dressed-outfits`, from `origin/claude/studigo-living-companion-upgrade-ee0706` at `339e29c`. Not pushed, merged or deployed. Browser checks ran against `next dev` on `127.0.0.1:3311` with this working tree, using Playwright 1.62.1 scratch scripts kept outside the repo.

## What changed

1. **The rig wears the dressed drawing.** [rig-renderer.ts](../../../apps/web/components/companion/rig-renderer.ts)
   - `setOutfit` swaps the WebGL texture to `dressed/<outfit>.webp`, or to `center.webp` for None. A drawing is decoded on first use and its texture is kept, so each outfit used owns one GL texture.
   - A swap fades over 200 ms. The fragment shader mixes the previous and the new texture (`uMix`, a second sampler). The old drawing stays on screen until the new one is decoded and uploaded, so no frame is blank.
   - A failed outfit load keeps what is on screen. Only a failed undressed drawing with nothing on screen falls back to the sprites, as before.
   - After a lost context, the worn drawing is uploaded again before the rig is handed back. `onRestored` runs only once a texture is back.
   - The overlay (`.cmpOutfit`, `placeOutfit`, `showOutfit`, the per-frame transform) is gone.
2. **Outfit table.** [outfits.ts](../../../apps/web/lib/companion-motion/outfits.ts) now holds only `OUTFIT_TEXTURES`, the id to drawing map. `OUTFIT_LABELS` stays in [companion-logic.ts](../../../apps/web/lib/companion-logic.ts).
3. **Thumbnails.** The menu card ([engine.ts](../../../apps/web/components/companion/engine.ts)) and Room Settings ([companion.tsx](../../../apps/web/components/companion/companion.tsx)) show a 40 px round thumbnail beside each outfit: the drawing cropped to the head (`scale(1.7)` from `50% 12%`). None shows the undressed drawing. Locked outfits keep their lock text and show the thumbnail in greyscale. Styles are in [companion.css](../../../apps/web/components/companion/companion.css).
4. **Deleted** the seven placeholder SVGs in `apps/web/public/mascot/companion/outfits/`.
5. **Tests.** [companion-outfits.test.ts](../../../apps/web/lib/companion-outfits.test.ts) checks the table, that every outfit has a dressed WebP that is 400 x 400 and under 60 KB (the VP8X canvas and the VP8 or VP8L bitstream must agree), that the files are distinct, and that the table module is pure. [companion-outfits-rules.test.ts](../../../apps/web/lib/companion-outfits-rules.test.ts) checks that no overlay remains (no SVG, no `.cmpOutfit` style, no overlay code), that the rig, menu and Room Settings read the same table, the cosmetic-only word check on outfit art and renderer code, the picker lines, and the unchanged `parsePrefs` behaviour.

## Commands and exit codes

| Step | Command | Exit | Result |
|---|---|---|---|
| Branch | `git switch -c lc/dressed-outfits origin/claude/studigo-living-companion-upgrade-ee0706` | 0 | Tip is `339e29c`, which has the dressed-texture commit. |
| Install | `pnpm install --frozen-lockfile` | 0 | 89 packages added. pnpm skipped the esbuild build script; the tests ran without it. |
| Baseline tests | `node --import tsx --test lib/companion-*.test.ts lib/quiet-feedback.test.ts lib/mobile-lessons.test.ts` (in `apps/web`) | 0 | 169 pass, 0 fail. |
| Baseline typecheck | `npx tsc --noEmit -p .` (in `apps/web`) | 0 | No output. |
| Baseline lint | `pnpm --filter @studigo/web lint` | 0 | Provider boundary ok. |
| Final tests | same command as the baseline | 0 | 165 pass, 0 fail. The 4 removed geometry tests are replaced by the table, WebP, identity and rules checks. |
| Final typecheck | `npx tsc --noEmit -p .` | 0 | No output. |
| Final lint | `pnpm --filter @studigo/web lint` | 0 | Provider boundary ok. |

Browser runs. Each script exited 0 and wrote its own results file. Run 1, 2 and 3 set a `fatal` field, so each stopped at a step; the steps before that point are the ones reported here.

- **Run 1.** Stopped at the context-restore step: `getExtension()` returns null once the context is lost, so the extension has to be kept from before the loss. Its swap latencies are not used, because the click time was taken before Playwright dispatched the click.
- **Run 2.** A menu label was detached during a click in the swap sequence. The cause is not isolated. It did not recur in run 3 (8 of 8 clicks landed, and no menu-card removal was logged). Its latencies are not used, for the same reason as run 1.
- **Run 3.** The swap sequence, rest and turn frames, context restore, Room Settings and reload all ran. Stopped in the locked-menu phase: every draw read back pixels, which made the page too slow for Playwright's waits. Sampling was switched off for that phase in run 4.
- **Run 4.** Context-loss probe with event order against each draw, and the locked menu with sampling off. Ran to the end.

Draw sampling: after each draw, the wrapper reads back a 16 by 16 pixel block near the centre of the canvas and records its maximum alpha. A draw is blank if that alpha is 0. Each draw also records the texture bound on unit 0 (current) and unit 1 (previous), and the crossfade value.

## Observations

- **Load.** Frame rate 58 fps (requestAnimationFrame, idle page). Uploads at load: `center.webp` only.
- **Menu.** All 8 thumbnails decode (run 3). Frames: [none-rest.png](LC-outfits/none-rest.png) (the undressed rig, for comparison) and [menu-unlocked.png](LC-outfits/menu-unlocked.png).
- **Lazy textures.** With sash saved, a reload uploads `sash.webp` only (run 3).
- **Timing** (run 3, sampling off, menu open). The first use of a drawing shows its new texture 273 ms after the change (goggles) and 222 ms (explorer), while the old drawing stays on screen. The fade reaches full mix at 509 ms and 599 ms. The fade samples follow the 200 ms ramp: goggles at mix 0.43 at 358 ms and 0.77 at 425 ms; explorer at mix 0.71 at 364 ms. A cached drawing shows at once: back to None took 1 ms to start and 214 ms to reach full mix. In this software-rendered browser the rig drew 4 to 18 frames in the second after each change, with the menu open.
- **Swap sequence** (run 3, sampling on). Eight clicks in order: visor, reader, beret, headphones, sash, None, goggles, explorer. 130 draws: 130 sampled, 0 blank, 0 with no texture. Each first-use drawing was uploaded once (visor, reader, beret, headphones, sash); goggles and explorer came from the cache, and None was already cached.
- **Rest** (2x device scale). With goggles, explorer or sash chosen, the current texture is that outfit at mix 1 with alpha 255 at the sample. Frames: [goggles-rest.png](LC-outfits/goggles-rest.png), [explorer-rest.png](LC-outfits/explorer-rest.png), [sash-rest.png](LC-outfits/sash-rest.png). Goggles and the explorer hat are clearly on his head; the sash shows on the chest.
- **Turn.** With the pointer far left (380 ms after the move), he takes the drawn left-turn pose, which is undressed. This is the accepted gap in the card (item 3). The outfit is not drawn while that pose shows. Frames: [goggles-turn.png](LC-outfits/goggles-turn.png), [explorer-turn.png](LC-outfits/explorer-turn.png), [sash-turn.png](LC-outfits/sash-turn.png).
- **Context loss** (run 4, probe). `webglcontextlost` fired 15 ms after `loseContext()`. One sampled draw read zero alpha. It came 5 ms after `loseContext()` and 10 ms before the lost event, so it was drawn to a context that was already lost. No draw ran between the lost and restored events. `webglcontextrestored` fired 34 ms after `restoreContext()`. The first three draws after the restore were sash at mix 1 with alpha 255, and none of the 64 sampled draws after it read zero alpha. Run 3 showed the same restore in more detail: the rig was back in the DOM, ready and with motion on, and only `sash.webp` was uploaded (the worn drawing), with the other drawings left to upload when first used. Run 3 also recorded one zero-alpha draw in that window.
- **Room Settings** (run 3). The picker shows 8 thumbnails, with the saved sash checked: [room-settings-outfits.png](LC-outfits/room-settings-outfits.png).
- **Locked menu** (run 4, new learner, growth 0). None is unlocked. The seven outfits are locked, each with "Unlocks after N more study tasks" (3, 15, 45, 68, 193, 358 and 265 study tasks, in the list order). The thumbnails show in greyscale: [menu-locked.png](LC-outfits/menu-locked.png). Thumbnails below the fold were not loaded when the DOM was read; they appear once scrolled into view, which is the lazy loading working.
- **Console and page errors.** None in any run.

## Bytes

- **Removed:** the seven SVGs, 5,820 bytes (beret 750, explorer 950, goggles 993, headphones 908, reader 740, sash 836, visor 643).
- **Added binary in this change:** none. The seven dressed WebPs (goggles 30,804; explorer 29,972; visor 30,622; reader 30,294; beret 29,420; headphones 30,752; sash 29,170; total 211,034) and `center.webp` (33,054) were already in `339e29c`.
- **Evidence screenshots:** 10 PNG files, 867,540 bytes in total. The rig windows are 57 to 60 KB each; the menu and Room Settings captures are 141 to 176 KB each.
- **Source and tests:** 14 tracked files, 192 insertions and 424 deletions (`git diff --stat`).

## Gaps and follow-ups

- The far head-turn drawings stay undressed (card item 3), so the outfit disappears during a far turn.
- [rig.ts](../../../apps/web/lib/companion-motion/rig.ts) was outside the file list and is unchanged. It still defines `RIG.slots`, `poseHeadPoint` and comments about outfit slots. Nothing in the outfit code uses them now; they belong in the prune pass.
- [ASSET_MANIFEST.md](../assets/ASSET_MANIFEST.md) still says to replace the flat placeholder overlays, and LC-DEC-028 stays OPEN until the owner approves the new art. Both are outside the file list, so they were not edited.
- The menu thumbnails use `loading="lazy"`, so they fetch as the menu scrolls into view. The rig then reuses the cached drawings.
- Timings come from a software-rendered headless Chromium (SwiftShader), not a phone.
- One menu label was detached during a click in run 2 (see the commands table). Its cause is not known. It did not recur in run 3, where no menu-card removal was logged.
