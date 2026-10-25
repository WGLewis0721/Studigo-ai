# Living Companion -> current code: integration map
Source: WGLewis0721/Studigo-ai `origin/main` @ 056066f (2026-10-21 17:46 CT), local clone, read-only. Plan: studigo-repo-package/implementation/LIVING_COMPANION_V1_PLAN.md (LC-3/5/6/7 rows, lines 37-42).

## 1. What exists today (verified)
- `apps/web/components/companion/companion.tsx` (116 lines): `CompanionContext`/`useCompanion` (L12-24, API = `event(name)`, `thinking(on)`; SILENT no-op default), `useCompanionWindow` (L31-96, creates engine, try/catch "safely" kill switch L46-56, kill flag `NEXT_PUBLIC_STUDIGO_COMPANION=off` L60, dev hook `window.studigoCompanion` L75), `RoomCompanionSettings` (L99-116: speech, seated).
- `components/companion/engine.ts` (724 lines): imperative DOM engine, no React per frame. `CompanionHandle` L18-26 = event/thinking/setTone/setPrefs/destroy. Renders 15 stacked `<img class="cmpPose">` WebPs + CSS eyelids (L87-115), lazy-loads poses. Owns drag, resize, pet/poke, bubble, particles (heart/spark/zzz), idle lean/sleep, seat mode (`seatSpot` -> `.chatMascot` L174), Phase 3 control-safe auto-seat (L221-235), menu card incl. "Fade while I scroll" = `tuck` (L538, L603). `event()` L671-684, `thinking()` L686-692.
- `lib/companion-logic.ts` (201 lines, pure, unit-tested in `companion-logic.test.ts`, 204 lines): `Dock` corners L11, poses L32-39, `dirPose` gaze octants L44, `chooseDock`/`controlSafeDock` L71-95, `CompanionEvent` = correct|wrong|blindspot|setDone|cardGood|cardMiss (~L128), `reactionFor`, `idleStage` (60s lean / 180s sleep), `CompanionPrefs` {speech, seated, tuck, dock, scale}, `DEFAULT_PREFS`, `parsePrefs` (lenient, defaults on malformed).
- `lib/companion-prefs.ts` (60 lines): localStorage `studigo.companion.<roomId>` (per room) + `studigo.companion.scale` (per device), `useSyncExternalStore`.
- `components/companion/stage.tsx` (196, Home full-body stage, `app-home.tsx`), `figure.tsx` (stills), `studigo-mascot.tsx` (header avatar/seat, used in mode-header, coach, quiz, learn, cram, loading, error).
- Assets: `apps/web/public/mascot/companion/` 25 files (15 waist-up WebPs, 10 `full/` WebPs, mark.jpg).
- Event emitters: `quiz-panel.tsx` L174 (correct/blindspot/wrong, after grading payload), L185 setDone; `cards-panel.tsx` L194-196; `thinking` from `workspace.tsx` L172, `coach-panel.tsx` L163, `learn-mission.tsx` L104. Engine also listens to `studigo:quiet-feedback` DOM event (`lib/quiet-feedback.ts` L39).
- Mount: `workspace.tsx` L170 hook, L253 Provider, L317 `<div className="cmpHost">`. Rail = `StudigoRail` in `mode-header.tsx` L105/L205 (aria-hidden decoration).
- Flags: `NEXT_PUBLIC_STUDIGO_COMPANION` (off switch); `NEXT_PUBLIC_STUDIGO_PHASE3_FOUNDATION_UI` + per-room allowlist `lib/phase3-room-flag.ts` L7; engine detects Phase 3 via `.roomDevice[data-ui="phase3"]`.
- `room/read-aloud-control.tsx` (55 lines): browser `speechSynthesis` only, no audio graph, not connected to companion.

## 2. Stays / wrapped / replaced
| Current | Fate |
|---|---|
| `CompanionContext`, `useCompanion`, `CompanionApi` | STAYS (public seam; all panels untouched). Add optional `event` names only. |
| `useCompanionWindow` safely/kill switch/LEAP_KEY | STAYS; picks renderer by flag. |
| `CompanionHandle` | STAYS as façade; add `setMotion?`, `setOutfit?` optional methods. |
| `engine.ts` host/chrome (drag, resize, menu, bubble, seat, control-safe placement, tuck fade) | STAYS; pose-swap internals (`setPose`, `poseEls`, `spriteFor`, lids) WRAPPED behind renderer. |
| `react()`, idle lean/sleep, streak, `reactionFor` | REPLACED by motion director when flag on; kept verbatim as fallback path. |
| `companion-logic.ts` geometry (`chooseDock`, `controlSafeDock`, `dirPose`) | STAYS; `dirPose` becomes gaze input (continuous x/y for Rive, octant for WebP). |
| WebP sprites | STAY as fallback renderer + reduced-data/Rive-load-fail path. |
| `stage.tsx`, `figure.tsx`, `studigo-mascot.tsx` | UNCHANGED in v1 (not in plan scope; flag as later). |
| `read-aloud-control.tsx` | UNCHANGED; LC-8 MouthDriver is separate, voice wired in LC-10. |

