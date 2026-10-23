# Guided Learn — engineering plan

> **Status: design direction.** Room 2 is not accepted. The live experiment is `docs/PHASE3_ROOM2_LEARN.md` and `docs/ux/`. Do not treat this file as shipped behavior.

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

The live Learn tab fails when the learner has to decide what they need. Someone who opened a study tool often does not have the initiative, or the self-awareness, to name the gap. Learn removes that decision. Studigo picks the next piece of the lesson and walks them through it.

Studigo is the character already in the product (the orange dragon). The character explains the world. The player moves by answering the step in front of them. Assistance starts high and drops as the level goes on. A seven-year-old government lesson and a first-week college physics lesson use the same machine. Academic level changes delivery, not the rules.

One level is a list of beats. Software picks the order. The model may write a bounded line of dialogue from eligible evidence. It does not pick the next beat, the score, or the mastery result. The learner never chooses the topic, the question, or the prompt.

On every beat the learner can answer in any of these ways. The controls are always there. None of them asks the learner to invent the lesson.

| Always available | What it does |
| --- | --- |
| Hear it | Studigo reads the current step aloud. Play, pause, stop. |
| Say it | The learner speaks the answer, reviews the words, then submits that answer. |
| Type it | The learner types the answer to the step Studigo already asked. |

Saying it and typing it submit the same answer. Hearing it does not submit anything.

Some beats, not most, also offer a structured play. These are variety inside the guided path. They are not the lesson.

| Occasional | What the player does |
| --- | --- |
| Checkbox | Mark the lines that fit. |
| Fill in the blank | Complete one missing word in a line Studigo already showed. |

A structured beat can still be answered by saying or typing. A beat has one next action. Check stays off until there is an answer. After the result the same button continues. A hit marks the play and does not lecture. A miss marks it and shows the right piece from the material. The player can always tell what to do without an instruction paragraph.

The global explanation level (`simpler`, `standard`, `deeper`) is the delivery mode for that room. It changes sentence length and how Studigo talks, including what gets read aloud. It does not change the facts, the source lines, the beat order, or what counts as correct.

If a prerequisite is not in the uploaded material, Studigo says it is missing. General-background teaching, if it ever appears, is labeled as such and is never stored as if the teacher wrote it.

## What the player sees

Keep the room shell: Coach / Learn switch, orange rail, bottom navigation, one column, one unlabeled progress bar, one button above the tab bar. Do not add a second navigation row, a chat transcript, starter chips, or an ask box on this screen.

The character sits with the beat. Progress is how far through this level, not a worksheet step name. Those names are not on screen.

## Mission shape

A level is still this sequence, expressed as beats rather than labels:

1. Briefing — Read. The objective, in the room's explanation level, grounded on a source line.
2. Foundation — Read, or an honest "not in your materials" if the prerequisite is absent.
3. Demonstration — Read. Show the line working. Do not dump the page.
4. Learner action — The learner answers the step Studigo chose, by saying it, typing it, or using the occasional checkbox or blank.
5. Checkpoint — One more answer. Ungraded. No mastery write.
6. Advancement — Continue into the next objective, or replay the demonstration on a miss. Do not dead-end.

The learner is never asked what they want to study. Wave 1 is not done if the only way forward is a checkbox.

## Current baseline

Already in the tree, behind `PHASE3_ROOM2_ROOM_IDS` (and the `/dev/study` fixture):

- A durable room cursor (`learn_mission_cursors`) moves brief → show → try → check → done. It does not write mastery.
- Allowlisted rooms replace the Learn chat with one column.
- `missionBeats` currently builds a local quiz from one excerpt: a read line, then a choice, a blank, and checkboxes. That is the wrong default. Checkboxes and blanks are occasional. The learner still cannot hear the step, say the answer, or type it, and the guide is not yet choosing the path.
- The character uses the existing mascot states. A hit celebrates. Nothing is scored.

Not done, and not to be mistaken for done:

- The beats are not a versioned plan. They are derived in the client from one excerpt and forgotten on reload.
- The cursor phases are not the beats the player sees. Resume does not return to the beat they left.
- There is no foundation beat, no "missing prerequisite" disclosure, and no source spotlight.
- Fill-in and checkboxes exist as local plays and currently appear on every level. They should be occasional.
- Hear, say, and type are not on the beat. Voice, read-aloud playback, original-file recovery, and the Learn → Coach/Practice handoff are untouched.
- Rooms outside the flag still get the old Learn chat.

## Deliverables

Each card is additive. Do not rebuild ingestion, retrieval, the Coach director, grading, or mastery.

