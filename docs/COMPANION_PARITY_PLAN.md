# Companion parity plan: bring the app up to the homepage

Written October 1, 2026, the day the companion homepage shipped. A plan, not a
record of work done. Update it as stages land.

## The problem

The homepage now shows a living Studigo: full body, reacting to what you do,
sitting in a window inside the Study Room. The app a visitor signs in to does
not have that yet. A visitor should not feel the product got plainer after the
sign-in page.

| | Homepage | App today |
| --- | --- | --- |
| Studigo | Full body and waist-up sprites, gaze, poke, pet, leaps | One still image in a bezel (`StudigoMascot`), five moods |
| Study Room | Demo phone with his window and header seat | Same room UI, no window, header avatar is static |
| Home (`/app`) | Demo shows a stage, a "next up" card, rooms | A heading, room cards, the create form |
| First run | Demo shows a guided setup | One first-run card |
| Sign-in pages | Not shown | Blueberry panel, older look than the homepage |
| Motion | Intro, reveals, pinned modes | Mode retint and a 6px rise |
| Tokens, type, keys | `globals.css` | `globals.css` (already shared) |

The foundation is already common: one token set, one type system, one set of
keys. The gap is the companion and the two screens around the room.

## Rules that hold in every stage

1. **One Studigo.** The same sprites and the same behavior on the homepage, in
   the web app and later in the iOS app. Three places only: stage (full body),
   window (waist-up), seat (header avatar).
2. **The app's rules win inside the app.** He never covers a control, he can be
   sent to his seat, speech can be switched off, and reduced motion is honored.
3. **He never changes mastery.** No bond level, streak, currency or reward.
4. **The homepage only shows what the app does.** The "arriving" note on the
   homepage comes off when stage 2 ships, not before.
5. **Real data only.** Anything he says about a test date, a topic or progress
   comes from the room's real state, or he does not say it.

## Stages

### Stage 1. One engine, one set of art (small)

- Move the sprite set to `apps/web/public/mascot/companion/` and point the
  homepage guide and the demo at it. Record in `docs/brand/mascot/` that the
  generated poses were approved on October 1, 2026.
- Port the demo's `companion.js` to a typed module with no DOM framework in it
  (pose, gaze, idle loop, touch, docking, the leap), plus a React component that
  hosts it. Keep it free of app imports so the iOS app can reuse the logic.
- Unit-test the parts that can break quietly: which corner he takes when one is
  blocked, the idle timeline, and that no event writes to mastery.

### Stage 2. His window in the Study Room (medium, the one that matters)

- Mount the window in `components/room/workspace.tsx`. Drive it from events the
  room already has: `HeaderSlots.setMascot` (thinking, sources, celebrate), a
  graded quiz answer, a flashcard rating, typing in the composer.
- The header avatar in `mode-header.tsx` becomes his seat. Window on Coach and
  Practice; seat on Progress, Plan and Materials.
- Phone layout first, then the framed wide layout.
- His card: quiet mode and "tuck away while I scroll", kept in local storage.
  No schema change.
- Done when: the five demo moments work in a real room, he never sits on a
  control at 375px or 1440px, a keyboard user can reach and dismiss him, and
  the homepage note is removed in the same change.

### Stage 3. Home (`/app`) (medium)

- A stage with full-body Studigo above the room cards, and one "next up" card.
- His one line and the card come from real state: the nearest `test_date` and
  the room's weakest or unpracticed topic. With no rooms, the existing
  first-run copy.
- Opening a room plays the leap into his window; a crossfade with reduced
  motion.

### Stage 4. First run (small to medium)

- Replace the first-run card with the guided setup from the demo: name the room
  and its test date, pick a color, add materials or skip, meet Studigo. Sign-in
  stays on the existing sign-in pages. Ask for nothing else (`AUTH.md`).

### Stage 5. One polish pass across every screen (medium)

Walk homepage, sign-in, Home and a room side by side at 375px and 1440px and
make these match:

- Display type sizes and tracking for page titles and section heads.
- Keys: one molded key, one hover, one press.
- Motion: one load sequence per screen, the same easing and durations.
- Empty and completion states use the full-body poses at 96px or less.
- Sign-in pages take the homepage's look (snow, the cream screen with its
  sill) so homepage, sign-in and app read as one product.
- A performance pass on the homepage and a real iPhone Safari check.

### Stage 6. iOS

The Expo app (`APP_STORE_RELEASE_PLAN.md`) reuses the stage 1 logic and art.
A rigged 3D Studigo is a separate spike and does not block any stage here.

## Order

1 and 2 first, together. They close the gap between what the homepage shows and
what the app does. Then 3, 4, 5. Each stage is its own branch and pull request,
with typecheck, tests, a production build and a rendered check at both widths.

## Decisions needed from William

- On wide screens, does his window sit inside the room frame (recommended) or in
  the sidebar?
- Is speech on by default, or off until switched on?
- Does Home say anything about progress, or only the test date and the next
  topic (recommended)?
