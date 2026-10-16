# Phase 3 — pause Guided Learn UI until the visual release is accepted

## Decision
User instruction on 2026-10-15: revert Learn to the established Coach/Learn experience while completing Phase 3 UI/UX. Implemented with a presentation-only gate; no learner records, schema, migrations, assessments or backend receipts are deleted.

## Effect
- Signed-in room pages explicitly pass `phase3Learn={false}`, regardless of the old per-room allowlist; the existing Learn tab and topic/lesson flow render again.
- Home no longer offers Resume based on an unfinished experimental Learn mission. Its next action is calculated from authentic topic/readiness/weak-area evidence as before.
- The Guided Learn source, cursor migration and historical records remain untouched for a *separate* gated launch after Phase 3's art, component, responsive and accessibility acceptance.
- Phone Clear/Previous/Next now use the compact navigation and composer-dock controls. The C21 test checks the visible replacement controls instead of incorrectly rejecting the intentional hidden legacy footer.

## Roll-forward
A later Guided Learn PR must restore the real room flag only after versioned beat/step persistence, source eligibility and age-cohort/device proof, and must restore Home Resume only if it lands on the exact saved beat. Never re-enable on a document count or synthesize learning mastery.

## Verification required
- CI: full web tests, typecheck, production build.
- Signed-in: Learn tab opens existing lesson/chat from a ready room, Coach remains unchanged, Home leads to real next action.
- Phone 320/390, tablet, desktop, keyboard and voiceover: action controls visible and accessible with lesson citations and companion.
- Flag-on/off visual and rollback evidence at one commit before production acceptance.
