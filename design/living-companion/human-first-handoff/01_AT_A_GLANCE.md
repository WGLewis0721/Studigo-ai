# The project at a glance

## Why Studigo exists

**Learn:** learners upload their own course materials. Studigo explains, asks questions, helps with practice, and works from the right source context. **Earn:** real learning achievements can support future progress, customization and companion development. **Play:** a personalized dragon can accompany users into fun-first games such as Moon Keep and Core Clash. Games should not be repeatedly interrupted by educational tasks.

The project should be approachable to children without becoming shallow for older learners, protect student privacy, and ultimately work well on web, iPhone and iPad. The orange dragon is intended to be an emotional connection across the ecosystem, not a superficial mascot.

## What has been approved

The owner watched and explicitly approved the **character-only** concept (“looks good”) and the **two on-screen placement** concept videos (“yep I like it. thats exactly it”). Approval is for the visual and interaction *direction*. It does not prove the existing app behaves that way.

**Two mutually exclusive Study Room homes:**

- **Floating dock:** A small framed dragon window moves as **one complete panel** and remains responsive inside. The learner can reposition it, including locations that are not just one of four corners. The panel must avoid covering answers, citations, controls and the message composer.
- **Fixed strip:** The same dragon stays in a permanent place **below the navigation bar and above the colored divider/rail**, with a gentle, contained idle life. It does not float over content or move the rail. Preserve the established Phase 3 header tuck/expand geometry.

The character is an original **wingless orange dragon** with cream body, large brown eyes, ivory pointed frills, teal/gold scholar vest, and an orange crayon-like flame tail. Use paws/forearms for gestures. There is only **one active companion and one behavior system**.

## Current specification beyond the early six-expression draft

The later Living Companion v1 plan calls for 14 expression targets, 12 choreographed movement “beats” (at least 10 delivered at the v1 release gate), synchronized gaze/head/frill/tail motion, mood feedback confined to the current session, seven school-subject costume layers, optional reduced-motion/Calm mode, a small mouth animation interface, and eventual voice integration only after the owner supplies the chosen voice. These are **requirements/plans**, not completed features.

## Engineering rules that must not move

- Deterministic application code, **not companion animation**, owns mastery, correctness, rewards, authorization, progression and evidence.
- Only respond to **committed learning events**; an ungraded click or AI suggestion is not proof of success.
- Keep the existing Study Room, CompanionContext, drag/resize/minimize, speech-off default, local preferences, keyboard accessibility, and WebP fallback.
- No camera/eye-tracking device access, behavioral surveillance, pointer-path logging, raw student-content telemetry or new unnecessary data storage.
- Preserve the Phase 3 header row's current expand/tuck behavior (desktop 100% to 60%, restoring on hover/focus/click); phone controls remain usable. The colored divider does not scale.
- For iOS readiness, favor a renderer-neutral behavior contract. Do not create a second back end or assume a native app has shipped.

## One-sentence status

**Research and approval of visual concepts are real; the new animation rig, runtime, two new production presentations and their release tests remain to be implemented and independently verified.**
