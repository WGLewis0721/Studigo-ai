# Studigo Product Contract

## One-sentence product

Studigo turns the material a student is actually expected to learn into one grounded AI study companion.

## Core job

A student should be able to say:

> I have a test. Here is the study guide and the material my class uses. Teach me what I need to know, let me practice it, and show me what I still do not understand.

The product is not a generic chatbot with a file attachment feature. The uploaded course material is the product's knowledge boundary and the teacher's study guide is the product's learning map.

## Core objects

### Study Room
A subject/unit/test-specific workspace containing source documents, generated topics, conversation history, quizzes/flashcards, and mastery state.

### Source material
Files uploaded by the learner. Initial types:

1. Study guide — highest priority.
2. Teacher material — teacher notes/handouts.
3. Worksheet — assignments/practice.
4. Presentation — teacher slides.
5. Student notes.
6. Textbook — authoritative supporting explanation, but not necessarily the test scope.
7. Other.

### Topic
A concept/objective inferred primarily from the study guide and teacher material. Topics become the unit of mastery tracking.

### Downloaded Study Guide
A learner-owned snapshot generated from the current Study Room: teacher-defined
scope, the student's current topic map, concise source-grounded explanations/key
facts, useful retrieval prompts, and references back to the uploaded material.

The downloaded guide is not a new source of truth. It is an export of Studigo's
current grounded understanding of the room. Student edits must win, removed
topics must stay removed, and missing evidence must remain missing rather than
being filled with general model knowledge.

## Initial experience

1. Create account.
2. Create Study Room.
3. Upload study guide plus supporting materials.
4. Studigo analyzes the material and produces a topic map.
5. Student chooses: Ask, Learn, Quiz, Flashcards, Practice Test, Weak Areas.
6. The student corrects anything Studigo read wrong: topics and flashcards are
   theirs to retitle, reword, add or remove, and their edits survive a re-ingest.
7. Studigo tracks evidence of mastery over time.
8. Student can open/download the original source at any time.
9. Student can click **Download study guide** and receive a clean, printable
   study guide built from the current grounded room state.

## Grounding rules

- Do not answer course-specific factual questions as if unsupported information came from the student's files.
- If the uploaded context does not support an answer, say so.
- Cite the source document and page/section when available.
- Never fabricate a teacher requirement, due date, test topic, quote, page, or citation.
- Teacher study-guide scope beats textbook breadth when deciding what to study.
- The textbook may clarify a study-guide concept but should not silently expand the test scope.
- General model knowledge can become an explicitly labeled optional mode later; it is off by default for grounded study answers.

## Mastery philosophy

Mastery should not be a decorative percentage. It should eventually combine evidence such as:

- Correct answers across multiple attempts.
- Free-response quality.
- Time since last successful recall.
- Confidence calibration.
- Hints used.
- Topic coverage.

Do not implement a fake readiness score from chat volume or page views.

## MVP boundaries

Build deeply around one study workflow before adding LMS features.

MVP needs:

- Accounts.
- Study Rooms.
- File upload/download.
- Parsing/chunking/indexing.
- Grounded chat with citations.
- Study-guide topic extraction.
- Flashcards, editable by the student.
- Quizzes/practice tests in four formats: multiple choice, true/false, fill in
  the blank, short answer.
- Topic mastery, plus confidence-vs-performance calibration.
- Basic study plan / cram mode.
- One-click downloadable study guide (PDF first).

Not MVP:

- School SIS integration.
- Teacher gradebook.
- Full classroom management.
- Marketplace.
- Social feed.
- Publisher textbook catalog.
- Public sharing of copyrighted uploads.

## Privacy/product constraints

Studigo may eventually be used by minors, so collect as little personal data as possible. Keep user uploads private by default. Do not expose source documents through public storage URLs. Retention/deletion controls, parental/school requirements, COPPA/FERPA analysis, and publisher licensing need explicit work before school-scale distribution.

## What the student is trusted to decide

Studigo generates the topic map, the cards and the questions, but it is reading a
teacher's document, and it can read it wrong. Three rules follow from that:

- **The student's correction is authoritative.** An edited topic or card keeps
  the student's wording through any number of re-ingests. A topic they removed
  stays removed.
- **Correcting something must never be punished.** Fixing a typo on a card keeps
  the recall schedule it has already earned; removing a topic keeps its practice
  history.
- **Explanation level is a preference, not a fact filter.** `simpler` and
  `deeper` change how an idea is pitched. The cited material, and what is true in
  it, are identical at every level.

## Why confidence is asked before the answer is revealed

A student who is wrong *and knew they were unsure* has a gap they will revise on
their own. A student who is wrong *while feeling certain* has a blind spot they
will walk into the test with. Those need different responses, and nothing in a
score tells them apart.

So rating the answer is the submit action in Quiz — never an extra optional step
that most students would skip. Confident-and-wrong is surfaced as a blind spot
and ranked above an ordinary gap in Weak Areas.

The Socratic check in Learn is the deliberate opposite: it is never scored and
never moves mastery, because a student will not think out loud if doing it badly
costs them something. Measurement belongs in Quiz, where they know they are being
measured.


## Downloadable study guide contract

This is the highest-priority missing learner-facing capability after the working
core loop.

### First release

- A visible **Download study guide** action from the Study Room.
- One click produces a PDF; do not make the learner choose a format first.
- Use a human filename such as `Biology-Midterm-Study-Guide.pdf`.
- Include room title/test context, current topic ordering, concise grounded
  explanations/key facts, and source references.
- Include retrieval prompts/check-yourself questions so the exported artifact
  supports active study rather than becoming only another rereading surface.
- Respect learner edits and removals.
- If evidence is insufficient, explain that in-product instead of fabricating a
  complete-looking guide.
- Export is read-only with respect to mastery/practice state.
- The file must open cleanly on desktop and mobile and print legibly.

### Not required for the first release

- DOCX/Google Docs export.
- Template/theme selection.
- Teacher/school branding.
- Public share links.
- Collaborative editing.

Those can follow only after the default PDF is demonstrably useful in user
testing.

## Teaching and coaching knowledge-base policy

The Coach's coaching styles, learning traditions, and practice recipes are
defined in the live UI today. Their research grounding lives in
[`../knowledge/teaching-coaching/README.md`](../knowledge/teaching-coaching/README.md).

The knowledge base is derived from the actual code taxonomy rather than from a
separate list of fashionable study techniques. Each current UI option has one
retrieval-friendly Markdown record containing its exact Studigo instruction,
closest real-world paradigm, use cases, cautions, examples, and sources.

Not every current label is a canonical method. The knowledge base must preserve
that distinction:

- named matches such as Explicit Instruction, Deliberate Practice, Socratic
  Questioning, CPA/CRA, and Montessori principles can be mapped directly;
- Studigo composites such as "Studigo default" and "Skill progression" are
  explicitly labeled composite;
- "Teacher's method" is a product/source-fidelity rule, not a teaching
  tradition;
- country-labelled options are not allowed to become cultural stereotypes.
  "Japanese-inspired" is compared against documented Japanese structured
  problem solving, and "Swedish-inspired" is grounded in learner agency and
  critical-inquiry values from Sweden's national curriculum.

Future Coach prompt generation should retrieve from this knowledge base by
`ui_dimension + ui_id` instead of duplicating educational claims in unrelated
prompt strings.
