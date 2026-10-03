# V3 Learner-Facing Finish Plan

**Scope:** finish the learner-facing V3 simplification on the existing web/PWA before carrying the same product contract into the native iOS/iPadOS client.

This is a product/UI integration pass over the adaptive learning work already in `main`. It does not redesign the learning engine.

## Implementation status — October 2, 2026

Implemented and merged in PR #66 (`0d4ed35`) and deployed through Vercel.

Completed in code:

- three learner-facing Coach modes only;
- global Study Room explanation level preserved;
- Coach/Learn remains visible across Chat and Topics;
- one-shot stretch renamed **Try a harder question**;
- legacy room preferences migrate/canonicalize safely;
- companion default frame enlarged to 116×138;
- mascot rendered at ~75% of the prior in-frame scale;
- intentional transparent top/side body overlap supported;
- homepage/demo companion and navigation kept in parity;
- Supabase `v3_coach_mode` migration applied to the hosted Studigo project.

Validation:

- PR CI passed typecheck, full tests, offline advisory ML tests, game tests and web build;
- Vercel deployment reported success;
- hosted database constraint was verified after migration.

Follow-up status on current `main`:

- PR #70 completed the physical-device settings correction: Explanation Level is
  Room Settings only; Coach and Learn have independent persisted surface modes,
  and Learn exposes Big picture / Step by step / Examples first.
- PR #71 verified the integrated current-main beta and aligned the development
  adapter with the same global-explanation/independent-mode contract.
- PR #72 added **Refresh study guide** after physical-iPhone testing exposed stale
  derived topic scope. That recovery belongs in Materials, not in Coach/Learn
  preference logic.

Still requires human visual acceptance on a physical iPhone/iPad: confirm the
actual sprite composition keeps every facial feature clear and that deliberate
body overlap feels intentional at real-device scale. This is visual acceptance,
not an unresolved architecture or persistence task.

## Outcome

The learner should see a simpler product:

```text
Study Room
  Explanation level
  Simpler | Standard | Deeper
        |
        | applies to Coach + Learn
        v

Coach
  Show me | Coach me | Challenge me
        |
        | changes delivery/support bias only
        v

Adaptive game director
  10 reasoning rungs
  6 scaffold rungs
  rematches
  retention
  transfer
  recovery
```

The sophisticated machinery stays underneath the interface.

---

## 1. Simplify persistent Coach settings

### Remove from learner-facing UI

- Studigo default
- Direct instruction
- Deliberate practice
- Socratic coach
- Skill progression
- Concrete to abstract
- Learning Tradition
- Practice Recipe

Their research records remain in `knowledge/teaching-coaching/` as internal strategy/reference material.

### Expose only

**Show me**  
Explain it first, show me an example, then let me try.

**Coach me**  
Guide me with questions, hints, and feedback. Default.

**Challenge me**  
Start with less help and make me apply what I know.

### Behavior contract

- modes change delivery/support bias;
- modes do not change source truth;
- modes do not change grading truth;
- modes do not directly raise persisted reasoning;
- modes do not lower the mastery target;
- adaptive director may add support when performance requires it.

### Persistence

Keep `study_rooms.explain_level` separate.

Persist `coach_mode = show|coach|challenge`.

Legacy style/tradition/practice fields may remain temporarily for DB rollback/backward compatibility, but new writes canonicalize those hidden values from the selected V3 mode so stale historical learner choices do not keep steering replies.

---

## 2. Surface-specific recalibration after physical-device testing

October 2 iPhone testing showed that a saved setting could appear selected while
the next reply was still carried by an older Coach/Learn conversation context.

Target behavior:

- **Apply Coach** saves Coach mode and starts a fresh Coach response context only.
- **Apply Learn** saves Learn presentation mode and starts a fresh Learn response
  context only.
- explanation level is not shown in either surface sheet.
- recalibration never changes mastery, attempts, rematches or source data.

Learn presentation modes:
- Big picture
- Step by step
- Examples first

These are presentation-route preferences, not adaptive-learning controls.

---

## 2. Preserve the global Study Room explanation level

Keep:

- Simpler
- Standard
- Deeper

Location: Room Settings.

Meaning:

> How should Studigo explain things in this Study Room?

It is the single canonical value. Coach and Learn both use it. Surface-specific
Apply actions cannot override or diverge it.

Invariant:

> language difficulty and thinking difficulty remain separate.

A hard transfer task can use simple wording.

---

## 3. Fix the Coach / Learn navigation regression

The mobile build currently shows the primary Coach/Learn segmented control in Chat but replaces it with a Topics heading in Topics.

That hierarchy is wrong.

### Required hierarchy

```text
PRIMARY MODE
Coach | Learn
always visible

SECONDARY CONTROLS
Chat | Topics
Topics opens the integrated study-scope selector
```

