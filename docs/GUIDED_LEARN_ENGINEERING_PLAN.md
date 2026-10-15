# Guided Learn — engineering plan

October 2026. This replaces the study-guide reading as the target for Learn. The wireframe with Brief / Show / Try / Check labels, Mission / Chat / Topics, and a row of Find it / Read aloud / Ask is information hierarchy, not the screen to build.

## Product DNA

Studigo is Learn, Earn, Play. It is a game that teaches from the learner's own material. It is not a study-guide generator and not three chat personalities.

| Mode | Job | Scores mastery |
| --- | --- | --- |
| Learn | The opening level. An in-world character walks the player through unfamiliar material. | No |
| Coach | The trainer. Apply it, get help, try again. | Yes |
| Practice | The arena. Show you can do it alone. | Yes |

Earn stays on the existing Coach and Practice paths. Learn never writes mastery, attempts, or readiness. A celebration is feedback, not a reward that changes the record.

## The level

Studigo is the character already in the product (the orange dragon). The character explains the world. The player moves by doing something. Assistance starts high and drops as the level goes on. A seven-year-old government lesson and a first-week college physics lesson use the same machine. Academic level changes delivery, not the rules.

One level is a list of beats. Software picks the order. The model may write a bounded line of dialogue from eligible evidence. It does not pick the next beat, the score, or the mastery result.

Every beat is one of four plays:

| Play | What the player does | Typing |
| --- | --- | --- |
| Read | Studigo says the next fact. The player continues. | No |
| Multiple choice | Pick one line. | No |
| Fill in the blank | Tap the missing word into the line. | No |
| Checkboxes | Mark every line that fits. Order can be a later checkbox-style play. | No |

A beat has one next action. Check stays off until there is a selection. After the result the same button continues. A hit marks the play and does not lecture. A miss marks it and shows the right piece from the material. The player can always tell what to do without an instruction paragraph.

The global explanation level (`simpler`, `standard`, `deeper`) is the delivery mode for that room. It changes sentence length and how Studigo talks. It does not change the facts, the source lines, the beat order, or what counts as correct.

If a prerequisite is not in the uploaded material, the Read beat says it is missing. General-background teaching, if it ever appears, is labeled as such and is never stored as if the teacher wrote it.

## What the player sees

Keep the room shell: Coach / Learn switch, orange rail, bottom navigation, one column, one unlabeled progress bar, one button above the tab bar. Do not add a second navigation row, a chat transcript, starter chips, or an ask box on this screen.

The character sits with the beat. Progress is how far through this level, not a worksheet step name. Those names are not on screen.

## Mission shape

A level is still this sequence, expressed as beats rather than labels:

1. Briefing — Read. The objective, in the room's explanation level, grounded on a source line.
2. Foundation — Read, or an honest "not in your materials" if the prerequisite is absent.
3. Demonstration — Read. Show the line working. Do not dump the page.
4. Learner action — Multiple choice, fill-in, or checkboxes. The player does the thing.
5. Checkpoint — One more play. Ungraded. No mastery write.
6. Advancement — Continue into the next objective, or replay the demonstration on a miss. Do not dead-end.

Wave 1 can ship that sequence with one action type in the middle and the other plays immediately after, as long as a beginner finishes without typing and without asking what to do next.

## Current baseline

Already in the tree, behind `PHASE3_ROOM2_ROOM_IDS` (and the `/dev/study` fixture):

- A durable room cursor (`learn_mission_cursors`) moves brief → show → try → check → done. It does not write mastery.
- Allowlisted rooms replace the Learn chat with one column.
- `missionBeats` builds a local level from one excerpt: Read, multiple choice, fill-in (tap the word), checkboxes. Prompts follow the room explanation level. Source lines are not rewritten.
- The character uses the existing mascot states. A hit celebrates. Nothing is scored.

Not done, and not to be mistaken for done:

- The beats are not a versioned plan. They are derived in the client from one excerpt and forgotten on reload.
- The cursor phases are not the beats the player sees. Resume does not return to the beat they left.
- There is no foundation beat, no "missing prerequisite" disclosure, and no source spotlight.
- Fill-in is a word tap, not speech. Checkboxes do not yet order steps.
- Voice, read-aloud playback, original-file recovery, and the Learn → Coach/Practice handoff are untouched.
- Rooms outside the flag still get the old Learn chat.

## Deliverables

Each card is additive. Do not rebuild ingestion, retrieval, the Coach director, grading, or mastery.

