# Studigo v2 — Phase 4: Living Companion execution plan

**Status:** APPROVED visual/interaction direction; PLANNED engineering execution; NOT IMPLEMENTED, NOT TESTED, NOT DEPLOYED.  
**Plan owner:** Studigo companion presentation and interaction.  
**Document date:** 2026-10-16.  
**Target:** responsive Next.js web/PWA, real iPhone Safari first, iPad/desktop parity; renderer-neutral motion contract for a future Expo/React Native client.  
**Source of truth:** current verified code, tests, signed-in behavior and build/deployment evidence take precedence over this plan.  
**Technical research:** [Coucou/REA behavior extraction](../design/phase4/COUCOU_REA_BEHAVIOR_EXTRACTION.md).  
**Existing companion product contract:** [companion parity plan](../docs/COMPANION_PARITY_PLAN.md).  
**Visual identity:** [mascot brand authority](../docs/brand/mascot/README.md), [design system](../docs/DESIGN_SYSTEM.md).

> This is the **single executable Phase 4 plan**. The Coucou/REA document is technical research, not a second delivery queue. Do not interpret concept footage or a passing unit test as production acceptance. Implementation must start from the verified Phase 3 release, not assume its current open PRs have shipped.

## 0. Product decision: what is approved

Studigo is the **same original orange dragon** in two mutually exclusive Study Room presentations, selected through the existing companion preference flow:

1. **Floating, repositionable companion dock.** A self-contained small window containing the waist-up dragon; its frame, controls and dragon move as one unit, can be resized/minimized, and stay clear of reading, answer choices, citations, input and navigation. Pointer/touch dragging changes its visible position, and that position persists. The dragon remains independently alive inside the window.
2. **Fixed companion strip.** The same waist-up dragon remains anchored **between the Study Room navigation bar and the colored horizontal divider/rail**, on the strip's right end, with no extra floating window. The header/rail stays structurally fixed while Studigo blinks, looks toward learning content, tilts, gestures modestly, and returns to idle. It must honor the established Phase 3 strip tuck/expand behavior without clipping the mascot or moving the rail.

**Only one interactive companion at a time.** The old header seat is the compatibility/fallback surface; it is not permission to show a second duplicate dragon while the floating dock is active. On narrow screens, retain the appropriate compact seat/strip fallback if the full strip would consume the reading area. A toggle must return the user to the other presentation without resetting learning state.

### Approved motion reference artifacts

These are the owner's approved **concept and movement direction**; they are not pixel-perfect specifications of the real production layout, runtime proof, or a license to redesign the Phase 3 Study Room:

| Reference | Approved behavior | Provenance/limit |
| --- | --- | --- |
| [Character-only living Studigo, 12 s](https://d8j0ntlcm91z4.cloudfront.net/user_3IkKBBXHZvEZQt2d8pBaRYd083T/hf_20261015_163130_6647ad5b-1046-436d-85a2-f420df05c498.mp4) | Natural gaze, blink, head movement, pet reaction, restrained celebration, follow-through | Higgsfield visual concept; not rigged app code |
| [Floating dock, approved 12 s](https://d2ol7oe51mr4n9.cloudfront.net/user_3IkKBBXHZvEZQt2d8pBaRYd083T/868d115b-2c32-43ec-b409-3bca35fd1c8d.mp4) | Complete window relocates, settles and contains independently animated Studigo | Higgsfield character motion plus deterministic motion-editing pass; UI is a recreated concept |
| [Fixed-strip, approved 12 s](https://d8j0ntlcm91z4.cloudfront.net/user_3IkKBBXHZvEZQt2d8pBaRYd083T/hf_20261015_174105_32b24696-7b5c-4407-bcd0-3f8d622575ce.mp4) | Small expressive Studigo remains anchored above the colored rail | Higgsfield concept; UI is recreated, not a production capture |

Reference job IDs: character **6647ad5b-1046-436d-85a2-f420df05c498**; floating source **32a4c8db-e86b-4a06-85ec-a5dca392125b**, final **868d115b-2c32-43ec-b409-3bca35fd1c8d**; strip **32b24696-7b5c-4407-bcd0-3f8d622575ce**. Keep approved samples available for review; external media availability can change, so obtain owner-authorized permanent internal copies before production acceptance.

### Outcomes and non-goals

**Outcomes:** (a) character feels continually alive; (b) two UI homes exactly communicate floating vs embedded behavior; (c) no visible pop between directional sprite poses; (d) equivalent personalities and reactions on Learn, Coach, Practice, Progress, Plan and Materials without interfering with study; (e) the existing client learning event contract remains authoritative; (f) graceful reduced-motion, performance, failure and rollback behavior.

**Not in Phase 4:** rebuilding Study Room/navigation, adding a second chat or learning policy, speech synthesis/lip-sync, new reward/XP/bond/currency rules, grades or mastery writes, self-directed camera/microphone analysis, reproducing Mochi's art/expression designs, shipping native iOS, Moon Keep/Core Clash integration, inventing another mascot, and generating dozens of unrelated pose images.

**Avatar anatomy:** Studigo uses a **paw/forearm gesture**, not wings. He has no added wings in the approved reference. Preserve ivory frills, orange/cream body, teal embroidered vest, original eyes/face and crayon-tail flame. Do not blindly copy the research note's earlier abstract channel label “wingGesture.”

## 1. Baseline, constraints and dependencies

### Verified code owners at planning time

| Existing owner | Responsibility and Phase 4 integration |
| --- | --- |
| apps/web/components/companion/engine.ts | Today: creates floating DOM/window, handles pose swaps, 320 ms behavior heartbeat, drag, pinch/resize, dock positioning, gaze, idle, thinking, pet/poke, speech and effects. **Keep its lifecycle/UI-control responsibilities**; replace *only its pose/rendering decision* behind a flag. |
| apps/web/components/companion/companion.tsx | Existing CompanionContext/CompanionHandle event/thinking bridge and host. **Retain the interface** while adapting internals; no second companion host. |
| apps/web/components/companion/companion.css | Window, stage, seat and CSS effects. Preserve legacy class/fallback behavior. |
| apps/web/components/companion/stage.tsx | Home full-body counterpart. Ensure appearance/event parity after the Study Room work; avoid coupling its stage layout to header geometry. |
| apps/web/lib/companion-logic.ts | Current typed events, poses, reactionFor, dockFromDrop, collision handling, idle timing. Extend/reuse rather than duplicate rules. |
| apps/web/lib/companion-prefs.ts | Browser-local per-room choices plus global device scale; existing seated/dock settings. Migrate compatibly, no Supabase schema needed. |
| apps/web/components/room/workspace.tsx and mode-header.tsx | Existing Study Room and header/frame owner, **not** animation engine. Place one fixed-strip host at the actual strip between top nav and colored rail, preserving focus/nav behavior. |
| apps/web/public/mascot/companion and design/companion-demo/assets | Current shipped WebP sprites and canonical generation source. **Legacy fallback and rig source**, not final procedural runtime. |
| docs/brand/mascot/reference | Canonical identity and expression/pose references; never casually regenerate the mascot. |

Actual names/layout **must be rechecked against the Phase 3 landing SHA before coding**. In particular, the header strip and CSS may change while PRs are open.

### Phase 3 sequencing gate (hard blocker for integration, not for research)

As observed on 2026-10-16, [Phase 3 completion PR #197](https://github.com/WGLewis0721/Studigo-ai/pull/197) is OPEN; the [guide export label fix PR #200](https://github.com/WGLewis0721/Studigo-ai/pull/200) is stacked on that branch; and [four-width visual evidence PR #196](https://github.com/WGLewis0721/Studigo-ai/pull/196) is draft. The [Phase 3 change ledger](../docs/ux/PHASE3_UI_CHANGE_LEDGER_2026-10-15.md) explicitly says the Coach options/header strip between nav and colored rail has locked desktop expand/tuck geometry: begins at 100%, tucks to 60% after interaction/arrival and returns to full size on hover/focus/click. Phone controls stay full size. **Do not re-tune those proportions to fit Studigo.** Design the anchored character within remaining strip geometry, or demonstrate a safe responsive fallback. Preserve the Phase 3 room allowlist/flag-off semantics.

Before Phase 4 UI integration, record (a) exact merged Phase 3 commit, (b) confirmed CI/deployment/production baseline, (c) accepted Phase 3 four-width, keyboard, signed-in and flag-off evidence, and (d) the authorized rollback ref/deployment. The 2026-10-15 golden checkpoint at docs/golden/2026-10-15 is the earlier **pre-redesign** checkpoint; create a **new post-Phase-3 Phase 4 baseline**, rather than mistakenly presenting the older checkpoint as the current UI.

Phase 4 research, asset inventory, rig prototype and a pure animation engine can run in isolation while Phase 3 is being accepted. Merging code that changes the Study Room/frame must wait for its exact target tree and passing integration gates.

## 2. Target architecture: one brain, two homes

### Authority/data flow

~~~text
Existing verified UI and learning events (read-only)
     |  correct / wrong / setDone / cardGood / cardMiss / thinking / user touch
     v
Existing CompanionContext + typed adapter (presentation-only)
     |
     v
Pure Studigo Motion Director (deterministic event priority + timing)
     |  sends pose snapshot; no network, learning writes or React per-frame setState
     +------> Idle microbehavior scheduler / bounded RNG
     +------> Tween channels + springs / secondary lag
     |
     v
Shared Studigo Rig + Renderer interface
     |
     +------> Floating window host (existing controls/positioning)
     +------> Anchored header strip host (existing frame/rail owner)
     +------> Future Home stage adapter and Expo parity
     |
     v
Visible pixel output; existing WebP system remains full fallback
~~~

Design the core as framework-independent TypeScript modules **adjacent to** apps/web/lib/companion-logic.ts initially, e.g. apps/web/lib/companion-motion/{types,director,timing,spring}.ts. Keep the adapter at apps/web/components/companion/. Only extract a workspace package when a real second consumer (Home/native) and measured reuse justify it; no new rendering/physics dependency before the P4-1 comparison. Canvas2D, lightweight layered DOM/SVG and one small rig library are candidates, not a preselected rewrite. Avoid shipping a large native or WebGL dependency for a 116x138 default window.

The director yields a **read-only MotionSnapshot** and does not own preference persistence, source content, routing, pointer capture, authentication, grades, the AI provider, or app state.

### Minimal motion API and channel contract

The research identifies Coucou's mechanism; the following is a Studigo-designed API, not copied Mochi code.

~~~typescript
type MotionExpression =
  | "neutral" | "curious" | "focused" | "joyful" | "supportive" | "sleepy";

type MotionSnapshot = {
  expression: MotionExpression;
  gazeX: number; gazeY: number;             // [-1, 1]
  headYaw: number; headPitch: number; headRoll: number;
  eyeOpen: number;                          // [0, 1]
  bodyScaleX: number; bodyScaleY: number;
  rootX: number; rootY: number;             // normalized local body offsets
  pawGesture: number;                       // [0, 1] (not a wing)
  softLagX: number; softLagY: number;
};

type MotionInput =
  | { type: "attention"; x: number; y: number; source: "pointer" | "typing" | "content" }
  | { type: "work"; state: "ready" | "thinking" | "explaining" | "waiting" }
  | { type: "result"; name: "correct" | "wrong" | "blindspot" | "setDone" | "cardGood" | "cardMiss" }
  | { type: "touch"; action: "tap" | "pet" | "dragStart" | "dragEnd" }
  | { type: "lifecycle"; state: "visible" | "hidden" | "suspended" | "reducedMotion" };

interface MotionDirector {
  dispatch(event: MotionInput): void;
  advance(dtMs: number): MotionSnapshot;
  reset(): void;
  dispose(): void;
}
~~~

Contract details:
- One main foreground reaction at a time, with per-property tween locks and finite expiry, layered over bounded passive gaze/blink/breathing where safe. Every transient ends in a stable pose; a later high-priority learning event preempts low-priority idle motion.
- Priority: visibility/accessibility safety > genuine learning result > direct user touch > active thinking/reading > gaze > ambient. Do not overwrite an active correct/needs-help gesture with another random idle. Dragging temporarily owns root/gesture motion; final docking settles without teleporting.
- Use explicit finite states and cancelable deadlines, not cascading uncontrolled setTimeout chains. Inject monotonic clock and seeded RNG for repeatable tests. Normalize motion by elapsed time; clamp/substep a paused tab's oversized dt; zero velocity on wake where appropriate.
- Ambient life is sparse and varied: breathing, intermittent blink including occasional double blink, tiny glances, warm micro-smile, small frill/tail idle. No constant bouncing; no autonomous narration; no repeated “sad” response for wrong answers.
- Facial animation needs independent brows/eyelids/pupils and small mouth cues rather than whole-head WebP popping. Gaze begins in the eyes, head follows with a small delay, frills/tail settle later. Support blinks in every direction, not only forward.
- Light effects and a tail-flame glow are optional bounded presentation and are reduced/disabled for reduced-motion. Preserve silent operation when existing speech preference is off.
- Core is read-only: never infer academic correctness from UI strings, LLM output or raw clicks; only react to *committed* result events already owned by Coach/Practice. No new DB writes or credit/achievement mutations.

### Character motion mapping: approved moments

| Learner/system event | Expression/motion | Guard and return |
| --- | --- | --- |
| Ambient, active/visible | Neutral, breathing, occasional blink, little eye glance | Very low activity, immediately interruptible |
| Pointer attention | Eyes move first, head follows, frills lag | Short dwell; target bounded to readable content, no eye surveillance |
| Learner typing / reading | Look toward composer or passage; small thoughtful head tilt | Do not visually imply Studigo has read private text beyond current UI signal |
| Coach thinking | Focused look, subtle stillness, small attentive blink | Cancel immediately on completed/failed work; no fake “thinking” when idle |
| Result correct or good card | Joyful eyes, anticipatory tiny crouch, paw gesture, soft bounce | Only *after* verified event, cooldown on repeated grading; never obscures answer |
| Wrong/needs-help/blindspot | Gentle supportive tilt, inviting eye contact, nonjudgmental smile | No scolding, crying, fake grade claim or exaggerated punishment |
| Finished practice set | Slightly bigger but contained celebration | Uses existing setDone event; no new progress awards |
| Tap/pet | Smile, close eyes briefly, lean into touch, tiny spring settle | Touch action distinct from drag; gesture must not open accidental UI actions |
| Drag whole dock | Dragon stays inside moving frame, glances toward pointer; panel translates smoothly | One pointer/keyboard owner; move cannot delete focus or block content |
| Header strip | Same cues with smaller root motion and paw reach | No animation may displace the rail or shift layout |
| Hidden/reduced motion | Freeze/reduced expressivity, no speculative background loops | Resume with safe time step; preserve event semantics |

## 3. Art and Higgsfield production contract

### P4-1 must answer “do we need more assets?” with a rig audit, not guesswork

Existing shipped sprite sources (waist-up and full-body) and six canonical mascot reference sheets are enough to begin. Inventory exact exported sizes, transparent bounds, alpha/fringe quality, face landmarks, head center, eye positions, paw positions, clothing overlap, left/right turn continuity and anchor points. First determine whether the approved image can be decomposed into layers without changing its appearance.

**Required layers** for a feasible 2D rig: body/chest; independently rotatable head; independent pupils/eyes/eyelids/brows and micro-mouth; left and right paw/forearm; two independently lagging soft parts (e.g. ivory frills and flame-tail); vest front/back occlusion; optional shadow/flame separately. A minimum of front and 3/4 pivot references is acceptable for prototype; don't attempt an expensive 3D character rebuild unless 2D fails. Naming must identify original Studigo parts; no generic “wings.”

**When Higgsfield is used:** condition new material on the exact approved Studigo canonical refs, use identity/shape checks at 1:1 and 116x138, and produce production-ready clean transparent part atlases/reference turnarounds only for demonstrably missing layers. Rendered image/video generation does **not** automatically create articulated bones or exact joint masks; human/engineering layer cleanup, registration, export, test sprites and pivot metadata are still required. Do not regenerate the whole dragon merely to create a blink; prefer moving eye/eyelid parts. Require a “before/after identical neutral pose” pixel/visual review against the approved sprite. Do not ship generated interface screenshots or concept-video frames as production UI assets.

**Deliverables:** asset inventory with existing/missing/reusable status; source licenses/provenance; head/eye/paw/tail/frill pivot sheet; layered 2D rig source; bounded runtime atlas/SVG layers; neutral + curious + focused + joyful + supportive + sleepy expression specimens; final rig decision with comparison and measured impact. Approved visual source always overrides generative invention.

**Licensing boundary:** Coucou's code is MIT, but Mochi-branded characters, art, sounds and protected creative expressions are reserved in [LICENSE-ASSETS.md](https://github.com/WGLewis0721/coucou/blob/main/LICENSE-ASSETS.md). Do not copy Mochi shapes, faces, animations as protected creative assets, voice or sound. If specific MIT code is adapted, preserve required license notices and source attribution. This plan references principles; it imports no Coucou source or art.

## 4. UI host and preference implementation

### Floating dock (production contract)

- Keep the current window look/controls and sensible bottom-right initial preference. A drag moves the **complete bezel and its rendered dragon together**, regardless of pointer or touch input. Keep touch scroll/pet separate from drag; use visible move/resize affordances.
- The concept shows free repositioning **within the valid Study Room safe region**. Today dockFromDrop quantizes to four corners; do not misrepresent corner-only snapping as full repositionability. Propose a versioned safe-area-relative normalized location, e.g. position = { version: 1, x: 0..1, y: 0..1 }; use old four-corner dock enum as fallback for legacy preferences, and chooseDock for avoidance if collisions require a temporary different position. Reflow on resize, browser zoom, mobile visual viewport and keyboard appearance, preserving intent as much as possible. Validate whether existing row/content collision algorithms support arbitrary positions before reusing them.
- Preserve keyboard move alternative, visible focus, Escape/cancel, touch target sizes, pointer capture release, iPhone pinch-to-resize, existing minimize/send-to-strip behavior, speaking-off default, fade while scrolling, and device-scale choice. No content covered by dock, including Send, cited page link, question options, navigation or modal controls; allow moving it to another safe region if crowded.
- Persist within existing browser-local preference model, per room for position and mode, device-specific scale where already owned. Make malformed/stale preferences default safely and preserve backward compatibility with “seated”, “dock” and “scale”. No database migration.
- Render only **one** character surface: when floating is active, the strip must not show a second autonomous avatar; provide a small accessible reopen affordance if required by existing UX.

### Fixed strip (production contract)

- Mount inside the existing room frame **after navigation, before the colored StudigoRail**; don't create a second header/navigation row. The mascot is at the right edge, constrained by responsive strip height and safe face bounds, and can be focused/released through existing controls.
- **Preserve Phase 3 Coach proportion lock**: desktop header/related tools tuck to 60% and restore on focus/hover/click; the rail does not scale. Studigo's pose must not cause relayout, font/geometry retuning, clipping, color-rail displacement or focus traps. Test open, tucked, expanded, and transition positions explicitly. On compact mobile where the header can't safely accommodate him, use the existing accessible small-seat/fallback representation rather than stealing composer height.
- Constrain animation amplitude: blinks, gaze, slight roll/tilt, small contained paw motion; do not let tail flame or frills overflow into controls, rail or transcript. The user can switch back to floating with one clear action; switching preserves the same behavior state/preferences without leaving a duplicate renderer running.
- Study content scrolls beneath the anchored nav/strip/rail per the actual existing scroll containers. Header never tracks the scrolling reading passage as a physical relocation.

### Preference and host state invariants

“Floating” and “strip” are two presentation modes of **one existing companion**, not two independent pet agents. Existing “seated=true” maps to strip/compact seat until changed. “seated=false” maps to floating with saved dock as legacy fallback. Store location only after committed move; never overwrite stored location with temporary obstacle avoidance or a synthetic preview layout. Local storage unavailable => default without crash. Mouse/touch/keyboard controls must not depend on animation engine responsiveness. No chat, mastery, room or topic state is lost when mode switches.

## 5. Executable work packages and dependency graph

**Do not start all tasks at once.** Parallelize the *independent* asset audit and motion-core implementation only after the Phase 4 baseline contract is fixed; integrate serially after Phase 3 merge. Every package yields a standalone reviewable PR and a short evidence ledger entry, not a new planning document.

| ID / gate | Outcome and concrete PR deliverable | Dependency | Completion proof |
| --- | --- | --- | --- |
| **P4-0 — Freeze and baseline** | Record current main + Phase 3 accepted SHA, golden baseline, visual geometry/specimen captures, all flags, current companion behavior/screens, and signed-in device gap; create separate Phase 4 feature branch and scoped release ledger. | Phase 3 can be in progress for docs; **UI integration waits for its acceptance**. | Exact SHAs, status links, fixture labels, rollback path and owner of every touched file. |
| **P4-1 — Visual rig feasibility** | Canonical-art inventory, part extraction/pivots, prototype front/3/4 head, every-direction eyelid blink, one paw cue, two lagging soft parts, renderer comparison (CSS/SVG vs Canvas 2D vs small rig library). No runtime rollout. | P4-0 art baseline; independent of Phase 3 UI merge. | Recorded side-by-side neutral identity, 375/390/768/1440 specimens, actual device frame measurements, chosen renderer and explicit rejected alternatives. |
| **P4-2 — Pure motion director** | Typed state/events, per-property tween/spring, seeded idle scheduler, deterministic advance, priority/expiry/preemption, visibility/reduced-motion policy, unit tests. No DOM, network or grading dependencies. | P4-0 event contract; may run in parallel with P4-1. | Fixture tests for 30/60/120Hz equivalence, pause/resume, priority, cancellation, no write-capable import path, exact event trace. |
| **P4-3 — Renderer & existing adapter** | Rendering rig consumes MotionSnapshot under an independent flag, maintains existing CompanionHandle and all previous WebP fallback behavior. Room still functions with flag OFF. | P4-1 + P4-2 reviewed. | Same-code-commit old/new captures, focus/size parity, no console errors/leaked RAF/listeners, feature flag OFF returns original WebP output. |
| **P4-4 — Floating drag/location** | Moving complete dock, persisted valid location, snap/safe obstacle avoidance, resize/touch/keyboard/focus parity. No change to learning API or room layout. | P4-3 + accepted Phase 3 UI SHA. | Actual drag demonstrated at two starting positions, reload, resize/keyboard, min/max zoom and composer/citation clearance. |
| **P4-5 — Fixed strip** | Strip right-anchor host between nav and colored rail; contained animation and mode switch; preserve Coach 100%/60% tuck and phone full-size controls. | P4-3 + accepted Phase 3 UI SHA, can follow P4-4. | Front/rear layout screenshot at 100%, 60%, focus return; no rail jump/crop or duplicate dragon; room fixture/signed-in control path. |
| **P4-6 — Learning-context gestures** | Exact Coach/Practice event adapter, six expressions, reading/typing/thinking attention, pet/support/celebrate timing; no new learning/reward authority. | P4-4 + P4-5. | Graded-result-only reactions, focus/content switching, 3x rapid events, wrong-answer encouragement, pause/retry and no extra mastery writes. |
| **P4-7 — Polish, parity and canary** | Full room mode/device acceptance, real signed-in source flow, network/perf/accessibility traces, canary flag rollout and live kill-switch/rollback drill; Home stage visual parity if proved safe. | P4-6, product/security acceptance. | Review evidence matrix below, measured budgets, golden comparison, documented canary deployment + toggled-off equivalence; production release only after explicit green gate. |

### Engineering orchestration for coding agents

Roles may be parallel **only when file ownership does not overlap**:
- **Agent A — Visual/rig:** assets, reference alignment, motion pivot metadata, sprite pipeline, renderer comparison. May use Higgsfield for missing references only.
- **Agent B — Deterministic animation:** pure timing, scheduler, state/event contract, tests/fixtures. Owns no DOM, assets or Study Room code.
- **Agent C — UI integration:** starts only after A/B have stable interfaces and the Phase 3 merge is verified. Owns companion hosts, strip placement, preferences, input/focus and responsive CSS; no learning business logic.
- **Integration/review lead:** checks branch SHA and PR ancestry, conflicting file owners, visual fidelity, accessibility/security, production parity, evidence and rollback; merges only after package gates. Leave current Phase 3 branches and unrelated PRs untouched.

Create scoped PRs in P4 order, with explicit target base and small commits. Each PR should state **what changed, why, which owner remains, tested command/result, screenshots/videos at same SHA, remaining failures, and reversible flag scope**. No broad rewrite and no second companion engine. Minimize human intervention for routine implementation, but **pause for user visual sign-off when canonical character identity deviates, the approved dock location behavior cannot be honored, or a change jeopardizes production functionality**.

## 6. Acceptance matrix — what “done” means

Acceptance is based on executed tests and real rendered/interaction evidence, not simply running a build. Collect per-PR and final release evidence with SHA, OS/browser, signed-in vs fixture, screen size, selected flag/mode, results, failures and artifact links.

| ID | Scenario | Expected proof |
| --- | --- | --- |
| **V-01 Identity** | Neutral front, 3/4 turn, curious, focused, joyful, supportive, sleepy | Maintains exact approved face/head/frill/vest/tail anatomy; no AI character drift, no added wings |
| **V-02 Dynamic eyes** | Pointer sweep left/right/up/down/diagonal then out of focus | Pupils move smoothly before head; no sprite popping; blink works in every gaze direction |
| **V-03 Physics** | Pet, hop, small celebration, sudden look turn | At least two independently lagging parts (frills/tail/vest), smooth follow-through and damping, no explosive spring |
| **V-04 State priority** | Rapid wrong -> correct -> thinking -> stop; repeated completion | Real grading feedback wins over idle, stale events expire, no flicker/infinite sequences, eventual steady idle |
| **UI-01 Floating position** | Drag dock at 390px and 1440px; release, navigate, reload | Full framed window moves, saved position restored/rebounded safely, never only the dragon image; no scroll hijack |
| **UI-02 Obstacles** | Composer, citations, answer options, nav, sheet/modal, visual keyboard | Dock does not prevent use/read of the active controls; focus recovers after move/minimize |
| **UI-03 Fixed strip** | Nav -> strip -> colored rail; 100% -> 60% -> 100%; scroll | Anchored at right in strip, rail untouched, no clipping/duplicate avatar, sensible phone compact fallback |
| **UI-04 Switch/compat** | Floating -> strip -> floating, legacy seated/dock/scale local prefs | One companion, same event semantics, preserved prefs and defaults, flag OFF restores original behavior |
| **UX-01 Accessible operation** | Keyboard only, screen reader, focus rings, Escape, touch, 200% zoom, high contrast | Functional controls with labels; no trapped focus or visual obstruction |
| **UX-02 Reduced motion** | OS reduce-motion and page hidden/reopened; battery-saving path | No continuous springs/particles when opted out, stable expression, loop suspended while hidden, no huge-dt snap |
| **LEARN-01 Authority** | Coach/Quiz/Flashcards wrong/correct/set done; guided Learn read | Only real committed result events produce grading celebration; reading completion never generates mastery |
| **LEARN-02 Room safety** | Signed-in learner, room change, document/citation, upload pending/failure | No source text exfiltration, no additional data writes or provider calls, no wrong-room reactions |
| **PERF-01 Motion cost** | 375/390 iPhone Safari; iPad; desktop mid/low hardware; long idle | Baseline vs enabled trace for frame time, CPU, memory, JS bundle and battery/proxy; no input, scroll, typing, or citation regression |
| **REL-01 Kill switch** | Existing global companion OFF, Phase 4 motion OFF, room-specific canary | Legacy sprite companion or completely off behaves as documented; canary disabled without mastery/data migration |
| **REL-02 Production smoke** | Exact merged SHA and READY deployment, signed-in learner sample | Both modes, one verified practice event, tab navigate/reload, open cited page, physical iPhone demo, rollback exercise |

**Provisional nonfunctional targets** (engineering targets, not verified results): animation director processing comfortably under 2 ms per active frame on reference hardware, smooth behavior at display refresh or gracefully throttled 30 fps on less capable devices, no long tasks attributable to the companion during interaction, small bounded sprite atlas/extra JS weight and no persistent timers/listeners when unmounted. Record baseline first and agree budgets from actual device measurements before treating numbers as pass/fail. A 60Hz device has ~16.7 ms per frame for the **entire** app, not for the companion alone. Do not hide dropped frames behind a good average.

Acceptance viewport/condition sweep: 375x667, 390x844, 768x1024, 1024x768, 1440x900; pointer coarse/fine; real Safari on a physical iPhone and iPad; desktop Chromium/WebKit where available; 200% zoom; reduced motion; keyboard navigation; screen reader smoke; low-bandwidth/asset failure; app background/resume; short and long Study Room content. Synthetic /dev/study screenshots are useful for layout comparison **only** and never prove real grading or RLS.

## 7. Safeguards, rollout and rollback

**Flags:** retain NEXT_PUBLIC_STUDIGO_COMPANION=off as the full-companion emergency kill switch. Add a separate Phase 4 motion flag (proposed NEXT_PUBLIC_STUDIGO_COMPANION_MOTION=off by default) so the old WebP renderer can be restored independently of the companion UI. An optional exact room allowlist for signed-in canaries is server-owned and presentation-only; no new academic access. Verify existing Vercel/Next build-time flag semantics and do not claim a value changes production until a new deployment is READY. If enabling the new renderer throws, catch at the companion host and fall back to existing sprite implementation without taking down the Study Room.

**Privacy:** no gaze video/audio collection, no camera, no microphone, no sharing pointer streams off device. Directional pointer targets are transient UI inputs only; do not log coordinate trails, document text, student sentiment profiling or per-child behavioral telemetry. If adding anonymized performance measurement, aggregate counts/timing only with no educational content, and review the minor-data policy. No backend or service-role changes expected.

**Failure behavior:** missing atlas/rig => WebP still works; invalid saved coordinates => safe default; offscreen/mobile-viewport change => clamp and preserve intent; WebGL context loss (if considered) => static fall back; hidden tab => animation loop pauses; animation exceptions => learning UI unaffected; stale result/room switch => cancel active emote; user asks for stillness => fully obey reduced-motion and disable continuous effects.

**Production sequence:** isolated rig demo -> dev fixture -> preview branch with legacy OFF comparison -> limited signed-in canary -> physical iPhone/iPad review -> exact-commit CI and Vercel preview readiness -> verified main merge/deploy -> signed-in smoke and device replay -> wider enablement. Record explicit operator approval for turning on the flag; no quiet default-on change.

**Rollback:** first disable the Phase 4 motion feature and confirm legacy WebP/live learner flow; if failure involves the host/prefs and flag-off is insufficient, revert the Phase 4 PRs to the **post-Phase-3** golden baseline through normal GitHub PR or promote its verified deployment. Do not force-reset main and do not roll back learner database state. Check flag, readiness, saved prefs and interaction smoke after rollback.

## 8. Open decisions and engineering risks

| Risk/decision | Phase 4 default | Trigger that requires escalation |
| --- | --- | --- |
| Rig renderer choice | Decide on evidence in P4-1; prefer the smallest layered 2D implementation | Neutral identity drifts or rendering cost is unacceptable on actual iPhone |
| Additional Higgsfield art | Existing approved sprites first; only generate missing rig layers/key poses | Canonical look is lost, licensing/provenance is unclear or tools produce unsuitable masks |
| Free-position dragging vs legacy corner snap | Honor approved free safe-region movement; migrate old dock preference | Collision/content constraints make a safe position impossible |
| Phase 3 tucked header and mobile strip | Preserve existing proportions/behavior, adapt character scale and compact fallback | Requires changing Phase 3's approved 60% interaction or obscures the composer |
| Native iOS/iPadOS | Share event/motion contract for future Expo client; web P4 release first | Web-only rig decisions make future adapter unreasonably costly |
| Animations vs child learning focus | Subtle when reading, stronger only on real positive events | Reactions interrupt comprehension, induce distraction, obscure evidence or misrepresent mastery |
| Frame-time/bundle cost | Measure P4-1 baseline before adding rendering dependency | Regresses low-end iPhone performance, responsiveness or memory |
| Phase 3 status | Treat PR #197/#200/#196 and ledger gates as unresolved until verified | Any unrelated PR/Phase 3 merge changes structure before integration |

## 9. Completion declaration and handoff requirements

**Phase 4 is DONE only if** P4-0 through P4-7 artifacts are committed, independently reviewed where needed, relevant checks/real-device evidence are green, the approved floating and strip interaction contracts match the shipped UI, the safe fallback and rollback are demonstrated, the exact deployed SHA is READY, and signed-in production smoke demonstrates no learning/citation/mastery regression. The implementation agent must provide reproducible recordings from the **actual app** for both modes; Higgsfield concept footage alone never meets this gate.

The PR handoff should link this plan; the research note; canonical asset manifest; chosen rig spec; versioned motion/input contract; new tests and explicit results; 375/390/768/1024/1440 before-after captures; real iPhone and iPad proof; deployed revision/flags; and rollback evidence. Distinguish VERIFIED, REPORTED and NOT TESTED status per item.

**Current status as of this document:** research complete and owner visual direction approved; implementation work P4-0–P4-7 **not executed**; Phase 3 completion still in progress. This document creates no live feature or release approval.
