# Studigo companion — concept demo

A proof of concept, not product code. It shows Studigo (the dragon) as a companion inside the study app, ahead of the iOS build: onboarding, an app Home screen, and the Study Room.

Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 4173 --directory design/companion-demo
```

The first visit starts in onboarding. The panel beside the phone jumps to any screen or moment.

## Where he is

He is only ever in one place:

- **Stage** — full body, on Home and in onboarding.
- **Window** — waist-up, on the pages where he has a job: Coach and Practice.
- **Seat** — the round avatar in the page header, on Progress, Plan and Materials, or whenever he is sent back. Tap the seat to call him out.

Opening a room, or finishing onboarding, plays one move: he leaps from the stage into his window.

## What is real and what is not

- **Real:** the room UI. `studigo.css` is ported from `apps/web/app/globals.css` on `origin/main` (phone layout) with the components' own class names. Home reuses the `/app` page's room cards and copy; onboarding reuses the room form fields and the room-color picker.
- **New in this concept:** the Home layout with his stage and a "next up" card, the five-step onboarding, his window, and the header seat.
- **Sample:** every room, topic, question, coach reply, citation and file name. Sign-in buttons only advance. Nothing calls a model or a server.
- **Concept art, not approved brand assets:**
  - Existing frames from `assets/mouse-tracking/`: `center`, `left`, `right`, `up`, `up-right`, `down`, `down-right` (waist-up crops in `assets/`, full body in `assets/full/`).
  - Generated from the centre frame for this demo: `celebrate`, `support`, `pet`, `poke`, `lean`, `sleep` (waist-up) and `wave`, `leap`, `celebrate`, `read` (full body). Replace these before anything ships.

## Rules the companion follows

- He never changes mastery. Only practice does. There is no bond level, currency or streak.
- He never sits on a control: the page makes room for him, he tucks aside while you scroll, and he takes another corner if his is blocked.
- Personality comes from gaze and body language first. Speech is short, rare, and can be switched off.
- Full body appears only on Home, in onboarding, in his card, and at the app's existing completion and empty states (96px, which `docs/DESIGN_SYSTEM.md` already allows). The larger Home and onboarding figures and the cropped window are exceptions to that document and need to be written into it before this moves into the app.

## Marketing homepage

`homepage/` is a concept homepage for this direction, at `http://localhost:4173/homepage/`. It is a preview, not the live site: the footer says so, and the "Start studying for free" button opens the app demo.

Direction: **pocket device**. Snow page, tangerine as the one accent, the product shown as a physical object with a spec sheet beside it. Same type and tokens as the app.

- **Intro:** a short coded sequence (he wakes, leaps in, waves, jumps into the phone). It plays once per tab and can be skipped. It is CSS and sprites, not a rendered video, because Higgsfield was out of credits.
- **Hero:** the phone is the real demo in an iframe (`index.html?embed`), so a visitor can tap around. The room-color picker recolors it.
- **Guide:** on scroll he leaves the phone and follows down the page, reacts to each section (`data-guide`, `data-say`), follows the cursor, and lands beside the last button.
- **Modes:** pinned on desktop, one device that switches Coach, Learn, Quiz, Flashcards as you scroll. Stacked on phones.
- **Copy:** reused from `apps/web/app/page.tsx` on `origin/main`. No testimonials, numbers, logos or prices. The mastery map is a labelled sample unit.

Reference principles, taken from Refero Styles (Slush, teenage engineering, Duolingo, Lego, Discord) and Dribbble mascot and study-app work. Aura's library did not load, so nothing came from there.

1. Show the product as an object, with its details listed like a spec sheet (teenage engineering).
2. One loud accent on a quiet ground; color blocks mark a change of subject (Slush, Lego).
3. The mascot does things. He is not a decoration in a corner (Duolingo).
4. Big, friendly display type with short sentences (Discord, Duolingo).
5. One button, repeated, never competing with a second one.

A static comp of the desktop and mobile layouts is on the Design canvas "Studigo Homepage".

## Files

- `companion.js` / `companion.css` — the companion: stage, window, seat, the leap, gaze, idle loop, touch, his card.
- `flows.js` / `flows.css` — Home and onboarding.
- `app.js` — a stand-in for the Study Room (scripted Coach, a five-question quiz, flashcards, Plan, Cram). With `?embed` it runs inside the homepage's phone and talks to it with `postMessage`.
- `studigo.css` — the app's styles.
- `homepage/index.html`, `site.css`, `site.js` — the marketing homepage.

## Next

1. Port the homepage into `apps/web` on a branch from `origin/main`.
2. The real iOS app in Expo / React Native, per `docs/APP_STORE_RELEASE_PLAN.md`.
3. A rigged 3D Studigo and a rendered intro video, once there are credits for it and Blender is running.