| ID | Priority | Engineering outcome | Depends on | Now |
| --- | --- | --- | --- | --- |
| GL01 | P0 | A versioned `LearningMissionPlan` for one topic: ordered beats, the source revision they were built from, and the evidence id for every taught line. Regenerated only when that revision changes. | Topic map, source blocks | Not done |
| GL02 | P0 | The director advances, retries, and resumes the plan. Same input, same next beat. No model call in the transition. | GL01, existing cursor | Cursor exists. It does not drive beats. |
| GL03 | P0 | The player renders the plan. Start in one tap. No prompt. No transcript. | GL02, flag | Column and local beats exist. |
| GL04 | P0 | Find it opens the exact supporting passage, or says the evidence is missing. | GL01 | Not done |
| GL05 | P0 | Speak on Coach and Learn: record, review, correct, retry, submit. A reviewed spoken answer uses the existing grade path. | Coach submit | Not done |
| GL06 | P0 | Choice, checkbox, fill-in, and order are tap plays. Hint use is on the interaction record. Hints cannot write mastery. | GL03 | Choice, fill-in, and checkboxes exist as local plays. Order and hint records do not. |
| GL07 | P1 | Read aloud for the current beat, with play, pause, and stop. | GL03 | Not done. The Read *beat* is on screen. Audio is separate. |
| GL08 | P1 | The existing character reacts to a miss, a hit, and a stall. Reactions never block the button. | Existing mascot | Hit / miss states only. |
| GL09 | P1 | Open, download, or print the unchanged teacher file. It stays visually separate from anything Studigo wrote. | Materials | Not done |
| GL10 | P1 | One elementary government fixture and one college physics fixture complete a level, then open Coach or Practice on that same topic. | GL03, GL06 | Fixture samples exist. The handoff does not. |

UI cards track the same work. UX01–UX03 are Wave 1. UX04–UX06 are Wave 2. UX07–UX09 are Wave 3. UX10 is Wave 4. The shell in UX01 is the shell already shipped. Do not add the wireframe's second tab row.

## Waves

**Wave 1 — the level is real.** GL01, GL02, GL03, and a source link on the Read beat.

Exit: a second-grade government lesson and a college physics lesson each finish briefing → action → checkpoint with no typing. Reload returns to the same beat. A miss does not write mastery.

**Wave 2 — the keyboard is optional.** Finish GL04, GL05, GL06.

Exit: the government fixture is finishable with taps only. A Coach answer can be spoken, reviewed, and submitted through the current grader.

**Wave 3 — it feels like the game.** GL07, GL08, GL09.

Exit: read-aloud works on a supported phone. The character reacts without covering the button. The original teacher file can be opened when the generated guide is missing.

**Wave 4 — prove they learned.** GL10.

Exit: after the level, the learner attempts one assessed question in Coach or Practice on the same topic and source scope.

## Architecture

Reuse: Supabase auth and RLS, ingestion and OCR, source blocks, retrieval, guide composition, the Coach director, grade and evidence persistence, AI admission, the mascot.

Add only:

- `LearningMissionPlan`, versioned by topic and source revision.
- Beat cursor and assistance history on the existing mission row, or a child table keyed by that row. Do not invent a second session store.
- A typed beat contract: `read`, `choice`, `blank`, `boxes`, later `order`.
- Adapters for speech and read-aloud when those waves start.
- The player component that already mounts for allowlisted rooms.

The model writes dialogue and feedback inside a beat. The server decides which beat is next, whether the tap matched, and that Learn writes no mastery.

## Gates on every PR

- Flag or fixture. Rooms outside `PHASE3_ROOM2_ROOM_IDS` keep current Learn.
- A behavior test for the beat contract, not a screenshot.
- Evidence the PR did not write mastery, attempts, or readiness.
- Rollback is the flag, not a schema rewrite.
- End the PR with DONE, NOT DONE, and BLOCKED.

## Do not start

A framework migration. A new mastery engine. A new retrieval stack. A second character. A points economy. A study-guide page with checkboxes on every line. An open "explain it back" essay as the lesson.

## First card

GL01 + the smallest GL02 hook: persist the beat list and the beat index for one topic, built from the current cited excerpt, keyed by source revision. The player renders that saved list instead of recomputing and forgetting it. Explanation level still changes only the prompts.

Done when reload shows the same beat, a different explanation level does not change which line is correct, and no mastery row moves.
