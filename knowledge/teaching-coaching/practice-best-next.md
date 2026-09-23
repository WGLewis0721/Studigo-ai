---
kb_schema_version: 1
ui_dimension: practice_recipe
ui_id: adaptive
ui_label: Best next practice
alignment_type: composite
match_strength: high
canonical_paradigms:
  - formative_assessment
  - adaptive_instruction
  - mastery_learning
retrieval_tags:
  - diagnosis
  - adaptation
  - next_task
  - formative_assessment
  - mastery
  - worked_example
  - retrieval
  - transfer
best_for:
  - default_practice_selection
  - mixed_learner_state
  - personalized_tutoring
avoid_when:
  - no_evidence_about_learner_state
---

# Best Next Practice → Formative Adaptive Instruction

## Current Studigo definition

**Instruction:** "Choose the smallest next task that reveals understanding. Use retrieval, a worked example, or a transfer problem based on the learner's last response."

## Real-world alignment

This is a product composite rather than one named protocol. Its closest foundations are:

- **formative assessment**: use evidence of learning to adapt teaching;
- **mastery learning**: adjust time/support and corrective work rather than simply advancing everyone on schedule;
- **adaptive instruction**: select the next learning activity from the learner's demonstrated state.

## Definition

The next task is chosen for information value and learning value: it should reveal whether the learner understands the target while being appropriately difficult for their current state.

## Decision sequence

1. Inspect the last response and recent history.
2. Classify the failure/success:
   - missing prerequisite;
   - conceptual misconception;
   - execution error;
   - correct but fragile;
   - independently correct.
3. Choose:
   - worked/model example for missing procedure;
   - guided item for partial understanding;
   - retrieval item for fragile knowledge;
   - focused repetition for execution error;
   - transfer item for independent success.
4. Re-evaluate after the response.

## Best-fit use cases

- Default recipe when the learner's needs are changing.
- Personalized tutoring.
- Weak-area practice.
- Short sessions where every question should provide diagnostic evidence.

## Cautions

- "Adaptive" does not mean randomly changing difficulty.
- Do not choose a harder item simply because the last answer was correct; first ask whether success was independent and transferable.
- A single response can be noisy; use recent evidence when available.
- Avoid hidden learner profiling unrelated to the task.

## Example

A learner answers a fraction-addition problem correctly but says they guessed the common denominator. Instead of increasing difficulty, Studigo gives a quick explanatory retrieval prompt or a similar guided item. After a confident correct explanation, the next item changes denominators and surface context.

## Recommended coaching rules

- Prefer the smallest task that resolves the current uncertainty.
- Make the routing rule explainable.
- Route repeated conceptual errors to teaching, not more blind practice.
- Use independent success before transfer.
- Keep teacher scope fixed while adapting the path.

## Sources

- Black, P., & Wiliam, D. (1998). *Inside the Black Box: Raising Standards Through Classroom Assessment.* https://kappanonline.org/inside-the-black-box-raising-standards-through-classroom-assessment/
- Black, P., & Wiliam, D. (2009). *Developing the theory of formative assessment.* Educational Assessment, Evaluation and Accountability, 21, 5–31. https://doi.org/10.1007/s11092-008-9068-5
- Bloom, B. S. (1968). *Learning for Mastery.* Evaluation Comment, 1(2). ERIC ED053419. https://eric.ed.gov/?id=ED053419
