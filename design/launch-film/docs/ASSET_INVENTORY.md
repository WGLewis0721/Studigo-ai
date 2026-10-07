# Asset inventory & reference notes — Round 1

## Character (approved by William, Oct 1 2026; `docs/brand/mascot/README.md`)
- Full-body sprites, 540×540 RGBA webp, byte-identical to `apps/web/public/mascot/companion/full/`: center, left, right, up, down, up-right, down-right, wave, leap, celebrate, read.
- Waist-up (400px PNG, `design/companion-demo/assets/`): lean, support, poke, pet, celebrate, sleep. `lean` is used for physical interaction #3.
- GAP: no sprite resolution above 540px exists. At ~800–980px display he is upscaled ~1.5–1.8×. Round 2: test an upscale pass (Higgsfield upscale_image) on a locked sheet. Round 3: final.
- GAP: no true leap-toward-camera, push/shove, or three-quarter turn. Round 1 fakes these with squash/stretch, scale, and the leap sprite. Candidates for Higgsfield: panel-push (Coach scene), camera double-take.

## Real opening (apps/web/components/home/home-motion.tsx, home.css)
1. `introWake` 1s spring: scale .06→1, circle→56px radius, delay .2s.
2. After ~1.25s: he starts off-left (x −42% vw, y 72%, 0.7 size), `fly()` 880ms arc: squash at 14%, lift apex ~55%, rotate −6→+8→+2°, pose `leap`.
3. Lands at 0.86×screen width; 12 spark burst; `wave` pose with `gSway` 1.7s loop; 1.25s hold.
4. Overlay shrinks out; he flies into the phone window.
Film compresses 1–3 to ~2.6s, then breaks the routine (notices camera) and bursts through the phone boundary instead of step 4.

## Brand tokens (globals.css): snow #f7f8fb, ink #141b2d, tangerine #ff8a3d/ink #b24a0a/soft #ffefe2, teal #1fc3b6/ink #09756d/soft #ddf6f3, blueberry #3c7cff/ink #1d5bdb/soft #e7efff, dandelion #ffd23f/soft #fff6d4. Fonts: Bricolage Grotesque (display 800), Figtree (UI); OFL files in public/fonts.

## Reference films — HONEST STATUS
The four links resolve to gallery pages (Revid) and a prompt page (YouMind). Fetching returned titles/metadata only; the video frames could not be watched in this session, so no "three frames per reference" notes can be claimed. Applied instead: the brief's per-reference ingredients (Peggy product clarity → enlarged UI cards; TixFox → chapter color + oversized kinetic type; Muse → hold on the learning payoff; Ajoflow → one code-built motion language, decisive wipes). ACTION for William: send the four mp4s or 6–8 frames each (or approve Higgsfield `video_analysis_create` credits) before Round 2 if frame-level notes are required.

## Round 1 known defects → Round 2 list
1. Studigo is ~70% of frame height in feature scenes (brief: ~1/3 of frame area). Reduce to ~620px and add depth passes.
2. No real front-to-back crossings yet (he never passes in front of a panel); coach "nudge" is a panel animation, not contact.
3. Phone UI in scenes 6–9 and 25–30 is small; enlarge for 9:16 legibility.
4. Gaze/pose changes are sprite swaps; add 2-frame cuts + squash on each, and tail/frill follow-through.
5. No audio yet (scratch VO, licensed music/SFX, silent + music-only exports).
6. 9:16 cut not started.
