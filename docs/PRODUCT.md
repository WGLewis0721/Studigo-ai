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

## Initial experience

1. Create account.
2. Create Study Room.
3. Upload study guide plus supporting materials.
4. Studigo analyzes the material and produces a topic map.
5. Student chooses: Ask, Learn, Quiz, Flashcards, Practice Test, Weak Areas.
6. Studigo tracks evidence of mastery over time.
7. Student can open/download the original source at any time.

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
- Flashcards.
- Quizzes/practice tests.
- Topic mastery.
- Basic study plan / cram mode.

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
