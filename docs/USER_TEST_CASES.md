# Next User Test Cases

These are the next product-level user tests now that the core Study Room loop is working in production.

The purpose is not to prove every backend component independently. The purpose is to find where a real learner gets confused, blocked, distrustful, or unable to finish the job they came to do.

## Test protocol

- Run on the production experience or a production-equivalent preview.
- Include desktop and mobile, with at least one iPhone/Safari session because the room-creation 404 was first exposed in real mobile use.
- Do not coach the tester unless they are completely blocked. Record where they expected to click.
- Use ordinary school material: one teacher study guide plus at least one supporting handout/chapter.
- Capture task completion, visible errors, wrong turns, time-to-first-value, and the tester's explanation of what they think Studigo is doing.
- A test is not a pass because the backend returned 200. It passes when the user gets the intended result and understands it.

## P0 acceptance case — Download a study guide

**Goal:** A learner can leave Studigo with a useful study artifact in one click.

**Task:** "You have a test tomorrow. Use this room to download a study guide you can study from or print."

**Pass criteria:**

1. A clear **Download study guide** action is visible from the room without hunting through settings.
2. The default action requires no format-selection dialog.
3. The default export is a clean PDF with a useful filename such as `Biology-Midterm-Study-Guide.pdf`.
4. The PDF opens successfully on desktop and mobile.
5. It contains the current room title/test context, the current topic map, concise source-grounded explanations/key facts, and source references.
6. Student-edited topic wording/order is respected.
7. Removed topics do not reappear.
8. Unsupported facts are not introduced to "fill out" the guide.
9. Empty/insufficient rooms explain what is missing rather than producing a blank or fabricated guide.
10. Download does not mutate mastery, attempts, or the learner's source files.

**Later, not required for first release:** DOCX export, export customization, school-branded templates, shared/public links.

## UT-01 — First visit to first room

**Task:** "Create a room for your next test."

**Pass:** The learner understands what a Study Room is, creates one, and lands in it without a 404, stale screen, or need to refresh.

**Watch for:** unclear room naming, test-date confusion, mobile keyboard/layout issues, repeated taps.

## UT-02 — Upload the teacher study guide

**Task:** "Add the teacher's study guide."

**Pass:** The learner knows where to upload, can identify the file's source type, sees processing state, and knows when Studigo is ready.

**Watch for:** silent failures, duplicate upload confusion, unclear "processing" state.

## UT-03 — Add supporting material

**Task:** "Add the chapter/notes that explain the study guide."

**Pass:** The learner understands that the study guide sets scope while supporting sources add explanation.

**Watch for:** assumption that every uploaded textbook page automatically becomes test scope.

## UT-04 — Ask a question that is in the materials

**Task:** Ask a course-specific question with an answer in the uploaded files.

**Pass:** The answer is useful, source-grounded, and the citation opens the correct file/page or section.

## UT-05 — Ask something not in the materials

**Task:** Ask a plausible course question that is absent from the uploaded sources.

**Pass:** Studigo says the evidence is missing instead of inventing an answer or pretending it came from the teacher's material.

## UT-06 — Learn a weak topic

**Task:** "Teach me the topic I understand least."

**Pass:** Studigo explains the topic at the room's explanation level, uses sources, asks at least one meaningful self-explanation/Socratic check, and does not move mastery from the formative conversation alone.

## UT-07 — Ask for exactly N questions

**Task:** "Give me 10 questions on this unit."

**Pass:** The learner receives 10 distinct, source-grounded questions rather than a description of the requested settings. No answer leakage in stems.

## UT-08 — Complete a mixed quiz

**Task:** Complete a quiz containing supported formats.

**Pass:** Scoring is correct, free text receives appropriate evaluation, feedback is source-grounded, and confidence is captured without an extra confusing step.

## UT-09 — Review a blind spot

**Setup:** Learner answers incorrectly with high confidence.

**Pass:** Weak Areas makes the blind spot visible and higher priority than an ordinary low-confidence miss.

## UT-10 — Use flashcards across sessions

**Task:** Review cards, leave the app, and return later.

**Pass:** Recall state persists, due cards are sensible, edits do not reset earned scheduling history, and cards remain tied to the room.

## UT-11 — Edit the generated topic map

**Task:** Rename one topic, delete one, add one, then cause the source to be reprocessed/re-ingested.

**Pass:** Student edits remain authoritative; deleted topics do not resurrect and edited wording is not overwritten.

## UT-12 — Original-source access

**Task:** From an answer/citation, open the original source and then download it.

**Pass:** Correct private file opens through a signed/authorized path and cannot be accessed as a public permanent URL.

## UT-13 — Failed ingestion and recovery

**Setup:** Use a file that fails parsing or exceeds a supported path.

**Pass:** Failure is visible and actionable. Retrying cannot create duplicate document state or duplicate chunks.

## UT-14 — Returning session

**Task:** Close the browser, return later, and reopen the room.

**Pass:** The correct account/session returns to the same room, with topics, documents, mastery, and practice history intact.

## UT-15 — Mobile room creation regression

**Device:** iPhone/Safari or iOS browser using a normal tab.

**Task:** Create two rooms in succession and open each repeatedly.

**Pass:** No default Next.js 404, no stale cached 404, no reload requirement, and no loss of the newly created room.

## UT-16 — Cross-account isolation

**Setup:** Two users with different rooms.

**Pass:** Neither can read, cite, download, update, or infer the other's room/document data. Server routes must not weaken Postgres RLS ownership boundaries.

## UT-17 — Downloaded-guide trust check

After downloading the generated study guide, ask the learner:

1. "Which parts came from your teacher's material?"
2. "Could you tell where to verify a fact?"
3. "Is there anything here you would not trust on a test?"
4. "What would you add/remove before printing this?"
5. "Would you use this instead of manually making a study guide? Why?"

Pass is not unanimity. The purpose is to identify what makes the artifact trustworthy enough to use.

## Metrics to capture

- Time from entering a new room to first useful output.
- Task completion without intervention.
- Number of visible errors/retries.
- Number of times user navigates to the wrong surface.
- Citation-open success.
- Study-guide download success.
- Whether the user can correctly describe the role of the study guide vs supporting sources.
- Whether the user understands mastery/readiness as evidence from practice rather than activity.
- Post-task confidence/trust in the generated study guide.

## Release-blocking failures

The next beta should not be called ready if any of these are common:

- room creation/opening still produces intermittent 404s;
- upload fails without a useful message;
- a generated/cited answer cannot be traced to the learner's material;
- the app produces unsupported course facts as source-grounded;
- the learner cannot download a usable study guide;
- mobile users cannot complete create → upload → study → download;
- one user can access another user's room or files.