| ID | Priority | Engineering outcome | Depends on | Now |
| --- | --- | --- | --- | --- |
| GL01 | P0 | A versioned `LearningMissionPlan` for one topic: ordered beats, the source revision they were built from, and the evidence id for every taught line. Regenerated only when that revision changes. | Topic map, source blocks | Not done |
| GL02 | P0 | The director advances, retries, and resumes the plan. Same input, same next beat. No model call in the transition. | GL01, existing cursor | Cursor exists. It does not drive beats. |
| GL03 | P0 | The player renders the plan and never asks what to study. Every beat offers hear, say, and type. | GL02, flag | Column exists. The three answer ways do not. |
| GL04 | P0 | Find it opens the exact supporting passage, or says the evidence is missing. | GL01 | Not done |
| GL05 | P0 | Say it, on every Learn beat and in Coach: record, review, correct, retry, submit. Saying it is the same answer as typing it. | GL03 | Not done |
| GL06 | P0 | A checkbox or a blank appears sometimes, not on every beat. Either can still be said or typed. Hints cannot write mastery. | GL03 | Local plays exist and currently show on every level. |
| GL07 | P0 | Hear it, on every beat: play, pause, and stop for the line Studigo is teaching. | GL03 | Not done |
| GL08 | P1 | The existing character reacts to a miss, a hit, and a stall. Reactions never block the button. | Existing mascot | Hit / miss states only. |
| GL09 | P1 | Open, download, or print the unchanged teacher file. It stays visually separate from anything Studigo wrote. | Materials | Not done |
| GL10 | P1 | One elementary government fixture and one college physics fixture complete a level, then open Coach or Practice on that same topic. | GL03, GL06 | Fixture samples exist. The handoff does not. |

Hear, say, and type ship with the player in Wave 1. Find it is Wave 2. Character reactions and the original file are Wave 3. The cross-device proof is Wave 4. The shell already shipped stays. Do not add the wireframe's second tab row.

## Waves

**Wave 1 — the guide owns the lesson.** GL01, GL02, GL03, plus hear, say, and type on every beat.

Exit: a second-grade government lesson and a college physics lesson each run from the first step to the last without the learner choosing a topic or writing a prompt. On any step they can hear it, say the answer, or type the answer. A checkbox or a blank shows up at least once and not on every step. Reload returns to the same beat. A miss does not write mastery.

**Wave 2 — the source is one tap away.** Finish GL04 and the hint record on GL06.

Exit: Find it opens the line the beat just used, or says it is missing. A spoken Coach answer still goes through the current grader.

**Wave 3 — it feels like the game.** GL08 and GL09.

Exit: the character reacts without covering the button. The original teacher file can be opened when the generated guide is missing.

**Wave 4 — prove they learned.** GL10.

Exit: after the level, the learner attempts one assessed question in Coach or Practice on the same topic and source scope.

## Architecture

Reuse: Supabase auth and RLS, ingestion and OCR, source blocks, retrieval, guide composition, the Coach director, grade and evidence persistence, AI admission, the mascot.

Add only:

- `LearningMissionPlan`, versioned by topic and source revision.
- Beat cursor and assistance history on the existing mission row, or a child table keyed by that row. Do not invent a second session store.
- A typed beat contract: a guided step, plus optional `boxes` or `blank`. Hear, say, and type are controls on every step, not beat types.
- Speech and read-aloud adapters with the player, not in a later wave.
- The player component that already mounts for allowlisted rooms.

The model writes dialogue and feedback inside a beat. The server decides which beat is next, whether the tap matched, and that Learn writes no mastery.

## Gates on every PR

- Flag or fixture. Rooms outside `PHASE3_ROOM2_ROOM_IDS` keep current Learn.
- A behavior test for the beat contract, not a screenshot.
- Evidence the PR did not write mastery, attempts, or readiness.
- Rollback is the flag, not a schema rewrite.
- End the PR with DONE, NOT DONE, and BLOCKED.

## Do not start

A framework migration. A new mastery engine. A new retrieval stack. A second character. A points economy. A study-guide page with checkboxes on every line. A lesson that starts by asking what the learner wants to learn.

## First card

GL01 + the smallest GL02 hook: persist the beat list and the beat index for one topic, built from the current cited excerpt, keyed by source revision. The player renders that saved list instead of recomputing and forgetting it. Explanation level still changes only the prompts.

Done when reload shows the same beat, the learner did not have to name what to study, every beat can be heard, said, or typed, a checkbox or a blank is occasional, a different explanation level does not change which line is correct, and no mastery row moves.
