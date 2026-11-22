# Companion-first integration

Studigo opens the first encounter with a close-up and can be tapped, petted, poked, held or dragged. A learner can have a short conversation or go directly to homework help. The sample question remains optional practice with no mastery effect. The own-file path opens Materials. Returning learners can open the same conversation from Home while keeping their next study action visible.

| Surface | Rive preview |
| --- | --- |
| Public homepage | The scroll guide uses the shared surface and retains its existing phone handoff and placement. The Meet Studigo portrait is a still. |
| First-run Home | The shared React component fills the stage with a portrait crop. Pointer hit regions are mapped back to the original artboard. |
| Returning Home | The shared React component uses the outfit and Calm setting for the next room and the flame stage earned on the device. |
| Study Room window and strip | The existing host owns layout, controls, activity, and progression. It mounts one Rive surface and reuses the committed-event API. |
| Coach, Learn, Quiz, Flashcards, Practice Test, Progress, Plan and Materials | The shared Study Room host carries across modes. Empty states, completion illustrations, source and status marks, and the tiny seated icon are static. |
| Sign-in | The original welcome illustration is static. |

## Conversation and voice

The welcome endpoint uses the existing authentication, chat admission and budget checks. The AI package owns the provider call and validates the reply. Up to four short learner turns are held in component state for the encounter. The conversation has no access to class files, tools or study data. Leaving the encounter aborts the browser request. The fixture uses explicitly labeled scripted replies.

Read-aloud is user-initiated through the existing browser speech control. The microphone is a separate local opt-in. The learner starts one speech-recognition session, can stop it, and reviews its transcript before manually sending text. The browser speech service may process audio. The Studigo endpoint receives only the submitted text. Opening the permission dialog does not start recording.

Enable voice on a local development server by setting `NEXT_PUBLIC_STUDIGO_COMPANION_VOICE_PREVIEW=1` before launch. The local permission override is scoped to `/app` and `/dev/home`. Production retains the current microphone policy. Authenticated AI responses and physical voice hardware remain release checks.

## Rive data and progression

- `gazeX` and `gazeY` are normalized to the range -1 to 1. Pupils lead the neck and frills on three different interpolation curves.
- `intent` carries the named expressions and unlocked tricks. Touch can produce surprise or playful annoyance. Incorrect study answers use the existing reassuring motion.
- `spark`, `heart` and `thought` select original Rive overlays. Reduced motion suppresses these overlays.
- The seven outfit names select one accessory on the head or chest. The art is rasterized from the repo's original overlay vectors at `d72bede`. Each accessory inherits the body-part transform. Fit and contours are visually verified on the frontal rig. The prior sprite system remains available via the rollback flag.
- `flameBoost` uses the existing 1.0, 1.15 and 1.3 values on a dedicated parent bone. The five idle tricks use the existing unlock thresholds. The controller only handles their animation priorities and return to idle.
- Correct answers and incorrect attempts keep the current growth weights. Companion play and conversation cannot award growth. The Study Room continues to own all learning state.

## Preview and rollback

From the repository root run `pnpm --filter @studigo/web dev --hostname 127.0.0.1 --port 3328`. Open `/dev/home?first=1` for the introduction, `/dev/home` for returning Home, and `/dev/studigo` for the exact production component in its showroom.

Development defaults to Rive. Release builds require `NEXT_PUBLIC_STUDIGO_RIVE=1`. Set `NEXT_PUBLIC_STUDIGO_RIVE=off` and restart or rebuild to switch to the previous animation and onboarding. The shared Rive renderer uses a static fallback if loading or rendering fails.

The source project is `design/living-companion/rive/studigo`. Run `rive design/living-companion/rive/studigo --verify`, then `rive design/living-companion/rive/studigo --publish=local`. Copy `build/studigo.riv` into `apps/web/public/mascot/rive/studigo.riv`. The current plan adds the Rive splash to that export.