## 3. Adapter seam (proposal)
```ts
interface CompanionRenderer {
  mount(stageEl: HTMLElement): Promise<void>;   // inside .cmpStage
  apply(frame: MotionFrame): void;              // expression, gaze{x,y}, beat, mouth, outfit, mood
  setPaused(p: boolean): void; destroy(): void;
}
```
`SpriteRenderer` = current img/lids logic moved out of engine.ts (maps expression->nearest WindowPose, gaze->`dirPose`). `RiveRenderer` = canvas in same `.cmpStage`, lazy-imported. Mount failure -> SpriteRenderer. Director (pure TS, LC-2, `lib/companion-motion/`) owns one RAF clock; engine calls `renderer.apply()`; React never renders per frame.

## 4. Prefs migration (`companion-logic.ts` parsePrefs + `companion-prefs.ts`)
Add `v: 2`, `pos: {x,y}` normalized 0-1, `outfit: string|null`; keep `dock` written for rollback. Legacy read: no `pos` -> derive from `dock` via `spot()` corner. Motion is a FLAG, not a pref, except a user "Calm mode" (reduced motion) bool. Unknown fields must be ignored by old `parsePrefs` (it is already field-picking, verified L95-106) so rollback is safe. `controlSafeDock` needs a free-position variant (LC-5).

## 5. Events into director (read-only)
Existing `api.event` -> engine `event()` -> `director.onEvent()`; `thinking` -> director state. Extend `CompanionEvent` additively (hit/fastHit/miss mapping from correct/wrong/blindspot; `stall`, `celebrate`, `return`, `hint` from GL02/Guided Learn). Emitters stay post-grade (quiz L174 fires after payload). Director has no imports of fetch/supabase/mastery (import-boundary test, LC-2). Mood meter in-memory per session inside engine instance.

## 6. Two hosts, one controller
One `createCompanion` instance per room = one director + one renderer. `host` mode = `"float"` (today's window, free pos) | `"strip"` (new slot). Mode switch re-parents the `.cmpStage` node, not a new engine, so mood/state persists. GAP: no "strip between nav and colored rail" element exists on main; `StudigoRail` (mode-header L105) is aria-hidden decoration. LC-6 must add a slot in `mode-header.tsx` and LC-0 must record that geometry. Note `prefs.tuck` today = fade-on-scroll, NOT Phase 3 seating; Phase 3 behaviour is transient auto-seat in `controlSafeDock` (engine L221-235). Strip must preserve both.

## 7. Flags & rollback
New `NEXT_PUBLIC_STUDIGO_COMPANION_MOTION` (off default, optional room allowlist reusing `phase3UiEnabledForRoom` pattern). Off -> SpriteRenderer + legacy reactions (byte-identical behavior target). `NEXT_PUBLIC_STUDIGO_COMPANION=off` still removes him entirely. Runtime fallback: Rive load/throw -> sprite; engine throw -> existing `safely` kill. No DB changes.

## 8. Test impact
- `lib/companion-logic.test.ts`: `parsePrefs`/`DEFAULT_PREFS` equality assertions will break when fields are added -> update; dock/gaze tests should pass unchanged.
- `quiet-feedback.test.ts`, `mobile-lessons.test.ts` reference companion; check after event changes.
- No Playwright/e2e spec for the companion found in tracked files (searched names with e2e/spec/playwright). Visual parity must be new (LC-3).
- `phase3-room-flag.test.ts` unaffected unless reused for motion allowlist.

## 9. Risks
1. engine.ts is 724-line monolith; extracting sprite code risks regressions in placement/seat (no e2e net).
2. Rive bundle/WASM size + canvas on low-end Android; must lazy-load only when out of seat.
3. Strip host has no existing anchor; header layout change touches Phase 3 UI.
4. Prefs written by new build read by old build: keep `dock` in sync.
5. Art continuity: Rive/Higgsfield dragon must match 25 existing WebPs or fallback looks like a different character.
6. Home `stage.tsx` and header `StudigoMascot` stay static -> inconsistency until a later phase.
7. `wrong`/`blindspot` must never lower mood (MOOD_METER rule) — enforce in director tests.

## Not verified
PR/branch state on GitHub (no auth), Vercel prod SHA, CSS for rail/strip geometry, stage.tsx internals.