### Requirements

- Coach/Learn stays visible in Chat and Topics.
- Topics never replaces Coach/Learn.
- the standalone green topic dropdown is removed;
- Topics itself opens the selector;
- selector rows use checkboxes for multi-select;
- include Select all, Clear and Apply topics;
- Apply topics resets Coach/Learn response context but not learning evidence;
- phone uses the same prominent segmented control already used in the working Chat view;
- wide/iPad layouts preserve the same information hierarchy even if spacing changes.

### Acceptance views

- Coach + Chat
- Learn + Chat
- Coach + Topics
- Learn + Topics

Verify at a phone viewport and at least one wide/iPad viewport.

---

## 4. Separate persistent Challenge mode from one-shot stretch

Persistent setting:

**Challenge me**

One-shot Coach control:

**Try a harder question**

The one-shot action sends `challengeRequest: "stretch"`.

It does not:

- save a mode;
- rewrite learner state;
- raise mastery;
- stair-step difficulty when repeatedly tapped without evidence.

Legacy text "Challenge me" may still be understood for backward compatibility, but the learner-facing control uses the new copy.

---

## 5. Companion window final polish

### Problem

In the current mobile companion window, Studigo's head fills too much of the available screen and his nose can be cropped.

### Frame

Increase the default companion window footprint so the character has more breathing room.

Target default geometry:

- 116px wide
- 138px high

All collision/docking calculations must use the same geometry.

### Character scale

Scale the mascot inside the window to approximately **75%** of the previous rendering size.

Acceptance:

- nose is fully visible;
- eyes are fully visible;
- cheeks/snout are fully visible;
- horns/ears/frills are not accidentally cropped;
- face remains inside a safe visual region at the default mobile size.

### Intentional overlap

The character should feel like it lives in the device rather than being pasted behind a mask.

Use layered composition:

```text
screen background
character
selected transparent body/limb overflow
foreground sill/nameplate
window controls
```

Allow transparent body parts to break the top/side bezel deliberately.

Good overflow candidates:

- arms/hands;
- side frills;
- shoulder/body silhouette;
- tail tip where present.

Rules:

- face stays comfortably readable;
- sill/nameplate stays above the character;
- overlap never covers resize/minimize/drag controls;
- overlap never blocks study controls;
- reduced motion behavior stays intact.

---

## 6. Regression coverage

### Coach preferences

Test:

- old rooms deterministically migrate to a V3 mode;
- new Apply persists `coach_mode`;
- hidden compatibility values are canonicalized;
- Room Settings explanation level is not overwritten by Coach Apply;
- denied/missing room never reports success.

### Prompt contract

Test all:

- 3 Coach modes x 3 explanation levels;
- exactly one saved Coach mode reaches Coach;
- exactly one room explanation level reaches Coach;
- Learn receives explanation level + topic context but no Coach mode/internal strategy;
- mode does not alter grounding rules.

### Navigation

Static/component coverage must prove:

- one persistent Coach/Learn switcher;
- one Chat/Topics secondary switch;
- Topics does not conditionally replace Coach/Learn.

### Companion

Test:

- geometry used by engine matches visual geometry;
- default character scale is 75%;
- stage allows intentional negative side/top clipping region;
- sill is layered above the character;
- companion still makes room for controls using new dimensions;
- companion still has no network/mastery writes.

---

## 7. Visual QA

On the production-like Study Room verify:

### Coach settings
- only Show me / Coach me / Challenge me;
- Apply works;
- selected mode persists after reload;
- explanation level still shown as a read-only note linking conceptually to Room Settings.

### Navigation
- primary switch always visible;
- secondary switch always visible;
- no jump/reflow that pushes Studigo rail to a different position;
- topic picker still fits on phone.

### Companion
- face is not cropped;
- character is visibly smaller inside a larger window;
- selected transparent body features can cross the bezel;
- sill remains readable;
- resize/pinch still works;
- drag/docking avoids controls;
- seated edge tab still works.

---

## 8. Native handoff

The future Expo/React Native app copies this product contract, not the current legacy web settings.

Native must ship with:

- global room Explanation Level;
- Show me / Coach me / Challenge me;
- persistent Coach/Learn;
- secondary Chat/Topics;
- Try a harder question as one-shot stretch;
- same companion visual proportions and safe-face rule.

The server remains the authority for preferences, learning state, RAG and progression.

---

## Definition of done

The learner sees a simpler interface than before:

- three understandable Coach choices;
- one global explanation setting;
- one always-visible Coach/Learn decision;
- one integrated Chat/Topics scope control with no duplicate topic dropdown;
- a companion whose face is never unintentionally cropped.

At the same time, the deterministic adaptive engine remains fully intact underneath the experience.
