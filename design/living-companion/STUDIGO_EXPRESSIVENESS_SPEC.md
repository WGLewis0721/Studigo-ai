# Studigo Expressiveness Spec — Living Companion v1 (Oct 25 2026)

> Status: ENGINEERING PROPOSAL except where marked APPROVED-BY-OWNER in `RECONCILIATION.md`. Owner-approved: reference range (Muse/Jolly, OpenAI dots, Coucou, Pokemon GO buddy, Grok companions' head turning + eye movement), personality blend (Sonic + Ms. Frizzle + Pikachu + Krypto as original motion/voice rules, no copied likeness or sounds), mood meter, existing voice, no wings. All numbers not cited to Coucou are starting guesses for LC-1 tuning.
Status: proposal. No repo changes made. Companion: orange dragon (cream belly, big warm eyes, ivory frill ears, teal scholar vest, crayon-flame tail). Studigo is an ORIGINAL character: personality traits below are *inspirations translated into motion rules*. Never copy those characters' likeness, catchphrases, sounds or designs.

## 0. Hard guards (apply to every section)
- Companion reads recorded learning events only; never writes grades, mastery, stars or stage advances.
- No camera, mic, or pointer-tracking of the child's face. Gaze targets are UI elements and touch points only.
- No answer leaks: reactions never preview correctness before the engine records it; hints come only from existing hint system.
- Kid-safe: no romance/affection-meter mechanics (Grok Ani-style is explicitly out), no guilt ("I'm sad you left"), no punishment animations.
- prefers-reduced-motion + in-app "Calm mode" honored (section 12).
- Personalization (name, pronouns, interests) comes only from study room / onboarding settings; no new memory store.

## 1. References: what sources actually show
| Ref | What it is (assumption) | Documented dimensions | Source |
|---|---|---|---|
| Muse | Meta's Muse agent, default mascot "Jolly/Jollybot" (Sept 2026) | Plush rotund body, rosy cheeks, big eyes; customizable name/appearance/outfits "with matching animations"; **working-status animations** (e.g., typing at keyboard, headphones while working); Muse Realtime Avatar = audio-driven diffusion video with facial, hand, full-body gesture + lip sync. App is 18+. | axios.com 2026/09/25; nbcnews; businessinsider; research.meta.ai "Bringing your Muse to life" |
| Dots | Assumed OpenAI "dots" (ChatGPT always-on agent characters). Alt match: dotsui.dev "Pebble" SwarmAvatar demo | dots: customizable shape, color, eyes, glasses, accessories. Pet sprite system (Codex hatch-pet / Dotsona): **9 animation states** (idle, waving, jumping, failed, waiting, running, review…) and **16 look directions** in an 8x9 atlas of 192x208 cells. Pebble: expression prop (curious, dizzy…), follows pointer, "surprise", explode->dizzy action, speech amplitude prop. | learn.chatgpt.com/docs/dots; dotsona.com guide; openai/skills hatch-pet SKILL.md; dotsui.dev/showcase/avatars |
| Pokémon GO | Buddy Adventure | Buddy walks on map; **Mood** (Neutral>Content>Happy>Delighted>Excited) from recent interactions, decays ~1 EP/25 min; permanent Buddy Levels (Good/Great/Ultra/Best); play = pet in AR until it "spins and jumps with delight"; treats, presents, souvenirs, "buddy wants to visit" a place. | niantic help center; Bulbapedia Buddy Pokémon |
| Grok companions | Ani, Rudi/Bad Rudi (3D, voice) | Emotion tool list: curiosity, shyness(blush), excitement, love, stress, sadness, frustration; moves: spin, sway, peek(come closer), heartbeat; background/music changes; Rudi praised for arm-crosses/eye-rolls. Affection meter gates outfits/NSFW -> **reject for kids**; keep only emotion list + moves + scene changes. | gist "Grok Companion Extracted Params" (third-party extraction, unverified official); aicompanionguides; testingcatalog |
| Grok Bot mascot | Unclear | **Unverified**: no public doc found describing Grok Bot's own mascot animation set. Treated as "status-aware working animations" like Muse. | none |
| Coucou (Mochi) | Fork WGLewis0721/coucou | 11 states (idle, working, thinking, searching, approval, question, error, finished, ratelimit, sleeping, dizzy); 7 emotes (love, surprised, proud, wink, yawn, happy, annoyed); eye shapes pill/wide/flat/happy/tired/closed/spiral (+heart/star/wink/cup for emotes); per-state flags bounces/breathes/sweat/zz/scans/tilt/look; particles heart/star/spark/sweat/z; mouth spring ω0=2π/0.25 ζ=0.6; soft-part spring k=60 c=9; 112-BPM dance bounce; IntroView.swift Beats (snap/drift/look gaze, pop/squint/ease eyes, hop/squash/shiver body, double take); breath sin(t*2.4)*0.022; shiver sin(t*70)*0.035 over 0.28s; ~1,158 lines of outfits. LICENSE-ASSETS reserves Mochi's look/animations: borrow numbers & structure, not art. | windows/src/core/layout.ts, windows/src/mochi/engine.ts, NotchBuddy/Sources/Phone/IntroView.swift |

### REA verdict
REA (WGLewis0721/rea) is an MCP for evidence-backed RE of binaries, Electron/JS bundles, Android resources, HAR captures and runtime traces "without source code". Its own skill says skip it for ordinary source repos. For Coucou (open source) it adds only a call graph; plain source reading gives everything. Where REA *could* add value: inspecting closed apps (e.g., Muse or Grok iOS bundles' animation assets/state names). **Not recommended**: ToS/IP risk and Studigo needs original behavior, not cloned assets.

## 2. Dimensions matrix (reference -> Studigo target)
| Dimension | Best reference | Studigo target (v1) |
|---|---|---|
| Expressions | Coucou 11+7, Grok 7 emotions | 14 faces (sec 3), continuous blend, not swaps |
| Emotes/beats | Coucou Beats | 12 choreographed beats (sec 4) |
| Gaze | dots 16 directions, Pebble pointer-follow | continuous 2D gaze, 5 targets (sec 5) |
| Idle personality | Coucou random blink/look, PoGO buddy | 3-tier idle ladder + 10 idle vignettes |
| Locomotion/dock | Muse status strip, PoGO walk-with | floating + strip dock, dash, hop, peek, curl |
| Learning reactions | (none in refs) | 9 recorded-event reactions (sec 6) |
| Mood | PoGO Mood | session-only "Spark" energy 0-4, decays, never punishes, never persisted to mastery |
| Outfits/props | Muse, dots, Coucou wardrobe | vest variants, hats, goggles, cape; subject props |
| Particles | Coucou heart/star/spark/sweat/z | crayon sparks, speed lines, stars, hearts, zz, question bubble |
| Sound/voice | Grok voice, Muse voice | chirps + TTS lines; mouth by TTS amplitude only |
| Scene | Grok bg changes | optional subject-themed backdrop pulse on celebrations |

## 3. Expression set (kid-friendly names; continuous channels)
Each = target values for channels: eyeOpen, eyeSize, pupil, brow, mouthCurve, mouthOpen, cheekGlow, earAngle (frill), tailWag, flameSize, bodySquash, tilt.
Sunny (default happy), Curious (head tilt, one frill up), Thinking (eyes up-left, mouth side), Focused (narrow eyes, flame steady), Wow (surprised: big round eyes, frills straight up), Proud (chin up, star eyes, puffed chest), Giggly (happy-closed eyes, bounce), Heart-eyes (love), Winky, Sleepy (yawn), Oopsie (sheepish: tiny sweat drop, frills back, grin), Hmm (gentle puzzled, never "annoyed"), Brave (hero pose, cape flutter), Cozy (calm, slow breath). Optional mild "Grumpy-cute" only for playful game losses vs companion, never at the child.

## 4. Beats (choreographed sequences, Coucou Beat model)
Beat = {gaze target, gazeMode snap|drift|look, eyes scale, eyeMotion pop|squint|ease, body hop|squash|shiver|spin|dash, hold s}. All end in REST.
hello, double-take, zoom-in (Sonic dash from offscreen), wonder-gasp (Frizzle), cheek-spark (Pikachu-style but crayon sparks from cheeks), hero-landing (Krypto), tail-helicopter, spin-and-jump (PoGO pet delight), peek, yawn-stretch, hat-tip, "let's go!" lean.

## 5. Gaze
Targets in priority: active question card > child's last tap point (≤1.5s) > hint button when hint system offers one > random wander (amplitude 0.6, every 2-6s) > player center. Saccade = snap spring; slow look = drift. Blink every 2.5-6s, 22% double blink (Coucou). No face/camera tracking.

## 6. Learning-event reactions (recorded events only; fire AFTER engine commits)
| Event (source) | Reaction | Duration |
|---|---|---|
| answer_recorded correct | Sunny hop + 3 crayon sparks, chirp "yip!" | 0.8s |
| correct, fast (engine flag) | Sonic zoom-loop + speed lines | 1.0s |
| answer_recorded incorrect | Oopsie->Curious, Frizzle line "Ooh, a mistake! Let's look closer." No red, no sad. | 1.2s |
| stall (no input ≥ N s, engine/GL08 event) | Thinking lean, gentle peek at question; at 2N, point toward hint button if offered | loop |
| streak 3/5/10 (recorded) | tail-wag escalation -> Proud -> hero-landing at 10 | 1-2s |
| return (session_start after gap) | Krypto bound-in + hello beat, greets by the name from onboarding settings | 1.5s |
| mission_complete / celebration | spin-and-jump + confetti crayons + optional outfit flash | 2.5s |
| hint_opened | Curious nod, glasses on | 0.6s |
| idle_long / app backgrounded | Sleepy -> curl in dock with zz | - |
Single shared event enum with GL08 (miss, hit, stall) — one reaction system, owned jointly with Yellow Ranger's UX08.

## 7. Idle ladder
0-8s: breath + blink + micro-gaze. 8-30s: vignette every ~10s (chase tail flame, doodle with tail, adjust vest, read tiny book, stretch, sniff the question, sit-wag). 30-90s: Sleepy. >90s: curled sleep (zz). Tap anywhere wakes with Wow.

## 8. Locomotion / dock
Floating dock: drag with spring follow (soft lag k=60 c=9), frame and dragon move as one; settles where released (free, normalized position, safe-area clamped; no forced corner snap); keyboard arrow-key alternative. Strip dock: constrained motion (lean, peek over rail, hop in place). Transitions: dash (Sonic), flame-hop (tail flame puff, NO wings), bound (Krypto), curl (sleep). Touch: pet = spin-and-jump after 1.5s stroke (PoGO); poke = giggle; long-press = hold-hands wave.

## 9. Outfits, props, particles
Outfits (APPROVED-BY-OWNER, v1): lightweight school-subject options as layer swaps on rig slots (head, eyes, neck/back): science goggles, history explorer hat, math visor, reading glasses + book cape, art beret, music headphones, civics sash. Cosmetic only; selected in room settings or onboarding; never unlocked by stars, mastery or progress; no purchases; original, kid-safe art; ≤1 extra draw layer per slot, no per-outfit animation sets.
Particles (max 24 live): crayon-spark, star, heart, speed-line, zz, question-bubble, sweat-drop(tiny). Pooled.

## 10. Sound & voice (no mic)
Chirp bank (8-12 original short dragon vocal cues, Pikachu-like brevity, NOT Pikachu sounds), whoosh, sparkle, tail-thump. Voice (APPROVED-BY-OWNER, Oct 25): Studigo's voice will come later from the promo video narration; no TTS engine is assumed. Mouth movement is a provider-agnostic plug-in:

```ts
type MouthDriver =
  | { kind: "amplitude"; sample(): number }            // 0..1 per frame
  | { kind: "visemes"; track: { tMs: number; viseme: string }[] }
  | { kind: "boundary"; onWord(cb: () => void): () => void }; // fallback pulse
```
Until the voice ships (task LC-10), only the boundary fallback and silent idle mouth are used. Earlier note: On `main` 056066f the only speech path found is browser `speechSynthesis` in `apps/web/components/room/read-aloud-control.tsx`; companion `speech` pref controls text bubbles. `speechSynthesis` exposes no audio samples, so true amplitude lip-sync needs an audio-element voice source; with `speechSynthesis` use `boundary` events to pulse mouthOpen (OPEN, see reconciliation C9). Mouth spring ω0=2π/0.25, ζ=0.6 (Coucou). Lines ≤8 words, reviewed, kid-safe. Global mute + volume from settings.

## 11. Springs & easing (named, tunable)
| Name | ω0 / k,c | ζ | Use |
|---|---|---|---|
| GAZE_SNAP | k=300 c≈24 | ~0.7 | saccade, double-take |
| GAZE_DRIFT | k=40 c≈9 | ~0.7 | slow look |
| GAZE_LOOK | k=120 c≈16 | ~0.73 | normal look |
| EYE_POP | k=260 c≈14 | ~0.45 | Wow/pop overshoot |
| SOFT_PART | k=60 c=9 (Coucou) | 0.58 | frills, tail, cape lag |
| MOUTH | ω0=2π/0.25 (Coucou) | 0.6 | talk/mouth |
| BODY_SQUASH | k=220 c≈12 | ~0.4 | hop landing |
| DOCK_FOLLOW | k=90 c≈15 | ~0.8 | drag follow |
| BREATH | sin(t*2.4)*0.022 (Coucou) | - | idle |
| SHIVER | sin(t*70)*0.035 decay 0.28s (Coucou) | - | excitement |
| DANCE | 112 BPM (Coucou) | - | celebration bounce |
Values not from Coucou are starting guesses to be tuned in the feasibility test. Integrate with 2 half-steps/frame, dt capped at 1/30 s (Coucou practice).

## 12. State machine & blend rules
Layers (top wins per channel, additive where marked): L0 REST pose -> L1 base state (idle/listening/thinking/sleeping/docked-strip/dragging) -> L2 mood tint (Spark 0-4: amplitude of idle bounce/wag) -> L3 reaction/beat (one at a time, queue max 2, drop older) -> L4 additive procedural (breath, blink, gaze, soft parts) -> L5 lip-sync.
Rules: every reaction returns to REST then base (John Kim "rest pose" rule); expression blend 120-200 ms crossfade on channels; interrupts allowed only by higher priority (celebration > hit/miss > streak > touch > idle vignette); no reaction during an answer being graded; cooldown 4s for identical idle vignette.
Reduced motion / Calm mode: disable dash, spin, shiver, speed lines, particles >4, camera-like zoom; keep expressions with 300 ms fades, blinks, small nods; chirps optional; no autoplay loops >5s.

## 13. Personality -> motion/voice rules
- **Sonic (speed, cocky-kind)**: dashes with speed lines when changing place; foot-tap + glance at clock when stall is long ("Ready when you are — I'm fast, but you're smart!"); fast-correct earns zoom-loop. Never mocks slowness; impatience is directed at the clock, not the child.
- **Ms. Frizzle (curious teacher)**: on miss, Wow-curious not sad; "Mistakes are clues! Let's explore."; puts on explorer hat at mission start; wonder-gasp at new topics; outfit matches subject.
- **Pikachu (cute, emotive cues)**: frill-ear and tail tell feelings (ears up = curious, back = oops, wag = happy); cheek crayon-spark on joy; short chirps instead of words for 60% of reactions.
- **Krypto (loyal hero)**: bounds in on return; sits beside the active card ("I've got your back"); hero-landing for big wins; protective stance when child struggles 3x (stands between child and question, offers hint button glow). 
Voice style: upbeat, short, encouraging; no sarcasm toward the child.

## 14. Rig/runtime recommendation
**Rive (state machine + bones + blend states, web @rive-app/canvas + iOS/Android runtimes)**, with Studigo's event bus driving Rive inputs (numbers/triggers) and the procedural layer (gaze, springs, lip-sync amplitude) set via inputs each frame. Reasons: continuous blending, bones/meshes for frills/tail, one asset across platforms, designer-editable, ~small runtime. Alternatives: layered Canvas/SVG rig (Coucou-style; full control, but blending and authoring cost high); Spine (strong but license fee); 3D (Three.js/VRM) — richest (Grok/Muse-like) but heavy for kids' devices and diverges from the 2D art; Lottie — no runtime state blending; generative video (Muse Realtime Avatar style) — not feasible/safe on device.

### 3-5 day feasibility test
Day 1: split dragon art into ~20 parts (head, 2 eyes w/ lids+pupils, brows, mouth set, 2 frills, body, belly, vest, 2 arms, 2 legs, tail 3 segs, flame); bone it in Rive. Day 2: 6 expressions (Sunny, Curious, Wow, Oopsie, Proud, Sleepy) as blend states; gaze 2D blend. Day 3: 3 beats (hello, hit hop, miss oopsie->curious) + REST return; JS driver with SOFT_PART, GAZE springs; reduced-motion toggle. Day 4: embed in a throwaway Next.js page in both docks; amplitude lip-sync from a TTS clip. Day 5: measure + side-by-side review vs Coucou/dots/Muse clips.
Acceptance (all must pass): 
1. ≥6 expressions with crossfade ≤200 ms, no popping (frame review).
2. Any reaction interrupted mid-play returns to REST within 400 ms without glitch (scripted 50 random event sequences).
3. 60 fps sustained (p95 frame ≤16.7 ms, companion script ≤2 ms/frame) on iPhone 12 Safari and a $150 Android (e.g., Moto G) Chrome; ≥30 fps floor on low-end.
4. Rive file ≤300 KB, runtime+wasm ≤250 KB gz, memory ≤40 MB added.
5. Reduced-motion: zero translations >8 px, no particles, verified via prefers-reduced-motion emulation.
6. Lip-sync: mouth tracks TTS with ≤80 ms lag.
7. Zero writes to mastery/grade tables (test asserts no API mutations from companion module).
8. William + 2 kids rate "feels alive" ≥4/5 vs current static images (subjective gate, William signs off).
Go/no-go: fail 3 or 4 -> try layered Canvas rig; fail 1/2 -> rig authoring issue, extend 2 days max.

## 15. Open questions
1. "Dots" = OpenAI dots (assumed) or dotsui.dev Pebble? "Muse" = Meta's Jolly (assumed)?
2. Grok Bot mascot: which behaviors does William mean? No public spec found.
3. Who authors the Rive rig (designer, William, or AI-driven Rive like the John Kim demo)?
4. Voice: generic TTS voice for Studigo, or a designed character voice? Speech in v1?
5. Does a session-only "Spark" mood meter fit, or should mood be purely reactive?
6. Merge GL08 and Phase 4 event enum now (needs Red Ranger to assign Yellow/Blue)?
