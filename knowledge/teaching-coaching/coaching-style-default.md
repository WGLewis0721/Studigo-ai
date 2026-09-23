---
kb_schema_version: 1
ui_dimension: coaching_style
ui_id: default
ui_label: Studigo default
alignment_type: composite
match_strength: high
canonical_paradigms:
  - explicit_instruction
  - worked_examples
  - formative_assessment
  - adaptive_instruction
retrieval_tags:
  - explain
  - model
  - guided_practice
  - diagnose
  - feedback
  - next_step
best_for:
  - general_tutoring
  - unknown_learner_state
  - mixed_concept_and_practice
avoid_when:
  - learner_requests_pure_socratic_dialogue
  - learner_needs_specialized_representation_sequence
---

# Studigo Default

## Current Studigo definition

**Description:** Clear explanation, example, guided practice.

**Instruction:** "Use a balanced coach loop: explain briefly, demonstrate one example, ask the learner to try, diagnose the mistake, then assign the next best practice."

## Real-world alignment

This is not one named educational tradition. It is a sensible **composite tutoring loop** built from established elements:

- brief explicit instruction;
- a worked example/model;
- guided learner practice;
- formative diagnosis from the learner's response;
- adaptive selection of the next task.

The strongest real-world analog is a compressed version of Rosenshine-style explicit instruction combined with formative assessment.

## Canonical definition

A model–practice–feedback loop moves responsibility from the coach to the learner while using each learner response as evidence for what should happen next.

## Core sequence

1. State or clarify the target.
2. Explain only what is needed.
3. Model one representative example.
4. Ask the learner to perform a similar task.
5. Diagnose the exact error or missing idea.
6. Give targeted feedback.
7. Choose the next task from that evidence.
8. Reduce support when performance improves.

## Best-fit use cases

- Default tutoring when Studigo does not yet know which specialized method is needed.
- A topic with both conceptual and procedural components.
- Learners who need enough explanation to begin but should reach active practice quickly.
- Short tutoring sessions where the coach must diagnose and teach in the same loop.

## Cautions

- Do not let "balanced" mean vague or generic.
- A worked example is not useful if the learner already knows the procedure.
- The next task must be selected from evidence, not from a fixed script.
- Exposure to an explanation does not constitute mastery.

## Example

**Topic:** Balancing a chemical equation.

Studigo briefly explains conservation of atoms, models one equation, then gives a similar equation. If the learner changes subscripts instead of coefficients, Studigo corrects that specific misconception and gives another item designed to test coefficient use.

## Recommended coaching rules

- Keep explanation shorter than the learner's practice whenever possible.
- Use one representative example before asking for an attempt.
- Base the next action on the learner's response.
- If the learner fails because a prerequisite is missing, teach the prerequisite.
- If the learner succeeds twice with support, reduce support or use transfer.

## Sources

- Rosenshine, B. (2012). *Principles of Instruction: Research-Based Strategies That All Teachers Should Know.* American Educator. https://www.aft.org/ae/spring2012/rosenshine
- Atkinson, R. K., Derry, S. J., Renkl, A., & Wortham, D. (2000). *Learning from Examples: Instructional Principles from the Worked Examples Research.* Review of Educational Research, 70(2), 181–214. https://doi.org/10.3102/00346543070002181
- Black, P., & Wiliam, D. (1998). *Inside the Black Box: Raising Standards Through Classroom Assessment.* Phi Delta Kappan. https://kappanonline.org/inside-the-black-box-raising-standards-through-classroom-assessment/
