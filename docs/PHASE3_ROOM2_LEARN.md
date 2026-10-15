# Phase 3 · Room 2 guided Learn reading

The signed-in room page reads `PHASE3_ROOM2_ROOM_IDS`. A listed room shows the reading steps inside the locked Coach frame. Every other room keeps the current lesson. The synthetic fixture (`roomId === "fixture"`, `/dev/study`) shows the steps without saving them. The strip, Clear/Previous/Next, the topic column, and the composer do not move.

Embedded Postgres, running every migration in this repo, proved one owned room can start, replay the same request, advance to Show, pause, and read that same step back. A second account is denied. Topic mastery and quiz-attempt counts do not change. That is not a hosted Supabase apply. Do not set `PHASE3_ROOM2_ROOM_IDS` until this migration is applied there.

This is not Room 2 acceptance. Do not point Home's Start action at it. A self-report is not evidence of knowledge.

Start calls the existing guarded `/api/learn` lesson for the selected active topic. It requires an actual cited chunk and commits a reading cursor only if that exact chunk is still owned, eligible for the topic, on a readable page, and at the document's current revision. The cursor moves Brief → Show → Try → Check → Done through an owner-scoped, revision-checked database transaction and idempotent request receipt. Show displays the generated explanation and the pinned source excerpt; reload restores the exact step, then may regenerate the explanation. Try is explicitly a **self-reflection**, not an answer evaluation. No mission action writes mastery, attempts, or readiness. A replaced/denied source cannot advance or replay its old excerpt; Restart requires a fresh cited Learn lesson.

Migration `20261015010000_learn_mission_cursor.sql` must be reviewed and applied before enabling any real room. The preview fixture `/dev/study?mode=coach&frame=phase3&learn=phase3` is synthetic: click Learn in the switcher, then move through the steps. Its controls are not persisted and its sample source cannot open. The route is unavailable in production.

This is **not yet Room 2 acceptance**. It does not include the requested objective-specific tap-answer check, hint, college physics fixture, or authenticated hosted and physical-device pass. A self-report is not evidence of knowledge. Do not connect Home's Start action or merge/enable this branch on the strength of local tests alone. Review four widths, 200% zoom, keyboard/focus, real elementary and college sources, stale/replaced/deleted citations, cross-account denial, reload, double-submit and zero mastery writes on a hosted preview before release.
