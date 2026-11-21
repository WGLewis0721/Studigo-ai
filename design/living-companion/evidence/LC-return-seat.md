# LC-return-seat: a greeting on return, and a living seat

Branch `lc/return-and-seat`, from `66c1b56` (origin `claude/studigo-living-companion-upgrade-ee0706`). Specs: [SHARED_COMPANION_EVENTS.md](../SHARED_COMPANION_EVENTS.md) (`sessionReturn`), [DECISIONS.md](../DECISIONS.md) LC-DEC-039 and LC-DEC-042, and [LC-17](LC-17.md).

## What changed

- [companion-session.ts](../../../apps/web/lib/companion-session.ts): the 30 minute return window, `isReturn`, and the device-wide last-seen time (`studigo.companion.lastSeen`), read and written through guarded storage. Fake-clock tests are in [companion-session.test.ts](../../../apps/web/lib/companion-session.test.ts).
- [engine.ts](../../../apps/web/components/companion/engine.ts): the start reads the gap. A return emits `sessionReturn` through `commit()` (growth, the `bound` beat, the voice line) 600 ms after start, once the landing has played. The last-seen time is saved after that window, on every committed event, and when the page is hidden. A return from Home replaces the arrival celebration. While seated, `correct`, `setDone`, `cardGood`, `missionComplete` and `sessionReturn` hop the avatar.
- [studigo-mascot.tsx](../../../apps/web/components/studigo-mascot.tsx) and [mode-header.tsx](../../../apps/web/components/room/mode-header.tsx): the `alive` prop adds two eyelids, and only the seat avatar passes it.
- [companion.css](../../../apps/web/components/companion/companion.css): the hop, the breathing (picture only, 1.5% over 3.8 s), and two blinks on one 12.6 s cycle. Calm stops the breathing and the hop. Reduced motion stops the breathing and keeps the blinks.

Growth points for `sessionReturn` are unchanged (2).

## Commands and results

| Command | Exit | Result |
|---|---|---|
| `pnpm install --frozen-lockfile` (root) | 0 | dependencies installed |
| `node --import tsx --test lib/companion-*.test.ts lib/quiet-feedback.test.ts lib/mobile-lessons.test.ts` (apps/web) | 0 | 188 pass, 0 fail (7 of them new in companion-session.test.ts) |
| `npx tsc --noEmit -p .` (apps/web) | 0 | no errors |
| `pnpm --filter @studigo/web lint` | 0 | ai provider boundary ok |
| `node return-seat-check.mjs all` (Playwright, scratch script outside the repo) | 0 | 34 checks, 0 failed |
| `node phase3-geometry.mjs` (scratch) | 0 | header 112 px, rail and avatar unchanged, seat empty to occupied |
| `STUDIGO_QA_BASE=http://127.0.0.1:3322 node scripts/lc-rollback-qa.mjs --expect=motion` (second run) | 0 | 48 of 48 checks pass |

All browser checks ran against `next dev` on port 3322, headless Chromium, 1440 by 900.

Rollback QA took two runs. The first exited 1 with 47 of 48: `[390x844 quiz-phase3] correct answer makes him celebrate within 1 s` timed out at 2.7 s elapsed. That run came while the machine ran at 45 to 80% CPU with about 325 MB free. To see whether the change caused it, the same sequence (wait for the rig, fire a correct answer, wait one second) ran five times on the base commit and five times on this change. Both passed 5 of 5, with the celebrate pose within 19 to 413 ms, and the companion was in its window, not seated. The second full run exited 0 with 48 of 48. The tracked LC-9 evidence folder was restored afterwards.

## Browser results

Greeting. Each return opens a new browser context that carries the saved storage, with the last-seen time moved back.

- First visit: the last-seen time is saved and no return line plays.
- Two hour gap: the bound beat celebrates 1085 ms after the companion appears (limit 1500 ms). `oh-youre-here-early.mp3` is requested. Growth goes from 0 to 2. The last-seen time is refreshed.
- One minute gap: no celebration, no return line, growth unchanged.
- Arrival from Home after two hours: one celebration at 1158 ms, the return line is requested, and nothing repeats later.

Seat (drawer open for both measurements):

- Header 82 px tall, top 154.08, rail top 236.08, before and after seating.
- Breathing: the picture's scale runs from 1.000 to 1.015 over the sampled frames.
- Blinks, read from the animation itself: left at 4420 and 10310 ms, right at 4470 and 10370 ms. Gaps are 5.9 s and 6.7 s.
- A correct answer while seated lifts the avatar 7 px at the peak (the hop).
- Reduced motion: no breathing (scale stays at 1), blinks at the same times, no hop.
- Calm: no breathing, blinks, no hop.

Screenshots (2x crops around the seat): [rest](LC-return-seat/seat-avatar-rest.png), [breath peak](LC-return-seat/seat-avatar-breath-peak.png), [blink peak](LC-return-seat/seat-avatar-blink-peak.png).

## Judgement calls

1. The last-seen write waits for the greeting window. React runs effects twice in development, so the first engine is torn down as soon as it starts. A write in the same tick would hide the gap from the second one. Production mounts once.
2. A same-tab reload is not a return. Chromium fires `visibilitychange` (hidden) as the old page unloads, and that rewrites the last-seen time before the new page reads it. Measured: a value set two hours back read as 28 ms old at the start of the reloaded document. The card's step "set it two hours ago, then reload" therefore cannot pass as written. The check opens a new context with the saved storage instead, which is how a real return looks. Owner call: whether a reload after a long idle should greet.
3. On a return from Home, the return beat replaces the arrival celebration. Queued behind it, the greeting landed seconds late.
4. The coach and materials room line is skipped while the greeting is pending, so it cannot take the voice cooldown first.
5. The seated cheer covers `correct`, `setDone`, `cardGood`, `missionComplete` and `sessionReturn`. Wrong answers, blind spots and card misses do not hop.
6. The `seatLand` class keeps its name, and its keyframes are now the hop. Landing in the seat hops too. Calm keeps still.
7. The voice line is requested, but browsers can hold sound until the learner touches the page. Bubble text shows only when a line starts, as for every line. A missed greeting is not replayed on the first touch.
8. The greeting runs on start only, as the card specifies. A tab shown again without a reload is not greeted.
9. In development the first-meet clip is not requested. React's double mount tears down the first engine after it saves the meet flag. This predates this change, production is unaffected, and nothing here alters it.
10. Blink timing is read from the animation's own clock. Sampling every frame, or on a timer, can miss a blink about 0.1 s wide while the page is busy, so the timing check does not depend on the sampler.
11. The drawer folds after three idle seconds and stays folded. Both header measurements are taken with it open, so the comparison is like for like.

## Open

- Nothing pushed or merged.
- Phase 3 (`ui=phase3`) was checked at rest: header 112 px, rail and avatar unchanged by seating. The scroll tuck was not exercised. The change adds transforms and absolutely positioned eyelids only, no layout property.

## Orchestrator follow-up 2026-11-21: reload after a long idle

Decision: a reload after a long idle should greet (the learner came back to an open tab). Leaving the tab now records the last time the learner was active, not the unload time (`engine.ts`, `lastActiveAt`). Verified with Playwright's fake clock on a dev server, Chromium, 1440x900: open the room, move the pointer, fast-forward 2 h with no activity, reload: the bound beat plays (`celebrate`) and `oh-youre-here-early.mp3` is requested. Same with 1 minute: no greeting, no voice request. No page errors in either run. LC tests 184 pass after the change (the session test file is counted in the 188-test run above); typecheck exit 0.
