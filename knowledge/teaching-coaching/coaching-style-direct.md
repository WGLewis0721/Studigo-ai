---
kb_schema_version: 1
ui_dimension: coaching_style
ui_id: direct
ui_label: Direct instruction
alignment_type: canonical_match
match_strength: high
canonical_paradigms:
  - explicit_instruction
retrieval_tags:
  - explicit_instruction
  - worked_example
  - guided_practice
  - correction
  - modeling
  - independent_practice
best_for:
  - novice_skill
  - clear_procedure
  - misconception_correction
  - prerequisite_teaching
avoid_when:
  - learner_already_independent
  - open_ended_reasoning_is_primary_goal
---

# Direct Instruction → Explicit Instruction

## Current Studigo definition

**Description:** Worked examples, correction, repetition.

**Instruction:** "Teach directly. Show worked examples, give one precise correction at a time, and use deliberate repetition until the learner is accurate."

## Real-world alignment

The current behavior closely matches **Explicit Instruction**: small steps, modeling, guided practice, frequent checks, corrective feedback, and movement toward independent practice.

Terminology matters. "Direct instruction" can be used generically, while capital-D **Direct Instruction** can refer to the specific Engelmann instructional system. Studigo's current implementation is better described internally as **Explicit Instruction** because it does not implement a particular Direct Instruction curriculum or script.

## Definition

Explicit Instruction is a structured, interactive method in which the teacher makes the target skill and reasoning visible, demonstrates it, supports learner practice, checks understanding, corrects errors, and fades support as performance improves.

## Core sequence

1. State the objective and success criterion.
2. Confirm prerequisite knowledge.
3. Present material in manageable steps.
4. Model a worked example or think-aloud.
5. Ask the learner to respond frequently.
6. Correct the exact error.
7. Provide guided practice.
8. Fade prompts.
9. Require independent practice and later review.

## Best-fit use cases

- A new procedure or convention.
- The learner lacks a clear model of what successful performance looks like.
- A repeated misconception can be directly corrected.
- Math, grammar, reading strategy, science procedure, or other domains where reasoning can be modeled.

## Cautions

- Direct explanation without learner response is not the full method.
- Do not continue modeling after the learner is independently accurate.
- Do not confuse more repetition with better instruction.
- Open-ended inquiry may require a different method after prerequisites are established.

## Example

**Algebra:** Solve `3x + 5 = 20`.

Studigo models the inverse-operation reasoning, then gives `4x + 6 = 26` with one prompt. The next item removes the prompt. If the learner applies an operation to only one side, feedback addresses preservation of equality specifically.

## Recommended coaching rules

- Model one clear example.
- Ask the learner to do the next step, not merely watch another example.
- Use precise feedback tied to the learner's error.
- Fade support after evidence of success.
- Mix in a transfer item before declaring independence.

## Sources

- Rosenshine, B. (2012). *Principles of Instruction.* American Educator. https://www.aft.org/ae/spring2012/rosenshine
- Hughes, C. A., Morris, J. R., Therrien, W. J., & Benson, S. K. (2017). *Explicit Instruction: Historical and Contemporary Contexts.* Learning Disabilities Research & Practice, 32(3), 140–148. https://doi.org/10.1111/ldrp.12142
- Atkinson, R. K., Derry, S. J., Renkl, A., & Wortham, D. (2000). *Learning from Examples.* https://doi.org/10.3102/00346543070002181
